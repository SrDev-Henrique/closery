import type { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { authzOf } from "../../../test/authz";
import { spDate } from "../../../test/clock";
import {
  type DashboardWorld,
  seedDashboardWorld,
} from "../../../test/dashboardWorld";
import { createTestDb, type TestDb } from "../../../test/db";
import {
  insertHandover,
  insertHandoverItem,
  insertItem,
  insertSector,
  insertShift,
  insertUser,
} from "../../../test/fixtures";
import { CSV_BOM } from "./csv";
import { buildPassagesCsv, type PassagesCsv } from "./exportCsv";
import { periodDays, previousPeriod } from "./period";
import type { DashboardScope } from "./types";

const ULD_HEADER = [
  "Dia",
  "Turno",
  "Setor",
  "Entregue por",
  "Recebido por",
  "Situação",
  "Corrigida",
  "Rede de proteção (rede)",
  "Cinta (peça)",
  "Cinta antiga (peça)",
  "Stretch (rolo)",
  "Observações dos itens",
  "Fica para o próximo turno",
  "Ocorrências do turno",
];

function scopeOf(
  world: DashboardWorld,
  sector: { id: string; name: string } | null,
  period: DashboardScope["period"] = world.period,
): DashboardScope {
  return {
    sectorId: sector?.id ?? null,
    sectorName: sector?.name ?? null,
    sectorParam: sector?.id ?? "todos",
    showSector: sector === null,
    period,
    previous: previousPeriod(period),
    days: periodDays(period),
    today: world.today,
  };
}

// Linhas sem o BOM e sem o CRLF final; o teste só olha texto sem quebra interna.
function linesOf(csv: PassagesCsv): string[] {
  if (!csv.ok) throw new Error("o CSV devia ter sido gerado");
  expect(csv.body.startsWith(CSV_BOM)).toBe(true);
  expect(csv.body.endsWith("\r\n")).toBe(true);
  return csv.body.slice(CSV_BOM.length, -2).split("\r\n");
}

const cells = (...values: string[]) => values.join(";");

describe("buildPassagesCsv (mundo do critério de pronto)", () => {
  let client: PGlite;
  let db: TestDb;
  let world: DashboardWorld;

  beforeAll(async () => {
    ({ client, db } = await createTestDb());
    world = await seedDashboardWorld(db);
  });
  afterAll(async () => {
    await client.close();
  });

  it("setor: cabeçalho exato, uma linha por linha do histórico e a ordem da lista", async () => {
    const csv = await buildPassagesCsv(
      db,
      world.people.admin,
      scopeOf(world, world.uld),
      world.now,
    );
    const lines = linesOf(csv);
    expect(lines[0]).toBe(ULD_HEADER.join(";"));
    expect(lines).toHaveLength(1 + 21);
    expect(csv.ok && csv.rows).toBe(21);
    expect(csv.ok && csv.filename.ascii).toBe(
      "passagens-uld-teste-2026-11-14_a_2026-11-20.csv",
    );
    // 20/11: a Tarde (fim 22:00) antes da Manhã (fim 14:00); a Noite de 20/11
    // ainda está aberta e fica de fora.
    expect(lines[1]).toBe(
      cells(
        "20/11/2026",
        "Tarde",
        "ULD Teste",
        "Bia Teste",
        "",
        "Aguardando recebimento",
        "Não",
        "3",
        "2",
        "",
        "12",
        "",
        "",
        "",
      ),
    );
    expect(lines[2]).toBe(
      cells(
        "20/11/2026",
        "Manhã",
        "ULD Teste",
        "Ana Teste",
        "Bia Teste",
        "Confirmada",
        "Não",
        "6",
        "5",
        "",
        "2",
        "",
        "",
        "",
      ),
    );
  });

  it("'Sem passagem' sai com as células vazias e o rascunho continua sem passagem", async () => {
    const lines = linesOf(
      await buildPassagesCsv(
        db,
        world.people.admin,
        scopeOf(world, world.uld),
        world.now,
      ),
    );
    const blank = Array.from({ length: 8 }, () => "");
    expect(lines).toContain(
      cells(
        "19/11/2026",
        "Tarde",
        "ULD Teste",
        "",
        "",
        "Sem passagem",
        ...blank,
      ),
    );
    expect(lines).toContain(
      cells(
        "15/11/2026",
        "Tarde",
        "ULD Teste",
        "",
        "",
        "Sem passagem",
        ...blank,
      ),
    );
    expect(
      lines.filter((line) => line.includes(";Sem passagem;")),
    ).toHaveLength(11);
  });

  it("quantidade vigente depois da correção, 'Corrigida' e item ausente vazio", async () => {
    const lines = linesOf(
      await buildPassagesCsv(
        db,
        world.people.admin,
        scopeOf(world, world.uld),
        world.now,
      ),
    );
    // 17/11 Tarde: Rede 5 → 8 pela correção; Cinta antiga não existe nesta passagem.
    expect(lines).toContain(
      cells(
        "17/11/2026",
        "Tarde",
        "ULD Teste",
        "Bia Teste",
        "Ana Teste",
        "Confirmada",
        "Sim",
        "8",
        "4",
        "",
        "5",
        "",
        "",
        "",
      ),
    );
    // 15/11 Manhã: a Cinta antiga tem 2; situação "Não confirmada" sem "Recebido por".
    expect(lines).toContain(
      cells(
        "15/11/2026",
        "Manhã",
        "ULD Teste",
        "Ana Teste",
        "",
        "Não confirmada",
        "Não",
        "4",
        "6",
        "2",
        "8",
        "",
        "",
        "",
      ),
    );
    // Turno Antigo (inativo) entra pelo nome do snapshot e do cadastro.
    expect(
      lines.some((line) => line.startsWith("15/11/2026;Turno Antigo;")),
    ).toBe(true);
  });

  it("Todos os setores: colunas com o setor, Câmara primeiro, 27 linhas", async () => {
    const lines = linesOf(
      await buildPassagesCsv(
        db,
        world.people.admin,
        scopeOf(world, null),
        world.now,
      ),
    );
    expect(lines[0]).toBe(
      [
        "Dia",
        "Turno",
        "Setor",
        "Entregue por",
        "Recebido por",
        "Situação",
        "Corrigida",
        "Câmara Teste · Lacre (unidade)",
        "ULD Teste · Rede de proteção (rede)",
        "ULD Teste · Cinta (peça)",
        "ULD Teste · Cinta antiga (peça)",
        "ULD Teste · Stretch (rolo)",
        "Observações dos itens",
        "Fica para o próximo turno",
        "Ocorrências do turno",
      ].join(";"),
    );
    expect(lines).toHaveLength(1 + 27);
    // O "Setor Parado" está inativo e nunca aparece.
    expect(lines.some((line) => line.includes("Setor Parado"))).toBe(false);
  });

  it("operador com o setor de outro setor no escopo recebe só o próprio", async () => {
    const csv = await buildPassagesCsv(
      db,
      world.people.ana,
      scopeOf(world, world.camara),
      world.now,
    );
    const lines = linesOf(csv);
    expect(lines).toHaveLength(1 + 21);
    expect(
      lines.slice(1).every((line) => line.split(";")[2] === "ULD Teste"),
    ).toBe(true);
    expect(lines.join("\n")).not.toContain("Câmara Teste");
  });

  it("operador sem setor recebe só o cabeçalho", async () => {
    const csv = await buildPassagesCsv(
      db,
      { ...world.people.ana, sectorId: null },
      scopeOf(world, null),
      world.now,
    );
    expect(linesOf(csv)).toHaveLength(1);
    expect(csv.ok && csv.rows).toBe(0);
  });

  it("período sem nenhum par (antes da criação dos turnos): só o cabeçalho com o BOM", async () => {
    const csv = await buildPassagesCsv(
      db,
      world.people.admin,
      scopeOf(world, world.uld, {
        period: "range",
        from: "2025-12-01",
        to: "2025-12-02",
      }),
      world.now,
    );
    expect(csv.ok && csv.rows).toBe(0);
    expect(csv.ok && csv.body).toBe(
      `${CSV_BOM}${[
        "Dia",
        "Turno",
        "Setor",
        "Entregue por",
        "Recebido por",
        "Situação",
        "Corrigida",
        "Observações dos itens",
        "Fica para o próximo turno",
        "Ocorrências do turno",
      ].join(";")}\r\n`,
    );
  });

  it("teto de linhas: acima devolve too_large, exatamente no teto devolve ok", async () => {
    const oneDay: DashboardScope["period"] = {
      period: "range",
      from: "2026-11-20",
      to: "2026-11-20",
    };
    const exact = await buildPassagesCsv(
      db,
      world.people.admin,
      scopeOf(world, world.uld, oneDay),
      world.now,
      { maxRows: 2 },
    );
    expect(exact.ok && exact.rows).toBe(2);

    const over = await buildPassagesCsv(
      db,
      world.people.admin,
      scopeOf(world, world.uld),
      world.now,
      { maxRows: 2 },
    );
    expect(over).toEqual({ ok: false, reason: "too_large", rows: 3 });
  });
});

describe("buildPassagesCsv (neutralização e aspas, passagem própria)", () => {
  let client: PGlite;
  let db: TestDb;

  beforeAll(async () => {
    ({ client, db } = await createTestDb());
  });
  afterAll(async () => {
    await client.close();
  });

  it("neutraliza fórmula só nos campos de pessoa e cita quebra de linha", async () => {
    const sector = await insertSector(db, "Setor Fórmulas");
    const admin = await insertUser(db, {
      role: "admin",
      sectorId: null,
      name: "Admin Teste",
    });
    const author = await insertUser(db, {
      role: "operator",
      sectorId: sector.id,
      name: "=Autora Teste",
    });
    const receiver = await insertUser(db, {
      role: "operator",
      sectorId: sector.id,
      name: "+Bia Teste",
    });
    const shift = await insertShift(db, {
      sectorId: sector.id,
      name: "@Turno Teste",
      startsAt: "00:00",
      endsAt: "23:59",
      createdAt: new Date("2026-01-01T12:00:00Z"),
    });
    const formula = await insertItem(db, {
      sectorId: sector.id,
      name: "=SOMA(1)",
      unit: "rolo",
    });
    const plain = await insertItem(db, {
      sectorId: sector.id,
      name: "Rede de proteção",
      unit: "rede",
    });
    const created = await insertHandover(db, {
      sectorId: sector.id,
      shiftId: shift.id,
      operationalDate: "2026-11-19",
      status: "confirmed",
      deliveredBy: author.id,
      deliveredAt: spDate("2026-11-19", "23:59"),
      confirmedBy: receiver.id,
      confirmedAt: spDate("2026-11-20", "00:10"),
      occurrencesText: '+1\nsegunda "linha"; fim',
      nextShiftText: "-trocar o lacre",
    });
    await insertHandoverItem(db, {
      handoverId: created.id,
      itemId: formula.id,
      quantity: 3,
      note: null,
      snapshot: true,
    });
    await insertHandoverItem(db, {
      handoverId: created.id,
      itemId: plain.id,
      quantity: 0,
      note: "-2 rolos",
      snapshot: true,
    });

    const oneDay: DashboardScope["period"] = {
      period: "range",
      from: "2026-11-19",
      to: "2026-11-19",
    };
    const csv = await buildPassagesCsv(
      db,
      authzOf({ role: "admin", userId: admin.id }),
      {
        sectorId: sector.id,
        sectorName: sector.name,
        sectorParam: sector.id,
        showSector: false,
        period: oneDay,
        previous: previousPeriod(oneDay),
        days: 1,
        today: "2026-11-20",
      },
      spDate("2026-11-20", "15:00"),
    );
    expect(csv.ok && csv.rows).toBe(1);
    const body = csv.ok ? csv.body : "";
    expect(body).toBe(
      `${CSV_BOM}${[
        "Dia",
        "Turno",
        "Setor",
        "Entregue por",
        "Recebido por",
        "Situação",
        "Corrigida",
        "'=SOMA(1) (rolo)",
        "Rede de proteção (rede)",
        "Observações dos itens",
        "Fica para o próximo turno",
        "Ocorrências do turno",
      ].join(";")}\r\n${[
        "19/11/2026",
        "'@Turno Teste",
        "Setor Fórmulas",
        "'=Autora Teste",
        "'+Bia Teste",
        "Confirmada",
        "Não",
        "3",
        "0",
        "Rede de proteção: -2 rolos",
        "'-trocar o lacre",
        '"\'+1\nsegunda ""linha""; fim"',
      ].join(";")}\r\n`,
    );
  });
});
