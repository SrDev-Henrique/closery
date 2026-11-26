import type { PGlite } from "@electric-sql/pglite";
import { DrizzleQueryError } from "drizzle-orm/errors";
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  type MockInstance,
  vi,
} from "vitest";

import { createTestAuth, TEST_AUTH_ENV } from "../../../../../test/auth";
import { createTestDb, resetDb, type TestDb } from "../../../../../test/db";

// O auth de verdade (createAuth) sobre o PGlite entra no lugar de "@/lib/auth";
// o route captura o objeto na importação, então o `handler` delega ao auth da
// vez (o caso de falha troca o banco por um que recusa).
const mocks = vi.hoisted(() => {
  const current: {
    auth: { handler: (request: Request) => Promise<Response> };
  } = { auth: { handler: async () => new Response(null, { status: 500 }) } };
  return { current };
});

vi.mock("@/lib/auth", () => ({
  auth: {
    handler: (request: Request) => mocks.current.auth.handler(request),
  },
}));

import { GET, POST } from "./route";

const SECRET_EMAIL = "ana@exemplo.test";
const BASE_URL = TEST_AUTH_ENV.baseURL;

let client: PGlite;
let db: TestDb;
let consoleError: MockInstance;

beforeAll(async () => {
  ({ client, db } = await createTestDb());
});

afterAll(async () => {
  await client.close();
});

beforeEach(async () => {
  await resetDb(client);
  consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  consoleError.mockRestore();
});

// `db` cuja consulta falha como o driver falharia.
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

function signIn(password: string) {
  return POST(
    new Request(`${BASE_URL}/api/auth/sign-in/email`, {
      method: "POST",
      headers: { "content-type": "application/json", origin: BASE_URL },
      body: JSON.stringify({ email: SECRET_EMAIL, password }),
    }) as never,
  );
}

function lines(): string[] {
  return consoleError.mock.calls.map((call) => call.map(String).join(" "));
}

describe("/api/auth/[...all]", () => {
  it("exporta GET e POST", () => {
    expect(typeof GET).toBe("function");
    expect(typeof POST).toBe("function");
  });

  it("erro inesperado: 500 sem corpo, uma linha JSON do logServerError e nada do better-call", async () => {
    mocks.current.auth = createTestAuth(failingDb());

    const res = await signIn("senha-qualquer-1");

    expect(res.status).toBe(500);
    expect(await res.text()).toBe("");
    const all = lines();
    expect(all).toHaveLength(1);
    expect(JSON.parse(all[0] ?? "")).toMatchObject({
      level: "error",
      context: "better-auth",
      code: "23505",
    });
    for (const line of all) {
      expect(line).not.toContain("SERVER_ERROR");
      expect(line).not.toContain(SECRET_EMAIL);
      expect(line).not.toContain("Failed query");
      expect(line).not.toContain("params");
    }
  });

  it("APIError (senha errada): a resposta normal do Better Auth, sem linha de log", async () => {
    mocks.current.auth = createTestAuth(db);

    const res = await signIn("senha-qualquer-1");

    expect(res.status).toBe(401);
    expect(await res.json()).toMatchObject({
      code: "INVALID_EMAIL_OR_PASSWORD",
    });
    expect(consoleError).not.toHaveBeenCalled();
  });

  it("logger do Better Auth com mensagem só de texto: NonError, sem e-mail nem SQL", async () => {
    const { logger } = await createTestAuth(db).$context;

    logger.error(
      `Failed query: select "id" from "user" params: ${SECRET_EMAIL}`,
    );

    const all = lines();
    expect(all).toHaveLength(1);
    expect(JSON.parse(all[0] ?? "")).toMatchObject({
      context: "better-auth",
      name: "NonError",
    });
    expect(all[0]).not.toContain(SECRET_EMAIL);
    expect(all[0]).not.toContain("Failed query");
  });
});
