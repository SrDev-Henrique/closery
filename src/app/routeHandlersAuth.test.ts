import { existsSync, readFileSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { describe, expect, it } from "vitest";

import {
  actionsMissingGuard,
  listSourceFiles,
  stripComments,
} from "../../test/actionGuards";

// Guarda de todo route.ts de src/app. Um Route Handler é um endpoint público
// como uma Server Action: o proxy não cobre /api, então cada handler se
// autentica sozinho, com requireUser()/requireAdmin() como PRIMEIRA instrução,
// exporta só GET (nada escreve por aqui) e nunca usa "use cache" (dado por
// usuário não se cacheia).

const APP_DIR = join(process.cwd(), "src", "app");

// Lista fechada, caminhos relativos a src/app, com "/". Entrar aqui exige
// motivo; qualquer outro route.ts precisa passar no guarda.
export const PUBLIC_ROUTE_HANDLERS: readonly string[] = [
  // Better Auth: entrar, sair, OAuth, passkey. Autentica por dentro.
  "api/auth/[...all]/route.ts",
  // Health check do deploy: sem dado de ninguém, sem sessão.
  "api/health/route.ts",
];

export const MIN_GUARDED_ROUTE_HANDLERS = 1;

const EXPORT_PATTERN =
  /^export\s+(async\s+function\s+([\w$]+)|default\b|(?:const|let|var|function|class)\s+([\w$]+)|\{|\*)/gm;

/** Problemas do código-fonte de um route.ts; [] = tudo certo. */
export function routeHandlerProblems(source: string): string[] {
  const code = stripComments(source);
  const problems: string[] = [];

  let hasGet = false;
  for (const match of code.matchAll(EXPORT_PATTERN)) {
    if (match[2] === "GET") {
      hasGet = true;
      continue;
    }
    const name = match[2] ?? match[3] ?? match[1] ?? "export";
    problems.push(`export não permitido: ${name.trim()}`);
  }
  if (
    hasGet &&
    actionsMissingGuard(source, ["requireUser", "requireAdmin"]).includes("GET")
  ) {
    problems.push("GET sem requireUser()/requireAdmin() na primeira instrução");
  }
  if (/["']use cache(?::\s*[\w-]+)?["']/.test(code)) {
    problems.push('"use cache" proibido');
  }
  return problems;
}

function findRouteHandlers(): string[] {
  return listSourceFiles(APP_DIR, (name) => name === "route.ts").map((file) =>
    relative(APP_DIR, file).split(sep).join("/"),
  );
}

const GUARDED = findRouteHandlers().filter(
  (path) => !PUBLIC_ROUTE_HANDLERS.includes(path),
);

describe("guarda de Route Handlers", () => {
  it("cada entrada da lista de exceções existe", () => {
    for (const path of PUBLIC_ROUTE_HANDLERS) {
      expect(existsSync(join(APP_DIR, path)), path).toBe(true);
    }
  });

  it("há pelo menos um route.ts guardado (o guarda não passa no vazio)", () => {
    expect(GUARDED.length).toBeGreaterThanOrEqual(MIN_GUARDED_ROUTE_HANDLERS);
    expect(GUARDED).toContain("api/dashboard/export/route.ts");
  });

  it.each(GUARDED)("%s: só GET, com o guarda na primeira instrução", (path) => {
    const source = readFileSync(join(APP_DIR, path), "utf8");
    expect(routeHandlerProblems(source), path).toEqual([]);
  });
});

describe("routeHandlerProblems", () => {
  const GOOD = `import { requireUser } from "@/lib/auth/session";
export async function GET(request: Request): Promise<Response> {
  const actor = await requireUser();
  return new Response(actor.userId);
}`;

  it("aceita o GET com o guarda na primeira instrução (e requireAdmin também)", () => {
    expect(routeHandlerProblems(GOOD)).toEqual([]);
    expect(
      routeHandlerProblems(GOOD.replaceAll("requireUser", "requireAdmin")),
    ).toEqual([]);
  });

  it("reprova o GET sem guarda", () => {
    const source = `export async function GET() {
  return new Response("oi");
}`;
    expect(routeHandlerProblems(source)).toEqual([
      "GET sem requireUser()/requireAdmin() na primeira instrução",
    ]);
  });

  it("reprova o guarda na segunda instrução e o guarda só em comentário", () => {
    const second = `export async function GET() {
  const now = new Date();
  await requireUser();
  return new Response(String(now));
}`;
    const commented = `export async function GET() {
  // await requireUser();
  return new Response("oi");
}`;
    expect(routeHandlerProblems(second)).toEqual([
      "GET sem requireUser()/requireAdmin() na primeira instrução",
    ]);
    expect(routeHandlerProblems(commented)).toEqual([
      "GET sem requireUser()/requireAdmin() na primeira instrução",
    ]);
  });

  it.each(["POST", "PUT", "PATCH", "DELETE"])("reprova o %s", (method) => {
    const source = `${GOOD}
export async function ${method}() {
  await requireUser();
  return new Response("ok");
}`;
    expect(routeHandlerProblems(source)).toEqual([
      `export não permitido: ${method}`,
    ]);
  });

  it("reprova export const runtime, export default e export { … }", () => {
    expect(
      routeHandlerProblems(`${GOOD}\nexport const runtime = "edge";`),
    ).toEqual(["export não permitido: runtime"]);
    expect(
      routeHandlerProblems(`${GOOD}\nexport default function Rota() {}`),
    ).toEqual(["export não permitido: default"]);
    expect(routeHandlerProblems(`${GOOD}\nexport { GET as HEAD };`)).toEqual([
      "export não permitido: {",
    ]);
  });

  it("reprova GET síncrono", () => {
    expect(
      routeHandlerProblems(
        "export function GET() { return new Response('oi'); }",
      ),
    ).toEqual(["export não permitido: GET"]);
  });

  it('reprova "use cache" (diretiva de arquivo ou de função)', () => {
    expect(routeHandlerProblems(`"use cache";\n${GOOD}`)).toEqual([
      '"use cache" proibido',
    ]);
    expect(
      routeHandlerProblems(
        GOOD.replace("const actor", '"use cache: private";\n  const actor'),
      ),
    ).toContain('"use cache" proibido');
  });
});
