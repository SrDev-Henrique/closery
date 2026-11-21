import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

// Guarda do grupo (app): o layout não protege a página (o Next roda a página
// mesmo que o layout troque o conteúdo, e o layout não re-renderiza na
// navegação no cliente). Toda página precisa chamar requireUser/requireAdmin
// ela mesma ou num componente que importa direto de "@/components/...".

const ROOT = process.cwd();
const APP_GROUP = join(ROOT, "src", "app", "(app)");

const GUARD_CALL = /\brequire(User|Admin)\s*\(/;

function stripComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/.*$/gm, "$1");
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

// Verdadeiro se a página, ou um componente que ela importa direto, chama o guarda.
export function pageCallsAuthGuard(
  pageSource: string,
  readComponent: (path: string) => string | null,
): boolean {
  if (GUARD_CALL.test(stripComments(pageSource))) return true;
  return componentImports(pageSource).some((path) => {
    const source = readComponent(path);
    return source !== null && GUARD_CALL.test(stripComments(source));
  });
}

function readComponentFromDisk(path: string): string | null {
  const file = resolveComponent(path);
  return file ? readFileSync(file, "utf8") : null;
}

function findPages(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) return findPages(full);
    return name === "page.tsx" ? [full] : [];
  });
}

describe("toda página do grupo (app) chama requireUser ou requireAdmin", () => {
  const pages = findPages(APP_GROUP);

  it("encontra as páginas do grupo", () => {
    expect(pages.length).toBeGreaterThanOrEqual(4);
  });

  it.each(
    pages.map((file) => [relative(ROOT, file).replaceAll("\\", "/"), file]),
  )("%s", (name, file) => {
    const ok = pageCallsAuthGuard(
      readFileSync(file as string, "utf8"),
      readComponentFromDisk,
    );
    expect(
      ok,
      `${name} não chama requireUser/requireAdmin (nem direto, nem num componente importado de @/components). O layout não protege a página.`,
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
});
