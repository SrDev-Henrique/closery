import type { PGlite } from "@electric-sql/pglite";
import { afterEach, describe, expect, it } from "vitest";

import {
  applyMigration,
  migratedTo,
  migrationFile,
  statementsOf,
} from "../../../test/migrations";

// Aplica 0000–0003 (o banco como está depois da Fase 3), insere dados e aplica
// a 0004 por cima: é o que o db:migrate faz no Neon.
const SECTOR = "11111111-1111-4111-8111-111111111111";
const SHIFT = "22222222-2222-4222-8222-222222222222";
const ITEM = "33333333-3333-4333-8333-333333333333";
const DESTINATION = "44444444-4444-4444-8444-444444444444";
const HANDOVER = "55555555-5555-4555-8555-555555555555";

// Cada teste cria um PGlite novo e aplica todas as migrações: sob carga passa
// dos 15 s padrão (mesmo padrão da migration0003), então o describe leva 60 s.
describe("migração 0004 sobre os dados da 0003", { timeout: 60_000 }, () => {
  let client: PGlite | undefined;

  afterEach(async () => {
    await client?.close();
    client = undefined;
  });

  async function dbAtPhase3(): Promise<PGlite> {
    const created = await migratedTo(["0000", "0001", "0002", "0003"]);
    client = created;
    await created.exec(`
      INSERT INTO sector (id, name) VALUES ('${SECTOR}', 'ULD');
      INSERT INTO "user" (id, name, email, role, sector_id)
        VALUES ('u-admin', 'Admin Teste', 'admin@example.test', 'admin', NULL),
               ('u-ana', 'Ana Teste', 'ana@example.test', 'operator', '${SECTOR}'),
               ('u-bia', 'Bia Teste', 'bia@example.test', 'operator', '${SECTOR}');
      INSERT INTO shift (id, sector_id, name, starts_at, ends_at, sort_order)
        VALUES ('${SHIFT}', '${SECTOR}', 'Turno Manhã', '06:00', '14:00', 1);
      INSERT INTO item (id, sector_id, name, unit, kind, sort_order)
        VALUES ('${ITEM}', '${SECTOR}', 'Rede de proteção', 'rolo', 'stock', 1);
      INSERT INTO destination (id, name) VALUES ('${DESTINATION}', 'Doca 3');
      INSERT INTO handover (id, sector_id, shift_id, operational_date, status, delivered_by, delivered_at, occurrences_text)
        VALUES ('${HANDOVER}', '${SECTOR}', '${SHIFT}', '2026-11-20', 'delivered', 'u-ana', '2026-11-20T17:00:00Z', 'Tudo certo');
    `);
    return created;
  }

  it("é só aditiva: cria tabelas, constraints e índices, sem apagar nem alterar nada", () => {
    const statements = statementsOf(migrationFile("0004"));
    expect(statements.length).toBeGreaterThan(0);
    for (const statement of statements) {
      expect(statement).toMatch(
        /^(CREATE TABLE|ALTER TABLE "[a-z_]+" ADD CONSTRAINT|CREATE (UNIQUE )?INDEX)/,
      );
    }
  });

  it("a identity de seq vem dentro do CREATE TABLE: nenhum CREATE SEQUENCE separado", () => {
    const sql = statementsOf(migrationFile("0004")).join("\n");
    expect(sql).not.toMatch(/CREATE SEQUENCE/i);
    expect(sql).toMatch(/"seq" integer GENERATED ALWAYS AS IDENTITY/);
  });

  it("aplica e preserva setor, turno, item, destino, usuários e a passagem entregue", async () => {
    const pg = await dbAtPhase3();
    await applyMigration(pg, migrationFile("0004"));

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
      { name: "Doca 3" },
    ]);
    expect((await pg.query(`SELECT id FROM "user"`)).rows).toHaveLength(3);
    expect(
      (await pg.query("SELECT status, occurrences_text FROM handover")).rows,
    ).toEqual([{ status: "delivered", occurrences_text: "Tudo certo" }]);

    const tables = await pg.query<{ tablename: string }>(
      "SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename LIKE 'request%' ORDER BY tablename",
    );
    expect(tables.rows.map((row) => row.tablename)).toEqual([
      "request",
      "request_comment",
      "request_item",
      "request_status_event",
    ]);
  });

  it("as tabelas novas começam vazias e já referenciam destino, item e passagem da 0003", async () => {
    const pg = await dbAtPhase3();
    await applyMigration(pg, migrationFile("0004"));
    for (const table of [
      "request",
      "request_item",
      "request_status_event",
      "request_comment",
    ]) {
      expect((await pg.query(`SELECT 1 FROM ${table}`)).rows).toHaveLength(0);
    }

    const requestId = "66666666-6666-4666-8666-666666666666";
    await pg.exec(`
      INSERT INTO request (id, sector_id, destination_id, description, created_by, origin_handover_id)
        VALUES ('${requestId}', '${SECTOR}', '${DESTINATION}', 'Rede para a doca', 'u-ana', '${HANDOVER}');
      INSERT INTO request_item (request_id, item_id, item_name_snapshot, item_unit_snapshot, quantity)
        VALUES ('${requestId}', '${ITEM}', 'Rede de proteção', 'rolo', 12);
      INSERT INTO request_status_event (request_id, from_status, to_status, changed_by)
        VALUES ('${requestId}', NULL, 'requested', 'u-ana'),
               ('${requestId}', 'requested', 'in_transit', 'u-bia');
    `);
    const rows = await pg.query<{
      status: string;
      quantity: number;
      events: string;
    }>(
      `SELECT r.status, i.quantity,
              (SELECT string_agg(e.to_status, ',' ORDER BY e.seq) FROM request_status_event e WHERE e.request_id = r.id) AS events
         FROM request r JOIN request_item i ON i.request_id = r.id`,
    );
    expect(rows.rows).toEqual([
      { status: "requested", quantity: 12, events: "requested,in_transit" },
    ]);
  });

  it("cria os 12 CHECKs, os 11 índices, as 11 FKs restrict, a PK composta e a identity do contrato", async () => {
    const pg = await dbAtPhase3();
    await applyMigration(pg, migrationFile("0004"));

    const checks = await pg.query<{ conname: string }>(
      "SELECT conname FROM pg_constraint WHERE contype = 'c' AND conname LIKE 'request%' ORDER BY conname",
    );
    expect(checks.rows.map((row) => row.conname)).toEqual([
      "request_comment_body_not_blank",
      "request_comment_reason_not_deleted",
      "request_description_not_blank",
      "request_destination_exactly_one",
      "request_destination_other_not_blank",
      "request_item_quantity_positive",
      "request_status_changed_after_created",
      "request_status_event_changes",
      "request_status_event_creation_requested",
      "request_status_event_from_valid",
      "request_status_event_to_valid",
      "request_status_valid",
    ]);

    const indexes = await pg.query<{ indexname: string }>(
      "SELECT indexname FROM pg_indexes WHERE schemaname = 'public' AND tablename LIKE 'request%' AND indexname NOT LIKE '%_pkey' AND indexname NOT LIKE '%_pk' ORDER BY indexname",
    );
    expect(indexes.rows.map((row) => row.indexname)).toEqual([
      "request_comment_author_id_idx",
      "request_comment_request_idx",
      "request_comment_status_event_uq",
      "request_created_by_idx",
      "request_destination_id_idx",
      "request_item_item_id_idx",
      "request_origin_handover_id_idx",
      "request_sector_created_idx",
      "request_sector_status_changed_idx",
      "request_status_event_changed_by_idx",
      "request_status_event_request_idx",
    ]);

    const fks = await pg.query<{ confdeltype: string }>(
      "SELECT confdeltype FROM pg_constraint WHERE contype = 'f' AND conrelid::regclass::text LIKE 'request%'",
    );
    expect(fks.rows).toHaveLength(11);
    // 'r' = RESTRICT
    expect(new Set(fks.rows.map((row) => row.confdeltype))).toEqual(
      new Set(["r"]),
    );

    const primaryKeys = await pg.query<{ conname: string }>(
      "SELECT conname FROM pg_constraint WHERE contype = 'p' AND conrelid = 'request_item'::regclass",
    );
    expect(primaryKeys.rows).toEqual([
      { conname: "request_item_request_id_item_id_pk" },
    ]);

    // 'a' = GENERATED ALWAYS AS IDENTITY; só a seq do evento tem identity.
    const identities = await pg.query<{ relname: string; attname: string }>(
      `SELECT c.relname, a.attname
         FROM pg_attribute a JOIN pg_class c ON c.oid = a.attrelid
        WHERE a.attidentity = 'a' AND c.relname LIKE 'request%'`,
    );
    expect(identities.rows).toEqual([
      { relname: "request_status_event", attname: "seq" },
    ]);
  });
});
