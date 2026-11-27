import { execFileSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  realpathSync,
  rmSync,
  statSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import {
  assertInsideSdd,
  gitCommonDir,
  isInside,
  readJsonInsideSdd,
  repoRoot,
  resolveInside,
  sddDir,
  sddPath,
  VISUAL_DB_DIR,
  VISUAL_DB_FILES,
  visualDbDir,
  writeInsideSdd,
} from "../../scripts/visual/paths.mjs";

// Guarda dos caminhos das ferramentas visuais (spec §5.1, regra 1): tudo sai em
// <git-common-dir>/sdd, inclusive numa worktree, e nada escapa dela.

describe("isInside", () => {
  it("aceita a própria pasta e o que está dentro", () => {
    expect(isInside("/repo/.git/sdd", "/repo/.git/sdd")).toBe(true);
    expect(isInside("/repo/.git/sdd", "/repo/.git/sdd/processo/a.png")).toBe(
      true,
    );
  });

  it("recusa a fuga por .., o absoluto fora e a pasta irmã de nome parecido", () => {
    expect(
      isInside("/repo/.git/sdd", "/repo/.git/sdd/../hooks/pre-commit"),
    ).toBe(false);
    expect(isInside("/repo/.git/sdd", "/repo/src/app/page.tsx")).toBe(false);
    expect(isInside("/repo/.git/sdd", "/repo/.git/sdd-outra/x")).toBe(false);
  });

  it("uma pasta que começa com dois pontos não é fuga", () => {
    expect(isInside("/repo/.git/sdd", "/repo/.git/sdd/..visual/x")).toBe(true);
  });

  it("no Windows, compara sem caixa e com as duas barras", () => {
    expect(
      isInside(
        "C:\\Users\\Dev\\repo\\.git\\sdd",
        "c:/users/dev/REPO/.git/SDD/processo/a.png",
      ),
    ).toBe(true);
    expect(
      isInside("C:/Users/Dev/repo/.git/sdd", "C:\\Users\\Dev\\repo\\src"),
    ).toBe(false);
    expect(isInside("C:\\repo\\.git\\sdd", "D:\\repo\\.git\\sdd\\x")).toBe(
      false,
    );
  });
});

describe("resolveInside", () => {
  it("resolve o relativo dentro da base", () => {
    expect(resolveInside("/repo/.git/sdd", "processo/pares")).toBe(
      "/repo/.git/sdd/processo/pares",
    );
    expect(resolveInside("/repo/.git/sdd", ".")).toBe("/repo/.git/sdd");
  });

  it("lança na fuga por .. e no absoluto fora, com a base e o relativo na mensagem", () => {
    expect(() => resolveInside("/repo/.git/sdd", "../../src")).toThrow(
      "fora de /repo/.git/sdd: ../../src",
    );
    expect(() => resolveInside("/repo/.git/sdd", "/etc/passwd")).toThrow(
      "fora de /repo/.git/sdd: /etc/passwd",
    );
  });

  it("no Windows, devolve com barra invertida e recusa a fuga", () => {
    expect(resolveInside("C:\\repo\\.git\\sdd", "processo/pares")).toBe(
      "C:\\repo\\.git\\sdd\\processo\\pares",
    );
    expect(() => resolveInside("C:\\repo\\.git\\sdd", "..\\..\\src")).toThrow(
      "fora de",
    );
  });
});

describe("caminhos pelo git (repositório temporário com worktree)", () => {
  const root = realpathSync.native(
    mkdtempSync(join(tmpdir(), "closery-paths-")),
  );
  const main = join(root, "main");
  const worktree = join(root, "wt");
  const git = (cwd: string, ...args: string[]) =>
    execFileSync(
      "git",
      ["-c", "user.name=Teste", "-c", "user.email=teste@example.com", ...args],
      { cwd, stdio: "ignore" },
    );

  beforeAll(() => {
    mkdirSync(main);
    git(main, "init", "-q");
    git(main, "commit", "-q", "--allow-empty", "-m", "inicio");
    git(main, "worktree", "add", "-q", worktree);
  });

  afterAll(() => {
    vi.unstubAllEnvs();
    rmSync(root, { recursive: true, force: true });
  });

  it("sddDir é <git-common-dir>/sdd", () => {
    expect(sddDir(main)).toBe(join(gitCommonDir(main), "sdd"));
    expect(sddDir(main).endsWith(join(".git", "sdd"))).toBe(true);
  });

  it("numa worktree (onde .git é um arquivo), o sdd é o mesmo do repositório principal", () => {
    expect(statSync(join(worktree, ".git")).isFile()).toBe(true);
    expect(sddDir(worktree)).toBe(sddDir(main));
  });

  it("repoRoot é a raiz de cada árvore", () => {
    expect(repoRoot(worktree)).not.toBe(repoRoot(main));
    expect(isInside(root, repoRoot(worktree))).toBe(true);
  });

  it("fora de um repositório, lança com a pasta na mensagem", () => {
    const outside = join(root, "solto");
    mkdirSync(outside);
    vi.stubEnv("GIT_CEILING_DIRECTORIES", root);
    expect(() => gitCommonDir(outside)).toThrow(
      `não é um repositório git: ${outside}`,
    );
  });
});

describe("no repositório atual", () => {
  const scratch = sddPath("tmp-testes", `paths-${process.pid}-${Date.now()}`);

  afterEach(() => {
    rmSync(scratch, { recursive: true, force: true });
  });

  it("sddPath fica dentro do sdd e recusa a fuga", () => {
    expect(isInside(sddDir(), sddPath("processo", "pares"))).toBe(true);
    expect(sddPath()).toBe(sddDir());
    expect(() => sddPath("..", "hooks")).toThrow("fora de");
  });

  it("visualDbDir é <sdd>/visual-db, com os arquivos de sempre", () => {
    expect(visualDbDir()).toBe(join(sddDir(), VISUAL_DB_DIR));
    expect(VISUAL_DB_FILES).toEqual({
      world: "world.json",
      state: "state.json",
      avatars: "avatars.json",
      secret: "secret",
      data: "pgdata",
    });
  });

  it("assertInsideSdd devolve o absoluto e recusa o que está fora", () => {
    const inside = join(sddDir(), "x.json");
    expect(assertInsideSdd(inside)).toBe(inside);
    expect(() => assertInsideSdd(join(repoRoot(), "package.json"))).toThrow(
      "fora de .git/sdd",
    );
  });

  it("writeInsideSdd cria as pastas, e readJsonInsideSdd lê de volta", () => {
    const file = join(scratch, "a", "b.json");
    writeInsideSdd(file, JSON.stringify({ ok: 1 }));
    expect(readJsonInsideSdd(file)).toEqual({ ok: 1 });
  });

  it("writeInsideSdd recusa destino fora e não grava nada", () => {
    const outside = join(tmpdir(), `closery-fora-${process.pid}.txt`);
    expect(() => writeInsideSdd(outside, "x")).toThrow("fora de .git/sdd");
    expect(existsSync(outside)).toBe(false);
  });

  it("readJsonInsideSdd diz qual arquivo falta", () => {
    expect(() => readJsonInsideSdd(join(scratch, "nao-existe.json"))).toThrow(
      "arquivo ausente",
    );
  });
});
