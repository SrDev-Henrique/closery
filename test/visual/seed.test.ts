import type { PGlite } from "@electric-sql/pglite";
import { and, eq, inArray, isNull } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { user } from "@/db/schema/auth";
import { destination, item, shift } from "@/db/schema/catalog";
import { handover, handoverCorrection } from "@/db/schema/handovers";
import { invite } from "@/db/schema/invites";
import { request } from "@/db/schema/requests";
import { sector } from "@/db/schema/sectors";
import { STALE_AFTER_MS } from "@/features/requests/limits";
import { STATES, seedState } from "../../scripts/visual/seed/states/index";
import {
  type PersonKey,
  saoPauloAt,
  saoPauloDate,
  seedBase,
  type WorldFile,
} from "../../scripts/visual/seed/world";
import {
  VISUAL_PEOPLE,
  VISUAL_TEXTS,
} from "../../scripts/visual/vocabulary.mjs";
import { createTestDb, resetDb, type TestDb } from "../db";
import { insertUser } from "../fixtures";

// Guarda do seed visual (spec §5.4), no PGlite dos testes, com as quatro pessoas
// inseridas direto (o visual:people as cadastra pela API no ambiente de verdade).

// 12:00 de uma sexta em São Paulo: o turno sugerido é o Turno 1 de hoje (fim às 14:00).
const NOW = new Date("2026-11-27T15:00:00Z");

let client: PGlite;
let db: TestDb;
let world: WorldFile;

beforeAll(async () => {
  ({ client, db } = await createTestDb());
});

afterAll(async () => {
  await client.close();
});

beforeEach(async () => {
  await resetDb(client);
  world = await seedBase(db);
  for (const key of Object.keys(VISUAL_PEOPLE) as PersonKey[]) {
    const person = VISUAL_PEOPLE[key];
    await insertUser(db, {
      role: person.role,
      sectorId: person.role === "admin" ? null : (world.sectors.ULD ?? null),
      name: person.name,
      email: person.email,
    });
  }
});

function sectorOf(name: string): string {
  const id = world.sectors[name];
  if (!id) throw new Error(`teste: setor ${name} ausente no world`);
  return id;
}

async function openRequests(sectorId: string) {
  return db
    .select({
      description: request.description,
      statusChangedAt: request.statusChangedAt,
    })
    .from(request)
    .where(
      and(
        eq(request.sectorId, sectorId),
        inArray(request.status, ["requested", "in_transit"]),
      ),
    );
}

describe("seedBase", () => {
  it("cria 4 setores, 12 turnos, 9 itens, 5 destinos e 4 convites", async () => {
    expect(await db.$count(sector)).toBe(4);
    expect(await db.$count(shift)).toBe(12);
    expect(await db.$count(item)).toBe(9);
    expect(await db.$count(destination)).toBe(5);
    expect(await db.$count(invite)).toBe(4);
    expect(Object.keys(world.sectors).sort()).toEqual([
      "Carga",
      "Operações",
      "Rampa",
      "ULD",
    ]);
  });

  it("um convite por pessoa: a Ana admin sem setor, os operadores no ULD", async () => {
    expect(Object.keys(world.invites)).toEqual([
      "ana",
      "bruno",
      "carla",
      "diego",
    ]);
    for (const token of Object.values(world.invites)) {
      expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    }
    const rows = await db
      .select({ role: invite.role, sectorId: invite.sectorId })
      .from(invite);
    expect(rows.filter((r) => r.role === "admin")).toEqual([
      { role: "admin", sectorId: null },
    ]);
    expect(
      rows.filter((r) => r.role === "operator").map((r) => r.sectorId),
    ).toEqual([sectorOf("ULD"), sectorOf("ULD"), sectorOf("ULD")]);
  });

  it("rodar de novo lança e não duplica nada", async () => {
    await expect(seedBase(db)).rejects.toThrow("o banco visual já tem setores");
    expect(await db.$count(sector)).toBe(4);
    expect(await db.$count(invite)).toBe(4);
  });
});

describe("seedState", () => {
  it("STATES tem os seis do Início e o rico", () => {
    expect(Object.keys(STATES).sort()).toEqual([
      "geral:rico",
      "inicio:admin",
      "inicio:confirmada",
      "inicio:continuar",
      "inicio:entregue",
      "inicio:primeiro",
      "inicio:sem-turnos",
    ]);
  });

  it("inicio:admin: 7 abertas, 3 paradas e a pendente do Bruno de ontem", async () => {
    const file = await seedState(db, "inicio:admin", { now: NOW });
    const uld = sectorOf("ULD");
    const open = await openRequests(uld);
    expect(open).toHaveLength(7);
    const stale = open.filter(
      (r) => r.statusChangedAt.getTime() <= NOW.getTime() - STALE_AFTER_MS,
    );
    expect(stale.map((r) => r.description).sort()).toEqual(
      VISUAL_TEXTS.staleRequests.map((r) => r.description).sort(),
    );
    const handovers = await db
      .select({
        status: handover.status,
        deliveredBy: handover.deliveredBy,
        operationalDate: handover.operationalDate,
        nextShiftText: handover.nextShiftText,
      })
      .from(handover);
    expect(handovers).toEqual([
      {
        status: "delivered",
        deliveredBy: file.users.bruno,
        operationalDate: saoPauloDate(NOW, -1),
        nextShiftText: VISUAL_TEXTS.pendingNextShift,
      },
    ]);
    expect(file).toMatchObject({
      state: "inicio:admin",
      sector: "ULD",
      sectorId: uld,
      sectors: world.sectors,
      at: NOW.toISOString(),
    });
    expect(Object.keys(file.users)).toEqual(["ana", "bruno", "carla", "diego"]);
  });

  it("inicio:sem-turnos desliga só os turnos do ULD e mantém as 7 abertas", async () => {
    await seedState(db, "inicio:sem-turnos", { now: NOW });
    const rows = await db
      .select({ sectorId: shift.sectorId, active: shift.active })
      .from(shift);
    const uld = sectorOf("ULD");
    expect(rows.filter((r) => r.sectorId === uld).map((r) => r.active)).toEqual(
      [false, false, false],
    );
    expect(rows.filter((r) => r.sectorId !== uld).every((r) => r.active)).toBe(
      true,
    );
    expect(await db.$count(request)).toBe(7);
  });

  it("inicio:primeiro: só a Ana ativa, sem convite pendente, sem passagem nem solicitação", async () => {
    await seedState(db, "inicio:primeiro", { now: NOW });
    const active = await db
      .select({ email: user.email })
      .from(user)
      .where(isNull(user.deactivatedAt));
    expect(active).toEqual([{ email: VISUAL_PEOPLE.ana.email }]);
    const pending = await db.$count(
      invite,
      and(isNull(invite.usedAt), isNull(invite.cancelledAt)),
    );
    expect(pending).toBe(0);
    expect(await db.$count(handover)).toBe(0);
    expect(await db.$count(request)).toBe(0);
  });

  it("inicio:continuar: rascunho do turno sugerido, salvo pela Carla às 07:58", async () => {
    const file = await seedState(db, "inicio:continuar", { now: NOW });
    const [row] = await db
      .select({
        status: handover.status,
        operationalDate: handover.operationalDate,
        updatedBy: handover.updatedBy,
        updatedAt: handover.updatedAt,
      })
      .from(handover);
    expect(row).toEqual({
      status: "draft",
      operationalDate: "2026-11-27",
      updatedBy: file.users.carla,
      updatedAt: saoPauloAt("07:58", NOW),
    });
  });

  it("inicio:confirmada com o setor Carga: entregue pela Ana às 13:52 e confirmada pelo Diego às 14:06", async () => {
    const file = await seedState(db, "inicio:confirmada", {
      sector: "Carga",
      now: NOW,
    });
    const carga = sectorOf("Carga");
    const [row] = await db
      .select({
        sectorId: handover.sectorId,
        status: handover.status,
        operationalDate: handover.operationalDate,
        deliveredBy: handover.deliveredBy,
        deliveredAt: handover.deliveredAt,
        confirmedBy: handover.confirmedBy,
        confirmedAt: handover.confirmedAt,
      })
      .from(handover);
    expect(row).toEqual({
      sectorId: carga,
      status: "confirmed",
      operationalDate: "2026-11-27",
      deliveredBy: file.users.ana,
      deliveredAt: saoPauloAt("13:52", NOW),
      confirmedBy: file.users.diego,
      confirmedAt: saoPauloAt("14:06", NOW),
    });
    expect(file).toMatchObject({ sector: "Carga", sectorId: carga });
    expect(await openRequests(carga)).toHaveLength(7);
    expect(await openRequests(sectorOf("ULD"))).toHaveLength(0);
  });

  it("geral:rico: 17 confirmadas em 6 dias, a pendente, a correção, o Stretch em rolo e todos os status", async () => {
    await seedState(db, "geral:rico", { now: NOW });
    expect(await db.$count(handover, eq(handover.status, "confirmed"))).toBe(
      17,
    );
    expect(await db.$count(handover, eq(handover.status, "delivered"))).toBe(1);
    const corrections = await db
      .select({
        oldValue: handoverCorrection.oldValue,
        newValue: handoverCorrection.newValue,
        reason: handoverCorrection.reason,
      })
      .from(handoverCorrection);
    expect(corrections).toEqual([
      {
        oldValue: VISUAL_TEXTS.history.correctionOld,
        newValue: VISUAL_TEXTS.history.occurrences,
        reason: VISUAL_TEXTS.history.correctionReason,
      },
    ]);
    const [stretch] = await db
      .select({ kind: item.kind, unit: item.unit })
      .from(item)
      .where(eq(item.name, "Stretch"));
    expect(stretch).toEqual({ kind: "stock", unit: "rolo" });
    expect(await db.$count(request)).toBe(12);
    const statuses = new Set(
      (await db.select({ status: request.status }).from(request)).map(
        (r) => r.status,
      ),
    );
    expect([...statuses].sort()).toEqual([
      "cancelled",
      "delivered",
      "in_transit",
      "requested",
    ]);
  });

  it("o estado seguinte desfaz o anterior (passagens somem, o Stretch volta a control)", async () => {
    await seedState(db, "geral:rico", { now: NOW });
    await seedState(db, "inicio:primeiro", { now: NOW });
    expect(await db.$count(handover)).toBe(0);
    expect(await db.$count(handoverCorrection)).toBe(0);
    const [stretch] = await db
      .select({ kind: item.kind, unit: item.unit })
      .from(item)
      .where(eq(item.name, "Stretch"));
    expect(stretch).toEqual({ kind: "control", unit: "unidade" });
  });

  it("estado desconhecido lança sem apagar nada (inclusive nome herdado do Object)", async () => {
    await seedState(db, "inicio:admin", { now: NOW });
    await expect(
      seedState(db, "inicio:nao-existe", { now: NOW }),
    ).rejects.toThrow("estado desconhecido: inicio:nao-existe");
    await expect(seedState(db, "toString", { now: NOW })).rejects.toThrow(
      "estado desconhecido: toString",
    );
    await expect(seedState(db, "", { now: NOW })).rejects.toThrow(
      "estado desconhecido",
    );
    expect(await db.$count(request)).toBe(7);
  });

  it("setor desconhecido lança sem apagar nada", async () => {
    await seedState(db, "inicio:admin", { now: NOW });
    await expect(
      seedState(db, "inicio:entregue", { sector: "Nada", now: NOW }),
    ).rejects.toThrow("setor Nada não existe");
    expect(await db.$count(request)).toBe(7);
    expect(await db.$count(handover)).toBe(1);
  });

  it("pessoa sem cadastro lança antes de zerar", async () => {
    await seedState(db, "inicio:admin", { now: NOW });
    await db.delete(user).where(eq(user.email, VISUAL_PEOPLE.diego.email));
    await expect(
      seedState(db, "inicio:confirmada", { now: NOW }),
    ).rejects.toThrow(`usuário ${VISUAL_PEOPLE.diego.email} não existe`);
    expect(await db.$count(request)).toBe(7);
  });
});

describe("datas de São Paulo", () => {
  it("saoPauloAt dá o HH:MM de hoje em São Paulo", () => {
    expect(saoPauloAt("13:52", NOW).toISOString()).toBe(
      "2026-11-27T16:52:00.000Z",
    );
    expect(saoPauloAt("00:00", NOW).toISOString()).toBe(
      "2026-11-27T03:00:00.000Z",
    );
    expect(saoPauloAt("23:59", NOW).toISOString()).toBe(
      "2026-11-28T02:59:00.000Z",
    );
  });

  it("às 23:00 de São Paulo (02:00Z do dia seguinte), hoje ainda é o dia anterior", () => {
    expect(
      saoPauloAt("05:58", new Date("2026-11-28T02:00:00Z")).toISOString(),
    ).toBe("2026-11-27T08:58:00.000Z");
  });

  it("saoPauloAt recusa horário inválido", () => {
    for (const bad of ["24:00", "7:58", "", "07:60", "07:58:00"]) {
      expect(() => saoPauloAt(bad, NOW)).toThrow("horário inválido");
    }
  });

  it("saoPauloDate anda em dias de São Paulo, inclusive na virada do mês", () => {
    expect(saoPauloDate(NOW)).toBe("2026-11-27");
    expect(saoPauloDate(NOW, -1)).toBe("2026-11-26");
    expect(saoPauloDate(NOW, -27)).toBe("2026-10-31");
    expect(saoPauloDate(new Date("2026-12-01T02:00:00Z"))).toBe("2026-11-30");
  });
});
