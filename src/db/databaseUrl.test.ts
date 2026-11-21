import { describe, expect, it } from "vitest";

import { resolveDatabaseUrls } from "./databaseUrl";

describe("resolveDatabaseUrls", () => {
  it("convenção A: DATABASE_URL direta + DATABASE_URL_POOLED", () => {
    expect(
      resolveDatabaseUrls({
        DATABASE_URL: "postgres://direta",
        DATABASE_URL_POOLED: "postgres://pooler",
      }),
    ).toEqual({ runtime: "postgres://pooler", migration: "postgres://direta" });
  });

  it("convenção B (neon env pull): DATABASE_URL pooler + DATABASE_URL_UNPOOLED", () => {
    expect(
      resolveDatabaseUrls({
        DATABASE_URL: "postgres://pooler",
        DATABASE_URL_UNPOOLED: "postgres://direta",
      }),
    ).toEqual({ runtime: "postgres://pooler", migration: "postgres://direta" });
  });

  it("só DATABASE_URL: usa a mesma para runtime e migração", () => {
    expect(resolveDatabaseUrls({ DATABASE_URL: "postgres://unica" })).toEqual({
      runtime: "postgres://unica",
      migration: "postgres://unica",
    });
  });

  it("a variável com sufixo vence o DATABASE_URL genérico", () => {
    const urls = resolveDatabaseUrls({
      DATABASE_URL: "postgres://generica",
      DATABASE_URL_POOLED: "postgres://pooler",
      DATABASE_URL_UNPOOLED: "postgres://direta",
    });
    expect(urls.runtime).toBe("postgres://pooler");
    expect(urls.migration).toBe("postgres://direta");
  });

  it("ausência total: ambos undefined", () => {
    expect(resolveDatabaseUrls({})).toEqual({
      runtime: undefined,
      migration: undefined,
    });
  });

  it("só as variáveis com sufixo: cada uma cobre o seu uso", () => {
    expect(
      resolveDatabaseUrls({ DATABASE_URL_POOLED: "postgres://pooler" }),
    ).toEqual({ runtime: "postgres://pooler", migration: undefined });
    expect(
      resolveDatabaseUrls({ DATABASE_URL_UNPOOLED: "postgres://direta" }),
    ).toEqual({ runtime: undefined, migration: "postgres://direta" });
  });
});
