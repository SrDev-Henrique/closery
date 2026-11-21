import type { PGlite } from "@electric-sql/pglite";
import { desc } from "drizzle-orm";
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

import { session } from "@/db/schema";

import {
  createTestAuth,
  sessionCookieOf,
  signUpWithInvite,
} from "../../../test/auth";
import { createTestDb, resetDb, type TestDb } from "../../../test/db";
import { insertInvite, insertSector } from "../../../test/fixtures";

const PASSWORD = "senha-segura-123";
const DAY_MS = 24 * 60 * 60 * 1000;
const SEVEN_DAYS_S = 7 * 24 * 60 * 60;

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

afterEach(() => {
  vi.useRealTimers();
});

async function login(): Promise<Headers> {
  const sector = await insertSector(db);
  const { token } = await insertInvite(db, {
    role: "operator",
    sectorId: sector.id,
  });
  await signUpWithInvite(auth, token, {
    name: "Pessoa Teste",
    email: "op@example.com",
    password: PASSWORD,
  });
  const { headers } = await auth.api.signInEmail({
    body: { email: "op@example.com", password: PASSWORD },
    returnHeaders: true,
  });
  return new Headers({ cookie: sessionCookieOf(headers) });
}

async function expiresAt(): Promise<number> {
  // O cadastro abre uma sessão e o login outra: vale a mais recente (a do login).
  const [row] = await db
    .select()
    .from(session)
    .orderBy(desc(session.createdAt))
    .limit(1);
  if (!row) throw new Error("sessão sumiu");
  return row.expiresAt.getTime();
}

function getSessionHttp(headers: Headers): Promise<Response> {
  return auth.handler(
    new Request("http://localhost:3000/api/auth/get-session", { headers }),
  );
}

// Só `Date` é falsificado: PGlite e o handler usam timers reais.
function advanceClock(ms: number) {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(Date.now() + ms);
}

describe("renovação da sessão: servidor lê, SessionKeepAlive (HTTP) renova", () => {
  it("passado o updateAge, a leitura com disableRefresh devolve a sessão e NÃO mexe no banco", async () => {
    const headers = await login();
    const before = await expiresAt();
    advanceClock(2 * DAY_MS);

    const result = await auth.api.getSession({
      headers,
      query: { disableRefresh: true },
    });

    expect(result?.user.email).toBe("op@example.com");
    expect(await expiresAt()).toBe(before);
  });

  it("sessão expirada continua recusada com disableRefresh", async () => {
    const headers = await login();
    advanceClock(8 * DAY_MS);

    const result = await auth.api.getSession({
      headers,
      query: { disableRefresh: true },
    });

    expect(result).toBeNull();
  });

  it("depois disso, o get-session HTTP regrava o cookie (7 dias) e move expires_at", async () => {
    const headers = await login();
    const before = await expiresAt();
    advanceClock(2 * DAY_MS);
    await auth.api.getSession({ headers, query: { disableRefresh: true } });

    const response = await getSessionHttp(headers);

    expect(response.status).toBe(200);
    const cookie = response.headers
      .getSetCookie()
      .find((line) => line.includes("session_token="));
    expect(cookie).toBeDefined();
    expect(cookie).toContain(`Max-Age=${SEVEN_DAYS_S}`);
    expect(await expiresAt()).toBeGreaterThan(before + DAY_MS);
  });

  it("sem passar o updateAge, o get-session HTTP não regrava o cookie nem o banco", async () => {
    const headers = await login();
    const before = await expiresAt();

    const response = await getSessionHttp(headers);

    expect(response.status).toBe(200);
    const cookie = response.headers
      .getSetCookie()
      .find((line) => line.includes("session_token="));
    expect(cookie).toBeUndefined();
    expect(await expiresAt()).toBe(before);
  });
});
