import type { PGlite } from "@electric-sql/pglite";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { SECTOR_COLORS } from "@/features/sectors/colors";
import { createTestDb, resetDb, type TestDb } from "../../../test/db";
import { sqlErrorOf } from "../../../test/sqlError";
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
      .values({ name: "ULD", color: "lilac" })
      .returning();
    expect(inserted?.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(inserted?.active).toBe(true);
    expect(inserted?.createdAt).toBeInstanceOf(Date);

    const rows = await db.select().from(sector).where(eq(sector.name, "ULD"));
    expect(rows).toHaveLength(1);
  });

  it("recusa nome repetido com o código 23505 (unique)", async () => {
    await db.insert(sector).values({ name: "ULD", color: "lilac" });
    const attempt = await db
      .insert(sector)
      .values({ name: "ULD", color: "lilac" })
      .then(
        () => null,
        (error: unknown) => error,
      );
    expect(sqlState(attempt)).toBe("23505");
  });

  it('recusa nome que só difere na caixa: "Uld" depois de "ULD" (23505)', async () => {
    await db.insert(sector).values({ name: "ULD", color: "lilac" });
    const attempt = await db
      .insert(sector)
      .values({ name: "Uld", color: "lilac" })
      .then(
        () => null,
        (error: unknown) => error,
      );
    expect(sqlState(attempt)).toBe("23505");
  });

  it("recusa nome nulo", async () => {
    const attempt = await client
      .query("INSERT INTO sector (name, color) VALUES (NULL, 'lilac')")
      .then(
        () => null,
        (error: unknown) => error,
      );
    expect(sqlState(attempt)).toBe("23502");
  });

  it("grava e devolve a cor", async () => {
    const [inserted] = await db
      .insert(sector)
      .values({ name: "ULD", color: "sky" })
      .returning();
    expect(inserted?.color).toBe("sky");

    const [read] = await db.select().from(sector).where(eq(sector.name, "ULD"));
    expect(read?.color).toBe("sky");
  });

  it("aceita cada cor da paleta", async () => {
    for (const color of SECTOR_COLORS) {
      await db.insert(sector).values({ name: `Setor ${color}`, color });
    }
    expect(await db.select().from(sector)).toHaveLength(SECTOR_COLORS.length);
  });

  it("recusa cor fora da paleta com 23514 e o nome da constraint", async () => {
    for (const invalid of ["red", "", "Lilac"]) {
      expect(
        await sqlErrorOf(
          client.query("INSERT INTO sector (name, color) VALUES ('X', $1)", [
            invalid,
          ]),
        ),
        invalid,
      ).toEqual({ code: "23514", constraint: "sector_color_valid" });
    }
    expect(await db.select().from(sector)).toEqual([]);
  });

  it("recusa cor nula (23502)", async () => {
    expect(
      (
        await sqlErrorOf(
          client.query("INSERT INTO sector (name, color) VALUES ('X', NULL)"),
        )
      ).code,
    ).toBe("23502");
  });

  it("recusa insert sem cor: o banco não escolhe uma por padrão (23502)", async () => {
    expect(
      (await sqlErrorOf(client.query("INSERT INTO sector (name) VALUES ('X')")))
        .code,
    ).toBe("23502");
  });

  it("o check do banco lista exatamente as cores de SECTOR_COLORS (a paleta e o SQL não se separam)", async () => {
    const { rows } = await client.query<{ definition: string }>(
      `SELECT pg_get_constraintdef(oid) AS definition FROM pg_constraint
       WHERE conname = 'sector_color_valid'`,
    );
    const definition = rows[0]?.definition ?? "";
    const quoted = [...definition.matchAll(/'([a-z]+)'::text/g)].map(
      (match) => match[1],
    );
    expect(quoted).toEqual([...SECTOR_COLORS]);
  });

  it("transação que lança é revertida por inteiro", async () => {
    await expect(
      db.transaction(async (tx) => {
        await tx.insert(sector).values({ name: "Revertido", color: "lilac" });
        throw new Error("falha interna");
      }),
    ).rejects.toThrow("falha interna");

    const rows = await db.select().from(sector);
    expect(rows).toEqual([]);
  });

  it("transação bem-sucedida confirma os dados", async () => {
    await db.transaction(async (tx) => {
      await tx.insert(sector).values({ name: "Confirmado", color: "lilac" });
    });
    const rows = await db.select().from(sector);
    expect(rows.map((row) => row.name)).toEqual(["Confirmado"]);
  });
});
