import type { PGlite } from "@electric-sql/pglite";
import { afterEach, describe, expect, it } from "vitest";

import {
  applyMigration,
  migratedTo,
  migrationFile,
  statementsOf,
} from "../../../test/migrations";

// Aplica 0000–0002 (o banco como está depois da Fase 2), insere dados e aplica
// a 0003 por cima: é o que o db:migrate faz no Neon.
const SECTOR = "11111111-1111-4111-8111-111111111111";
const SHIFT = "22222222-2222-4222-8222-222222222222";
const ITEM = "33333333-3333-4333-8333-333333333333";

// Cada teste cria um PGlite novo e aplica todas as migrações: sob carga passa
// dos 15 s padrão (mesmo padrão da migration0002), então o describe leva 60 s.
describe("migração 0003 sobre os dados da 0002", { timeout: 60_000 }, () => {
  let client: PGlite | undefined;

  afterEach(async () => {
    await client?.close();
    client = undefined;
  });

  async function dbAtPhase2(): Promise<PGlite> {
    const created = await migratedTo(["0000", "0001", "0002"]);
    client = created;
    await created.exec(`
      INSERT INTO sector (id, name) VALUES ('${SECTOR}', 'ULD');
      INSERT INTO "user" (id, name, email, role, sector_id)
        VALUES ('u-admin', 'Admin Teste', 'admin@example.test', 'admin', NULL),
               ('u-op', 'Operador Teste', 'op@example.test', 'operator', '${SECTOR}');
      INSERT INTO shift (id, sector_id, name, starts_at, ends_at, sort_order)
        VALUES ('${SHIFT}', '${SECTOR}', 'Turno Manhã', '06:00', '14:00', 1);
      INSERT INTO item (id, sector_id, name, unit, kind, sort_order)
        VALUES ('${ITEM}', '${SECTOR}', 'Rede de proteção', 'rolo', 'stock', 1);
      INSERT INTO destination (name) VALUES ('Destino Teste');
    `);
    return created;
  }

  it("é só aditiva: cria tabelas, constraints e índices, sem apagar nem alterar nada", () => {
    const statements = statementsOf(migrationFile("0003"));
    expect(statements.length).toBeGreaterThan(0);
    for (const statement of statements) {
      expect(statement).toMatch(
        /^(CREATE TABLE|ALTER TABLE "[a-z_]+" ADD CONSTRAINT|CREATE (UNIQUE )?INDEX)/,
      );
    }
  });

  it("aplica e preserva setor, turno, item, destino e usuários existentes", async () => {
    const pg = await dbAtPhase2();
    await applyMigration(pg, migrationFile("0003"));

    expect((await pg.query("SELECT name FROM sector")).rows).toEqual([
      { name: "ULD" },
    ]);
    expect((await pg.query("SELECT name FROM shift")).rows).toEqual([
      { name: "Turno Manhã" },
    ]);
    expect((await pg.query("SELECT name FROM item")).rows).toEqual([
      { name: "Rede de proteção" },
    ]);
    expect((await pg.query("SELECT name FROM destination")).rows).toEqual([
      { name: "Destino Teste" },
    ]);
    expect((await pg.query(`SELECT id FROM "user"`)).rows).toHaveLength(2);

    const tables = await pg.query<{ tablename: string }>(
      "SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename LIKE 'handover%' ORDER BY tablename",
    );
    expect(tables.rows.map((row) => row.tablename)).toEqual([
      "handover",
      "handover_correction",
      "handover_item",
    ]);
  });

  it("as tabelas novas começam vazias e já referenciam os turnos e itens da 0002", async () => {
    const pg = await dbAtPhase2();
    await applyMigration(pg, migrationFile("0003"));
    expect((await pg.query("SELECT 1 FROM handover")).rows).toHaveLength(0);

    await pg.exec(`
      INSERT INTO handover (id, sector_id, shift_id, operational_date)
        VALUES ('44444444-4444-4444-8444-444444444444', '${SECTOR}', '${SHIFT}', '2026-11-20');
      INSERT INTO handover_item (handover_id, item_id, quantity)
        VALUES ('44444444-4444-4444-8444-444444444444', '${ITEM}', 2);
    `);
    const rows = await pg.query<{ operational_date: string; quantity: number }>(
      "SELECT h.operational_date::text AS operational_date, i.quantity FROM handover h JOIN handover_item i ON i.handover_id = h.id",
    );
    expect(rows.rows).toEqual([
      { operational_date: "2026-11-20", quantity: 2 },
    ]);
  });

  it("cria os 8 CHECKs, os 10 índices e as 10 FKs restrict do contrato", async () => {
    const pg = await dbAtPhase2();
    await applyMigration(pg, migrationFile("0003"));

    const checks = await pg.query<{ conname: string }>(
      "SELECT conname FROM pg_constraint WHERE contype = 'c' AND conname LIKE 'handover%' ORDER BY conname",
    );
    expect(checks.rows.map((row) => row.conname)).toEqual([
      "handover_confirmer_ne_deliverer",
      "handover_correction_field_valid",
      "handover_correction_item_matches_field",
      "handover_correction_reason_not_blank",
      "handover_item_kind_snapshot_valid",
      "handover_item_quantity_nonneg",
      "handover_state_consistent",
      "handover_status_valid",
    ]);

    const indexes = await pg.query<{ indexname: string }>(
      "SELECT indexname FROM pg_indexes WHERE schemaname = 'public' AND tablename LIKE 'handover%' AND indexname NOT LIKE '%_pkey' AND indexname NOT LIKE '%_pk' ORDER BY indexname",
    );
    expect(indexes.rows.map((row) => row.indexname)).toEqual([
      "handover_confirmed_by_idx",
      "handover_correction_corrected_by_idx",
      "handover_correction_handover_idx",
      "handover_correction_item_id_idx",
      "handover_delivered_by_idx",
      "handover_item_item_id_idx",
      "handover_sector_date_idx",
      "handover_sector_shift_date_uq",
      "handover_shift_id_idx",
      "handover_updated_by_idx",
    ]);

    const fks = await pg.query<{ confdeltype: string }>(
      "SELECT confdeltype FROM pg_constraint WHERE contype = 'f' AND conrelid::regclass::text LIKE 'handover%'",
    );
    expect(fks.rows).toHaveLength(10);
    // 'r' = RESTRICT
    expect(new Set(fks.rows.map((row) => row.confdeltype))).toEqual(
      new Set(["r"]),
    );
  });
});
