import { describe, expect, it } from "vitest";

import { databaseHostOf, formatDatabaseHosts } from "./databaseHost";

describe("databaseHostOf", () => {
  it("devolve só o host, em minúsculas, sem usuário, senha, porta ou banco", () => {
    expect(
      databaseHostOf(
        "postgres://usr:s3nha@EP-abc-pooler.sa-east-1.aws.neon.tech:5432/db?sslmode=require",
      ),
    ).toBe("ep-abc-pooler.sa-east-1.aws.neon.tech");
  });

  it("o -pooler faz parte do host", () => {
    expect(databaseHostOf("postgresql://u:p@ep-a-pooler.example.test/db")).toBe(
      "ep-a-pooler.example.test",
    );
    expect(databaseHostOf("postgresql://u:p@ep-a.example.test/db")).toBe(
      "ep-a.example.test",
    );
  });

  it("string inválida ou vazia lança sem repetir o conteúdo (pode ter senha)", () => {
    for (const value of ["nao-e-url-s3nha", "", "postgres://u:s3nha@/db"]) {
      expect(() => databaseHostOf(value)).toThrow(
        "DATABASE_URL não é uma URL de conexão válida.",
      );
      try {
        databaseHostOf(value);
      } catch (error) {
        expect(String(error)).not.toContain("s3nha");
      }
    }
  });
});

describe("formatDatabaseHosts", () => {
  it("duas linhas: o host da aplicação e o das migrações, nunca usuário nem senha", () => {
    const text = formatDatabaseHosts({
      runtime: "postgresql://usr:s3nha@ep-a-pooler.example.test/db",
      migration: "postgresql://usr:s3nha@ep-a.example.test/db",
    });
    expect(text).toBe(
      [
        "Banco da aplicação (runtime): ep-a-pooler.example.test",
        "Banco das migrações (drizzle-kit): ep-a.example.test",
      ].join("\n"),
    );
    expect(text).not.toContain("s3nha");
    expect(text).not.toContain("usr");
  });

  it("variável ausente vira 'ausente' e URL inválida vira 'inválida'", () => {
    expect(
      formatDatabaseHosts({ runtime: undefined, migration: "lixo-s3nha" }),
    ).toBe(
      [
        "Banco da aplicação (runtime): ausente",
        "Banco das migrações (drizzle-kit): inválida",
      ].join("\n"),
    );
  });
});
