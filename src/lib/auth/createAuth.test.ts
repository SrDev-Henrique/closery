import type { PGlite } from "@electric-sql/pglite";
import type { BetterAuthOptions } from "better-auth";
import { eq } from "drizzle-orm";
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import { invite, user } from "@/db/schema";
import { enabledSocialProviders } from "@/lib/auth/env";
import { INVITE_COOKIE } from "@/lib/auth/inviteCookie";
import {
  createTestAuth,
  sessionCookieOf,
  signUpWithInvite,
  TEST_AUTH_ENV,
} from "../../../test/auth";
import { createTestDb, resetDb, type TestDb } from "../../../test/db";
import { insertInvite, insertSector, insertUser } from "../../../test/fixtures";
import { createAuth } from "./createAuth";

const PASSWORD = "senha-segura-123";

let client: PGlite;
let db: TestDb;
let auth: ReturnType<typeof createTestAuth>;

beforeAll(async () => {
  ({ client, db } = await createTestDb());
  auth = createTestAuth(db);
});

afterAll(async () => {
  await client.close();
});

beforeEach(async () => {
  await resetDb(client);
});

// `auth.options` tem o tipo literal da configuração; aqui só lemos como o
// tipo geral para inspecionar campos opcionais.
function optionsOf(instance: {
  options: BetterAuthOptions;
}): BetterAuthOptions {
  return instance.options;
}

function newPerson(email: string) {
  return { name: "Pessoa Teste", email, password: PASSWORD };
}

async function allUsers() {
  return db.select().from(user);
}

async function inviteRow(id: string) {
  const [row] = await db.select().from(invite).where(eq(invite.id, id));
  if (!row) throw new Error("convite sumiu");
  return row;
}

describe("cadastro: o convite é o portão", () => {
  it("sem cookie: 403 SIGNUP_INVITE_ONLY e nada é criado", async () => {
    await expect(
      signUpWithInvite(auth, null, newPerson("a@example.com")),
    ).rejects.toMatchObject({
      statusCode: 403,
      body: { code: "SIGNUP_INVITE_ONLY" },
    });
    expect(await allUsers()).toHaveLength(0);
  });

  it("cookie com lixo (token malformado): 403 e nada é criado", async () => {
    await expect(
      signUpWithInvite(auth, "isto-nao-e-um-token", newPerson("a@example.com")),
    ).rejects.toMatchObject({
      statusCode: 403,
      body: { code: "SIGNUP_INVITE_ONLY" },
    });
    expect(await allUsers()).toHaveLength(0);
  });

  it("token bem formado mas inexistente: 403", async () => {
    await expect(
      signUpWithInvite(auth, "A".repeat(43), newPerson("a@example.com")),
    ).rejects.toMatchObject({
      statusCode: 403,
      body: { code: "SIGNUP_INVITE_ONLY" },
    });
    expect(await allUsers()).toHaveLength(0);
  });

  it("convite de admin: user.role admin, sectorId null, e-mail verificado, convite gasto e ligado ao usuário", async () => {
    const { id, token } = await insertInvite(db, {
      role: "admin",
      now: new Date(),
    });

    await signUpWithInvite(auth, token, newPerson("admin@example.com"));

    const [created] = await allUsers();
    expect(created).toMatchObject({
      email: "admin@example.com",
      role: "admin",
      sectorId: null,
      emailVerified: true,
      deactivatedAt: null,
    });
    const row = await inviteRow(id);
    expect(row.usedAt).toBeInstanceOf(Date);
    expect(row.usedBy).toBe(created?.id);
  });

  it("convite de operador: herda o setor do convite", async () => {
    const sector = await insertSector(db, "Setor do convite");
    const { token } = await insertInvite(db, {
      role: "operator",
      sectorId: sector.id,
      now: new Date(),
    });

    await signUpWithInvite(auth, token, newPerson("op@example.com"));

    const [created] = await allUsers();
    expect(created).toMatchObject({ role: "operator", sectorId: sector.id });
  });

  it.each([
    ["expirado", { expiresAt: new Date(Date.now() - 1000) }],
    ["já usado", { usedAt: new Date() }],
    ["cancelado", { cancelledAt: new Date() }],
  ])("convite %s: 403 e nada é criado", async (_label, patch) => {
    const { id, token } = await insertInvite(db, { role: "admin", ...patch });
    const before = await inviteRow(id);

    await expect(
      signUpWithInvite(auth, token, newPerson("x@example.com")),
    ).rejects.toMatchObject({
      statusCode: 403,
      body: { code: "SIGNUP_INVITE_ONLY" },
    });

    expect(await allUsers()).toHaveLength(0);
    expect(await inviteRow(id)).toEqual(before);
  });

  it("o mesmo convite não serve para duas contas", async () => {
    const { token } = await insertInvite(db, { role: "admin" });
    await signUpWithInvite(auth, token, newPerson("primeira@example.com"));

    await expect(
      signUpWithInvite(auth, token, newPerson("segunda@example.com")),
    ).rejects.toMatchObject({
      statusCode: 403,
      body: { code: "SIGNUP_INVITE_ONLY" },
    });
    expect(await allUsers()).toHaveLength(1);
  });

  it("e-mail já cadastrado: erro USER_ALREADY_EXISTS* e o convite NÃO é gasto", async () => {
    const first = await insertInvite(db, { role: "admin" });
    await signUpWithInvite(auth, first.token, newPerson("dono@example.com"));
    const second = await insertInvite(db, { role: "admin" });

    await expect(
      signUpWithInvite(auth, second.token, newPerson("dono@example.com")),
    ).rejects.toMatchObject({
      body: { code: expect.stringMatching(/^USER_ALREADY_EXISTS/) },
    });
    // maiúsculas no e-mail não burlam a checagem
    await expect(
      signUpWithInvite(auth, second.token, newPerson("DONO@Example.com")),
    ).rejects.toMatchObject({
      body: { code: expect.stringMatching(/^USER_ALREADY_EXISTS/) },
    });

    const row = await inviteRow(second.id);
    expect(row.usedAt).toBeNull();
    expect(row.usedBy).toBeNull();

    // o segundo convite continua servindo para outra pessoa
    await signUpWithInvite(auth, second.token, newPerson("outra@example.com"));
    expect(await allUsers()).toHaveLength(2);
  });

  it("o cliente não escolhe o papel: role admin no body com convite de operador continua operator", async () => {
    const sector = await insertSector(db);
    const { token } = await insertInvite(db, {
      role: "operator",
      sectorId: sector.id,
    });

    const body = { ...newPerson("op@example.com"), role: "admin" };
    await auth.api.signUpEmail({
      body,
      headers: new Headers({ cookie: `${INVITE_COOKIE}=${token}` }),
    });

    const [created] = await allUsers();
    expect(created).toMatchObject({ role: "operator", sectorId: sector.id });
  });

  it("o cliente não escolhe o setor: sectorId no body é recusado e o convite não é gasto", async () => {
    const own = await insertSector(db);
    const other = await insertSector(db);
    const { id, token } = await insertInvite(db, {
      role: "operator",
      sectorId: own.id,
    });

    const body = { ...newPerson("op@example.com"), sectorId: other.id };
    await expect(
      auth.api.signUpEmail({
        body,
        headers: new Headers({ cookie: `${INVITE_COOKIE}=${token}` }),
      }),
    ).rejects.toMatchObject({ statusCode: 400 });

    expect(await allUsers()).toHaveLength(0);
    expect((await inviteRow(id)).usedAt).toBeNull();
  });

  it("senha curta (7) é recusada antes de gastar o convite; 8 passa", async () => {
    const { id, token } = await insertInvite(db, { role: "admin" });

    await expect(
      signUpWithInvite(auth, token, {
        ...newPerson("a@example.com"),
        password: "1234567",
      }),
    ).rejects.toMatchObject({ body: { code: "PASSWORD_TOO_SHORT" } });
    expect((await inviteRow(id)).usedAt).toBeNull();

    await signUpWithInvite(auth, token, {
      ...newPerson("a@example.com"),
      password: "12345678",
    });
    expect(await allUsers()).toHaveLength(1);
  });

  it("fora de uma requisição (sem contexto) a criação de usuário é recusada", async () => {
    const context = await auth.$context;
    await expect(
      context.internalAdapter.createUser(
        {
          name: "Sem Contexto",
          email: "semcontexto@example.com",
          emailVerified: true,
        },
        { method: "email-password" },
      ),
    ).rejects.toMatchObject({ body: { code: "SIGNUP_INVITE_ONLY" } });
    expect(await allUsers()).toHaveLength(0);
  });
});

describe("login e sessão", () => {
  it("getSession com o cookie de sessão traz role e sectorId", async () => {
    const sector = await insertSector(db);
    const { token } = await insertInvite(db, {
      role: "operator",
      sectorId: sector.id,
    });
    await signUpWithInvite(auth, token, newPerson("op@example.com"));

    const { headers } = await auth.api.signInEmail({
      body: { email: "op@example.com", password: PASSWORD },
      returnHeaders: true,
    });
    const session = await auth.api.getSession({
      headers: new Headers({ cookie: sessionCookieOf(headers) }),
    });

    expect(session?.user).toMatchObject({
      email: "op@example.com",
      role: "operator",
      sectorId: sector.id,
      deactivatedAt: null,
    });
  });

  it("sem cookie de sessão, getSession devolve null", async () => {
    expect(await auth.api.getSession({ headers: new Headers() })).toBeNull();
  });

  it("senha errada: 401 INVALID_EMAIL_OR_PASSWORD", async () => {
    const { token } = await insertInvite(db, { role: "admin" });
    await signUpWithInvite(auth, token, newPerson("a@example.com"));

    await expect(
      auth.api.signInEmail({
        body: { email: "a@example.com", password: "senha-errada-123" },
      }),
    ).rejects.toMatchObject({
      statusCode: 401,
      body: { code: "INVALID_EMAIL_OR_PASSWORD" },
    });
  });

  it("usuário desativado: signInEmail responde 403 ACCOUNT_DEACTIVATED e não abre sessão", async () => {
    const { token } = await insertInvite(db, { role: "admin" });
    await signUpWithInvite(auth, token, newPerson("a@example.com"));
    await db.update(user).set({ deactivatedAt: new Date() });

    await expect(
      auth.api.signInEmail({
        body: { email: "a@example.com", password: PASSWORD },
      }),
    ).rejects.toMatchObject({
      statusCode: 403,
      body: { code: "ACCOUNT_DEACTIVATED" },
    });
    const sessions = await client.query(
      "SELECT count(*)::int AS n FROM session",
    );
    // só a sessão aberta pelo cadastro; o login recusado não criou outra
    expect(sessions.rows).toEqual([{ n: 1 }]);
  });

  it("e-mail sem conta de senha: INVALID_EMAIL_OR_PASSWORD, sem revelar se o e-mail existe", async () => {
    await insertUser(db, {
      role: "admin",
      sectorId: null,
      email: "so-banco@example.com",
    });
    await expect(
      auth.api.signInEmail({
        body: { email: "so-banco@example.com", password: PASSWORD },
      }),
    ).rejects.toMatchObject({ body: { code: "INVALID_EMAIL_OR_PASSWORD" } });
  });
});

describe("configuração", () => {
  it("sem variáveis sociais, nenhum provedor está ligado", () => {
    expect(optionsOf(auth).socialProviders).toEqual({});
    expect(enabledSocialProviders(TEST_AUTH_ENV)).toEqual([]);
  });

  it("com google e facebook, ambos ligados com disableImplicitSignUp", () => {
    const social = createTestAuth(db, {
      google: { clientId: "gid", clientSecret: "gsecret" },
      facebook: { clientId: "fid", clientSecret: "fsecret" },
    });
    expect(optionsOf(social).socialProviders).toEqual({
      google: {
        clientId: "gid",
        clientSecret: "gsecret",
        disableImplicitSignUp: true,
      },
      facebook: {
        clientId: "fid",
        clientSecret: "fsecret",
        disableImplicitSignUp: true,
      },
    });
  });

  it("só google configurado não liga o facebook", () => {
    const social = createTestAuth(db, {
      google: { clientId: "gid", clientSecret: "gsecret" },
    });
    expect(Object.keys(optionsOf(social).socialProviders ?? {})).toEqual([
      "google",
    ]);
  });

  it("e-mail e senha: mínimo 8 e sem recuperação de senha por e-mail", () => {
    expect(optionsOf(auth).emailAndPassword).toMatchObject({
      enabled: true,
      minPasswordLength: 8,
    });
    expect(optionsOf(auth).emailAndPassword?.sendResetPassword).toBeUndefined();
  });

  it("sem cookieCache e sem nextCookies (T7)", () => {
    expect(optionsOf(auth).session?.cookieCache).toBeUndefined();
    const ids = (optionsOf(auth).plugins ?? []).map((plugin) => plugin.id);
    expect(ids).toContain("passkey");
    expect(ids).not.toContain("next-cookies");
  });

  it("origem confiável é só a baseURL", () => {
    const custom = createTestAuth(db, { baseURL: "https://closery.app" });
    expect(optionsOf(custom).trustedOrigins).toEqual(["https://closery.app"]);
    expect(optionsOf(custom).baseURL).toBe("https://closery.app");
  });

  it("login social nunca vincula conta existente sozinho", () => {
    expect(
      optionsOf(auth).account?.accountLinking?.disableImplicitLinking,
    ).toBe(true);
  });

  it("rate limit: desligado fora de produção, ligado em produção com storage database", () => {
    expect(optionsOf(auth).rateLimit?.enabled).toBe(false);
    vi.stubEnv("NODE_ENV", "production");
    try {
      const prod = createAuth(db, TEST_AUTH_ENV);
      expect(optionsOf(prod).rateLimit).toMatchObject({
        enabled: true,
        storage: "database",
        window: 10,
        max: 100,
        customRules: {
          "/sign-in/email": { window: 60, max: 10 },
          "/sign-up/email": { window: 60, max: 5 },
        },
      });
    } finally {
      vi.unstubAllEnvs();
    }
  });
});
