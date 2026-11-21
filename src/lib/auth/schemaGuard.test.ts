import { getAuthTables } from "@better-auth/core/db";
import type { PGlite } from "@electric-sql/pglite";
import { getTableColumns, getTableName, is } from "drizzle-orm";
import { PgTable } from "drizzle-orm/pg-core";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import * as schema from "@/db/schema";
import { createTestAuth } from "../../../test/auth";
import { createTestDb, type TestDb } from "../../../test/db";
import { AUTH_USER_ADDITIONAL_FIELDS } from "./createAuth";

let client: PGlite;
let db: TestDb;
let tables: ReturnType<typeof getAuthTables>;

beforeAll(async () => {
  ({ client, db } = await createTestDb());
  const auth = createTestAuth(db, {
    google: { clientId: "gid", clientSecret: "gsecret" },
  });
  tables = getAuthTables(auth.options);
});

afterAll(async () => {
  await client.close();
});

type Loose = Record<string, unknown>;

describe("guarda de schema: o que o Better Auth espera existe no Drizzle", () => {
  it("o Better Auth declara as 6 tabelas que escrevemos à mão", () => {
    const modelNames = Object.values(tables)
      .map((table) => table.modelName)
      .sort();
    expect(modelNames).toEqual(
      [
        "account",
        "passkey",
        "rateLimit",
        "session",
        "user",
        "verification",
      ].sort(),
    );
  });

  it("para cada tabela, existe schema[modelName] com todas as colunas esperadas", () => {
    const loose: Loose = schema;
    const missing: string[] = [];

    for (const table of Object.values(tables)) {
      const drizzleTable = loose[table.modelName];
      if (!is(drizzleTable, PgTable)) {
        missing.push(`tabela ${table.modelName}`);
        continue;
      }
      const columns = getTableColumns(drizzleTable);
      // o Better Auth sempre grava e lê `id`, mesmo sem declará-lo em `fields`
      if (!("id" in columns)) missing.push(`${table.modelName}.id`);
      for (const [fieldKey, field] of Object.entries(table.fields)) {
        const key = field.fieldName ?? fieldKey;
        if (!(key in columns)) missing.push(`${table.modelName}.${key}`);
      }
    }

    expect(missing).toEqual([]);
  });

  it("cada coluna esperada existe de fato no banco migrado", async () => {
    const loose: Loose = schema;
    const missing: string[] = [];

    for (const table of Object.values(tables)) {
      const drizzleTable = loose[table.modelName];
      if (!is(drizzleTable, PgTable)) continue;
      const columns = getTableColumns(drizzleTable);
      const result = await client.query<{ column_name: string }>(
        "SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = $1",
        [getTableName(drizzleTable)],
      );
      const inDb = new Set(result.rows.map((row) => row.column_name));
      for (const [fieldKey, field] of Object.entries(table.fields)) {
        const column = columns[field.fieldName ?? fieldKey];
        if (column && !inDb.has(column.name)) {
          missing.push(`${getTableName(drizzleTable)}.${column.name}`);
        }
      }
    }

    expect(missing).toEqual([]);
  });

  it("os campos extras do usuário (role, sectorId, deactivatedAt) existem em schema.user", () => {
    const columns = getTableColumns(schema.user);
    for (const key of Object.keys(AUTH_USER_ADDITIONAL_FIELDS)) {
      expect(columns).toHaveProperty(key);
    }
  });

  it("o campo extra role aceita exatamente os papéis do app", () => {
    expect(AUTH_USER_ADDITIONAL_FIELDS.role.type).toEqual([
      "admin",
      "operator",
    ]);
    expect(getTableColumns(schema.user).role.enumValues).toEqual([
      "admin",
      "operator",
    ]);
  });
});
