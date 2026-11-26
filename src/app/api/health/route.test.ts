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

import { createTestDb, type TestDb } from "../../../../test/db";

// O banco de verdade (PGlite) entra no lugar de "@/db" por um getter, como nos
// testes de action; o caso de falha troca o banco por um que recusa.
const mocks = vi.hoisted(() => {
  const database: { current: unknown } = { current: undefined };
  return { database };
});

vi.mock("@/db", () => ({
  get db() {
    return mocks.database.current;
  },
}));
// connection() só existe dentro de uma requisição do Next.
vi.mock("next/server", () => ({ connection: async () => {} }));

import { GET } from "./route";

const SECRET = "ana@exemplo.test";

let client: PGlite;
let db: TestDb;
let consoleError: MockInstance;

beforeAll(async () => {
  ({ client, db } = await createTestDb());
});

afterAll(async () => {
  await client.close();
});

beforeEach(() => {
  mocks.database.current = db;
  consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  consoleError.mockRestore();
});

describe("GET /api/health", () => {
  it("com o banco no ar: 200 com a latência em milissegundos", async () => {
    const response = await GET();

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.status).toBe("ok");
    expect(body.database).toBe("ok");
    expect(typeof body.latencyMs).toBe("number");
    expect(consoleError).not.toHaveBeenCalled();
  });

  it("com o banco recusando: 503 sem detalhe e uma linha de log sem a mensagem do erro", async () => {
    const pgError = Object.assign(new Error(`connect failed (${SECRET})`), {
      code: "ECONNREFUSED",
    });
    mocks.database.current = {
      transaction: async () => {
        throw new DrizzleQueryError("select 1", [SECRET], pgError);
      },
    };

    const response = await GET();

    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({
      status: "error",
      database: "unreachable",
    });
    expect(consoleError).toHaveBeenCalledTimes(1);
    const line = String(consoleError.mock.calls[0]?.[0]);
    expect(JSON.parse(line)).toEqual({
      level: "error",
      context: "health",
      name: "Error",
      code: "ECONNREFUSED",
      digest: null,
    });
    expect(line).not.toContain(SECRET);
  });
});
