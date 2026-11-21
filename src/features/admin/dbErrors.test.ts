import type { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { sector } from "@/db/schema";
import {
  constraintOf,
  isUniqueViolation,
  sqlStateOf,
} from "@/features/admin/dbErrors";

import { createTestDb, resetDb, type TestDb } from "../../../test/db";

describe("com o erro real do Drizzle + PGlite", () => {
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

  async function duplicateInsertError(): Promise<unknown> {
    await db.insert(sector).values({ name: "ULD" });
    try {
      await db.insert(sector).values({ name: "uld" });
    } catch (error) {
      return error;
    }
    throw new Error("o segundo insert deveria falhar");
  }

  it("acha o SQLSTATE e a constraint dentro de error.cause", async () => {
    const error = await duplicateInsertError();
    expect(sqlStateOf(error)).toBe("23505");
    expect(constraintOf(error)).toBe("sector_name_lower_uq");
    expect(isUniqueViolation(error)).toBe(true);
  });

  it("reconhece o 23514 de uma CHECK como outro erro, não como duplicado", async () => {
    let error: unknown;
    try {
      await client.query(
        `INSERT INTO "user" (id, name, email, role, sector_id) VALUES ('u1', 'Pessoa', 'u1@example.test', 'gerente', NULL)`,
      );
    } catch (caught) {
      error = caught;
    }
    expect(sqlStateOf(error)).toBe("23514");
    expect(isUniqueViolation(error)).toBe(false);
  });
});

describe("com objetos sintéticos", () => {
  it("lê o código no próprio erro", () => {
    expect(sqlStateOf({ code: "23505" })).toBe("23505");
    expect(constraintOf({ constraint: "x_uq" })).toBe("x_uq");
  });

  it("lê o código na cause, e na cause da cause", () => {
    expect(sqlStateOf(new Error("x", { cause: { code: "23503" } }))).toBe(
      "23503",
    );
    const deep = new Error("a", {
      cause: new Error("b", { cause: { code: "23505", constraint: "k" } }),
    });
    expect(sqlStateOf(deep)).toBe("23505");
    expect(constraintOf(deep)).toBe("k");
  });

  it("código do Node (ECONNRESET) não é SQLSTATE", () => {
    expect(sqlStateOf({ code: "ECONNRESET" })).toBeUndefined();
    expect(isUniqueViolation({ code: "ECONNRESET" })).toBe(false);
  });

  it("devolve undefined para o que não é erro de banco", () => {
    for (const value of [
      undefined,
      null,
      "23505",
      23505,
      {},
      [],
      new Error("x"),
    ]) {
      expect(sqlStateOf(value), String(value)).toBeUndefined();
      expect(constraintOf(value), String(value)).toBeUndefined();
      expect(isUniqueViolation(value), String(value)).toBe(false);
    }
  });

  it("não entra em loop com cause circular", () => {
    const error: { cause?: unknown } = {};
    error.cause = error;
    expect(sqlStateOf(error)).toBeUndefined();
  });
});
