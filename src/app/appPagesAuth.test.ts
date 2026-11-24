import { existsSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

import { listSourceFiles, stripComments } from "../../test/actionGuards";

// Guarda do grupo (app): o layout não protege a página (o Next roda a página
// mesmo que o layout troque o conteúdo, e o layout não re-renderiza na
// navegação no cliente). Toda página precisa chamar requireUser/requireAdmin
// ela mesma ou num componente que importa direto de "@/components/...". Sob
// admin/ só requireAdmin vale (P27): requireUser deixaria um operador abrir a
// tela do administrador.

const ROOT = process.cwd();
const APP_GROUP = join(ROOT, "src", "app", "(app)");

type PageGuard = "requireUser" | "requireAdmin";
const ANY_GUARD: readonly PageGuard[] = ["requireUser", "requireAdmin"];

function guardCall(accepted: readonly PageGuard[]): RegExp {
  return new RegExp(`\\b(?:${accepted.join("|")})\\s*\\(`);
}

function componentImports(source: string): string[] {
  const found: string[] = [];
  const pattern = /from\s+["']@\/(components\/[^"']+)["']/g;
  for (const match of stripComments(source).matchAll(pattern)) {
    if (match[1]) found.push(match[1]);
  }
  return found;
}

function resolveComponent(path: string): string | null {
  for (const ext of [".tsx", ".ts", "/index.tsx", "/index.ts"]) {
    const file = join(ROOT, "src", `${path}${ext}`);
    if (existsSync(file)) return file;
  }
  return null;
}

// Verdadeiro se a página, ou um componente que ela importa direto, chama um dos
// guardas aceitos.
export function pageCallsAuthGuard(
  pageSource: string,
  readComponent: (path: string) => string | null,
  accepted: readonly PageGuard[] = ANY_GUARD,
): boolean {
  const call = guardCall(accepted);
  if (call.test(stripComments(pageSource))) return true;
  return componentImports(pageSource).some((path) => {
    const source = readComponent(path);
    return source !== null && call.test(stripComments(source));
  });
}

function readComponentFromDisk(path: string): string | null {
  const file = resolveComponent(path);
  return file ? readFileSync(file, "utf8") : null;
}

// Páginas de slot (rota paralela) que só devolvem null: não leem nada, então não
// há o que proteger. A lista é fechada de propósito: uma página nula que não
// esteja aqui continua precisando do portão, e o guarda reprova. Caminhos
// relativos a src/app/(app), com "/". Entra o slot @detalhe na Tarefa 12.
export const NULL_SLOT_PAGES: readonly string[] = [];

// Verdadeiro só para `export default function Nome() { return null; }`, sem
// nenhum import (comentários não contam).
export function rendersNothing(source: string): boolean {
  return /^export\s+default\s+function\s+[A-Za-z_$][\w$]*\s*\(\s*\)\s*\{\s*return\s+null\s*;?\s*\}\s*;?$/.test(
    stripComments(source).trim(),
  );
}

function findPages(dir: string): string[] {
  return listSourceFiles(dir, (name) => name === "page.tsx");
}

function routeOf(file: string): string {
  return relative(APP_GROUP, file).replaceAll("\\", "/");
}

function isAdminPage(file: string): boolean {
  return routeOf(file).startsWith("admin/");
}

describe("toda página do grupo (app) chama requireUser ou requireAdmin", () => {
  const allPages = findPages(APP_GROUP);
  // As páginas nulas da lista fechada têm a sua própria regra (abaixo).
  const pages = allPages.filter(
    (file) => !NULL_SLOT_PAGES.includes(routeOf(file)),
  );

  it("encontra as páginas guardadas do grupo", () => {
    expect(pages.length).toBeGreaterThanOrEqual(13);
  });

  it("a lista fechada de slots nulos: cada entrada é de um slot, existe e só devolve null", () => {
    expect(new Set(NULL_SLOT_PAGES).size).toBe(NULL_SLOT_PAGES.length);
    for (const route of NULL_SLOT_PAGES) {
      expect(route.startsWith("@"), `${route} não é de um slot`).toBe(true);
      const file = allPages.find((candidate) => routeOf(candidate) === route);
      expect(file, `${route} não existe`).toBeDefined();
      if (file === undefined) continue;
      expect(
        rendersNothing(readFileSync(file, "utf8")),
        `${route} faz mais que devolver null: precisa do portão`,
      ).toBe(true);
    }
  });

  it("inclui a página de cada rota de /admin", () => {
    const routes = pages.map((file) =>
      relative(APP_GROUP, file).replaceAll("\\", "/"),
    );
    for (const route of [
      "admin/page.tsx",
      "admin/setores/page.tsx",
      "admin/turnos/page.tsx",
      "admin/itens/page.tsx",
      "admin/destinos/page.tsx",
      "admin/equipe/page.tsx",
    ]) {
      expect(routes).toContain(route);
    }
  });

  it("inclui a página de cada rota de /passagens", () => {
    const routes = pages.map((file) =>
      relative(APP_GROUP, file).replaceAll("\\", "/"),
    );
    for (const route of [
      "passagens/page.tsx",
      "passagens/nova/page.tsx",
      "passagens/[id]/page.tsx",
    ]) {
      expect(routes).toContain(route);
    }
  });

  it("inclui a página de cada rota de /solicitacoes", () => {
    const routes = pages.map((file) =>
      relative(APP_GROUP, file).replaceAll("\\", "/"),
    );
    for (const route of ["solicitacoes/page.tsx"]) {
      expect(routes).toContain(route);
    }
  });

  it("nenhuma página de /admin exporta metadata (T12)", () => {
    for (const file of pages.filter(isAdminPage)) {
      expect(readFileSync(file, "utf8"), file).not.toMatch(
        /export\s+(const\s+metadata|(async\s+)?function\s+generateMetadata)\b/,
      );
    }
  });

  it.each(
    pages.map((file) => [relative(ROOT, file).replaceAll("\\", "/"), file]),
  )("%s", (name, file) => {
    const admin = isAdminPage(file as string);
    const ok = pageCallsAuthGuard(
      readFileSync(file as string, "utf8"),
      readComponentFromDisk,
      admin ? ["requireAdmin"] : ANY_GUARD,
    );
    expect(
      ok,
      admin
        ? `${name} não chama requireAdmin (nem direto, nem num componente importado de @/components). Sob admin/ só requireAdmin vale.`
        : `${name} não chama requireUser/requireAdmin (nem direto, nem num componente importado de @/components). O layout não protege a página.`,
    ).toBe(true);
  });
});

describe("pageCallsAuthGuard (o guarda de fato falha)", () => {
  const noComponents = () => null;

  it("página fictícia sem chamada de sessão → false", () => {
    const fake = `export default function Page() { return <p>dados</p>; }`;
    expect(pageCallsAuthGuard(fake, noComponents)).toBe(false);
  });

  it("chamada só em comentário não conta", () => {
    const fake = `// await requireUser();\n/* requireAdmin() */\nexport default function Page() { return null; }`;
    expect(pageCallsAuthGuard(fake, noComponents)).toBe(false);
  });

  it("componente importado sem chamada → false", () => {
    const fake = `import { Lista } from "@/components/x/Lista";\nexport default () => <Lista />;`;
    expect(
      pageCallsAuthGuard(fake, () => "export const Lista = () => null;"),
    ).toBe(false);
  });

  it("chamada na própria página → true", () => {
    const page = `async function C() { await requireUser(); }`;
    expect(pageCallsAuthGuard(page, noComponents)).toBe(true);
  });

  it("chamada no componente importado → true", () => {
    const page = `import { Lista } from "@/components/x/Lista";`;
    expect(pageCallsAuthGuard(page, () => "await requireAdmin();")).toBe(true);
  });

  it("com ['requireAdmin'], só requireUser não basta (página de admin)", () => {
    const page = `async function C() { await requireUser(); }`;
    expect(pageCallsAuthGuard(page, noComponents, ["requireAdmin"])).toBe(
      false,
    );
    const viaComponent = `import { Lista } from "@/components/x/Lista";`;
    expect(
      pageCallsAuthGuard(viaComponent, () => "await requireUser();", [
        "requireAdmin",
      ]),
    ).toBe(false);
  });

  it("com ['requireAdmin'], requireAdmin na página ou no componente passa", () => {
    expect(
      pageCallsAuthGuard("await requireAdmin();", noComponents, [
        "requireAdmin",
      ]),
    ).toBe(true);
    const viaComponent = `import { Lista } from "@/components/x/Lista";`;
    expect(
      pageCallsAuthGuard(viaComponent, () => "await requireAdmin();", [
        "requireAdmin",
      ]),
    ).toBe(true);
  });

  it("o padrão aceita requireUser; um nome parecido não conta", () => {
    expect(pageCallsAuthGuard("await requireUser();", noComponents)).toBe(true);
    expect(pageCallsAuthGuard("await requireUserOrNot();", noComponents)).toBe(
      false,
    );
  });
});

describe("rendersNothing (a lista fechada de slots nulos de fato falha)", () => {
  it("a página nula de verdade → true", () => {
    expect(
      rendersNothing(`export default function Default() { return null; }`),
    ).toBe(true);
    expect(
      rendersNothing(
        `// slot vazio\nexport default function Nada() {\n  return null\n}\n`,
      ),
    ).toBe(true);
  });

  it("com import → false", () => {
    expect(
      rendersNothing(
        `import { x } from "@/lib/x";\nexport default function Page() { return null; }`,
      ),
    ).toBe(false);
  });

  it("com JSX → false", () => {
    expect(
      rendersNothing(`export default function Page() { return <p>oi</p>; }`),
    ).toBe(false);
  });

  it("com requireUser ou outra instrução → false", () => {
    expect(
      rendersNothing(
        `export default async function Page() { await requireUser(); return null; }`,
      ),
    ).toBe(false);
  });

  it("com dois exports → false", () => {
    expect(
      rendersNothing(
        `export const metadata = {};\nexport default function Page() { return null; }`,
      ),
    ).toBe(false);
    expect(
      rendersNothing(
        `export default function Page() { return null; }\nexport const x = 1;`,
      ),
    ).toBe(false);
  });

  it("função de seta ou export nomeado → false (o formato é um só)", () => {
    expect(rendersNothing(`export default () => null;`)).toBe(false);
    expect(rendersNothing(`export function Page() { return null; }`)).toBe(
      false,
    );
  });

  it("devolver outra coisa que não null → false", () => {
    expect(
      rendersNothing(`export default function Page() { return undefined; }`),
    ).toBe(false);
    expect(
      rendersNothing(`export default function Page() { return <></>; }`),
    ).toBe(false);
  });

  it("o return null só em comentário não conta", () => {
    expect(
      rendersNothing(
        `export default function Page() { /* return null; */ return <p />; }`,
      ),
    ).toBe(false);
  });

  it("vazio → false", () => {
    expect(rendersNothing("")).toBe(false);
  });

  it("uma página nula que NÃO está na lista continua sem portão: o guarda a reprova", () => {
    const nullPage = `export default function Page() { return null; }`;
    expect(pageCallsAuthGuard(nullPage, () => null)).toBe(false);
  });
});
