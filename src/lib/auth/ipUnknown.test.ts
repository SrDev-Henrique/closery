import type { PGlite } from "@electric-sql/pglite";
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

import { rateLimit } from "@/db/schema/auth";
import { createTestAuth, TEST_AUTH_ENV } from "../../../test/auth";
import { createTestDb, resetDb, type TestDb } from "../../../test/db";

// O Better Auth decide "é teste?" quando o módulo carrega: com NODE_ENV=test e
// sem IP no pedido ele inventa 127.0.0.1 e nunca cai no balde global nem avisa.
// Este arquivo existe para provar o comportamento de produção, então o
// NODE_ENV=production e TEST vazio (o Vitest define TEST=true, que também conta
// como teste) valem ANTES de qualquer import. Arquivo próprio: o aviso
// sai uma vez por processo (flag de módulo) e o NODE_ENV não vaza para os demais.
vi.hoisted(() => {
  vi.stubEnv("NODE_ENV", "production");
  vi.stubEnv("TEST", "");
});

const BASE_URL = TEST_AUTH_ENV.baseURL;

let client: PGlite;
let db: TestDb;

beforeAll(async () => {
  ({ client, db } = await createTestDb());
});

afterAll(async () => {
  await client.close();
  vi.unstubAllEnvs();
});

beforeEach(async () => {
  await resetDb(client);
});

afterEach(() => {
  vi.restoreAllMocks();
});

function signIn(
  auth: ReturnType<typeof createTestAuth>,
  headers: Record<string, string>,
) {
  return auth.handler(
    new Request(`${BASE_URL}/api/auth/sign-in/email`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        origin: BASE_URL,
        ...headers,
      },
      body: JSON.stringify({
        email: "ninguem@example.test",
        password: "senha-qualquer-1",
      }),
    }),
  );
}

describe("P22: sem IP resolvível, em produção", () => {
  it("cabeçalho ausente ou lista de vários cai num balde global, e o aviso vira uma linha só", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const auth = createTestAuth(db);

    await signIn(auth, {});
    await signIn(auth, { "x-forwarded-for": "1.1.1.1, 2.2.2.2" });
    await signIn(auth, {});

    // Um balde só por rota, nunca um por valor forjado pelo cliente.
    const rows = await db.select().from(rateLimit);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.key).toBe("no-trusted-ip|/sign-in/email");
    expect(rows[0]?.count).toBe(3);
    // O aviso sai uma vez por processo e passa por logServerError.
    const lines = error.mock.calls
      .map((call) => call.map(String).join(" "))
      .filter((line) => line.startsWith("{"));
    expect(lines).toHaveLength(1);
    expect(JSON.parse(lines[0] ?? "")).toMatchObject({
      level: "error",
      context: "better-auth:ip-desconhecido",
    });
    expect(warn).not.toHaveBeenCalled();
  });
});
