import type { PGlite } from "@electric-sql/pglite";
import { eq } from "drizzle-orm";
import { DrizzleQueryError } from "drizzle-orm/errors";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { invite } from "@/db/schema/invites";
import { createTestDb, resetDb, type TestDb } from "../../../test/db";
import {
  ADMIN_INVITE_LABEL_MAX_LENGTH,
  assertHostConfirmed,
  createAdminInvite,
  formatAdminInviteError,
  formatAdminInviteOutput,
  formatAdminInviteTarget,
  parseAdminInviteArgs,
} from "./adminInvite";
import { consumeInvite, findInviteByToken } from "./inviteQueries";
import { INVITE_TTL_MS } from "./inviteState";
import { hashInviteToken } from "./token";

const NOW = new Date("2026-11-20T12:00:00.000Z");

describe("parseAdminInviteArgs: --confirmar-host", () => {
  it("aceita as duas formas e convive com --label", () => {
    expect(parseAdminInviteArgs(["--confirmar-host=db.example.com"])).toEqual({
      label: null,
      confirmHost: "db.example.com",
    });
    expect(
      parseAdminInviteArgs(["--confirmar-host", "db.example.com", "--label=A"]),
    ).toEqual({ label: "A", confirmHost: "db.example.com" });
  });

  it("vazio vira nulo; sem valor e repetido lançam", () => {
    expect(
      parseAdminInviteArgs(["--confirmar-host=  "]).confirmHost,
    ).toBeNull();
    expect(() => parseAdminInviteArgs(["--confirmar-host"])).toThrow(
      "Falta o valor de --confirmar-host.",
    );
    expect(() =>
      parseAdminInviteArgs(["--confirmar-host=a", "--confirmar-host=b"]),
    ).toThrow("--confirmar-host foi informado mais de uma vez.");
  });

  it("as mensagens trazem o uso novo, com a flag obrigatória", () => {
    expect(() => parseAdminInviteArgs(["--confirmar-host"])).toThrow(
      'Falta o valor de --confirmar-host. Uso: bun run admin:invite --confirmar-host=<host do banco> [--label "Nome de referência"]',
    );
  });

  it("flag com o nome parecido não vale como --confirmar-host", () => {
    expect(() => parseAdminInviteArgs(["--confirmar-hostx=a"])).toThrow(
      "Argumento desconhecido: --confirmar-hostx=a.",
    );
  });
});

describe("assertHostConfirmed", () => {
  it("passa quando confere, ignorando maiúsculas", () => {
    expect(() =>
      assertHostConfirmed("db.example.com", "DB.example.com"),
    ).not.toThrow();
  });

  it("sem confirmação recusa e diz como confirmar", () => {
    expect(() => assertHostConfirmed("db.example.com", null)).toThrow(
      "--confirmar-host=db.example.com",
    );
  });

  it("host diferente recusa (inclusive prefixo e sufixo)", () => {
    expect(() =>
      assertHostConfirmed("db.example.com", "outro.example.com"),
    ).toThrow("não confere");
    expect(() =>
      assertHostConfirmed("db.example.com", "db.example.com.evil"),
    ).toThrow("não confere");
    expect(() => assertHostConfirmed("db.example.com", "db.example")).toThrow(
      "não confere",
    );
  });
});

describe("formatAdminInviteTarget", () => {
  it("mostra só o host do banco e a BETTER_AUTH_URL", () => {
    const text = formatAdminInviteTarget({
      databaseHost: "db.example.com",
      baseURL: "https://app.vercel.app",
    });
    expect(text).toContain("Banco de destino: db.example.com");
    expect(text).toContain("BETTER_AUTH_URL:  https://app.vercel.app");
  });
});

describe("parseAdminInviteArgs", () => {
  it("sem argumentos: label nulo", () => {
    expect(parseAdminInviteArgs([])).toEqual({
      label: null,
      confirmHost: null,
    });
  });

  it("aceita --label Nome e --label=Nome", () => {
    expect(parseAdminInviteArgs(["--label", "Dono do sistema"])).toEqual({
      label: "Dono do sistema",
      confirmHost: null,
    });
    expect(parseAdminInviteArgs(["--label=Dono do sistema"])).toEqual({
      label: "Dono do sistema",
      confirmHost: null,
    });
  });

  it("apara espaços e trata vazio como nulo", () => {
    expect(parseAdminInviteArgs(["--label", "  Nome  "])).toEqual({
      label: "Nome",
      confirmHost: null,
    });
    expect(parseAdminInviteArgs(["--label="])).toEqual({
      label: null,
      confirmHost: null,
    });
    expect(parseAdminInviteArgs(["--label", "   "])).toEqual({
      label: null,
      confirmHost: null,
    });
  });

  it("preserva '=' e unicode dentro do valor", () => {
    expect(parseAdminInviteArgs(["--label=a=b ção"])).toEqual({
      label: "a=b ção",
      confirmHost: null,
    });
  });

  it("aceita exatamente o tamanho máximo e rejeita um a mais", () => {
    const max = "x".repeat(ADMIN_INVITE_LABEL_MAX_LENGTH);

    expect(parseAdminInviteArgs([`--label=${max}`])).toEqual({
      label: max,
      confirmHost: null,
    });
    expect(() => parseAdminInviteArgs([`--label=${max}x`])).toThrow(
      `--label aceita no máximo ${ADMIN_INVITE_LABEL_MAX_LENGTH} caracteres.`,
    );
  });

  it("argumento desconhecido lança Error em português", () => {
    expect(() => parseAdminInviteArgs(["--foo"])).toThrow(
      "Argumento desconhecido: --foo.",
    );
    expect(() => parseAdminInviteArgs(["Nome"])).toThrow(
      "Argumento desconhecido: Nome.",
    );
    expect(() => parseAdminInviteArgs(["--label", "a", "extra"])).toThrow(
      "Argumento desconhecido: extra.",
    );
  });

  it("--label sem valor lança", () => {
    expect(() => parseAdminInviteArgs(["--label"])).toThrow(
      "Falta o valor de --label.",
    );
  });

  it("--label repetido lança", () => {
    expect(() => parseAdminInviteArgs(["--label=a", "--label=b"])).toThrow(
      "--label foi informado mais de uma vez.",
    );
  });
});

describe("formatAdminInviteOutput", () => {
  it("mostra o link e a validade no horário de Brasília", () => {
    const text = formatAdminInviteOutput({
      url: "http://localhost:3000/convite/abc",
      expiresAt: new Date("2026-11-27T15:30:00.000Z"),
    });

    expect(text).toContain("Convite de administrador criado.");
    expect(text).toContain("Link: http://localhost:3000/convite/abc");
    expect(text).toMatch(
      /Válido até: 27\/11\/2026,? 12:30 \(horário de Brasília\)/,
    );
  });
});

describe("createAdminInvite", () => {
  let client: PGlite;
  let db: TestDb;

  beforeAll(async () => {
    ({ client, db } = await createTestDb());
  });

  afterAll(async () => {
    await client.close();
  });

  beforeEach(async () => {
    await resetDb(client);
  });

  it("cria convite de admin e devolve link e validade de 7 dias", async () => {
    const result = await createAdminInvite(db, {
      label: "Dono do sistema",
      baseURL: "http://localhost:3000",
      now: NOW,
    });

    expect(result.expiresAt).toEqual(new Date(NOW.getTime() + INVITE_TTL_MS));
    expect(result.url).toMatch(
      /^http:\/\/localhost:3000\/convite\/[A-Za-z0-9_-]{43}$/,
    );
  });

  it("o link devolvido abre um convite válido de admin, sem setor nem convidante", async () => {
    const result = await createAdminInvite(db, {
      label: "Dono do sistema",
      baseURL: "http://localhost:3000/",
      now: NOW,
    });
    const token = result.url.split("/convite/")[1] ?? "";

    expect(await findInviteByToken(db, token, NOW)).toEqual({
      state: "valid",
      role: "admin",
      sectorName: null,
      inviterName: null,
      inviteeLabel: "Dono do sistema",
      expiresAt: result.expiresAt,
    });
    expect(await consumeInvite(db, token, NOW)).toEqual({
      role: "admin",
      sectorId: null,
    });
  });

  it("grava só o hash do token do link", async () => {
    const result = await createAdminInvite(db, {
      label: null,
      baseURL: "https://closery.example",
      now: NOW,
    });
    const token = result.url.split("/convite/")[1] ?? "";

    const rows = await db.select().from(invite);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.tokenHash).toBe(hashInviteToken(token));
    expect(JSON.stringify(rows)).not.toContain(token);
    expect(rows[0]?.inviteeLabel).toBeNull();
  });

  it("dois convites seguidos geram links diferentes", async () => {
    const input = { label: null, baseURL: "http://localhost:3000", now: NOW };

    const first = await createAdminInvite(db, input);
    const second = await createAdminInvite(db, input);

    expect(first.url).not.toBe(second.url);
    expect(await db.select().from(invite)).toHaveLength(2);
  });

  it("baseURL inválida lança em português e não grava convite", async () => {
    await expect(
      createAdminInvite(db, {
        label: null,
        baseURL: "localhost:3000 sem esquema",
        now: NOW,
      }),
    ).rejects.toThrow("BETTER_AUTH_URL não é uma URL absoluta");

    expect(
      await db.select().from(invite).where(eq(invite.role, "admin")),
    ).toHaveLength(0);
  });
});

describe("formatAdminInviteError", () => {
  it("mantém a mensagem dos erros do próprio script", () => {
    expect(
      formatAdminInviteError(new Error("--confirmar-host não confere.")),
    ).toBe("Erro: --confirmar-host não confere.");
  });

  it("erro do banco vira uma linha sem SQL, parâmetros nem e-mail, com o código", () => {
    const cause = Object.assign(new Error("duplicate key value"), {
      code: "23505",
    });
    const error = new DrizzleQueryError(
      'insert into "invite" ("token_hash") values ($1)',
      ["ana@exemplo.test"],
      cause,
    );

    const text = formatAdminInviteError(error);

    expect(text).toBe(
      "Erro: falha inesperada ao gravar o convite (DrizzleQueryError, código 23505). Confira no banco se o convite foi criado antes de rodar de novo.",
    );
    expect(text).not.toContain("ana@exemplo.test");
    expect(text).not.toContain("insert");
  });
});
