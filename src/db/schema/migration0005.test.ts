import type { PGlite } from "@electric-sql/pglite";
import { afterEach, describe, expect, it } from "vitest";

import {
  applyMigration,
  migratedTo,
  migrationFile,
  statementsOf,
} from "../../../test/migrations";
import { sqlErrorOf } from "../../../test/sqlError";

// Aplica 0000–0004 (o banco como está em produção antes da cor do setor), insere
// setores "de antes" e aplica a 0005 por cima: é o que o db:migrate faz no Neon.
const PHASE_6 = ["0000", "0001", "0002", "0003", "0004"] as const;

function sectorId(n: number): string {
  return `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
}

describe(
  "migração 0005 (cor do setor) sobre os dados da 0004",
  {
    timeout: 60_000,
  },
  () => {
    let client: PGlite | undefined;

    afterEach(async () => {
      await client?.close();
      client = undefined;
    });

    async function dbBeforeColor(inserts = ""): Promise<PGlite> {
      const created = await migratedTo(PHASE_6);
      client = created;
      if (inserts !== "") await created.exec(inserts);
      return created;
    }

    async function colorsByName(pg: PGlite): Promise<Record<string, string>> {
      const { rows } = await pg.query<{ name: string; color: string }>(
        "SELECT name, color FROM sector ORDER BY created_at, id",
      );
      return Object.fromEntries(rows.map((row) => [row.name, row.color]));
    }

    it("o SQL editado segue a ordem: coluna anulável, preenchimento, NOT NULL, check", () => {
      const statements = statementsOf(migrationFile("0005"));

      expect(statements).toHaveLength(4);
      expect(statements[0]).toBe(
        'ALTER TABLE "sector" ADD COLUMN "color" text;',
      );
      expect(statements[1]).toMatch(/^UPDATE "sector" SET "color" = /);
      expect(statements[1]).toContain("row_number() OVER");
      expect(statements[1]).toContain('ORDER BY "created_at", "id"');
      expect(statements[2]).toBe(
        'ALTER TABLE "sector" ALTER COLUMN "color" SET NOT NULL;',
      );
      expect(statements[3]).toMatch(
        /^ALTER TABLE "sector" ADD CONSTRAINT "sector_color_valid" CHECK /,
      );
    });

    it("os setores que já existem ganham cor pela ordem de created_at, ciclando a paleta uma vez", async () => {
      // Inseridos fora de ordem de propósito: a ordem da cor é a do created_at, não a do insert.
      const pg = await dbBeforeColor(`
      INSERT INTO sector (id, name, created_at) VALUES
        ('${sectorId(3)}', 'Terceiro', '2026-01-03T00:00:00Z'),
        ('${sectorId(7)}', 'Sétimo',   '2026-01-07T00:00:00Z'),
        ('${sectorId(1)}', 'Primeiro', '2026-01-01T00:00:00Z'),
        ('${sectorId(5)}', 'Quinto',   '2026-01-05T00:00:00Z'),
        ('${sectorId(2)}', 'Segundo',  '2026-01-02T00:00:00Z'),
        ('${sectorId(6)}', 'Sexto',    '2026-01-06T00:00:00Z'),
        ('${sectorId(4)}', 'Quarto',   '2026-01-04T00:00:00Z');
    `);

      await applyMigration(pg, migrationFile("0005"));

      expect(await colorsByName(pg)).toEqual({
        Primeiro: "lilac",
        Segundo: "peach",
        Terceiro: "sky",
        Quarto: "green",
        Quinto: "pink",
        Sexto: "lilac",
        Sétimo: "peach",
      });
    });

    it("setores com o mesmo created_at desempatam pelo id (resultado estável)", async () => {
      const pg = await dbBeforeColor(`
      INSERT INTO sector (id, name, created_at) VALUES
        ('${sectorId(2)}', 'Id dois', '2026-02-01T00:00:00Z'),
        ('${sectorId(1)}', 'Id um',   '2026-02-01T00:00:00Z'),
        ('${sectorId(3)}', 'Depois',  '2026-02-02T00:00:00Z');
    `);

      await applyMigration(pg, migrationFile("0005"));

      expect(await colorsByName(pg)).toEqual({
        "Id um": "lilac",
        "Id dois": "peach",
        Depois: "sky",
      });
    });

    it("setor inativo também recebe cor, e nome, ativo e pessoas ficam como estavam", async () => {
      const pg = await dbBeforeColor(`
      INSERT INTO sector (id, name, active, created_at) VALUES
        ('${sectorId(1)}', 'ULD', true, '2026-03-01T00:00:00Z'),
        ('${sectorId(2)}', 'Antigo', false, '2026-03-02T00:00:00Z');
      INSERT INTO "user" (id, name, email, role, sector_id)
        VALUES ('u-ana', 'Ana Teste', 'ana@example.test', 'operator', '${sectorId(1)}');
    `);

      await applyMigration(pg, migrationFile("0005"));

      const { rows } = await pg.query(
        "SELECT name, active, color FROM sector ORDER BY created_at",
      );
      expect(rows).toEqual([
        { name: "ULD", active: true, color: "lilac" },
        { name: "Antigo", active: false, color: "peach" },
      ]);
      const people = await pg.query(
        `SELECT sector_id FROM "user" WHERE id = 'u-ana'`,
      );
      expect(people.rows).toEqual([{ sector_id: sectorId(1) }]);
    });

    it("banco sem nenhum setor migra sem erro", async () => {
      const pg = await dbBeforeColor();

      await applyMigration(pg, migrationFile("0005"));

      const { rows } = await pg.query("SELECT count(*)::int AS n FROM sector");
      expect(rows).toEqual([{ n: 0 }]);
    });

    it("depois da migração a coluna é NOT NULL e não tem valor padrão", async () => {
      const pg = await dbBeforeColor();
      await applyMigration(pg, migrationFile("0005"));

      const { rows } = await pg.query(
        `SELECT is_nullable, column_default FROM information_schema.columns
       WHERE table_name = 'sector' AND column_name = 'color'`,
      );
      expect(rows).toEqual([{ is_nullable: "NO", column_default: null }]);

      expect(
        (
          await sqlErrorOf(
            pg.query("INSERT INTO sector (name) VALUES ('Sem cor')"),
          )
        ).code,
      ).toBe("23502");
    });

    it("depois da migração uma cor fora da paleta é recusada com 23514 e o nome da constraint", async () => {
      const pg = await dbBeforeColor();
      await applyMigration(pg, migrationFile("0005"));

      for (const invalid of ["red", "", "Lilac", "lilac "]) {
        expect(
          await sqlErrorOf(
            pg.query("INSERT INTO sector (name, color) VALUES ('X', $1)", [
              invalid,
            ]),
          ),
          invalid,
        ).toEqual({ code: "23514", constraint: "sector_color_valid" });
      }
      const { rows } = await pg.query("SELECT count(*)::int AS n FROM sector");
      expect(rows).toEqual([{ n: 0 }]);
    });

    it("depois da migração as cinco cores da paleta são aceitas", async () => {
      const pg = await dbBeforeColor();
      await applyMigration(pg, migrationFile("0005"));

      for (const color of ["lilac", "peach", "sky", "green", "pink"]) {
        await pg.query("INSERT INTO sector (name, color) VALUES ($1, $1)", [
          color,
        ]);
      }
      const { rows } = await pg.query("SELECT count(*)::int AS n FROM sector");
      expect(rows).toEqual([{ n: 5 }]);
    });
  },
);
