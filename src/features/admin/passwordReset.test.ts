import type { PGlite } from "@electric-sql/pglite";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { account, session, user, verification } from "@/db/schema/auth";
import type { Authz } from "@/features/authz/authz";
import {
  createTestAuth,
  signUpWithInvite,
  TEST_AUTH_ENV,
} from "../../../test/auth";
import { createTestDb, resetDb, type TestDb } from "../../../test/db";
import { insertInvite, insertSector, insertUser } from "../../../test/fixtures";
import {
  PASSWORD_RESET_FORBIDDEN_MESSAGE,
  PERSON_RESET_INACTIVE_MESSAGE,
} from "./messages";
import {
  buildPasswordResetUrl,
  createPasswordResetLink,
  PASSWORD_RESET_TTL_MS,
} from "./passwordReset";
import { setPersonActive } from "./people";

const NOW = new Date("2026-11-25T12:00:00.000Z");
const BASE_URL = TEST_AUTH_ENV.baseURL;
const OLD_PASSWORD = "senha-antiga-123";
const NEW_PASSWORD = "senha-nova-4567";

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

function adminActor(userId = "admin-1"): Authz {
  return {
    userId,
    name: "Admin Teste",
    email: "admin@example.test",
    role: "admin",
    sectorId: null,
  };
}

function operatorActor(): Authz {
  return {
    userId: "op-1",
    name: "Operador Teste",
    email: "op@example.test",
    role: "operator",
    sectorId: "s",
  };
}

// Pessoa real: cadastro pelo portão do convite (cria user + conta credential).
async function signedUpOperator(email = "ana@example.test") {
  const sector = await insertSector(db);
  const { token } = await insertInvite(db, {
    role: "operator",
    sectorId: sector.id,
    now: new Date(),
  });
  await signUpWithInvite(auth, token, {
    name: "Ana Teste",
    email,
    password: OLD_PASSWORD,
  });
  const [row] = await db.select().from(user).where(eq(user.email, email));
  if (!row) throw new Error("usuário não criado");
  return row;
}

function tokenOf(url: string): string {
  const token = new URL(url).hash.replace("#token=", "");
  if (!token) throw new Error(`link sem token: ${url}`);
  return token;
}

async function link(userId: string, now = NOW) {
  const result = await createPasswordResetLink(
    db,
    auth,
    { actor: adminActor(), userId, baseURL: BASE_URL },
    now,
  );
  if (!result.ok) throw new Error(`link falhou: ${result.message}`);
  return { ...result, token: tokenOf(result.url) };
}

function http(
  path: string,
  body: unknown,
  headers: Record<string, string> = {},
) {
  return auth.handler(
    new Request(`${BASE_URL}/api/auth${path}`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        origin: BASE_URL,
        ...headers,
      },
      body: JSON.stringify(body),
    }),
  );
}

const resetWith = (token: string, newPassword = NEW_PASSWORD) =>
  http("/reset-password", { token, newPassword });

const signIn = (email: string, password: string) =>
  http("/sign-in/email", { email, password });

async function errorCode(res: Response): Promise<string | undefined> {
  const body: unknown = await res.json();
  return typeof body === "object" &&
    body !== null &&
    "code" in body &&
    typeof body.code === "string"
    ? body.code
    : undefined;
}

describe("buildPasswordResetUrl", () => {
  it("usa só a origem e põe o token no fragmento", () => {
    expect(
      buildPasswordResetUrl(
        "https://closery.example.test/qualquer/coisa",
        "abc",
      ),
    ).toBe("https://closery.example.test/redefinir-senha#token=abc");
  });

  it("URL sem protocolo lança", () => {
    expect(() => buildPasswordResetUrl("localhost:3000", "abc")).toThrow(
      /URL base inválida/,
    );
  });
});

describe("createPasswordResetLink", () => {
  it("devolve o link com o token no fragmento e validade de 24 h exatas", async () => {
    const person = await signedUpOperator();
    const made = await link(person.id);
    expect(made.url.startsWith(`${BASE_URL}/redefinir-senha#token=`)).toBe(
      true,
    );
    expect(made.token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(made.expiresAt.getTime()).toBe(
      NOW.getTime() + PASSWORD_RESET_TTL_MS,
    );
  });

  it("o banco guarda só o hash do token, e o value é o userId", async () => {
    const person = await signedUpOperator();
    const made = await link(person.id);
    const rows = await db.select().from(verification);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.identifier).not.toContain(made.token);
    expect(rows[0]?.identifier).not.toContain("reset-password");
    expect(rows[0]?.value).toBe(person.id);
  });

  it("operador não gera (FORBIDDEN, com a mensagem) e nada é gravado", async () => {
    const person = await signedUpOperator();
    const result = await createPasswordResetLink(
      db,
      auth,
      { actor: operatorActor(), userId: person.id, baseURL: BASE_URL },
      NOW,
    );
    expect(result).toEqual({
      ok: false,
      code: "FORBIDDEN",
      message: PASSWORD_RESET_FORBIDDEN_MESSAGE,
    });
    expect(await db.select().from(verification)).toHaveLength(0);
  });

  it("pessoa inexistente: NOT_FOUND e nada é gravado", async () => {
    const result = await createPasswordResetLink(
      db,
      auth,
      { actor: adminActor(), userId: "nao-existe", baseURL: BASE_URL },
      NOW,
    );
    expect(result).toMatchObject({ ok: false, code: "NOT_FOUND" });
    expect(await db.select().from(verification)).toHaveLength(0);
  });

  it("pessoa desativada: PERSON_INACTIVE com a mensagem exata e nada é gravado", async () => {
    const person = await signedUpOperator();
    await db
      .update(user)
      .set({ deactivatedAt: NOW })
      .where(eq(user.id, person.id));
    const result = await createPasswordResetLink(
      db,
      auth,
      { actor: adminActor(), userId: person.id, baseURL: BASE_URL },
      NOW,
    );
    expect(result).toEqual({
      ok: false,
      code: "PERSON_INACTIVE",
      message: PERSON_RESET_INACTIVE_MESSAGE,
    });
    expect(await db.select().from(verification)).toHaveLength(0);
  });

  it("baseURL sem protocolo lança (nunca grava link sem URL para mostrar)", async () => {
    const person = await signedUpOperator();
    await expect(
      createPasswordResetLink(
        db,
        auth,
        { actor: adminActor(), userId: person.id, baseURL: "localhost:3000" },
        NOW,
      ),
    ).rejects.toThrow(/BETTER_AUTH_URL/);
    expect(await db.select().from(verification)).toHaveLength(0);
  });

  it("link novo derruba o anterior e deixa as verificações de outro tipo", async () => {
    const person = await signedUpOperator();
    await db.insert(verification).values({
      id: "outra-verificacao",
      identifier: "passkey-challenge:xyz",
      value: JSON.stringify({ userId: person.id, challenge: "abc" }),
      expiresAt: new Date(Date.now() + 60_000),
    });
    await link(person.id, new Date());
    await link(person.id, new Date());
    const rows = await db.select().from(verification);
    expect(rows).toHaveLength(2);
    expect(rows.map((row) => row.id)).toContain("outra-verificacao");
  });
});

describe("redefinição de verdade (POST /api/auth/reset-password)", () => {
  it("troca a senha: a nova entra, a antiga não", async () => {
    const person = await signedUpOperator();
    const made = await link(person.id, new Date());
    expect((await resetWith(made.token)).status).toBe(200);
    expect((await signIn(person.email, NEW_PASSWORD)).status).toBe(200);
    expect((await signIn(person.email, OLD_PASSWORD)).status).toBe(401);
  });

  it("revoga as sessões antigas", async () => {
    const person = await signedUpOperator();
    expect((await signIn(person.email, OLD_PASSWORD)).status).toBe(200);
    expect(
      (await db.select().from(session).where(eq(session.userId, person.id)))
        .length,
    ).toBeGreaterThan(0);
    const made = await link(person.id, new Date());
    expect((await resetWith(made.token)).status).toBe(200);
    expect(
      await db.select().from(session).where(eq(session.userId, person.id)),
    ).toHaveLength(0);
  });

  it("uso único: a segunda vez é INVALID_TOKEN e a senha fica a da primeira", async () => {
    const person = await signedUpOperator();
    const made = await link(person.id, new Date());
    expect((await resetWith(made.token)).status).toBe(200);
    const again = await resetWith(made.token, "outra-senha-9999");
    expect(again.status).toBe(400);
    expect(await errorCode(again)).toBe("INVALID_TOKEN");
    expect((await signIn(person.email, NEW_PASSWORD)).status).toBe(200);
  });

  it("vencido há 1 min: INVALID_TOKEN e a senha não muda", async () => {
    const person = await signedUpOperator();
    const made = await link(
      person.id,
      new Date(Date.now() - PASSWORD_RESET_TTL_MS - 60_000),
    );
    const res = await resetWith(made.token);
    expect(res.status).toBe(400);
    expect(await errorCode(res)).toBe("INVALID_TOKEN");
    expect((await signIn(person.email, OLD_PASSWORD)).status).toBe(200);
  });

  it("faltando 1 min para vencer: ainda vale", async () => {
    const person = await signedUpOperator();
    const made = await link(
      person.id,
      new Date(Date.now() - PASSWORD_RESET_TTL_MS + 60_000),
    );
    expect((await resetWith(made.token)).status).toBe(200);
  });

  it("token que nunca existiu: INVALID_TOKEN", async () => {
    await signedUpOperator();
    const res = await resetWith("x".repeat(43));
    expect(res.status).toBe(400);
    expect(await errorCode(res)).toBe("INVALID_TOKEN");
  });

  it("senha de 7: PASSWORD_TOO_SHORT e o link continua valendo; de 8 passa", async () => {
    const person = await signedUpOperator();
    const made = await link(person.id, new Date());
    const short = await resetWith(made.token, "1234567");
    expect(short.status).toBe(400);
    expect(await errorCode(short)).toBe("PASSWORD_TOO_SHORT");
    expect((await resetWith(made.token, "12345678")).status).toBe(200);
  });

  it("senha de 129: PASSWORD_TOO_LONG e o link continua valendo", async () => {
    const person = await signedUpOperator();
    const made = await link(person.id, new Date());
    const long = await resetWith(made.token, "a".repeat(129));
    expect(long.status).toBe(400);
    expect(await errorCode(long)).toBe("PASSWORD_TOO_LONG");
    expect((await resetWith(made.token)).status).toBe(200);
  });

  it("link novo derruba o anterior", async () => {
    const person = await signedUpOperator();
    const first = await link(person.id, new Date());
    const second = await link(person.id, new Date());
    expect(await db.select().from(verification)).toHaveLength(1);
    const res = await resetWith(first.token);
    expect(res.status).toBe(400);
    expect(await errorCode(res)).toBe("INVALID_TOKEN");
    expect((await resetWith(second.token)).status).toBe(200);
  });

  it("o link de uma pessoa não mexe no link de outra", async () => {
    const a = await signedUpOperator("a@example.test");
    const b = await signedUpOperator("b@example.test");
    const linkA = await link(a.id, new Date());
    const linkB = await link(b.id, new Date());
    expect(await db.select().from(verification)).toHaveLength(2);
    expect((await resetWith(linkA.token)).status).toBe(200);
    expect((await resetWith(linkB.token)).status).toBe(200);
  });

  it("quem só tem passkey (sem conta credential) ganha uma conta de senha", async () => {
    const sector = await insertSector(db);
    const person = await insertUser(db, {
      role: "operator",
      sectorId: sector.id,
      email: "so-passkey@example.test",
    });
    expect(
      await db.select().from(account).where(eq(account.userId, person.id)),
    ).toHaveLength(0);
    const made = await link(person.id, new Date());
    expect((await resetWith(made.token)).status).toBe(200);
    const [created] = await db
      .select()
      .from(account)
      .where(eq(account.userId, person.id));
    expect(created).toMatchObject({
      providerId: "credential",
      accountId: person.id,
    });
    expect((await signIn("so-passkey@example.test", NEW_PASSWORD)).status).toBe(
      200,
    );
  });

  it("desativada DEPOIS de gerar: o link deixa de valer, a conta segue desativada e reativar não o ressuscita", async () => {
    const person = await signedUpOperator();
    const admin = await insertUser(db, { role: "admin", sectorId: null });
    const made = await link(person.id, new Date());

    expect(
      await setPersonActive(
        db,
        { actorId: admin.id, userId: person.id, active: false },
        new Date(),
      ),
    ).toEqual({ ok: true });
    expect(
      await db
        .select()
        .from(verification)
        .where(eq(verification.value, person.id)),
    ).toHaveLength(0);

    const res = await resetWith(made.token);
    expect(res.status).toBe(400);
    expect(await errorCode(res)).toBe("INVALID_TOKEN");
    const [row] = await db.select().from(user).where(eq(user.id, person.id));
    expect(row?.deactivatedAt).toBeInstanceOf(Date);
    const login = await signIn(person.email, OLD_PASSWORD);
    expect(login.status).toBe(403);
    expect(await errorCode(login)).toBe("ACCOUNT_DEACTIVATED");

    expect(
      await setPersonActive(
        db,
        { actorId: admin.id, userId: person.id, active: true },
        new Date(),
      ),
    ).toEqual({ ok: true });
    const afterReactivation = await resetWith(made.token);
    expect(afterReactivation.status).toBe(400);
    expect(await errorCode(afterReactivation)).toBe("INVALID_TOKEN");
    expect((await signIn(person.email, OLD_PASSWORD)).status).toBe(200);
  });

  it("defesa em profundidade: se o link sobrevive à desativação (UPDATE cru), a conta segue sem entrar", async () => {
    const person = await signedUpOperator();
    const made = await link(person.id, new Date());
    await db
      .update(user)
      .set({ deactivatedAt: new Date() })
      .where(eq(user.id, person.id));

    expect((await resetWith(made.token)).status).toBe(200);

    const login = await signIn(person.email, NEW_PASSWORD);
    expect(login.status).toBe(403);
    expect(await errorCode(login)).toBe("ACCOUNT_DEACTIVATED");
  });

  it("o pedido por e-mail continua desligado", async () => {
    const res = await http("/request-password-reset", {
      email: "ana@example.test",
    });
    expect(res.status).toBe(400);
    expect(await errorCode(res)).toBe("RESET_PASSWORD_DISABLED");
  });
});
