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

import { authzOf } from "../../../../../test/authz";
import {
  type DashboardWorld,
  seedDashboardWorld,
} from "../../../../../test/dashboardWorld";
import { createTestDb, resetDb, type TestDb } from "../../../../../test/db";
import { insertSector, insertUser } from "../../../../../test/fixtures";

const mocks = vi.hoisted(() => ({
  requireUser: vi.fn(),
  database: { current: undefined as unknown },
  touched: vi.fn(),
}));

vi.mock("@/lib/auth/session", () => ({ requireUser: mocks.requireUser }));
vi.mock("next/headers", () => ({
  cookies: async () => ({ get: () => undefined }),
}));
vi.mock("@/db", () => ({
  get db() {
    mocks.touched();
    return mocks.database.current;
  },
}));

import * as routeModule from "./route";

const { GET } = routeModule;

const URL_BASE = "http://closery.local/api/dashboard/export";
const REDIRECT = Object.assign(new Error("NEXT_REDIRECT"), {
  digest: "NEXT_REDIRECT;replace;/entrar;307;",
});

async function bytesOf(response: Response): Promise<Uint8Array> {
  return new Uint8Array(await response.arrayBuffer());
}

describe("GET /api/dashboard/export", () => {
  let client: PGlite;
  let db: TestDb;
  let world: DashboardWorld;

  beforeAll(async () => {
    ({ client, db } = await createTestDb());
    mocks.database.current = db;
    world = await seedDashboardWorld(db);
  });
  afterAll(async () => {
    await client.close();
  });
  beforeEach(() => {
    mocks.requireUser.mockReset();
    mocks.touched.mockReset();
    mocks.requireUser.mockResolvedValue(world.people.admin);
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(world.now);
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("exporta só o GET", () => {
    expect(Object.keys(routeModule)).toEqual(["GET"]);
  });

  it("sem sessão rejeita com o redirect de requireUser e não toca o banco", async () => {
    mocks.requireUser.mockRejectedValue(REDIRECT);
    await expect(GET(new Request(`${URL_BASE}?periodo=7`))).rejects.toBe(
      REDIRECT,
    );
    expect(mocks.touched).not.toHaveBeenCalled();
  });

  it("devolve os quatro cabeçalhos do contrato, o BOM em bytes e CRLF em toda linha", async () => {
    mocks.requireUser.mockResolvedValue(world.people.ana);
    const response = await GET(new Request(`${URL_BASE}?periodo=7`));
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe(
      "text/csv; charset=utf-8",
    );
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
    expect(response.headers.get("content-disposition")).toBe(
      "attachment; filename=\"passagens-uld-teste-2026-11-14_a_2026-11-20.csv\"; filename*=UTF-8''passagens-ULD%20Teste-2026-11-14_a_2026-11-20.csv",
    );

    const bytes = await bytesOf(response);
    expect([...bytes.subarray(0, 3)]).toEqual([239, 187, 191]);
    const text = new TextDecoder("utf-8", { ignoreBOM: true }).decode(bytes);
    expect(text.startsWith("\u{feff}Dia;Turno;Setor;")).toBe(true);
    expect(text.endsWith("\r\n")).toBe(true);
    expect(text.replaceAll("\r\n", "")).not.toMatch(/[\r\n]/);
    expect(text.split("\r\n")).toHaveLength(1 + 21 + 1);
  });

  it("acentos saem em UTF-8 (Câmara no cabeçalho de todos os setores)", async () => {
    const response = await GET(new Request(`${URL_BASE}?setor=todos`));
    const text = new TextDecoder("utf-8", { ignoreBOM: true }).decode(
      await bytesOf(response),
    );
    expect(text).toContain("Câmara Teste · Lacre (unidade)");
  });

  it("o período da tela vale no CSV (últimos 30 dias) e no nome do arquivo", async () => {
    const response = await GET(
      new Request(`${URL_BASE}?periodo=30&setor=${world.uld.id}`),
    );
    expect(response.headers.get("content-disposition")).toContain(
      'filename="passagens-uld-teste-2026-10-22_a_2026-11-20.csv"',
    );
  });

  it("operador com ?setor= de outro setor recebe só o próprio, nunca o outro", async () => {
    mocks.requireUser.mockResolvedValue(world.people.ana);
    const response = await GET(
      new Request(`${URL_BASE}?setor=${world.camara.id}`),
    );
    expect(response.status).toBe(200);
    const text = await response.text();
    expect(text).toContain("ULD Teste");
    expect(text).not.toContain("Câmara Teste");
    expect(response.headers.get("content-disposition")).toContain(
      "passagens-uld-teste-",
    );
  });

  it("admin com ?setor=todos exporta os dois setores ativos e nunca o inativo", async () => {
    const response = await GET(new Request(`${URL_BASE}?setor=todos`));
    expect(response.status).toBe(200);
    expect(response.headers.get("content-disposition")).toContain(
      'filename="passagens-todos-os-setores-2026-11-14_a_2026-11-20.csv"',
    );
    const text = await response.text();
    expect(text.split("\r\n")).toHaveLength(1 + 27 + 1);
    expect(text).not.toContain("Setor Parado");
  });

  it("operador de setor inativo recebe 404 com o texto, sem CSV", async () => {
    mocks.requireUser.mockResolvedValue(world.people.duda);
    const response = await GET(new Request(`${URL_BASE}?periodo=7`));
    expect(response.status).toBe(404);
    expect(response.headers.get("content-type")).toBe(
      "text/plain; charset=utf-8",
    );
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(await response.text()).toBe(
      "Nenhum setor disponível para exportar.",
    );
  });

  it("parâmetros lixo caem no padrão: últimos 7 dias e, para o admin, o primeiro setor ativo", async () => {
    const response = await GET(
      new Request(`${URL_BASE}?periodo=abc&de=x&ate=y&setor=nao-e-uuid`),
    );
    expect(response.status).toBe(200);
    expect(response.headers.get("content-disposition")).toContain(
      'filename="passagens-camara-teste-2026-11-14_a_2026-11-20.csv"',
    );
  });
});

describe("GET /api/dashboard/export sem setor ativo", () => {
  let client: PGlite;
  let db: TestDb;

  beforeAll(async () => {
    ({ client, db } = await createTestDb());
    mocks.database.current = db;
  });
  afterAll(async () => {
    await client.close();
  });
  beforeEach(async () => {
    await resetDb(client);
    mocks.requireUser.mockReset();
  });

  it("admin sem nenhum setor ativo recebe 404 com o texto", async () => {
    await insertSector(db, "Setor Desativado", { active: false });
    const admin = await insertUser(db, { role: "admin", sectorId: null });
    mocks.requireUser.mockResolvedValue(
      authzOf({ role: "admin", userId: admin.id }),
    );
    const response = await GET(new Request(`${URL_BASE}?setor=todos`));
    expect(response.status).toBe(404);
    expect(await response.text()).toBe(
      "Nenhum setor disponível para exportar.",
    );
  });
});
