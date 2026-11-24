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
