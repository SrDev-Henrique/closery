import type { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { PAGE_SIZE } from "@/features/admin/pagination";
import type { Authz } from "@/features/authz/authz";
import { spDate } from "../../../test/clock";
import { createTestDb, resetDb, type TestDb } from "../../../test/db";
import {
  insertHandover,
  insertHandoverCorrection,
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
        filters: filters({ from: "2026-11-20", to: "2026-11-20" }),
      });

      expect(page.rows.map((row) => row.sectorName)).not.toContain("Fechado");
      expect(
        page.rows.filter((row) => row.shiftName === "Velho"),
      ).toMatchObject([{ situation: "awaiting" }]);
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
