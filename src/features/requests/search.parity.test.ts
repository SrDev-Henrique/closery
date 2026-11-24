import type { PGlite } from "@electric-sql/pglite";
import { sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createTestDb, type TestDb } from "../../../test/db";
import { foldForSearch, SEARCH_FOLD_FROM, SEARCH_FOLD_TO } from "./search";
import { foldSql } from "./sql";

// A busca dobra acento e caixa no SQL (foldSql) e a URL é dobrada no JS
// (foldForSearch): o padrão ILIKE só acha o que o SQL guardou se os dois
// fizerem a mesma conta. Palavras sempre em NFC (o domínio grava em NFC).
const WORDS = [
  "separação rápida",
  "SEPARAÇÃO RÁPIDA",
  "Água",
  "ÁGUA",
  "Pão de Queijo",
  "AÇÃO",
  "Ñandú",
  "ÀÉÎÕÜ",
  "Doca 3",
  "100% (urgente) _ \\",
  "sem acento nenhum",
  "😀 emoji",
  "",
  ...Array.from(SEARCH_FOLD_FROM),
  ...Array.from(SEARCH_FOLD_FROM).map((letter) => letter.toUpperCase()),
];

let client: PGlite;
let db: TestDb;

beforeAll(async () => {
  ({ client, db } = await createTestDb());
});

afterAll(async () => {
  await client.close();
});

describe("paridade search.ts × SQL", () => {
  it("os dois alfabetos de dobra têm o mesmo tamanho", () => {
    expect(Array.from(SEARCH_FOLD_FROM)).toHaveLength(24);
    expect(Array.from(SEARCH_FOLD_TO)).toHaveLength(24);
  });

  it("foldSql devolve o mesmo que foldForSearch para cada palavra", async () => {
    for (const word of WORDS) {
      const [row] = await db
        .select({ folded: foldSql(sql`${word}::text`) })
        .from(sql`(values (1)) as one(n)`);
      expect(row?.folded, JSON.stringify(word)).toBe(foldForSearch(word));
    }
  });

  it("separação rápida vira separacao rapida nos dois", async () => {
    const [row] = await db
      .select({ folded: foldSql(sql`${"SEPARAÇÃO Rápida"}::text`) })
      .from(sql`(values (1)) as one(n)`);
    expect(row?.folded).toBe("separacao rapida");
    expect(foldForSearch("SEPARAÇÃO Rápida")).toBe("separacao rapida");
  });
});
