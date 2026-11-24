import { describe, expect, it } from "vitest";

import {
  MIGRATIONS,
  migratedTo,
  migrationFile,
  statementsOf,
} from "./migrations";

describe("harness de migração", () => {
  it("lista os .sql do drizzle em ordem", () => {
    expect(MIGRATIONS.length).toBeGreaterThanOrEqual(4);
    expect(MIGRATIONS.every((file) => file.endsWith(".sql"))).toBe(true);
    expect([...MIGRATIONS].sort()).toEqual([...MIGRATIONS]);
    expect(MIGRATIONS[0]?.startsWith("0000")).toBe(true);
  });

  it("migrationFile acha pelo prefixo e lança quando não existe", () => {
    expect(migrationFile("0003")).toMatch(/^0003_.+\.sql$/);
    expect(() => migrationFile("9999")).toThrow("migração 9999 não encontrada");
  });

  it("statementsOf quebra por statement-breakpoint, sem vazios nem espaços nas pontas", () => {
    const statements = statementsOf(migrationFile("0003"));
    expect(statements.length).toBeGreaterThan(1);
    for (const statement of statements) {
      expect(statement).toBe(statement.trim());
      expect(statement).not.toBe("");
      expect(statement).not.toContain("statement-breakpoint");
    }
  });

  it("migratedTo devolve um PGlite pronto com as migrações aplicadas na ordem", async () => {
    const client = await migratedTo(["0000", "0001"]);
    try {
      const tables = await client.query<{ tablename: string }>(
        "SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename IN ('sector', 'invite', 'shift')",
      );
      expect(tables.rows.map((row) => row.tablename).sort()).toEqual([
        "invite",
        "sector",
      ]);
    } finally {
      await client.close();
    }
  }, 60_000);

  it("migratedTo com prefixo inexistente lança o erro da migração que falhou", async () => {
    await expect(migratedTo(["0000", "9999"])).rejects.toThrow(
      "migração 9999 não encontrada",
    );
  }, 60_000);
});
