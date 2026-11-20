import type { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createTestDb, resetDb, TABLES } from "./db";

describe("harness de banco", () => {
  let client: PGlite;

  beforeAll(async () => {
    ({ client } = await createTestDb());
  });

  afterAll(async () => {
    await client.close();
  });

  it("TABLES lista exatamente as tabelas do schema public", async () => {
    const { rows } = await client.query<{ tablename: string }>(
      "SELECT tablename FROM pg_tables WHERE schemaname = 'public'",
    );
    const actual = rows.map((row) => row.tablename).sort();
    expect([...TABLES].sort()).toEqual(actual);
  });

  it("resetDb apaga os dados de todas as tabelas", async () => {
    await client.exec("INSERT INTO sector (name) VALUES ('ULD')");
    await resetDb(client);
    const { rows } = await client.query("SELECT 1 FROM sector");
    expect(rows).toHaveLength(0);
  });
});
