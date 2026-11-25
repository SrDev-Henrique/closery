import type { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { PAGE_SIZE } from "@/features/admin/pagination";
import type { Authz } from "@/features/authz/authz";
import { authzOf } from "../../../test/authz";
import { spDate } from "../../../test/clock";
import { createTestDb, resetDb, type TestDb } from "../../../test/db";
import {
  insertDestination,
  insertItem,
  insertRequest,
  insertRequestComment,
  insertRequestEvent,
  insertRequestItem,
  insertSector,
  insertUser,
} from "../../../test/fixtures";
import { getRequestGroups, listRequestTable } from "./lists";
import {
  defaultRequestFilters,
  parseRequestFilters,
  type RequestFilters,
} from "./requestFilters";

// 2026-11-21 12:00 em São Paulo = 15:00Z.
const NOW = spDate("2026-11-21", "12:00");
const TODAY = "2026-11-21";
const HOUR = 3_600_000;
const DAY = 24 * HOUR;
const ago = (ms: number) => new Date(NOW.getTime() - ms);

let client: PGlite;
let db: TestDb;

type World = {
  sector: { id: string; name: string };
  other: { id: string; name: string };
  ana: { id: string };
  bia: { id: string };
  doca: { id: string; name: string };
  operator: Authz;
  admin: Authz;
};
let w: World;

beforeAll(async () => {
  ({ client, db } = await createTestDb());
});

afterAll(async () => {
  await client.close();
});

beforeEach(async () => {
  await resetDb(client);
  const sector = await insertSector(db, "Almoxarifado Teste");
  const other = await insertSector(db, "Outro Setor");
  const ana = await insertUser(db, {
    role: "operator",
    sectorId: sector.id,
    name: "Ana Teste",
  });
  const bia = await insertUser(db, {
    role: "operator",
    sectorId: sector.id,
    name: "Bia Teste",
  });
  const doca = await insertDestination(db, { name: "Doca 3" });
  w = {
    sector,
    other,
    ana,
    bia,
    doca,
    operator: authzOf({
      role: "operator",
      userId: ana.id,
      sectorId: sector.id,
    }),
    admin: authzOf({ role: "admin" }),
  };
});

function filters(overrides: Partial<RequestFilters> = {}): RequestFilters {
  return { ...defaultRequestFilters(), ...overrides };
}

function groups(
  input: Partial<RequestFilters> = {},
  actor: Authz = w.operator,
  sectorId: string | null = null,
) {
  return getRequestGroups(
    db,
    actor,
    { sectorId, filters: filters(input) },
    NOW,
  );
}

async function seed(
  overrides: Partial<Parameters<typeof insertRequest>[1]> = {},
) {
  return insertRequest(db, {
    sectorId: w.sector.id,
    createdBy: w.ana.id,
    destinationId: w.doca.id,
    createdAt: ago(HOUR),
    ...overrides,
  });
}

describe("getRequestGroups", () => {
  it("devolve os 4 grupos, vazios, sem solicitações", async () => {
    const result = await groups();

    expect(Object.keys(result)).toEqual([
      "requested",
      "in_transit",
      "delivered",
      "cancelled",
    ]);
    for (const group of Object.values(result)) {
      expect(group.total).toBe(0);
      expect(group.rows).toEqual([]);
      expect(group.limit).toBe(20);
    }
  });

  it("total vem do SQL e é maior que as linhas; ?mais_ traz mais", async () => {
    for (let i = 0; i < 45; i++) {
      await seed({ description: `Pedido ${i}`, events: false });
    }

    const first = await groups();
    expect(first.requested.total).toBe(45);
    expect(first.requested.rows).toHaveLength(20);
    expect(first.requested.limit).toBe(20);

    const more = await groups({
      limits: { ...defaultRequestFilters().limits, requested: 40 },
    });
    expect(more.requested.total).toBe(45);
    expect(more.requested.rows).toHaveLength(40);
    expect(more.requested.limit).toBe(40);
  });

  it("separa por status e preenche cada linha (destino, setor, quem criou, contagens, dias)", async () => {
    const stock = await insertItem(db, {
      sectorId: w.sector.id,
      kind: "stock",
      name: "Luva",
      unit: "par",
    });
    const stock2 = await insertItem(db, {
      sectorId: w.sector.id,
      kind: "stock",
      name: "Fita",
    });
    const mine = await seed({
      description: "Luvas para a doca",
      createdAt: ago(5 * DAY),
    });
    await insertRequestItem(db, {
      requestId: mine.id,
      itemId: stock.id,
      quantity: 12,
    });
    await insertRequestItem(db, { requestId: mine.id, itemId: stock2.id });
    await insertRequestComment(db, { requestId: mine.id, authorId: w.bia.id });
    await insertRequestComment(db, { requestId: mine.id, authorId: w.bia.id });
    await insertRequestComment(db, {
      requestId: mine.id,
      authorId: w.bia.id,
      deletedAt: ago(HOUR),
    });
    await seed({
      destinationId: undefined,
      destinationOther: "Cliente avulso",
      status: "in_transit",
      createdAt: ago(2 * DAY),
      statusChangedAt: ago(DAY),
    });

    const result = await groups();

    expect(result.requested.rows).toHaveLength(1);
    expect(result.requested.rows[0]).toEqual({
      id: mine.id,
      sectorId: w.sector.id,
      sectorName: "Almoxarifado Teste",
      description: "Luvas para a doca",
      destinationName: "Doca 3",
      destinationIsOther: false,
      status: "requested",
      createdByName: "Ana Teste",
      createdAt: ago(5 * DAY),
      statusChangedAt: ago(5 * DAY),
      daysInStatus: 5,
      stale: true,
      itemCount: 2,
      commentCount: 2,
    });
    expect(result.in_transit.rows[0]).toMatchObject({
      destinationName: "Cliente avulso",
      destinationIsOther: true,
      daysInStatus: 1,
      stale: false,
      itemCount: 0,
      commentCount: 0,
    });
  });

  it("abertas: a mais antiga no status primeiro (desempate por id); fechadas: a mais recente primeiro", async () => {
    const olderOpen = await seed({
      description: "antiga",
      createdAt: ago(3 * DAY),
    });
    const newerOpen = await seed({ description: "nova", createdAt: ago(HOUR) });
    const tieA = await seed({
      description: "empate A",
      createdAt: ago(2 * DAY),
    });
    const tieB = await seed({
      description: "empate B",
      createdAt: ago(2 * DAY),
    });
    const oldDone = await seed({
      status: "delivered",
      createdAt: ago(5 * DAY),
      statusChangedAt: ago(4 * DAY),
    });
    const newDone = await seed({
      status: "delivered",
      createdAt: ago(5 * DAY),
      statusChangedAt: ago(DAY),
    });

    const result = await groups();

    const tieIds = [tieA.id, tieB.id].sort();
    expect(result.requested.rows.map((row) => row.id)).toEqual([
      olderOpen.id,
      ...tieIds,
      newerOpen.id,
    ]);
    expect(result.delivered.rows.map((row) => row.id)).toEqual([
      newDone.id,
      oldDone.id,
    ]);
  });

  it("Entregue e Cancelada só dos últimos 30 dias em 'Todo o período'; a contagem também", async () => {
    await seed({
      status: "delivered",
      createdAt: ago(40 * DAY),
      statusChangedAt: ago(31 * DAY),
      description: "entregue há 31 dias",
    });
    const edge = await seed({
      status: "delivered",
      createdAt: ago(40 * DAY),
      statusChangedAt: ago(30 * DAY),
      description: "entregue há 30 dias",
    });
    await seed({
      status: "cancelled",
      createdAt: ago(40 * DAY),
      statusChangedAt: ago(31 * DAY),
    });
    const open = await seed({
      createdAt: ago(60 * DAY),
      description: "aberta antiga",
    });

    const result = await groups();

    expect(result.delivered.total).toBe(1);
    expect(result.delivered.rows.map((row) => row.id)).toEqual([edge.id]);
    expect(result.cancelled.total).toBe(0);
    // Abertas nunca saem pela janela.
    expect(result.requested.rows.map((row) => row.id)).toEqual([open.id]);
  });

  it("com período escolhido a janela de 30 dias some", async () => {
    const old = await seed({
      status: "delivered",
      createdAt: ago(40 * DAY),
      statusChangedAt: ago(35 * DAY),
    });

    const result = await groups(
      parseRequestFilters(
        { periodo: "intervalo", de: "2026-09-01", ate: TODAY },
        TODAY,
      ),
    );

    expect(result.delivered.rows.map((row) => row.id)).toEqual([old.id]);
    expect(result.delivered.total).toBe(1);
  });

  it("filtra por destino da lista e por 'Outro'", async () => {
    const other = await insertDestination(db, { name: "Doca 9" });
    const listed = await seed({ description: "da lista" });
    await seed({ destinationId: other.id, description: "de outra doca" });
    const free = await seed({
      destinationId: undefined,
      destinationOther: "Fora da lista",
      description: "avulsa",
    });

    const byDestination = await groups({ destination: w.doca.id });
    expect(byDestination.requested.rows.map((row) => row.id)).toEqual([
      listed.id,
    ]);
    expect(byDestination.requested.total).toBe(1);

    const byOther = await groups({ destination: "outro" });
    expect(byOther.requested.rows.map((row) => row.id)).toEqual([free.id]);
  });

  it("período 7 dias vale pelo dia de São Paulo: 02:59Z é o dia anterior, 03:00Z é o dia", async () => {
    // Últimos 7 dias em 2026-11-21 = de 2026-11-15 a 2026-11-21.
    await seed({
      description: "antes",
      createdAt: new Date("2026-11-15T02:59:00Z"),
    });
    const inside = await seed({
      description: "dentro",
      createdAt: new Date("2026-11-15T03:00:00Z"),
    });

    const result = await groups(parseRequestFilters({ periodo: "7" }, TODAY));

    expect(result.requested.rows.map((row) => row.id)).toEqual([inside.id]);
    expect(result.requested.total).toBe(1);
  });

  it("período 30 dias e intervalo (inclusive nas duas pontas)", async () => {
    const edgeStart = await seed({
      createdAt: new Date("2026-10-23T03:00:00Z"),
    });
    await seed({ createdAt: new Date("2026-10-23T02:59:00Z") });

    const thirty = await groups(parseRequestFilters({ periodo: "30" }, TODAY));
    expect(thirty.requested.rows.map((row) => row.id)).toEqual([edgeStart.id]);

    const range = await groups(
      parseRequestFilters(
        { periodo: "intervalo", de: "2026-10-23", ate: "2026-10-23" },
        TODAY,
      ),
    );
    expect(range.requested.rows.map((row) => row.id)).toEqual([edgeStart.id]);
  });

  it("filtra por quem criou", async () => {
    await seed({ description: "da Ana" });
    const byBia = await seed({ createdBy: w.bia.id, description: "da Bia" });

    const result = await groups({ creatorId: w.bia.id });

    expect(result.requested.rows.map((row) => row.id)).toEqual([byBia.id]);
  });

  describe("busca", () => {
    it("acha sem diferença de acento nem de caixa", async () => {
      const found = await seed({ description: "Separação Rápida de luvas" });
      await seed({ description: "Outra coisa" });

      for (const term of ["separacao rapida", "SEPARAÇÃO", "rápida", "LUVAS"]) {
        const result = await groups({ search: term });
        expect(
          result.requested.rows.map((row) => row.id),
          term,
        ).toEqual([found.id]);
      }
    });

    it("acha pelo nome do destino e pelo texto do 'Outro'", async () => {
      const byName = await seed({ description: "primeira" });
      const byOther = await seed({
        destinationId: undefined,
        destinationOther: "Armazém Ñandú",
        description: "segunda",
      });

      const name = await groups({ search: "doca" });
      expect(name.requested.rows.map((row) => row.id)).toEqual([byName.id]);

      const other = await groups({ search: "nandu" });
      expect(other.requested.rows.map((row) => row.id)).toEqual([byOther.id]);
    });

    it("%, _ e \\ valem como texto, nunca como coringa", async () => {
      const percent = await seed({ description: "desconto de 50% hoje" });
      const underscore = await seed({ description: "item_novo" });
      const slash = await seed({ description: "caminho a\\b" });
      await seed({ description: "desconto de 50 hoje" });
      await seed({ description: "itemXnovo" });
      await seed({ description: "caminho aXb" });

      expect(
        (await groups({ search: "50%" })).requested.rows.map((row) => row.id),
      ).toEqual([percent.id]);
      expect(
        (await groups({ search: "m_n" })).requested.rows.map((row) => row.id),
      ).toEqual([underscore.id]);
      expect(
        (await groups({ search: "a\\b" })).requested.rows.map((row) => row.id),
      ).toEqual([slash.id]);
      expect((await groups({ search: "%" })).requested.total).toBe(1);
    });

    it("busca sem resultado devolve grupos vazios", async () => {
      await seed({ description: "luvas" });

      const result = await groups({ search: "inexistente" });

      expect(result.requested.total).toBe(0);
      expect(result.requested.rows).toEqual([]);
    });
  });

  it("operador fica preso ao próprio setor: o sectorId de outro setor é ignorado", async () => {
    const mine = await seed({ description: "minha" });
    await insertRequest(db, {
      sectorId: w.other.id,
      createdBy: w.ana.id,
      destinationOther: "Em outro setor",
      createdAt: ago(HOUR),
    });

    const result = await groups({}, w.operator, w.other.id);

    expect(result.requested.rows.map((row) => row.id)).toEqual([mine.id]);
    expect(result.requested.total).toBe(1);
  });

  it("operador sem setor (estado que o toAuthz já recusa) não vê nada", async () => {
    await seed();
    const ghost: Authz = { ...w.operator, sectorId: null };

    const result = await groups({}, ghost);

    expect(result.requested.total).toBe(0);
  });

  it("admin vê todos os setores (com o nome do setor) ou só o escolhido", async () => {
    const mine = await seed({ description: "do almoxarifado" });
    const theirs = await insertRequest(db, {
      sectorId: w.other.id,
      createdBy: w.ana.id,
      destinationOther: "Outro lugar",
      description: "do outro setor",
      createdAt: ago(2 * HOUR),
    });

    const all = await groups({}, w.admin, null);
    expect(all.requested.total).toBe(2);
    expect(
      all.requested.rows.map((row) => [row.id, row.sectorName]).sort(),
    ).toEqual(
      [
        [mine.id, "Almoxarifado Teste"],
        [theirs.id, "Outro Setor"],
      ].sort(),
    );

    const one = await groups({}, w.admin, w.other.id);
    expect(one.requested.rows.map((row) => row.id)).toEqual([theirs.id]);
  });

  it("setor inativo fica fora (padrão P26)", async () => {
    const inactive = await insertSector(db, "Setor Inativo", {
      active: false,
    });
    await insertRequest(db, {
      sectorId: inactive.id,
      createdBy: w.ana.id,
      destinationOther: "Qualquer",
      createdAt: ago(HOUR),
    });
    await seed();

    const all = await groups({}, w.admin, null);
    expect(all.requested.total).toBe(1);

    const direct = await groups({}, w.admin, inactive.id);
    expect(direct.requested.total).toBe(0);
  });

  it("'parada' vale com o relógio injetado: 72 h exatas não, 72 h + 1 ms sim; entregue nunca", async () => {
    const exact = await seed({
      createdAt: ago(72 * HOUR),
      description: "exata",
    });
    const over = await seed({
      createdAt: ago(72 * HOUR + 1),
      description: "passou",
    });
    const done = await seed({
      status: "delivered",
      createdAt: ago(10 * DAY),
      statusChangedAt: ago(9 * DAY),
    });

    const result = await groups();

    const byId = new Map(
      [...result.requested.rows, ...result.delivered.rows].map((row) => [
        row.id,
        row,
      ]),
    );
    expect(byId.get(exact.id)).toMatchObject({ stale: false, daysInStatus: 3 });
    expect(byId.get(over.id)).toMatchObject({ stale: true, daysInStatus: 3 });
    expect(byId.get(done.id)).toMatchObject({ stale: false, daysInStatus: 9 });
  });
});

describe("listRequestTable", () => {
  it("todos os status, sem a janela de 30 dias, do mais novo para o mais antigo", async () => {
    const oldest = await seed({
      status: "delivered",
      createdAt: ago(90 * DAY),
      statusChangedAt: ago(80 * DAY),
    });
    const middle = await seed({ createdAt: ago(10 * DAY) });
    const newest = await seed({
      status: "cancelled",
      createdAt: ago(HOUR),
      statusChangedAt: ago(HOUR),
    });

    const page = await listRequestTable(
      db,
      w.operator,
      { sectorId: null, filters: filters({ view: "table" }) },
      NOW,
    );

    expect(page.rows.map((row) => row.id)).toEqual([
      newest.id,
      middle.id,
      oldest.id,
    ]);
    expect(page.total).toBe(3);
    expect(page.page).toBe(1);
    expect(page.pageSize).toBe(PAGE_SIZE);
  });

  it("vazio: página 1 de 1 e nenhuma linha", async () => {
    const page = await listRequestTable(
      db,
      w.operator,
      { sectorId: null, filters: filters() },
      NOW,
    );

    expect(page).toEqual({
      rows: [],
      total: 0,
      page: 1,
      pageCount: 1,
      pageSize: PAGE_SIZE,
    });
  });

  it("50 por página, com a página clampada ao último valor", async () => {
    for (let i = 0; i < PAGE_SIZE + 5; i++) {
      await seed({
        description: `Pedido ${i}`,
        createdAt: ago(HOUR + i * 1000),
        events: false,
      });
    }

    const first = await listRequestTable(
      db,
      w.operator,
      { sectorId: null, filters: filters({ page: 1 }) },
      NOW,
    );
    const beyond = await listRequestTable(
      db,
      w.operator,
      { sectorId: null, filters: filters({ page: 99 }) },
      NOW,
    );

    expect(first.rows).toHaveLength(PAGE_SIZE);
    expect(first.total).toBe(PAGE_SIZE + 5);
    expect(first.pageCount).toBe(2);
    expect(beyond.page).toBe(2);
    expect(beyond.rows).toHaveLength(5);
  });

  it("aplica os mesmos filtros e o escopo do operador; total e página saem do mesmo recorte", async () => {
    await seed({ description: "luvas azuis" });
    await seed({ description: "fita" });
    await insertRequest(db, {
      sectorId: w.other.id,
      createdBy: w.ana.id,
      destinationOther: "Em outro setor",
      description: "luvas do outro setor",
      createdAt: ago(HOUR),
    });

    const page = await listRequestTable(
      db,
      w.operator,
      { sectorId: w.other.id, filters: filters({ search: "luvas" }) },
      NOW,
    );

    expect(page.total).toBe(1);
    expect(page.rows.map((row) => row.description)).toEqual(["luvas azuis"]);
  });

  it("admin em 'Todos os setores' vê o nome do setor de cada linha", async () => {
    await seed();
    await insertRequest(db, {
      sectorId: w.other.id,
      createdBy: w.ana.id,
      destinationOther: "Outro lugar",
      createdAt: ago(2 * HOUR),
    });

    const page = await listRequestTable(
      db,
      w.admin,
      { sectorId: null, filters: filters() },
      NOW,
    );

    expect(page.rows.map((row) => row.sectorName)).toEqual([
      "Almoxarifado Teste",
      "Outro Setor",
    ]);
  });
});

// Os filtros que os números do dashboard abrem (D-F5-3): status, parada,
// entrega e item. Cada um sozinho e combinado, no Quadro/Lista e na Tabela.
describe("filtros novos: status, parada, entrega e item", () => {
  function table(
    input: Partial<RequestFilters> = {},
    options: {
      actor?: Authz;
      sectorId?: string | null;
      now?: Date;
    } = {},
  ) {
    return listRequestTable(
      db,
      options.actor ?? w.operator,
      { sectorId: options.sectorId ?? null, filters: filters(input) },
      options.now ?? NOW,
    );
  }

  const idsOf = (rows: readonly { id: string }[]) =>
    rows.map((row) => row.id).sort();

  describe("status", () => {
    async function seedStatuses() {
      const requested = await seed({ description: "solicitada" });
      const inTransit = await seed({
        status: "in_transit",
        createdAt: ago(2 * HOUR),
        statusChangedAt: ago(HOUR),
        description: "em trânsito",
      });
      const delivered = await seed({
        status: "delivered",
        createdAt: ago(3 * HOUR),
        statusChangedAt: ago(2 * HOUR),
        description: "entregue",
      });
      const cancelled = await seed({
        status: "cancelled",
        createdAt: ago(3 * HOUR),
        statusChangedAt: ago(2 * HOUR),
        description: "cancelada",
      });
      return { requested, inTransit, delivered, cancelled };
    }

    it("cada valor conta exatamente o que o nome diz (Tabela)", async () => {
      const s = await seedStatuses();
      const expected: [RequestFilters["status"], { id: string }[]][] = [
        ["all", [s.requested, s.inTransit, s.delivered, s.cancelled]],
        ["open", [s.requested, s.inTransit]],
        ["not_cancelled", [s.requested, s.inTransit, s.delivered]],
        ["requested", [s.requested]],
        ["in_transit", [s.inTransit]],
        ["delivered", [s.delivered]],
        ["cancelled", [s.cancelled]],
      ];
      for (const [status, rows] of expected) {
        const page = await table({ status });
        expect(page.total, status).toBe(rows.length);
        expect(idsOf(page.rows), status).toEqual(idsOf(rows));
      }
    });

    it("no Quadro e na Lista, só o grupo do status escolhido tem linhas", async () => {
      const s = await seedStatuses();

      const open = await groups({ status: "open" });
      expect(open.requested.rows.map((row) => row.id)).toEqual([
        s.requested.id,
      ]);
      expect(open.in_transit.rows.map((row) => row.id)).toEqual([
        s.inTransit.id,
      ]);
      expect(open.delivered.total).toBe(0);
      expect(open.cancelled.total).toBe(0);

      const notCancelled = await groups({ status: "not_cancelled" });
      expect(notCancelled.delivered.total).toBe(1);
      expect(notCancelled.cancelled.total).toBe(0);

      const delivered = await groups({ status: "delivered" });
      expect(delivered.requested.total).toBe(0);
      expect(delivered.delivered.total).toBe(1);
    });

    it("sem nenhuma solicitação, todos os valores dão zero", async () => {
      for (const status of [
        "open",
        "not_cancelled",
        "requested",
        "in_transit",
        "delivered",
        "cancelled",
      ] as const) {
        expect((await table({ status })).total, status).toBe(0);
      }
    });

    it("combina com destino", async () => {
      const other = await insertDestination(db, { name: "Doca 9" });
      const mine = await seed({ description: "na doca 3" });
      await seed({ destinationId: other.id, description: "na doca 9" });
      await seed({
        status: "delivered",
        createdAt: ago(3 * HOUR),
        statusChangedAt: ago(2 * HOUR),
      });

      const page = await table({ status: "open", destination: w.doca.id });

      expect(page.rows.map((row) => row.id)).toEqual([mine.id]);
    });
  });

  describe("parada", () => {
    it("72 h exatas não; 72 h + 1 ms sim; entregue e cancelada nunca", async () => {
      await seed({ createdAt: ago(72 * HOUR), description: "exata" });
      const over = await seed({
        createdAt: ago(72 * HOUR + 1),
        description: "passou",
      });
      const overTransit = await seed({
        status: "in_transit",
        createdAt: ago(100 * HOUR),
        statusChangedAt: ago(73 * HOUR),
        description: "em trânsito parada",
      });
      await seed({
        status: "delivered",
        createdAt: ago(10 * DAY),
        statusChangedAt: ago(9 * DAY),
      });
      await seed({
        status: "cancelled",
        createdAt: ago(10 * DAY),
        statusChangedAt: ago(9 * DAY),
      });

      const page = await table({ stale: true });

      expect(idsOf(page.rows)).toEqual(idsOf([over, overTransit]));
      expect(page.total).toBe(2);
      expect((await groups({ stale: true })).requested.total).toBe(1);
    });

    it("usa o relógio injetado: 1 ms depois, a de 72 h exatas passa a parada", async () => {
      const exact = await seed({ createdAt: ago(72 * HOUR) });

      expect((await table({ stale: true })).total).toBe(0);
      const later = await table(
        { stale: true },
        { now: new Date(NOW.getTime() + 1) },
      );
      expect(later.rows.map((row) => row.id)).toEqual([exact.id]);
    });

    it("combina com status: parada + entregue é vazio", async () => {
      await seed({ createdAt: ago(100 * HOUR) });

      expect((await table({ stale: true, status: "delivered" })).total).toBe(0);
      expect((await table({ stale: true, status: "open" })).total).toBe(1);
    });
  });

  describe("entrega", () => {
    // Hoje é 21/11 (12:00 em SP): "últimos 7 dias" = 15/11 a 21/11.
    async function deliveredAt(
      description: string,
      events: readonly {
        to: "delivered" | "in_transit" | "cancelled";
        at: Date;
      }[],
      currentStatus: "delivered" | "in_transit" | "cancelled" = "delivered",
    ) {
      const created = await seed({
        createdAt: spDate("2026-11-01", "08:00"),
        status: currentStatus,
        statusChangedAt: events.at(-1)?.at ?? spDate("2026-11-01", "08:00"),
        description,
        events: false,
      });
      for (const event of events) {
        await insertRequestEvent(db, {
          requestId: created.id,
          fromStatus: "requested",
          toStatus: event.to,
          changedBy: w.ana.id,
          changedAt: event.at,
        });
      }
      return created;
    }

    it("pela 1ª entrega no dia de São Paulo, nas duas pontas", async () => {
      const today = await deliveredAt("hoje cedo", [
        { to: "delivered", at: spDate("2026-11-21", "00:00") },
      ]);
      const first = await deliveredAt("no primeiro dia", [
        { to: "delivered", at: spDate("2026-11-15", "00:00") },
      ]);
      await deliveredAt("véspera", [
        {
          to: "delivered",
          at: new Date(spDate("2026-11-14", "23:59").getTime() + 59_999),
        },
      ]);

      const page = await table({
        delivery: { period: "7", from: "2026-11-15", to: TODAY },
      });

      expect(idsOf(page.rows)).toEqual(idsOf([today, first]));
      expect(page.total).toBe(2);
    });

    it("reaberta conta pela 1ª entrega; cancelada depois de entregue conta; nunca entregue não", async () => {
      const reopened = await deliveredAt(
        "reaberta",
        [
          { to: "delivered", at: spDate("2026-11-10", "09:00") },
          { to: "in_transit", at: spDate("2026-11-17", "09:00") },
          { to: "delivered", at: spDate("2026-11-18", "09:00") },
        ],
        "delivered",
      );
      const cancelledAfter = await deliveredAt(
        "cancelada depois",
        [
          { to: "delivered", at: spDate("2026-11-10", "10:00") },
          { to: "cancelled", at: spDate("2026-11-10", "12:00") },
        ],
        "cancelled",
      );
      await deliveredAt(
        "cancelada sem entrega",
        [{ to: "cancelled", at: spDate("2026-11-10", "11:00") }],
        "cancelled",
      );

      const day10 = await table({
        delivery: { period: "range", from: "2026-11-10", to: "2026-11-10" },
      });
      expect(idsOf(day10.rows)).toEqual(idsOf([reopened, cancelledAfter]));

      // A 2ª entrega (18/11) não conta: nos últimos 7 dias a reaberta fica fora.
      const last7 = await table({
        delivery: { period: "7", from: "2026-11-15", to: TODAY },
      });
      expect(last7.total).toBe(0);
    });

    it("a janela de 30 dias das fechadas some com o filtro de entrega", async () => {
      const old = await seed({
        status: "delivered",
        createdAt: spDate("2026-10-01", "08:00"),
        statusChangedAt: spDate("2026-10-12", "10:00"),
        description: "entregue há 40 dias",
      });

      const withoutFilter = await groups();
      expect(withoutFilter.delivered.total).toBe(0);

      const withFilter = await groups({
        delivery: { period: "range", from: "2026-10-01", to: "2026-10-31" },
      });
      expect(withFilter.delivered.rows.map((row) => row.id)).toEqual([old.id]);
      expect(withFilter.delivered.total).toBe(1);
    });

    it("combina com destino e com o período de criação (os dois valem)", async () => {
      const other = await insertDestination(db, { name: "Doca 9" });
      const match = await deliveredAt("casa", [
        { to: "delivered", at: spDate("2026-11-18", "10:00") },
      ]);
      await insertRequest(db, {
        sectorId: w.sector.id,
        createdBy: w.ana.id,
        destinationId: other.id,
        createdAt: spDate("2026-11-01", "08:00"),
        status: "delivered",
        statusChangedAt: spDate("2026-11-18", "10:00"),
      });

      const page = await table({
        destination: w.doca.id,
        delivery: { period: "7", from: "2026-11-15", to: TODAY },
        period: "range",
        from: "2026-11-01",
        to: "2026-11-01",
      });
      expect(page.rows.map((row) => row.id)).toEqual([match.id]);

      const tight = await table({
        delivery: { period: "7", from: "2026-11-15", to: TODAY },
        period: "range",
        from: "2026-11-02",
        to: TODAY,
      });
      expect(tight.total).toBe(0);
    });
  });

  describe("item", () => {
    async function seedItems() {
      const rede = await insertItem(db, {
        sectorId: w.sector.id,
        name: "Rede de proteção",
        unit: "rede",
        kind: "stock",
      });
      const cinta = await insertItem(db, {
        sectorId: w.sector.id,
        name: "Cinta",
        unit: "peça",
        kind: "stock",
      });
      const withRede = await seed({ description: "pede rede" });
      await insertRequestItem(db, {
        requestId: withRede.id,
        itemId: rede.id,
        quantity: 2,
      });
      const both = await seed({ description: "pede as duas" });
      await insertRequestItem(db, { requestId: both.id, itemId: rede.id });
      await insertRequestItem(db, { requestId: both.id, itemId: cinta.id });
      const none = await seed({ description: "sem itens" });
      return { rede, cinta, withRede, both, none };
    }

    it("só as solicitações que pedem o item (uma linha por solicitação, sem duplicar)", async () => {
      const s = await seedItems();

      const rede = await table({ itemId: s.rede.id });
      expect(idsOf(rede.rows)).toEqual(idsOf([s.withRede, s.both]));
      expect(rede.total).toBe(2);

      const cinta = await table({ itemId: s.cinta.id });
      expect(cinta.rows.map((row) => row.id)).toEqual([s.both.id]);
      expect(cinta.total).toBe(1);
    });

    it("no Quadro e na Lista a contagem do grupo é a mesma", async () => {
      const s = await seedItems();

      const result = await groups({ itemId: s.rede.id });

      expect(result.requested.total).toBe(2);
      expect(idsOf(result.requested.rows)).toEqual(idsOf([s.withRede, s.both]));
    });

    it("item de outro setor não vaza: o operador vê zero", async () => {
      const foreign = await insertItem(db, {
        sectorId: w.other.id,
        name: "Item alheio",
        kind: "stock",
      });
      const request = await insertRequest(db, {
        sectorId: w.other.id,
        createdBy: w.bia.id,
        destinationOther: "Em outro setor",
        createdAt: ago(HOUR),
      });
      await insertRequestItem(db, {
        requestId: request.id,
        itemId: foreign.id,
      });

      expect((await table({ itemId: foreign.id })).total).toBe(0);
      expect(
        (await table({ itemId: foreign.id }, { actor: w.admin })).total,
      ).toBe(1);
    });

    it("item inexistente e item sem pedidos: vazio, sem erro", async () => {
      await seedItems();
      const unused = await insertItem(db, {
        sectorId: w.sector.id,
        name: "Sem pedidos",
        kind: "stock",
      });

      expect((await table({ itemId: unused.id })).total).toBe(0);
      expect(
        (await table({ itemId: "00000000-0000-4000-8000-000000000000" })).total,
      ).toBe(0);
    });

    it("combina com status (a quantidade pedida do dashboard: sem as canceladas)", async () => {
      const s = await seedItems();
      const cancelled = await seed({
        status: "cancelled",
        createdAt: ago(3 * HOUR),
        statusChangedAt: ago(2 * HOUR),
        description: "cancelada com rede",
      });
      await insertRequestItem(db, {
        requestId: cancelled.id,
        itemId: s.rede.id,
      });

      const all = await table({ itemId: s.rede.id });
      const notCancelled = await table({
        itemId: s.rede.id,
        status: "not_cancelled",
      });

      expect(all.total).toBe(3);
      expect(idsOf(notCancelled.rows)).toEqual(idsOf([s.withRede, s.both]));
    });
  });
});
