import type { PGlite } from "@electric-sql/pglite";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { invite } from "@/db/schema/invites";
import { createTestDb, resetDb, type TestDb } from "../../../test/db";
import {
  ADMIN_INVITE_LABEL_MAX_LENGTH,
  createAdminInvite,
  formatAdminInviteOutput,
  parseAdminInviteArgs,
} from "./adminInvite";
import { consumeInvite, findInviteByToken } from "./inviteQueries";
import { INVITE_TTL_MS } from "./inviteState";
import { hashInviteToken } from "./token";

const NOW = new Date("2026-11-20T12:00:00.000Z");

describe("parseAdminInviteArgs", () => {
  it("sem argumentos: label nulo", () => {
    expect(parseAdminInviteArgs([])).toEqual({ label: null });
  });

  it("aceita --label Nome e --label=Nome", () => {
    expect(parseAdminInviteArgs(["--label", "Dono do sistema"])).toEqual({
      label: "Dono do sistema",
    });
    expect(parseAdminInviteArgs(["--label=Dono do sistema"])).toEqual({
      label: "Dono do sistema",
    });
  });

  it("apara espaços e trata vazio como nulo", () => {
    expect(parseAdminInviteArgs(["--label", "  Nome  "])).toEqual({
      label: "Nome",
    });
    expect(parseAdminInviteArgs(["--label="])).toEqual({ label: null });
    expect(parseAdminInviteArgs(["--label", "   "])).toEqual({ label: null });
  });

  it("preserva '=' e unicode dentro do valor", () => {
    expect(parseAdminInviteArgs(["--label=a=b ção"])).toEqual({
      label: "a=b ção",
    });
  });

  it("aceita exatamente o tamanho máximo e rejeita um a mais", () => {
    const max = "x".repeat(ADMIN_INVITE_LABEL_MAX_LENGTH);

    expect(parseAdminInviteArgs([`--label=${max}`])).toEqual({ label: max });
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
