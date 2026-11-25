import type { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import {
  handoverItem as handoverItemTable,
  handover as handoverTable,
} from "@/db/schema/handovers";
import { PAGE_SIZE } from "@/features/admin/pagination";
import type { Authz } from "@/features/authz/authz";
import { spDate } from "../../../test/clock";
import { createTestDb, resetDb, type TestDb } from "../../../test/db";
import {
  deactivateSector,
  insertHandover,
  insertHandoverCorrection,
  insertHandoverItem,
  insertItem,
  insertSector,
  insertShift,
  insertUser,
} from "../../../test/fixtures";
import { listHandoverHistory } from "./history";
import type { HistoryFilters } from "./historyFilters";
import { addDays } from "./saoPaulo";

const NOW = spDate("2026-11-21", "14:30");
const OLD = new Date("2026-01-01T12:00:00.000Z");

let client: PGlite;
let db: TestDb;

beforeAll(async () => {
  ({ client, db } = await createTestDb());
});

afterAll(async () => {
  await client.close();
});

beforeEach(async () => {
  await resetDb(client);
});

function filters(overrides: Partial<HistoryFilters> = {}): HistoryFilters {
  return {
    period: "range",
    from: "2026-11-14",
    to: "2026-11-21",
    shiftId: null,
    situation: "all",
    itemId: null,
    ...overrides,
  };
}

function operator(id: string, name: string, sectorId: string): Authz {
  return {
    userId: id,
    name,
    email: `${id}@example.test`,
    role: "operator",
    sectorId,
  };
}

const ADMIN: Authz = {
  userId: "admin-1",
  name: "Admin Teste",
  email: "admin@example.test",
  role: "admin",
  sectorId: null,
};

// ULD com Ana, Bia e o administrador; três turnos antigos (Manhã 06–14,
// Tarde 14–22, Noite 22–06, que atravessa a meia-noite).
async function seed() {
  const uld = await insertSector(db, "ULD");
  const ana = await insertUser(db, {
    role: "operator",
    sectorId: uld.id,
    name: "Ana Teste",
  });
  const bia = await insertUser(db, {
    role: "operator",
    sectorId: uld.id,
    name: "Bia Teste",
  });
  const root = await insertUser(db, {
    role: "admin",
    sectorId: null,
    name: "Admin Teste",
  });
  const manha = await insertShift(db, {
    sectorId: uld.id,
    name: "Manhã",
    startsAt: "06:00",
    endsAt: "14:00",
    createdAt: OLD,
  });
  const tarde = await insertShift(db, {
    sectorId: uld.id,
    name: "Tarde",
    startsAt: "14:00",
    endsAt: "22:00",
    createdAt: OLD,
  });
  const noite = await insertShift(db, {
    sectorId: uld.id,
    name: "Noite",
    startsAt: "22:00",
    endsAt: "06:00",
    createdAt: OLD,
  });
  return {
    uld,
    ana: ana.id,
    bia: bia.id,
    root: root.id,
    manha,
    tarde,
    noite,
    anaAuthz: operator(ana.id, "Ana Teste", uld.id),
  };
}

async function history(
  actor: Authz,
  options: {
    filters?: HistoryFilters;
    sectorId?: string | null;
    page?: number;
    now?: Date;
  } = {},
) {
  return listHandoverHistory(
    db,
    actor,
    {
      filters: options.filters ?? filters(),
      sectorId: options.sectorId ?? null,
      page: options.page ?? 1,
    },
    options.now ?? NOW,
  );
}

describe("listHandoverHistory", () => {
  describe("sem passagem (missing)", () => {
    it("só pares encerrados: às 14:30 de 21/11 só a Manhã já terminou", async () => {
      const { uld, manha } = await seed();

      const page = await history(ADMIN, {
        sectorId: uld.id,
        filters: filters({ from: "2026-11-21", to: "2026-11-21" }),
      });

      expect(page.total).toBe(1);
      expect(page.rows).toEqual([
        {
          key: `${uld.id}:${manha.id}:2026-11-21`,
          operationalDate: "2026-11-21",
          shiftId: manha.id,
          shiftName: "Manhã",
          sectorId: uld.id,
          sectorName: "ULD",
          handoverId: null,
          situation: "missing",
          corrected: false,
          hasDraft: false,
          deliveredByName: null,
          deliveredAt: null,
          confirmedByName: null,
          confirmedAt: null,
        },
      ]);
    });

    it("fim igual a agora conta como encerrado; um minuto antes, não", async () => {
      const { uld } = await seed();
      const range = filters({ from: "2026-11-21", to: "2026-11-21" });

      const atEnd = await history(ADMIN, {
        sectorId: uld.id,
        filters: range,
        now: spDate("2026-11-21", "14:00"),
      });
      const before = await history(ADMIN, {
        sectorId: uld.id,
        filters: range,
        now: spDate("2026-11-21", "13:59"),
      });

      expect(atEnd.total).toBe(1);
      expect(before.total).toBe(0);
    });

    it("turno que atravessa a meia-noite: o dia operacional é o do início e só encerra às 06:00 do dia seguinte", async () => {
      const { uld, noite } = await seed();
      const range = filters({ from: "2026-11-20", to: "2026-11-20" });

      const early = await history(ADMIN, {
        sectorId: uld.id,
        filters: { ...range, shiftId: noite.id },
        now: spDate("2026-11-21", "05:59"),
      });
      const done = await history(ADMIN, {
        sectorId: uld.id,
        filters: { ...range, shiftId: noite.id },
        now: spDate("2026-11-21", "06:00"),
      });

      expect(early.total).toBe(0);
      expect(done.rows.map((row) => row.operationalDate)).toEqual([
        "2026-11-20",
      ]);
    });

    it("turno novo só gera pares a partir do dia (São Paulo) em que foi criado", async () => {
      const { uld } = await seed();
      await insertShift(db, {
        sectorId: uld.id,
        name: "Reforço",
        startsAt: "06:00",
        endsAt: "07:00",
        createdAt: spDate("2026-11-20", "23:30"),
      });

      const page = await history(ADMIN, {
        sectorId: uld.id,
        filters: filters({ from: "2026-11-15", to: "2026-11-21" }),
      });

      const reforco = page.rows.filter((row) => row.shiftName === "Reforço");
      expect(reforco.map((row) => row.operationalDate)).toEqual([
        "2026-11-21",
        "2026-11-20",
      ]);
    });

    it("turno inativo e setor inativo ficam fora; passagem entregue de turno inativo continua aparecendo", async () => {
      const { uld, ana } = await seed();
      const velho = await insertShift(db, {
        sectorId: uld.id,
        name: "Velho",
        startsAt: "06:00",
        endsAt: "07:00",
        active: false,
        createdAt: OLD,
      });
      const fechado = await insertSector(db, "Fechado", { active: false });
      const fechadoTurno = await insertShift(db, {
        sectorId: fechado.id,
        createdAt: OLD,
      });
      await insertHandover(db, {
        sectorId: fechado.id,
        shiftId: fechadoTurno.id,
        operationalDate: "2026-11-20",
        status: "delivered",
        deliveredBy: ana,
      });
      await insertHandover(db, {
        sectorId: uld.id,
        shiftId: velho.id,
        operationalDate: "2026-11-20",
        status: "delivered",
        deliveredBy: ana,
      });

      const page = await history(ADMIN, {
        // Dois dias: o dia 19 não tem passagem de ninguém, então um turno ou
        // setor inativo só apareceria ali como "sem passagem" se o filtro
        // `active` do CTE de pares deixasse de existir.
        filters: filters({ from: "2026-11-19", to: "2026-11-20" }),
      });

      expect(page.rows.map((row) => row.sectorName)).not.toContain("Fechado");
      expect(
        page.rows
          .filter((row) => row.shiftName === "Velho")
          .map((row) => ({
            situation: row.situation,
            operationalDate: row.operationalDate,
          })),
      ).toEqual([{ situation: "awaiting", operationalDate: "2026-11-20" }]);
    });

    it("par com rascunho é missing com hasDraft; rascunho de turno em andamento não aparece", async () => {
      const { uld, manha, tarde } = await seed();
      await insertHandover(db, {
        sectorId: uld.id,
        shiftId: manha.id,
        operationalDate: "2026-11-21",
      });
      await insertHandover(db, {
        sectorId: uld.id,
        shiftId: tarde.id,
        operationalDate: "2026-11-21",
      });

      const page = await history(ADMIN, {
        sectorId: uld.id,
        filters: filters({ from: "2026-11-21", to: "2026-11-21" }),
      });

      expect(page.rows).toHaveLength(1);
      expect(page.rows[0]).toMatchObject({
        shiftName: "Manhã",
        situation: "missing",
        hasDraft: true,
        handoverId: null,
      });
    });

    it("par com passagem entregue ou confirmada não é missing", async () => {
      const { uld, manha, tarde, ana, bia } = await seed();
      await insertHandover(db, {
        sectorId: uld.id,
        shiftId: manha.id,
        operationalDate: "2026-11-20",
        status: "delivered",
        deliveredBy: ana,
      });
      await insertHandover(db, {
        sectorId: uld.id,
        shiftId: tarde.id,
        operationalDate: "2026-11-20",
        status: "confirmed",
        deliveredBy: ana,
        confirmedBy: bia,
      });

      const page = await history(ADMIN, {
        sectorId: uld.id,
        filters: filters({
          from: "2026-11-20",
          to: "2026-11-20",
          situation: "missing",
        }),
      });

      expect(page.rows.map((row) => row.shiftName)).toEqual(["Noite"]);
    });
  });

  describe("situações das passagens reais", () => {
    it("a entregue mais recente do setor é awaiting; a anterior não confirmada é unconfirmed; cada setor tem a sua", async () => {
      const { uld, manha, tarde, ana } = await seed();
      const outro = await insertSector(db, "Outro");
      const outroTurno = await insertShift(db, {
        sectorId: outro.id,
        name: "Único",
        createdAt: OLD,
      });
      await insertHandover(db, {
        sectorId: uld.id,
        shiftId: manha.id,
        operationalDate: "2026-11-20",
        status: "delivered",
        deliveredBy: ana,
        deliveredAt: spDate("2026-11-20", "14:05"),
      });
      await insertHandover(db, {
        sectorId: uld.id,
        shiftId: tarde.id,
        operationalDate: "2026-11-20",
        status: "delivered",
        deliveredBy: ana,
        deliveredAt: spDate("2026-11-20", "22:05"),
      });
      await insertHandover(db, {
        sectorId: outro.id,
        shiftId: outroTurno.id,
        operationalDate: "2026-11-19",
        status: "delivered",
        deliveredBy: ana,
        deliveredAt: spDate("2026-11-19", "14:00"),
      });

      const page = await history(ADMIN, {
        filters: filters({ from: "2026-11-19", to: "2026-11-20" }),
      });

      const bySituation = page.rows
        .filter((row) => row.handoverId !== null)
        .map((row) => [row.sectorName, row.shiftName, row.situation]);
      expect(bySituation).toEqual([
        ["ULD", "Tarde", "awaiting"],
        ["ULD", "Manhã", "unconfirmed"],
        ["Outro", "Único", "awaiting"],
      ]);
    });

    it("uma confirmada mais nova do setor rebaixa a entregue antiga para unconfirmed", async () => {
      const { uld, manha, tarde, ana, bia } = await seed();
      await insertHandover(db, {
        sectorId: uld.id,
        shiftId: manha.id,
        operationalDate: "2026-11-20",
        status: "delivered",
        deliveredBy: ana,
        deliveredAt: spDate("2026-11-20", "14:05"),
      });
      await insertHandover(db, {
        sectorId: uld.id,
        shiftId: tarde.id,
        operationalDate: "2026-11-20",
        status: "confirmed",
        deliveredBy: ana,
        confirmedBy: bia,
        deliveredAt: spDate("2026-11-20", "22:05"),
        confirmedAt: spDate("2026-11-20", "22:20"),
      });

      const page = await history(ADMIN, {
        filters: filters({ from: "2026-11-20", to: "2026-11-20" }),
      });

      const bySituation = page.rows
        .filter((row) => row.handoverId !== null)
        .map((row) => [row.shiftName, row.situation]);
      expect(bySituation).toEqual([
        ["Tarde", "confirmed"],
        ["Manhã", "unconfirmed"],
      ]);
    });

    it("confirmada traz quem entregou, quem confirmou e os horários como Date", async () => {
      const { uld, manha, ana, bia } = await seed();
      const delivered = spDate("2026-11-20", "14:05");
      const confirmed = spDate("2026-11-20", "14:40");
      const passagem = await insertHandover(db, {
        sectorId: uld.id,
        shiftId: manha.id,
        operationalDate: "2026-11-20",
        status: "confirmed",
        deliveredBy: ana,
        confirmedBy: bia,
        deliveredAt: delivered,
        confirmedAt: confirmed,
        shiftNameSnapshot: "Manhã (antigo nome)",
      });

      const page = await history(ADMIN, {
        sectorId: uld.id,
        filters: filters({
          from: "2026-11-20",
          to: "2026-11-20",
          situation: "confirmed",
        }),
      });

      expect(page.rows).toEqual([
        expect.objectContaining({
          handoverId: passagem.id,
          shiftName: "Manhã (antigo nome)",
          situation: "confirmed",
          corrected: false,
          hasDraft: false,
          deliveredByName: "Ana Teste",
          deliveredAt: delivered,
          confirmedByName: "Bia Teste",
          confirmedAt: confirmed,
        }),
      ]);
    });

    it("corrected é um selo à parte e um filtro", async () => {
      const { uld, manha, tarde, ana, bia, root } = await seed();
      const corrigida = await insertHandover(db, {
        sectorId: uld.id,
        shiftId: manha.id,
        operationalDate: "2026-11-20",
        status: "confirmed",
        deliveredBy: ana,
        confirmedBy: bia,
      });
      await insertHandover(db, {
        sectorId: uld.id,
        shiftId: tarde.id,
        operationalDate: "2026-11-20",
        status: "confirmed",
        deliveredBy: ana,
        confirmedBy: bia,
      });
      await insertHandoverCorrection(db, {
        handoverId: corrigida.id,
        field: "occurrences_text",
        correctedBy: root,
      });

      const all = await history(ADMIN, {
        sectorId: uld.id,
        filters: filters({ from: "2026-11-20", to: "2026-11-20" }),
      });
      const onlyCorrected = await history(ADMIN, {
        sectorId: uld.id,
        filters: filters({
          from: "2026-11-20",
          to: "2026-11-20",
          situation: "corrected",
        }),
      });

      expect(
        all.rows
          .filter((row) => row.handoverId !== null)
          .map((row) => [row.shiftName, row.situation, row.corrected]),
      ).toEqual([
        ["Tarde", "confirmed", false],
        ["Manhã", "confirmed", true],
      ]);
      expect(onlyCorrected.rows.map((row) => row.handoverId)).toEqual([
        corrigida.id,
      ]);
    });
  });

  describe("filtros, ordem e paginação", () => {
    it("filtra por turno, situação e período", async () => {
      const { uld, manha, tarde, ana } = await seed();
      await insertHandover(db, {
        sectorId: uld.id,
        shiftId: manha.id,
        operationalDate: "2026-11-20",
        status: "delivered",
        deliveredBy: ana,
        deliveredAt: spDate("2026-11-20", "14:05"),
      });
      await insertHandover(db, {
        sectorId: uld.id,
        shiftId: tarde.id,
        operationalDate: "2026-11-10",
        status: "delivered",
        deliveredBy: ana,
        deliveredAt: spDate("2026-11-10", "22:05"),
      });

      const byShift = await history(ADMIN, {
        sectorId: uld.id,
        filters: filters({ shiftId: manha.id, from: "2026-11-20" }),
      });
      const bySituation = await history(ADMIN, {
        sectorId: uld.id,
        filters: filters({ situation: "awaiting", from: "2026-11-01" }),
      });
      const byPeriod = await history(ADMIN, {
        sectorId: uld.id,
        filters: filters({ from: "2026-11-15", to: "2026-11-20" }),
      });

      expect(new Set(byShift.rows.map((row) => row.shiftId))).toEqual(
        new Set([manha.id]),
      );
      expect(bySituation.rows.map((row) => row.shiftName)).toEqual(["Manhã"]);
      expect(bySituation.rows[0]?.situation).toBe("awaiting");
      expect(
        byPeriod.rows.every((row) => row.operationalDate <= "2026-11-20"),
      ).toBe(true);
      expect(
        byPeriod.rows.some((row) => row.operationalDate < "2026-11-15"),
      ).toBe(false);
    });

    it("ordena por dia desc, fim do turno desc e nome do setor", async () => {
      const { uld, manha, tarde, noite, ana, bia } = await seed();
      for (const turno of [manha, tarde, noite]) {
        await insertHandover(db, {
          sectorId: uld.id,
          shiftId: turno.id,
          operationalDate: "2026-11-19",
          status: "confirmed",
          deliveredBy: ana,
          confirmedBy: bia,
        });
      }

      const page = await history(ADMIN, {
        sectorId: uld.id,
        filters: filters({ from: "2026-11-19", to: "2026-11-20" }),
      });

      expect(
        page.rows.map((row) => `${row.operationalDate} ${row.shiftName}`),
      ).toEqual([
        "2026-11-20 Noite",
        "2026-11-20 Tarde",
        "2026-11-20 Manhã",
        "2026-11-19 Noite",
        "2026-11-19 Tarde",
        "2026-11-19 Manhã",
      ]);
    });

    it("pagina por linhas e clampa a página pedida", async () => {
      const sector = await insertSector(db, "ULD");
      await insertShift(db, {
        sectorId: sector.id,
        name: "Único",
        startsAt: "06:00",
        endsAt: "14:00",
        createdAt: OLD,
      });
      const range = filters({
        from: addDays("2026-11-21", -59),
        to: "2026-11-21",
      });

      const first = await history(ADMIN, {
        sectorId: sector.id,
        filters: range,
      });
      const second = await history(ADMIN, {
        sectorId: sector.id,
        filters: range,
        page: 2,
      });
      const beyond = await history(ADMIN, {
        sectorId: sector.id,
        filters: range,
        page: 99,
      });
      const zero = await history(ADMIN, {
        sectorId: sector.id,
        filters: range,
        page: 0,
      });

      expect(PAGE_SIZE).toBe(50);
      expect(first).toMatchObject({ total: 60, page: 1, pageCount: 2 });
      expect(first.rows).toHaveLength(50);
      expect(first.rows[0]?.operationalDate).toBe("2026-11-21");
      expect(second.rows).toHaveLength(10);
      expect(second.rows.at(-1)?.operationalDate).toBe("2026-09-23");
      expect(beyond.page).toBe(2);
      expect(beyond.rows).toEqual(second.rows);
      expect(zero.page).toBe(1);
    });

    it("sem nada no período: página vazia com pageCount 1", async () => {
      const { uld } = await seed();

      const page = await history(ADMIN, {
        sectorId: uld.id,
        filters: filters({ from: "2026-11-22", to: "2026-11-25" }),
      });

      expect(page).toEqual({
        rows: [],
        total: 0,
        page: 1,
        pageCount: 1,
        pageSize: 50,
      });
    });
  });

  describe("escopo", () => {
    it("operador só vê o próprio setor, mesmo pedindo outro ou todos", async () => {
      const { uld, anaAuthz } = await seed();
      const outro = await insertSector(db, "Outro");
      await insertShift(db, { sectorId: outro.id, createdAt: OLD });
      const range = filters({ from: "2026-11-20", to: "2026-11-20" });

      const own = await history(anaAuthz, { filters: range, sectorId: null });
      const foreign = await history(anaAuthz, {
        filters: range,
        sectorId: outro.id,
      });

      expect(own.total).toBe(3);
      expect(new Set(own.rows.map((row) => row.sectorId))).toEqual(
        new Set([uld.id]),
      );
      expect(foreign).toEqual(own);
    });

    it("admin vê todos os setores ativos; com sectorId filtra um", async () => {
      const { uld } = await seed();
      const outro = await insertSector(db, "Outro");
      await insertShift(db, { sectorId: outro.id, createdAt: OLD });
      const range = filters({ from: "2026-11-20", to: "2026-11-20" });

      const all = await history(ADMIN, { filters: range });
      const one = await history(ADMIN, { filters: range, sectorId: uld.id });

      expect(all.total).toBe(4);
      expect(one.total).toBe(3);
    });

    it("operador sem setor (estado inválido) não vê nada", async () => {
      await seed();

      const page = await history({
        ...ADMIN,
        role: "operator",
        sectorId: null,
      });

      expect(page.total).toBe(0);
    });
  });
});

// Situações "entregues" e "esperadas" e o filtro de item (D-F5-3, C-1): os
// números do dashboard abrem estas listas, então o `total` tem de contar
// exatamente o que o número diz.
describe("listHandoverHistory: situações entregues e esperadas, e item", () => {
  const SEVEN = { from: "2026-11-19", to: "2026-11-21" };

  // Hoje (21/11, 14:30): os pares encerrados do período são Manhã, Tarde e
  // Noite de 19 e 20/11 e a Manhã de 21/11 (7). Nove passagens/linhas:
  //   a  19/11 Manhã   confirmada                       (par encerrado)
  //   b  20/11 Manhã   entregue, não é a mais recente   (par encerrado)
  //   c  21/11 Tarde   entregue ANTES de o turno acabar (aguardando; fora de "esperadas")
  //   e  20/11 Antigo  turno desativado                 (fora de "esperadas")
  //   f  20/11 Novo    dia anterior à criação do turno  (fora de "esperadas")
  async function seedWorld() {
    const base = await seed();
    const antigo = await insertShift(db, {
      sectorId: base.uld.id,
      name: "Antigo",
      startsAt: "10:00",
      endsAt: "12:00",
      active: false,
      createdAt: OLD,
    });
    const novo = await insertShift(db, {
      sectorId: base.uld.id,
      name: "Novo",
      startsAt: "15:00",
      endsAt: "18:00",
      createdAt: spDate("2026-11-21", "08:00"),
    });
    const a = await insertHandover(db, {
      sectorId: base.uld.id,
      shiftId: base.manha.id,
      operationalDate: "2026-11-19",
      status: "confirmed",
      deliveredBy: base.ana,
      confirmedBy: base.bia,
      deliveredAt: new Date("2026-11-19T17:00:00Z"),
    });
    const b = await insertHandover(db, {
      sectorId: base.uld.id,
      shiftId: base.manha.id,
      operationalDate: "2026-11-20",
      status: "delivered",
      deliveredBy: base.ana,
      deliveredAt: new Date("2026-11-20T17:00:00Z"),
    });
    const c = await insertHandover(db, {
      sectorId: base.uld.id,
      shiftId: base.tarde.id,
      operationalDate: "2026-11-21",
      status: "delivered",
      deliveredBy: base.bia,
      deliveredAt: new Date("2026-11-21T17:10:00Z"),
    });
    const e = await insertHandover(db, {
      sectorId: base.uld.id,
      shiftId: antigo.id,
      operationalDate: "2026-11-20",
      status: "delivered",
      deliveredBy: base.ana,
      deliveredAt: new Date("2026-11-20T18:00:00Z"),
    });
    const f = await insertHandover(db, {
      sectorId: base.uld.id,
      shiftId: novo.id,
      operationalDate: "2026-11-20",
      status: "delivered",
      deliveredBy: base.bia,
      deliveredAt: new Date("2026-11-20T19:00:00Z"),
    });
    return { ...base, antigo, novo, a, b, c, e, f };
  }

  const keysOf = (page: {
    rows: readonly { shiftId: string; operationalDate: string }[];
  }) => page.rows.map((row) => `${row.operationalDate}|${row.shiftId}`).sort();

  it("entregues = confirmada + aguardando + não confirmada, sem 'sem passagem'", async () => {
    const world = await seedWorld();
    const total = async (situation: HistoryFilters["situation"]) =>
      (
        await history(ADMIN, {
          sectorId: world.uld.id,
          filters: filters({ ...SEVEN, situation }),
        })
      ).total;

    expect(await total("delivered")).toBe(5);
    expect(await total("confirmed")).toBe(1);
    expect(await total("awaiting")).toBe(1);
    expect(await total("unconfirmed")).toBe(3);
    expect(await total("delivered")).toBe(
      (await total("confirmed")) +
        (await total("awaiting")) +
        (await total("unconfirmed")),
    );
    expect(await total("missing")).toBe(5);
    expect(await total("all")).toBe(10);

    const page = await history(ADMIN, {
      sectorId: world.uld.id,
      filters: filters({ ...SEVEN, situation: "delivered" }),
    });
    expect(page.rows.every((row) => row.situation !== "missing")).toBe(true);
    expect(page.rows.map((row) => row.handoverId).sort()).toEqual(
      [world.a.id, world.b.id, world.c.id, world.e.id, world.f.id].sort(),
    );
  });

  it("esperadas = os pares encerrados: a entregue de cada um ou 'sem passagem'", async () => {
    const world = await seedWorld();
    const { manha, tarde, noite } = world;

    const page = await history(ADMIN, {
      sectorId: world.uld.id,
      filters: filters({ ...SEVEN, situation: "expected" }),
    });

    const pairs = [
      ["2026-11-19", manha.id],
      ["2026-11-19", tarde.id],
      ["2026-11-19", noite.id],
      ["2026-11-20", manha.id],
      ["2026-11-20", tarde.id],
      ["2026-11-20", noite.id],
      ["2026-11-21", manha.id],
    ].map(([day, shift]) => `${day}|${shift}`);
    expect(keysOf(page)).toEqual([...pairs].sort());
    expect(page.total).toBe(7);
    // A antecipada (c), a do turno desativado (e) e a anterior à criação (f) ficam fora.
    const ids = page.rows.map((row) => row.handoverId);
    for (const out of [world.c.id, world.e.id, world.f.id]) {
      expect(ids).not.toContain(out);
    }
    // As entregues dos pares (a, b) entram, e as 5 sem passagem também.
    expect(ids).toContain(world.a.id);
    expect(ids).toContain(world.b.id);
    expect(page.rows.filter((row) => row.situation === "missing")).toHaveLength(
      5,
    );
  });

  it("esperadas conta os mesmos pares encerrados que a 'sem passagem' mais as entregues deles", async () => {
    const world = await seedWorld();
    const total = async (situation: HistoryFilters["situation"]) =>
      (
        await history(ADMIN, {
          sectorId: world.uld.id,
          filters: filters({ ...SEVEN, situation }),
        })
      ).total;

    // esperadas = sem passagem (5) + entregues de pares encerrados (a, b).
    expect(await total("expected")).toBe((await total("missing")) + 2);
  });

  it("fim do turno == agora entra; um minuto antes não", async () => {
    const { uld } = await seed();
    const day = { from: "2026-11-21", to: "2026-11-21" };
    const expectedAt = async (now: Date) =>
      (
        await history(ADMIN, {
          sectorId: uld.id,
          now,
          filters: filters({ ...day, situation: "expected" }),
        })
      ).total;

    expect(await expectedAt(spDate("2026-11-21", "13:59"))).toBe(0);
    expect(await expectedAt(spDate("2026-11-21", "14:00"))).toBe(1);
    expect(await expectedAt(spDate("2026-11-21", "14:01"))).toBe(1);
    expect(await expectedAt(spDate("2026-11-21", "22:00"))).toBe(2);
  });

  it("a Noite que atravessa a meia-noite só vira esperada quando acaba, no dia seguinte", async () => {
    const { uld } = await seed();
    const day = { from: "2026-11-20", to: "2026-11-20" };
    const expectedAt = async (now: Date) =>
      (
        await history(ADMIN, {
          sectorId: uld.id,
          now,
          filters: filters({ ...day, situation: "expected" }),
        })
      ).total;

    // 20/11: Manhã (14:00) e Tarde (22:00) acabam no dia; a Noite só às 06:00 de 21/11.
    expect(await expectedAt(spDate("2026-11-20", "23:59"))).toBe(2);
    expect(await expectedAt(spDate("2026-11-21", "05:59"))).toBe(2);
    expect(await expectedAt(spDate("2026-11-21", "06:00"))).toBe(3);
  });

  it("a coluna expected não muda as linhas nem a ordem das outras situações", async () => {
    const world = await seedWorld();
    const all = await history(ADMIN, {
      sectorId: world.uld.id,
      filters: filters({ ...SEVEN }),
    });

    expect(all.total).toBe(10);
    const dates = all.rows.map((row) => row.operationalDate);
    expect(dates).toEqual([...dates].sort().reverse());
  });

  it("entregues e esperadas respeitam o escopo do operador, o 'todos' do admin e o setor inativo", async () => {
    const world = await seedWorld();
    const outro = await insertSector(db, "Outro");
    const shift = await insertShift(db, { sectorId: outro.id, createdAt: OLD });
    const ana = await insertUser(db, { role: "operator", sectorId: outro.id });
    await insertHandover(db, {
      sectorId: outro.id,
      shiftId: shift.id,
      operationalDate: "2026-11-20",
      status: "delivered",
      deliveredBy: ana.id,
      deliveredAt: new Date("2026-11-20T17:00:00Z"),
    });

    // O operador da ULD pede o setor "Outro" e continua vendo só a ULD.
    const forOperator = await history(world.anaAuthz, {
      sectorId: outro.id,
      filters: filters({ ...SEVEN, situation: "delivered" }),
    });
    expect(forOperator.total).toBe(5);

    const everything = await history(ADMIN, {
      filters: filters({ ...SEVEN, situation: "delivered" }),
    });
    expect(everything.total).toBe(6);

    await deactivateSector(db, outro.id);
    const afterDeactivation = await history(ADMIN, {
      filters: filters({ ...SEVEN, situation: "delivered" }),
    });
    expect(afterDeactivation.total).toBe(5);
  });

  describe("item (C-1)", () => {
    async function seedItems() {
      const world = await seedWorld();
      const item = (name: string, active = true) =>
        insertItem(db, {
          sectorId: world.uld.id,
          name,
          unit: "peça",
          kind: "control",
          active,
        });
      const rede = await item("Rede de proteção");
      const cinta = await item("Cinta");
      const antiga = await item("Cinta antiga", false);
      const nova = await item("Item novo");
      const line = (handoverId: string, itemId: string, quantity: number) =>
        insertHandoverItem(db, {
          handoverId,
          itemId,
          quantity,
          snapshot: true,
        });
      await line(world.a.id, rede.id, 4);
      await line(world.a.id, cinta.id, 2);
      await line(world.b.id, cinta.id, 3);
      await line(world.b.id, antiga.id, 1);
      await line(world.c.id, rede.id, 5);
      await line(world.c.id, nova.id, 6);
      return { ...world, rede, cinta, antiga, nova };
    }

    const delivered = (
      itemId: string | null,
      extra: Partial<HistoryFilters> = {},
    ) => filters({ ...SEVEN, situation: "delivered", itemId, ...extra });

    it("só as passagens que têm linha do item, inclusive item desativado e item criado no meio do período", async () => {
      const w = await seedItems();
      const idsFor = async (itemId: string) =>
        (
          await history(ADMIN, {
            sectorId: w.uld.id,
            filters: delivered(itemId),
          })
        ).rows
          .map((row) => row.handoverId)
          .sort();

      expect(await idsFor(w.rede.id)).toEqual([w.a.id, w.c.id].sort());
      expect(await idsFor(w.cinta.id)).toEqual([w.a.id, w.b.id].sort());
      expect(await idsFor(w.antiga.id)).toEqual([w.b.id]);
      expect(await idsFor(w.nova.id)).toEqual([w.c.id]);
    });

    it("o total é o número de linhas handover_item do item nas entregues do período (JS sobre as linhas cruas)", async () => {
      const w = await seedItems();
      const handovers = await db.select().from(handoverTable);
      const lines = await db.select().from(handoverItemTable);
      const deliveredIds = new Set(
        handovers
          .filter(
            (row) =>
              row.sectorId === w.uld.id &&
              (row.status === "delivered" || row.status === "confirmed") &&
              row.operationalDate >= SEVEN.from &&
              row.operationalDate <= SEVEN.to,
          )
          .map((row) => row.id),
      );

      for (const target of [w.rede, w.cinta, w.antiga, w.nova]) {
        const expected = lines.filter(
          (line) =>
            line.itemId === target.id && deliveredIds.has(line.handoverId),
        ).length;
        const page = await history(ADMIN, {
          sectorId: w.uld.id,
          filters: delivered(target.id),
        });
        expect(page.total, target.name).toBe(expected);
      }
    });

    it("a linha 'sem passagem' nunca tem item: com item, ela sai até em 'todas'", async () => {
      const w = await seedItems();

      const page = await history(ADMIN, {
        sectorId: w.uld.id,
        filters: filters({ ...SEVEN, situation: "all", itemId: w.cinta.id }),
      });

      expect(page.total).toBe(2);
      expect(page.rows.every((row) => row.situation !== "missing")).toBe(true);
    });

    it("combina com turno e com a situação", async () => {
      const w = await seedItems();

      const byShift = await history(ADMIN, {
        sectorId: w.uld.id,
        filters: delivered(w.rede.id, { shiftId: w.manha.id }),
      });
      expect(byShift.rows.map((row) => row.handoverId)).toEqual([w.a.id]);

      const confirmed = await history(ADMIN, {
        sectorId: w.uld.id,
        filters: filters({
          ...SEVEN,
          situation: "confirmed",
          itemId: w.cinta.id,
        }),
      });
      expect(confirmed.rows.map((row) => row.handoverId)).toEqual([w.a.id]);

      const awaiting = await history(ADMIN, {
        sectorId: w.uld.id,
        filters: filters({
          ...SEVEN,
          situation: "awaiting",
          itemId: w.cinta.id,
        }),
      });
      expect(awaiting.total).toBe(0);
    });

    it("item de outro setor e item inexistente: nenhuma linha, nada vaza", async () => {
      const w = await seedItems();
      const outro = await insertSector(db, "Outro");
      const alheio = await insertItem(db, {
        sectorId: outro.id,
        name: "Alheio",
      });

      const foreign = await history(ADMIN, {
        sectorId: w.uld.id,
        filters: delivered(alheio.id),
      });
      expect(foreign.total).toBe(0);
      expect(foreign.rows).toEqual([]);

      const missing = await history(ADMIN, {
        sectorId: w.uld.id,
        filters: delivered("00000000-0000-4000-8000-000000000000"),
      });
      expect(missing.total).toBe(0);
    });

    it("sem item (null) a lista é a de sempre", async () => {
      const w = await seedItems();

      const page = await history(ADMIN, {
        sectorId: w.uld.id,
        filters: delivered(null),
      });

      expect(page.total).toBe(5);
    });
  });
});
