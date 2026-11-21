import type { PGlite } from "@electric-sql/pglite";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { handover } from "@/db/schema/handovers";
import type { Authz } from "@/features/authz/authz";
import { spDate } from "../../../test/clock";
import { createTestDb, resetDb, type TestDb } from "../../../test/db";
import {
  insertHandover,
  insertSector,
  insertShift,
  insertUser,
} from "../../../test/fixtures";
import { sqlErrorOf } from "../../../test/sqlError";
import { confirmHandover } from "./confirm";

const NIL_ID = "00000000-0000-4000-8000-000000000000";
const NOW = spDate("2026-11-20", "14:30");

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

function operator(id: string, name: string, sectorId: string): Authz {
  return {
    userId: id,
    name,
    email: `${id}@example.test`,
    role: "operator",
    sectorId,
  };
}

function admin(id: string, name: string): Authz {
  return {
    userId: id,
    name,
    email: `${id}@example.test`,
    role: "admin",
    sectorId: null,
  };
}

// Setor ULD com Ana (entrega), Bia (confirma) e uma passagem entregue pela
// Ana; Caio é de outro setor; "Admin Teste" é administrador.
async function seed(status: "draft" | "delivered" = "delivered") {
  const uld = await insertSector(db, "ULD");
  const other = await insertSector(db, "Outro");
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
  const caio = await insertUser(db, {
    role: "operator",
    sectorId: other.id,
    name: "Caio Teste",
  });
  const root = await insertUser(db, {
    role: "admin",
    sectorId: null,
    name: "Admin Teste",
  });
  const turno = await insertShift(db, { sectorId: uld.id, name: "Manhã" });
  const passagem = await insertHandover(db, {
    sectorId: uld.id,
    shiftId: turno.id,
    status,
    ...(status === "delivered" ? { deliveredBy: ana.id } : {}),
  });
  return {
    uld,
    other,
    ana: operator(ana.id, "Ana Teste", uld.id),
    bia: operator(bia.id, "Bia Teste", uld.id),
    caio: operator(caio.id, "Caio Teste", other.id),
    root: admin(root.id, "Admin Teste"),
    id: passagem.id,
  };
}

async function rowOf(id: string) {
  const [row] = await db.select().from(handover).where(eq(handover.id, id));
  if (!row) throw new Error("passagem sumiu no teste");
  return row;
}

describe("confirmHandover", () => {
  it("outra pessoa do setor confirma: grava quem, quando e a observação", async () => {
    const { bia, id } = await seed();

    const result = await confirmHandover(
      db,
      bia,
      { id, note: "Tudo conferido" },
      NOW,
    );

    expect(result).toEqual({ ok: true, confirmedAt: NOW });
    const row = await rowOf(id);
    expect(row.status).toBe("confirmed");
    expect(row.confirmedBy).toBe(bia.userId);
    expect(row.confirmedAt).toEqual(NOW);
    expect(row.confirmationNote).toBe("Tudo conferido");
  });

  it("setor inativo é só leitura: SECTOR_INACTIVE e nada muda (P26)", async () => {
    const { uld, bia, id } = await seed();
    await client.query("update sector set active = false where id = $1", [
      uld.id,
    ]);

    const result = await confirmHandover(db, bia, { id, note: null }, NOW);

    expect(result).toEqual({
      ok: false,
      code: "SECTOR_INACTIVE",
      message:
        "Este setor está inativo. Peça a um administrador para reativá-lo.",
    });
    expect((await rowOf(id)).status).toBe("delivered");
  });

  it("observação vazia, só espaços ou null vira null", async () => {
    const first = await seed();
    await confirmHandover(db, first.bia, { id: first.id, note: "   " }, NOW);
    expect((await rowOf(first.id)).confirmationNote).toBeNull();

    await resetDb(client);
    const second = await seed();
    await confirmHandover(db, second.bia, { id: second.id, note: null }, NOW);
    expect((await rowOf(second.id)).confirmationNote).toBeNull();
  });

  it("observação de 501 caracteres é recusada e nada muda", async () => {
    const { bia, id } = await seed();

    const result = await confirmHandover(
      db,
      bia,
      { id, note: "a".repeat(501) },
      NOW,
    );

    expect(result).toMatchObject({
      ok: false,
      code: "INVALID_INPUT",
      fieldErrors: { note: "A observação pode ter no máximo 500 caracteres." },
    });
    expect((await rowOf(id)).status).toBe("delivered");
  });

  it("observação de 500 pontos de código (emoji) passa", async () => {
    const { bia, id } = await seed();

    const result = await confirmHandover(
      db,
      bia,
      { id, note: "😀".repeat(500) },
      NOW,
    );

    expect(result.ok).toBe(true);
  });

  it("quem entregou não confirma: OWN_HANDOVER e a passagem continua entregue", async () => {
    const { ana, id } = await seed();

    const result = await confirmHandover(db, ana, { id, note: null }, NOW);

    expect(result).toEqual({
      ok: false,
      code: "OWN_HANDOVER",
      message:
        "Quem entregou o turno não pode confirmar o recebimento. Peça a outra pessoa do setor.",
    });
    const row = await rowOf(id);
    expect(row.status).toBe("delivered");
    expect(row.confirmedBy).toBeNull();
  });

  it("a segunda confirmação diz quem confirmou e a hora, e não muda nada", async () => {
    const { bia, root, id } = await seed();
    await confirmHandover(db, bia, { id, note: "primeira" }, NOW);

    const second = await confirmHandover(
      db,
      root,
      { id, note: "segunda" },
      spDate("2026-11-20", "15:00"),
    );

    expect(second).toEqual({
      ok: false,
      code: "ALREADY_CONFIRMED",
      message: "Esta passagem já foi confirmada por Bia Teste às 14:30.",
    });
    const row = await rowOf(id);
    expect(row.confirmedBy).toBe(bia.userId);
    expect(row.confirmationNote).toBe("primeira");
  });

  it("quem entregou, numa passagem já confirmada, recebe ALREADY_CONFIRMED (estado vence a regra de autoria)", async () => {
    const { ana, bia, id } = await seed();
    await confirmHandover(db, bia, { id, note: null }, NOW);

    const result = await confirmHandover(db, ana, { id, note: null }, NOW);

    expect(result).toMatchObject({ ok: false, code: "ALREADY_CONFIRMED" });
  });

  it("rascunho: NOT_DELIVERED", async () => {
    const { bia, id } = await seed("draft");

    const result = await confirmHandover(db, bia, { id, note: null }, NOW);

    expect(result).toEqual({
      ok: false,
      code: "NOT_DELIVERED",
      message: "Esta passagem ainda não foi entregue.",
    });
    expect((await rowOf(id)).status).toBe("draft");
  });

  it("operador de outro setor recebe NOT_FOUND, igual a um id que não existe", async () => {
    const { caio, id } = await seed();

    const foreign = await confirmHandover(db, caio, { id, note: null }, NOW);
    const missing = await confirmHandover(
      db,
      caio,
      { id: NIL_ID, note: null },
      NOW,
    );

    expect(foreign).toEqual({
      ok: false,
      code: "NOT_FOUND",
      message: "Passagem não encontrada. Atualize a página.",
    });
    expect(missing).toEqual(foreign);
    expect((await rowOf(id)).status).toBe("delivered");
  });

  it("administrador confirma a passagem de qualquer setor", async () => {
    const { root, id } = await seed();

    const result = await confirmHandover(db, root, { id, note: null }, NOW);

    expect(result.ok).toBe(true);
    expect((await rowOf(id)).confirmedBy).toBe(root.userId);
  });

  it("administrador que entregou também não confirma a própria passagem", async () => {
    const uld = await insertSector(db, "ULD");
    const root = await insertUser(db, {
      role: "admin",
      sectorId: null,
      name: "Admin Teste",
    });
    const turno = await insertShift(db, { sectorId: uld.id });
    const passagem = await insertHandover(db, {
      sectorId: uld.id,
      shiftId: turno.id,
      status: "delivered",
      deliveredBy: root.id,
    });

    const result = await confirmHandover(
      db,
      admin(root.id, "Admin Teste"),
      { id: passagem.id, note: null },
      NOW,
    );

    expect(result).toMatchObject({ ok: false, code: "OWN_HANDOVER" });
  });

  it("o banco recusa o bypass: UPDATE direto com confirmed_by = delivered_by", async () => {
    const { ana, id } = await seed();

    const error = await sqlErrorOf(
      db
        .update(handover)
        .set({ status: "confirmed", confirmedBy: ana.userId, confirmedAt: NOW })
        .where(eq(handover.id, id)),
    );

    expect(error).toEqual({
      code: "23514",
      constraint: "handover_confirmer_ne_deliverer",
    });
  });
});
