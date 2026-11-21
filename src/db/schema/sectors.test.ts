import type { PGlite } from "@electric-sql/pglite";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { createTestDb, resetDb, type TestDb } from "../../../test/db";
import { sector } from "./sectors";

// Código SQLSTATE do erro. O driver do PGlite o expõe em `code`; o drizzle
// 0.45 pode embrulhar o erro original em `cause`, então olhamos os dois.
function sqlState(error: unknown): string | undefined {
  const candidates = [error, error instanceof Error ? error.cause : undefined];
  for (const candidate of candidates) {
    if (
      typeof candidate === "object" &&
      candidate !== null &&
      "code" in candidate &&
      typeof candidate.code === "string"
    ) {
      return candidate.code;
    }
  }
  return undefined;
}

describe("tabela sector", () => {
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

  it("insere e lê com id gerado, active=true e createdAt preenchido", async () => {
    const [inserted] = await db
      .insert(sector)
      .values({ name: "ULD" })
      .returning();
    expect(inserted?.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(inserted?.active).toBe(true);
    expect(inserted?.createdAt).toBeInstanceOf(Date);

    const rows = await db.select().from(sector).where(eq(sector.name, "ULD"));
    expect(rows).toHaveLength(1);
  });

  it("recusa nome repetido com o código 23505 (unique)", async () => {
    await db.insert(sector).values({ name: "ULD" });
    const attempt = await db
      .insert(sector)
      .values({ name: "ULD" })
      .then(
        () => null,
        (error: unknown) => error,
      );
    expect(sqlState(attempt)).toBe("23505");
  });

  it('recusa nome que só difere na caixa: "Uld" depois de "ULD" (23505)', async () => {
    await db.insert(sector).values({ name: "ULD" });
    const attempt = await db
      .insert(sector)
      .values({ name: "Uld" })
      .then(
        () => null,
        (error: unknown) => error,
      );
    expect(sqlState(attempt)).toBe("23505");
  });

  it("recusa nome nulo", async () => {
    const attempt = await client
      .query("INSERT INTO sector (name) VALUES (NULL)")
      .then(
        () => null,
        (error: unknown) => error,
      );
    expect(sqlState(attempt)).toBe("23502");
  });

  it("transação que lança é revertida por inteiro", async () => {
    await expect(
      db.transaction(async (tx) => {
        await tx.insert(sector).values({ name: "Revertido" });
        throw new Error("falha interna");
      }),
    ).rejects.toThrow("falha interna");

    const rows = await db.select().from(sector);
    expect(rows).toEqual([]);
  });

  it("transação bem-sucedida confirma os dados", async () => {
    await db.transaction(async (tx) => {
      await tx.insert(sector).values({ name: "Confirmado" });
    });
    const rows = await db.select().from(sector);
    expect(rows.map((row) => row.name)).toEqual(["Confirmado"]);
  });
});
