import type { PGlite } from "@electric-sql/pglite";
import { afterEach, describe, expect, it } from "vitest";

import {
  applyMigration,
  migratedTo,
  migrationFile,
} from "../../../test/migrations";
import { sqlErrorOf } from "../../../test/sqlError";

// Aplica as migrações na ordem, parando antes da 0002, e insere dados "da
// produção" (Fase 1). Depois aplica a 0002 por cima: é o que o db:migrate faz
// no Neon.

describe("migração 0002 sobre os dados da 0001", () => {
  let client: PGlite | undefined;

  afterEach(async () => {
    await client?.close();
    client = undefined;
  });

  async function dbAtPhase1(): Promise<PGlite> {
    const created = await migratedTo(["0000", "0001"]);
    client = created;
    await created.exec(`
      INSERT INTO sector (id, name) VALUES ('11111111-1111-4111-8111-111111111111', 'ULD');
      INSERT INTO "user" (id, name, email, role, sector_id)
        VALUES ('u-admin', 'Admin Teste', 'admin@example.test', 'admin', NULL),
               ('u-op', 'Operador Teste', 'op@example.test', 'operator', '11111111-1111-4111-8111-111111111111');
      INSERT INTO invite (token_hash, role, sector_id, expires_at)
        VALUES ('hash-1', 'operator', '11111111-1111-4111-8111-111111111111', now() + interval '7 days');
    `);
    return created;
  }

  it("aplica e preserva setor, usuários e convites existentes", async () => {
    const pg = await dbAtPhase1();
    await applyMigration(pg, migrationFile("0002"));

    const sectors = await pg.query("SELECT name FROM sector");
    const users = await pg.query(`SELECT id FROM "user"`);
    const invites = await pg.query("SELECT role FROM invite");
    expect(sectors.rows).toEqual([{ name: "ULD" }]);
    expect(users.rows).toHaveLength(2);
    expect(invites.rows).toEqual([{ role: "operator" }]);

    const tables = await pg.query<{ tablename: string }>(
      "SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename IN ('shift', 'item', 'destination')",
    );
    expect(tables.rows).toHaveLength(3);
  });

  it("troca a constraint unique do setor pelo índice em lower(name)", async () => {
    const pg = await dbAtPhase1();
    await applyMigration(pg, migrationFile("0002"));

    const failure = await sqlErrorOf(
      pg.query("INSERT INTO sector (name) VALUES ('uld')"),
    );
    expect(failure).toEqual({
      code: "23505",
      constraint: "sector_name_lower_uq",
    });
  });

  it("falha, sem aplicar nada do que vem depois, se já houver setores que só diferem na caixa", async () => {
    const pg = await dbAtPhase1();
    await pg.exec("INSERT INTO sector (name) VALUES ('Uld')");

    const failure = await sqlErrorOf(applyMigration(pg, migrationFile("0002")));
    expect(failure.code).toBe("23505");

    const roleCheck = await pg.query(
      "SELECT 1 FROM pg_constraint WHERE conname = 'user_role_valid'",
    );
    expect(roleCheck.rows).toHaveLength(0);
  });

  it("falha se já houver usuário com papel fora de admin/operator", async () => {
    const pg = await dbAtPhase1();
    await pg.exec(
      `INSERT INTO "user" (id, name, email, role, sector_id) VALUES ('u-x', 'Fora', 'x@example.test', 'gerente', '11111111-1111-4111-8111-111111111111')`,
    );

    const failure = await sqlErrorOf(applyMigration(pg, migrationFile("0002")));
    expect(failure.code).toBe("23514");
  });
});
