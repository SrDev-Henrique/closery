/**
 * Guarda da estrutura de rotas (PR B, spec §4.6, P81). Roda o validador estrito do próprio Next
 * (`normalizeCatchAllRoutes` com `strictRouteMatching: true`, o que o `next dev` 16.4 chama em
 * `server/lib/router-utils/setup-dev-bundler.js`) sobre a árvore real de `src/app`. Foi ele que
 * derrubou `/entrar`, `/convite/[token]`, `/redefinir-senha` e `/privacidade` no dev: o
 * `@detalhe/[...catchAll]` normaliza para `/[...catchAll]`, é pendurado em toda rota, e a poda
 * estrita apaga a rota inteira quando o `children` de `(app)` não tem página nem `default` nela.
 *
 * Os dois módulos são internos do Next (caminhos fixados na 16.4.6, `library-docs.md §1`). Se uma
 * atualização os mover, o import quebra aqui com a mensagem do Node: atualize o caminho. Se o
 * comportamento mudar, o grupo 5 (a causa, numa árvore sintética) avisa.
 *
 * Rodar: `bunx vitest run src/app/routeStructure.test.ts`
 */
import {
  mkdirSync,
  mkdtempSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, relative } from "node:path";
import { normalizeCatchAllRoutes } from "next/dist/server/lib/router-utils/normalize-catchall-routes";
import { normalizeAppPath } from "next/dist/shared/lib/router/utils/app-paths";
import { afterAll, describe, expect, it } from "vitest";

// O Next só lê estes nomes como página e `default` (pageExtensions padrão).
const ROUTE_FILE = /^(page|default)\.(?:tsx|ts|jsx|js)$/;

/**
 * As páginas e os `default` de uma pasta `app`, como o Next os vê: caminho a partir da pasta, sem
 * extensão, com `/` (`"/(app)/admin/page"`, `"/(app)/@detalhe/default"`, `"/privacidade/page"`).
 * Pasta privada (`_nome`) fica fora, como no Next. Ordenados.
 */
export function listAppRouteFiles(appDir: string): {
  pages: string[];
  defaults: string[];
} {
  const pages: string[] = [];
  const defaults: string[] = [];
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (entry.isDirectory()) {
        if (!entry.name.startsWith("_")) walk(join(dir, entry.name));
        continue;
      }
      const match = ROUTE_FILE.exec(entry.name);
      if (!match?.[1]) continue;
      const folder = relative(appDir, dir).replaceAll("\\", "/");
      const appPath = `${folder ? `/${folder}` : ""}/${match[1]}`;
      (match[1] === "page" ? pages : defaults).push(appPath);
    }
  };
  walk(appDir);
  return { pages: pages.sort(), defaults: defaults.sort() };
}

/**
 * Roda o validador estrito do Next: monta `{ rota: [páginas] }` como o `next dev` (a rota é o
 * `normalizeAppPath` da página) e devolve as páginas que ficaram sem rota, os slots incompletos e o
 * mapa já podado (o validador muda o mapa no lugar: acrescenta os catch-alls e apaga o que não
 * renderiza).
 */
export function validateRoutes(
  pages: readonly string[],
  defaults: readonly string[],
): {
  unmatched: string[];
  incompatible: unknown[];
  routes: Record<string, string[]>;
} {
  const routes: Record<string, string[]> = {};
  for (const page of pages) {
    const route = normalizeAppPath(page).replace(/%5F/g, "_");
    routes[route] = [...(routes[route] ?? []), page];
  }
  const { unmatchedAppPages, incompatibleParallelRouteSlots } =
    normalizeCatchAllRoutes(routes, undefined, {
      strictRouteMatching: true,
      defaultAppPaths: defaults,
    });
  return {
    unmatched: unmatchedAppPages,
    incompatible: incompatibleParallelRouteSlots,
    routes,
  };
}

const SLOT = "/(app)/@detalhe/";

/** Rota ou página interceptada: `(.)`, `(..)`, `(...)` e `(..)(..)`. */
function isInterception(appPath: string): boolean {
  return /\/\(\.{1,3}\)/.test(appPath);
}

/**
 * As rotas que têm página do grupo `(app)` (o `children`) mas nenhuma página do slot `@detalhe` que
 * não seja a interceptada. Numa navegação no cliente o slot sem página mantém a última ativa: o
 * Sheet do detalhe ficaria aberto sobre essa tela.
 */
function routesWithoutSlotPage(routes: Record<string, string[]>): string[] {
  return Object.entries(routes)
    .filter(([route, appPaths]) => {
      if (isInterception(route)) return false;
      const hasChildrenPage = appPaths.some(
        (appPath) =>
          appPath.startsWith("/(app)/") && !appPath.startsWith("/(app)/@"),
      );
      const hasSlotPage = appPaths.some(
        (appPath) => appPath.startsWith(SLOT) && !isInterception(appPath),
      );
      return hasChildrenPage && !hasSlotPage;
    })
    .map(([route]) => route)
    .sort();
}

/** O espelho que a árvore pede: por segmento de primeiro nível de `(app)` com página. */
function expectedMirror(pages: readonly string[]): string[] {
  const mirror = new Set<string>();
  for (const page of pages) {
    const segments = page.split("/").filter(Boolean);
    // ["(app)", "<segmento>", …, "page"]; a página da raiz ("/(app)/page") é do @detalhe/page.
    if (segments[0] !== "(app)" || segments.length < 3) continue;
    const segment = segments[1] ?? "";
    if (segment.startsWith("@") || segment.startsWith("(")) continue;
    mirror.add(
      segments.length === 3
        ? `${SLOT}${segment}/page`
        : `${SLOT}${segment}/[...rest]/page`,
    );
  }
  return [...mirror].sort();
}

/** As páginas do slot fora da raiz e da interceptada (o espelho que existe). */
function actualMirror(pages: readonly string[]): string[] {
  return pages
    .filter(
      (page) =>
        page.startsWith(SLOT) &&
        page !== `${SLOT}page` &&
        !isInterception(page),
    )
    .sort();
}

const tree = listAppRouteFiles(import.meta.dirname);
const real = validateRoutes(tree.pages, tree.defaults);

/** As quatro páginas de fora de `(app)` que o dev derrubava (P81). */
const OUTSIDE_APP: Record<string, string[]> = {
  "/entrar": ["/(auth)/entrar/page"],
  "/convite/[token]": ["/(auth)/convite/[token]/page"],
  "/redefinir-senha": ["/(auth)/redefinir-senha/page"],
  "/privacidade": ["/privacidade/page"],
};

/** O espelho de hoje (spec §4.5): a branch que criar um segmento acrescenta o dele. */
const MIRROR_TODAY = [
  `${SLOT}admin/page`,
  `${SLOT}admin/[...rest]/page`,
  `${SLOT}bem-vindo/page`,
  `${SLOT}conta/page`,
  `${SLOT}dashboard/page`,
  `${SLOT}passagens/page`,
  `${SLOT}passagens/[...rest]/page`,
  `${SLOT}solicitacoes/page`,
  `${SLOT}solicitacoes/[...rest]/page`,
];

describe("listAppRouteFiles (a árvore como o Next a vê)", () => {
  const dirs: string[] = [];
  afterAll(() => {
    for (const dir of dirs) rmSync(dir, { recursive: true, force: true });
  });

  function fakeApp(files: readonly string[]): string {
    const dir = mkdtempSync(join(tmpdir(), "closery-rotas-"));
    dirs.push(dir);
    for (const file of files) {
      mkdirSync(join(dir, file, ".."), { recursive: true });
      writeFileSync(
        join(dir, file),
        "export default function P() { return null; }\n",
      );
    }
    return dir;
  }

  it("pasta vazia: nada", () => {
    expect(listAppRouteFiles(fakeApp([]))).toEqual({ pages: [], defaults: [] });
  });

  it("lê page e default em qualquer extensão do Next, com grupo, slot e catch-all", () => {
    const dir = fakeApp([
      "page.tsx",
      "(g)/a/page.ts",
      "(g)/@s/default.jsx",
      "(g)/@s/[...rest]/page.js",
    ]);
    expect(listAppRouteFiles(dir)).toEqual({
      pages: ["/(g)/@s/[...rest]/page", "/(g)/a/page", "/page"],
      defaults: ["/(g)/@s/default"],
    });
  });

  it("ignora teste, layout, loading, route, pasta privada e outro nome", () => {
    const dir = fakeApp([
      "a/page.test.tsx",
      "a/layout.tsx",
      "a/loading.tsx",
      "a/route.ts",
      "_privado/page.tsx",
      "a/_x/default.tsx",
      "a/pages.tsx",
    ]);
    expect(listAppRouteFiles(dir)).toEqual({ pages: [], defaults: [] });
  });
});

describe("validateRoutes (o validador do Next)", () => {
  it("lista vazia: nada sem rota, nenhum slot incompleto, mapa vazio", () => {
    expect(validateRoutes([], [])).toEqual({
      unmatched: [],
      incompatible: [],
      routes: {},
    });
  });
});

describe("a árvore real de src/app passa no validador estrito do Next", () => {
  it("anti-vacuidade: acha as páginas e o default do slot", () => {
    expect(tree.pages.length).toBeGreaterThanOrEqual(20);
    expect(tree.pages).toEqual(
      expect.arrayContaining([
        "/(app)/page",
        "/(app)/@detalhe/page",
        "/(app)/@detalhe/(.)solicitacoes/[id]/page",
        ...Object.values(OUTSIDE_APP).flat(),
      ]),
    );
    expect(tree.defaults).toContain("/(app)/@detalhe/default");
    expect(tree.pages.some((page) => page.includes(".test"))).toBe(false);
  });

  it("1. nenhuma página fica sem rota e nenhum slot fica incompleto", () => {
    expect(real.unmatched).toEqual([]);
    expect(real.incompatible).toEqual([]);
  });

  it("2. /entrar, /convite/[token], /redefinir-senha e /privacidade são rotas, sem página do @detalhe", () => {
    for (const [route, appPaths] of Object.entries(OUTSIDE_APP)) {
      expect(real.routes[route], route).toEqual(appPaths);
    }
  });

  it("3. nenhuma rota começa com /[...: URL desconhecida continua no 404 da raiz", () => {
    expect(
      Object.keys(real.routes).filter((route) => route.startsWith("/[...")),
    ).toEqual([]);
  });
});

describe("4. o espelho do @detalhe por segmento de (app)", () => {
  it("cada segmento com página tem a página nula do slot; com subrota, também o [...rest]", () => {
    expect(actualMirror(tree.pages)).toEqual(expectedMirror(tree.pages));
  });

  it("o espelho de hoje são as nove páginas da spec §4.5", () => {
    expect(expectedMirror(tree.pages)).toEqual(
      expect.arrayContaining(MIRROR_TODAY),
    );
  });

  it("toda rota do grupo (app) leva uma página do @detalhe que não é a interceptada (o Sheet fecha)", () => {
    expect(routesWithoutSlotPage(real.routes)).toEqual([]);
  });

  it("não existem @detalhe/[...catchAll] nem (app)/default", () => {
    expect(tree.pages).not.toContain(`${SLOT}[...catchAll]/page`);
    expect(tree.defaults).not.toContain("/(app)/default");
  });
});

describe("5. a causa, documentada numa árvore sintética", () => {
  const before = [
    "/(app)/page",
    "/(app)/@detalhe/page",
    "/(app)/@detalhe/[...catchAll]/page",
    "/(app)/conta/page",
    "/(auth)/entrar/page",
  ];
  const slotDefault = ["/(app)/@detalhe/default"];

  it("catch-all na raiz do slot: a página do grupo irmão fica sem rota (o 404 do dev)", () => {
    const result = validateRoutes(before, slotDefault);
    expect(result.unmatched).toEqual(["/(auth)/entrar/page"]);
    expect(result.routes["/entrar"]).toBeUndefined();
    expect(result.routes["/conta"]).toContain(
      "/(app)/@detalhe/[...catchAll]/page",
    );
  });

  it("com (app)/default (a candidata recusada): passa, mas nasce a rota /[...catchAll] e o slot entra em /entrar", () => {
    const result = validateRoutes(before, [...slotDefault, "/(app)/default"]);
    expect(result.unmatched).toEqual([]);
    expect(result.routes["/[...catchAll]"]).toEqual([
      "/(app)/@detalhe/[...catchAll]/page",
    ]);
    expect(result.routes["/entrar"]).toContain(
      "/(app)/@detalhe/[...catchAll]/page",
    );
  });

  it("com o espelho: tudo tem rota e /entrar fica sem o slot", () => {
    const mirror = [
      "/(app)/page",
      "/(app)/@detalhe/page",
      "/(app)/@detalhe/conta/page",
      "/(app)/conta/page",
      "/(auth)/entrar/page",
    ];
    const result = validateRoutes(mirror, slotDefault);
    expect(result.unmatched).toEqual([]);
    expect(result.routes["/entrar"]).toEqual(["/(auth)/entrar/page"]);
    expect(routesWithoutSlotPage(result.routes)).toEqual([]);
  });

  it("segmento novo sem espelho: o validador deixa passar, o guarda do grupo 4 reprova", () => {
    const missing = [
      "/(app)/page",
      "/(app)/@detalhe/page",
      "/(app)/relatorios/page",
      "/(auth)/entrar/page",
    ];
    const result = validateRoutes(missing, slotDefault);
    expect(result.unmatched).toEqual([]);
    expect(routesWithoutSlotPage(result.routes)).toEqual(["/relatorios"]);
    expect(actualMirror(missing)).not.toEqual(expectedMirror(missing));
  });

  it("espelho órfão (o segmento saiu e a página do slot ficou): o validador reprova", () => {
    const orphan = [
      "/(app)/page",
      "/(app)/@detalhe/page",
      "/(app)/@detalhe/relatorios/page",
      "/(auth)/entrar/page",
    ];
    expect(validateRoutes(orphan, slotDefault).unmatched).toEqual([
      "/(app)/@detalhe/relatorios/page",
    ]);
  });
});
