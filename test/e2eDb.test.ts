import type { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { countSessionsByEmail } from "../e2e/db";
import { createTestDb, resetDb, type TestDb } from "./db";
import { insertSession, insertUser } from "./fixtures";

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

describe("countSessionsByEmail (helper do E2E)", () => {
  it("conta só as sessões da pessoa com aquele e-mail", async () => {
    const ana = await insertUser(db, {
      role: "admin",
      sectorId: null,
      email: "ana@example.test",
    });
    const davi = await insertUser(db, {
      role: "admin",
      sectorId: null,
      email: "davi@example.test",
    });
    await insertSession(db, { userId: ana.id });
    await insertSession(db, { userId: ana.id });
    await insertSession(db, { userId: davi.id });

    expect(await countSessionsByEmail(db, "ana@example.test")).toBe(2);
    expect(await countSessionsByEmail(db, "davi@example.test")).toBe(1);
  });

  it("zero quando a pessoa não tem sessão", async () => {
    await insertUser(db, {
      role: "admin",
      sectorId: null,
      email: "sem-sessao@example.test",
    });

    expect(await countSessionsByEmail(db, "sem-sessao@example.test")).toBe(0);
  });

  it("zero quando o e-mail não existe (nunca lança)", async () => {
    expect(await countSessionsByEmail(db, "ninguem@example.test")).toBe(0);
  });

  it("a caixa do e-mail conta: o e-mail é comparado como foi gravado", async () => {
    const ana = await insertUser(db, {
      role: "admin",
      sectorId: null,
      email: "ana@example.test",
    });
    await insertSession(db, { userId: ana.id });

    expect(await countSessionsByEmail(db, "ANA@example.test")).toBe(0);
  });
});
