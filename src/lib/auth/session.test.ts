import type { PGlite } from "@electric-sql/pglite";
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

import { user } from "@/db/schema";

import {
  createTestAuth,
  sessionCookieOf,
  signUpWithInvite,
} from "../../../test/auth";
import { createTestDb, resetDb, type TestDb } from "../../../test/db";
import { insertInvite, insertSector } from "../../../test/fixtures";
import type { Auth } from "./createAuth";

const holder: { auth: Auth | null; headers: Headers } = vi.hoisted(() => ({
  auth: null,
  headers: new Headers(),
}));

vi.mock("@/lib/auth", () => ({
  get auth() {
    return holder.auth;
  },
}));

vi.mock("next/headers", () => ({
  headers: async () => holder.headers,
}));

vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Error(`NEXT_REDIRECT ${url}`);
  },
  notFound: () => {
    throw new Error("NEXT_NOT_FOUND");
  },
}));

const { getAuthz, requireAdmin, requireUser } = await import("./session");

const PASSWORD = "senha-segura-123";

let client: PGlite;
let db: TestDb;

beforeAll(async () => {
  ({ client, db } = await createTestDb());
  holder.auth = createTestAuth(db);
});

afterAll(async () => {
  await client.close();
});

beforeEach(async () => {
  await resetDb(client);
  holder.headers = new Headers();
});

async function signUpAndLogin(
  role: "admin" | "operator",
  email: string,
): Promise<{ sectorId: string | null }> {
  const auth = holder.auth;
  if (!auth) throw new Error("auth não montado");
  const sector = role === "operator" ? await insertSector(db) : null;
  const { token } = await insertInvite(db, {
    role,
    sectorId: sector?.id ?? null,
  });
  await signUpWithInvite(auth, token, {
    name: "Pessoa Teste",
    email,
    password: PASSWORD,
  });
  const { headers } = await auth.api.signInEmail({
    body: { email, password: PASSWORD },
    returnHeaders: true,
  });
  holder.headers = new Headers({ cookie: sessionCookieOf(headers) });
  return { sectorId: sector?.id ?? null };
}

describe("getAuthz", () => {
  it("sem cookie → null", async () => {
    expect(await getAuthz()).toBeNull();
  });

  it("cookie de sessão inventado → null", async () => {
    holder.headers = new Headers({
      cookie: "better-auth.session_token=falso.falso",
    });
    expect(await getAuthz()).toBeNull();
  });

  it("operador logado → Authz com papel e setor", async () => {
    const { sectorId } = await signUpAndLogin("operator", "op@example.com");

    expect(await getAuthz()).toMatchObject({
      email: "op@example.com",
      role: "operator",
      sectorId,
    });
  });

  it("admin logado → Authz sem setor", async () => {
    await signUpAndLogin("admin", "admin@example.com");

    expect(await getAuthz()).toMatchObject({ role: "admin", sectorId: null });
  });

  it("lê a sessão sem renovar: getSession recebe disableRefresh (a renovação é do SessionKeepAlive)", async () => {
    await signUpAndLogin("admin", "admin@example.com");
    const auth = holder.auth;
    if (!auth) throw new Error("auth não montado");
    const spy = vi.spyOn(auth.api, "getSession");

    await getAuthz();

    expect(spy).toHaveBeenCalledWith(
      expect.objectContaining({ query: { disableRefresh: true } }),
    );
    spy.mockRestore();
  });

  it("desativar a pessoa vale na próxima leitura, com a sessão ainda aberta", async () => {
    await signUpAndLogin("admin", "admin@example.com");
    expect(await getAuthz()).not.toBeNull();

    await db.update(user).set({ deactivatedAt: new Date() });

    expect(await getAuthz()).toBeNull();
  });

  it("mudar o setor vale na próxima leitura (sem cache de sessão)", async () => {
    await signUpAndLogin("operator", "op@example.com");
    const other = await insertSector(db, "Outro setor");
    await db
      .update(user)
      .set({ sectorId: other.id })
      .where(eq(user.email, "op@example.com"));

    expect(await getAuthz()).toMatchObject({ sectorId: other.id });
  });
});

describe("requireUser", () => {
  it("sem sessão redireciona para /entrar", async () => {
    await expect(requireUser()).rejects.toThrow("NEXT_REDIRECT /entrar");
  });

  it("desativado redireciona para /entrar", async () => {
    await signUpAndLogin("operator", "op@example.com");
    await db.update(user).set({ deactivatedAt: new Date() });

    await expect(requireUser()).rejects.toThrow("NEXT_REDIRECT /entrar");
  });

  it("com sessão devolve o Authz", async () => {
    await signUpAndLogin("operator", "op@example.com");

    await expect(requireUser()).resolves.toMatchObject({ role: "operator" });
  });
});

describe("requireAdmin", () => {
  it("sem sessão redireciona para /entrar (não 404)", async () => {
    await expect(requireAdmin()).rejects.toThrow("NEXT_REDIRECT /entrar");
  });

  it("operador recebe 404 (notFound)", async () => {
    await signUpAndLogin("operator", "op@example.com");

    await expect(requireAdmin()).rejects.toThrow("NEXT_NOT_FOUND");
  });

  it("admin passa", async () => {
    await signUpAndLogin("admin", "admin@example.com");

    await expect(requireAdmin()).resolves.toMatchObject({ role: "admin" });
  });

  it("admin desativado com sessão aberta é barrado", async () => {
    await signUpAndLogin("admin", "admin@example.com");
    await db.update(user).set({ deactivatedAt: new Date() });

    await expect(requireAdmin()).rejects.toThrow("NEXT_REDIRECT /entrar");
  });
});
