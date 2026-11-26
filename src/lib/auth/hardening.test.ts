import type { PGlite } from "@electric-sql/pglite";
import { eq } from "drizzle-orm";
import { DrizzleQueryError } from "drizzle-orm/errors";
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import { rateLimit, session, verification } from "@/db/schema/auth";
import { createTestAuth, TEST_AUTH_ENV } from "../../../test/auth";
import { createTestDb, resetDb, type TestDb } from "../../../test/db";
import {
  insertInvite,
  insertSession,
  insertUser,
} from "../../../test/fixtures";
import { INVITE_COOKIE } from "./inviteCookie";

const BASE_URL = TEST_AUTH_ENV.baseURL;

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

afterEach(() => {
  vi.restoreAllMocks();
});

function post(
  auth: ReturnType<typeof createTestAuth>,
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

// Em produção o limiter liga (P22). O auth é criado com NODE_ENV=production
// e o env volta ao normal logo depois: o limiter lê a opção já resolvida.
function productionAuth() {
  vi.stubEnv("NODE_ENV", "production");
  try {
    return createTestAuth(db);
  } finally {
    vi.unstubAllEnvs();
  }
}

async function hammerSignIn(
  auth: ReturnType<typeof createTestAuth>,
  headers: Record<string, string>,
  times: number,
) {
  const statuses: number[] = [];
  for (let i = 0; i < times; i += 1) {
    const res = await post(
      auth,
      "/sign-in/email",
      { email: "ninguem@example.test", password: "senha-qualquer-1" },
      headers,
    );
    statuses.push(res.status);
  }
  return statuses;
}

// Os dois primeiros casos com logins fazem até 32 logins de verdade: com a
// máquina carregada (a suíte inteira) passam dos 15 s padrão, e o que sobra de
// um caso que estourou o tempo vaza para o seguinte. Daí os 60 s.
describe("rate limit por IP (advanced.ipAddress.ipAddressHeaders)", () => {
  it("declara x-forwarded-for explicitamente", () => {
    const auth = createTestAuth(db);
    expect(auth.options.advanced?.ipAddress?.ipAddressHeaders).toEqual([
      "x-forwarded-for",
    ]);
  });

  it("a chave do balde é o IP do x-forwarded-for (um balde por cliente)", async () => {
    const auth = productionAuth();
    await hammerSignIn(auth, { "x-forwarded-for": "203.0.113.7" }, 2);
    await hammerSignIn(auth, { "x-forwarded-for": "203.0.113.8" }, 1);
    const rows = await db.select().from(rateLimit);
    expect(rows.map((row) => row.key).sort()).toEqual([
      "203.0.113.7|/sign-in/email",
      "203.0.113.8|/sign-in/email",
    ]);
    const mine = rows.find((row) => row.key === "203.0.113.7|/sign-in/email");
    expect(mine?.count).toBe(2);
  }, 60_000);

  it("30 por minuto por IP: o 31º toma 429 e outro IP segue livre", async () => {
    const auth = productionAuth();
    const statuses = await hammerSignIn(
      auth,
      { "x-forwarded-for": "198.51.100.1" },
      31,
    );
    expect(statuses.slice(0, 30).every((status) => status !== 429)).toBe(true);
    expect(statuses[30]).toBe(429);
    const other = await hammerSignIn(
      auth,
      { "x-forwarded-for": "198.51.100.2" },
      1,
    );
    expect(other[0]).not.toBe(429);
  }, 60_000);

  it("x-real-ip e x-vercel-forwarded-for não escolhem o balde", async () => {
    const auth = productionAuth();
    await hammerSignIn(
      auth,
      {
        "x-forwarded-for": "192.0.2.10",
        "x-real-ip": "10.9.9.9",
        "x-vercel-forwarded-for": "10.8.8.8",
      },
      1,
    );
    const keys = (await db.select().from(rateLimit)).map((row) => row.key);
    expect(keys).toEqual(["192.0.2.10|/sign-in/email"]);
  });
});

describe("P16: o cookie do convite é apagado depois do cadastro", () => {
  async function signUp(
    auth: ReturnType<typeof createTestAuth>,
    token: string,
    email: string,
  ) {
    return post(
      auth,
      "/sign-up/email",
      { name: "Ana Teste", email, password: "senha-segura-123" },
      { cookie: `${INVITE_COOKIE}=${token}` },
    );
  }

  function inviteSetCookie(res: Response): string | undefined {
    return res.headers
      .getSetCookie()
      .find((line) => line.startsWith(`${INVITE_COOKIE}=`));
  }

  it("cadastro com sucesso devolve o Set-Cookie do convite vazio e com Max-Age=0", async () => {
    const auth = createTestAuth(db);
    const { token } = await insertInvite(db, {
      role: "admin",
      now: new Date(),
    });
    const res = await signUp(auth, token, "a@example.test");
    expect(res.status).toBe(200);
    const line = inviteSetCookie(res);
    expect(line).toBeDefined();
    expect(line).toMatch(/^closery_invite=;/);
    expect(line).toMatch(/Max-Age=0/i);
    expect(line).toMatch(/Path=\//);
    expect(line).toMatch(/HttpOnly/i);
    expect(line).toMatch(/SameSite=Lax/i);
    // O cookie de sessão continua vindo junto.
    expect(
      res.headers
        .getSetCookie()
        .some((entry) => entry.includes("session_token")),
    ).toBe(true);
  });

  it("em produção o cookie apagado também leva Secure", async () => {
    vi.stubEnv("NODE_ENV", "production");
    try {
      const auth = createTestAuth(db);
      const { token } = await insertInvite(db, {
        role: "admin",
        now: new Date(),
      });
      const res = await signUp(auth, token, "b@example.test");
      expect(res.status).toBe(200);
      expect(inviteSetCookie(res)).toMatch(/Secure/i);
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it("cadastro recusado (convite inválido) não mexe no cookie", async () => {
    const auth = createTestAuth(db);
    const res = await signUp(auth, "A".repeat(43), "c@example.test");
    expect(res.status).toBe(403);
    expect(inviteSetCookie(res)).toBeUndefined();
  });
});

describe("redefinição de senha: hash do identificador e sessões revogadas", () => {
  async function storeValue(identifier: string, value: string) {
    const { internalAdapter } = await createTestAuth(db).$context;
    return internalAdapter.createVerificationValue({
      identifier,
      value,
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
    });
  }

  it("o identificador reset-password: fica no banco só como hash", async () => {
    const token = "tokenSecretoDeTeste0123456789abcdefghijklmn";
    await storeValue(`reset-password:${token}`, "usuario-1");
    const rows = await db.select().from(verification);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.identifier).not.toContain(token);
    expect(rows[0]?.identifier).not.toContain("reset-password");
    expect(rows[0]?.value).toBe("usuario-1");
  });

  it("os outros identificadores continuam em texto puro", async () => {
    await storeValue("outro:abc", "{}");
    const rows = await db.select().from(verification);
    expect(rows.map((row) => row.identifier)).toEqual(["outro:abc"]);
  });

  it("redefinir a senha revoga todas as sessões da pessoa", async () => {
    const auth = createTestAuth(db);
    const person = await insertUser(db, { role: "admin", sectorId: null });
    await insertSession(db, { userId: person.id });
    await insertSession(db, { userId: person.id });
    expect(
      await db.select().from(session).where(eq(session.userId, person.id)),
    ).toHaveLength(2);
    const token = "tokenDeRedefinicao0123456789abcdefghijklmnopq";
    await storeValue(`reset-password:${token}`, person.id);

    const res = await post(auth, "/reset-password", {
      token,
      newPassword: "senha-nova-4567",
    });

    expect(res.status).toBe(200);
    expect(
      await db.select().from(session).where(eq(session.userId, person.id)),
    ).toHaveLength(0);
  });

  it("o pedido por e-mail continua desligado (sem provedor de e-mail, P8)", async () => {
    const auth = createTestAuth(db);
    const res = await post(auth, "/request-password-reset", {
      email: "ana@example.test",
    });
    expect(res.status).toBe(400);
    const body: unknown = await res.json();
    expect(body).toMatchObject({ code: "RESET_PASSWORD_DISABLED" });
  });
});

// R4: o log padrão do Better Auth imprime o erro cru, e o erro do Drizzle
// carrega o SQL e os parâmetros (e-mail, hash, IP).
describe("logger do Better Auth passa por logServerError", () => {
  const SECRET_EMAIL = "ana@exemplo.test";

  // `db` cuja consulta falha como o driver falharia: o erro é lançado ao
  // aguardar qualquer encadeamento de `select(...).from(...)...`.
  function failingDb() {
    const cause = Object.assign(new Error(`duplicate key (${SECRET_EMAIL})`), {
      code: "23505",
    });
    const failure = new DrizzleQueryError(
      'select "id" from "user" where "email" = $1',
      [SECRET_EMAIL],
      cause,
    );
    const chain: unknown = new Proxy(() => undefined, {
      get: (_target, prop) =>
        prop === "then"
          ? (_resolve: unknown, reject: (reason: unknown) => void) =>
              reject(failure)
          : chain,
      apply: () => chain,
    });
    return new Proxy(db, {
      get: (target, prop) =>
        prop === "select" ? () => chain : Reflect.get(target, prop),
    });
  }

  it("erro de banco: o handler relança (onAPIError.throw) e nada é impresso aqui", async () => {
    // O registro (uma linha JSON, sem SQL nem e-mail) é do embrulho do route
    // handler e fica provado em app/api/auth/[...all]/route.test.ts. Aqui só
    // vale que o better-call não imprime o erro cru (`# SERVER_ERROR`).
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const auth = createTestAuth(failingDb());

    await expect(
      post(auth, "/sign-in/email", {
        email: SECRET_EMAIL,
        password: "senha-qualquer-1",
      }),
    ).rejects.toBeInstanceOf(DrizzleQueryError);

    expect(spy).not.toHaveBeenCalled();
  });

  it("um aviso qualquer do Better Auth não escreve nada", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    const { logger } = await createTestAuth(db).$context;

    logger.warn("Um aviso qualquer com ana@exemplo.test");

    expect(error).not.toHaveBeenCalled();
    expect(warn).not.toHaveBeenCalled();
    expect(log).not.toHaveBeenCalled();
  });
});
