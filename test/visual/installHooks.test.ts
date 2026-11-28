import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  CHECK_NAMES_SCRIPT,
  HOOK_MARKER,
  hookScript,
  isOurHook,
  MISSING_SCRIPT_WARNING,
} from "../../scripts/visual/install-hooks.mjs";
import { createTempRepo, type TempRepo } from "./tempRepo";

// O pre-commit do check-names (spec §7): o script, a marca e o CLI que instala,
// regrava e remove só o nosso, num repositório git temporário.

const FOREIGN_HOOK = "#!/bin/sh\nexec npx lint-staged\n";

describe("hookScript", () => {
  it("é o script da spec §7 com o desvio da branch sem o check-names, com LF e a marca na segunda linha", () => {
    expect(HOOK_MARKER).toBe("# closery:check-names");
    expect(CHECK_NAMES_SCRIPT).toBe("scripts/visual/check-names.mjs");
    expect(hookScript()).toBe(
      [
        "#!/bin/sh",
        "# closery:check-names (instalado por scripts/visual/install-hooks.mjs)",
        "if [ ! -f scripts/visual/check-names.mjs ]; then",
        `  echo "${MISSING_SCRIPT_WARNING}" >&2`,
        "  exit 0",
        "fi",
        "exec node scripts/visual/check-names.mjs --staged",
        "",
      ].join("\n"),
    );
    expect(hookScript()).not.toContain("\r");
  });

  it("é o script que a spec §7 mostra (a emenda da decisão 9 não volta ao esboço)", () => {
    const spec = readFileSync(
      join(
        process.cwd(),
        "docs/superpowers/specs/2026-11-27-processo-visual-design.md",
      ),
      "utf8",
    ).replaceAll("\r\n", "\n");
    const section = spec.slice(spec.indexOf("**`install-hooks.mjs`:**"));
    const block = section.match(/```sh\n([\s\S]*?)```/);
    expect(block?.[1]).toBe(hookScript());
  });

  it("o aviso nomeia o script e não tem nada que o sh expanda dentro das aspas", () => {
    expect(MISSING_SCRIPT_WARNING).toContain("aviso");
    expect(MISSING_SCRIPT_WARNING).toContain(CHECK_NAMES_SCRIPT);
    expect(MISSING_SCRIPT_WARNING).not.toMatch(/["$`\\\n]/);
  });
});

describe("isOurHook", () => {
  it("reconhece o nosso, também com CRLF", () => {
    expect(isOurHook(hookScript())).toBe(true);
    expect(isOurHook(hookScript().replaceAll("\n", "\r\n"))).toBe(true);
    expect(isOurHook(`#!/bin/sh\n${HOOK_MARKER}\n`)).toBe(true);
  });

  it("recusa hook alheio, vazio, marca no meio da linha ou com outro sufixo", () => {
    expect(isOurHook("")).toBe(false);
    expect(isOurHook(FOREIGN_HOOK)).toBe(false);
    expect(isOurHook(`echo '${HOOK_MARKER}'\n`)).toBe(false);
    expect(isOurHook(`${HOOK_MARKER}-outro\n`)).toBe(false);
  });
});

describe("install-hooks.mjs (CLI)", () => {
  let repo: TempRepo;
  const defaultHook = () => join(repo.dir, ".git", "hooks", "pre-commit");

  beforeEach(() => {
    repo = createTempRepo();
  });

  afterEach(() => repo.remove());

  it("instala em .git/hooks/pre-commit e regrava sem erro (idempotente)", () => {
    const first = repo.run("install-hooks.mjs");
    expect(first.status).toBe(0);
    expect(first.stdout).toContain("hook instalado");
    expect(readFileSync(defaultHook(), "utf8")).toBe(hookScript());
    const second = repo.run("install-hooks.mjs");
    expect(second.status).toBe(0);
    expect(second.stdout).toContain("hook regravado");
    expect(readFileSync(defaultHook(), "utf8")).toBe(hookScript());
  });

  it("respeita o core.hooksPath", () => {
    repo.git("config", "core.hooksPath", ".githooks");
    expect(repo.run("install-hooks.mjs").status).toBe(0);
    expect(
      readFileSync(join(repo.dir, ".githooks", "pre-commit"), "utf8"),
    ).toBe(hookScript());
    expect(existsSync(defaultHook())).toBe(false);
  });

  it("recusa um pre-commit alheio com código 1 e não o toca", () => {
    repo.write(join(".git", "hooks", "pre-commit"), FOREIGN_HOOK);
    const result = repo.run("install-hooks.mjs");
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("não é deste projeto");
    expect(readFileSync(defaultHook(), "utf8")).toBe(FOREIGN_HOOK);
  });

  it("--remove apaga o nosso; sem hook não faz nada e sai com 0", () => {
    repo.run("install-hooks.mjs");
    const removed = repo.run("install-hooks.mjs", ["--remove"]);
    expect(removed.status).toBe(0);
    expect(existsSync(defaultHook())).toBe(false);
    const again = repo.run("install-hooks.mjs", ["--remove"]);
    expect(again.status).toBe(0);
    expect(again.stdout).toContain("nada a remover");
  });

  it("--remove recusa o hook alheio (código 1) e o deixa como está", () => {
    repo.write(join(".git", "hooks", "pre-commit"), FOREIGN_HOOK);
    expect(repo.run("install-hooks.mjs", ["--remove"]).status).toBe(1);
    expect(readFileSync(defaultHook(), "utf8")).toBe(FOREIGN_HOOK);
  });

  it("o hook instalado deixa o commit passar com o aviso numa branch sem o check-names", () => {
    expect(repo.run("install-hooks.mjs").status).toBe(0);
    repo.write("leia.txt", "texto\n");
    repo.git("add", "leia.txt");
    const commit = repo.gitResult("commit", "-q", "-m", "primeiro");
    expect(commit.status).toBe(0);
    expect(commit.stderr).toContain(MISSING_SCRIPT_WARNING);
    expect(repo.git("log", "--format=%s").trim()).toBe("primeiro");
  });

  it("com o check-names na branch, o hook roda --staged e o código dele decide o commit", () => {
    expect(repo.run("install-hooks.mjs").status).toBe(0);
    const fakeCheck = (code: number) =>
      repo.write(
        CHECK_NAMES_SCRIPT,
        `console.error("falso:" + process.argv.slice(2).join(" "));\nprocess.exit(${code});\n`,
      );
    fakeCheck(1);
    repo.write("leia.txt", "texto\n");
    repo.git("add", "leia.txt");
    const refused = repo.gitResult("commit", "-q", "-m", "recusado");
    expect(refused.status).not.toBe(0);
    expect(refused.stderr).toContain("falso:--staged");
    expect(refused.stderr).not.toContain(MISSING_SCRIPT_WARNING);
    expect(repo.gitResult("rev-parse", "--verify", "HEAD").status).not.toBe(0);
    fakeCheck(0);
    const passed = repo.gitResult("commit", "-q", "-m", "aceito");
    expect(passed.status).toBe(0);
    expect(passed.stderr).toContain("falso:--staged");
    expect(passed.stderr).not.toContain(MISSING_SCRIPT_WARNING);
    expect(repo.git("log", "--format=%s").trim()).toBe("aceito");
  });

  it.each([
    [["--forca"]],
    [["extra"]],
    [["--remove=sim"]],
  ])("argumento desconhecido %j: código 2 e nada gravado", (args) => {
    const result = repo.run("install-hooks.mjs", args);
    expect(result.status).toBe(2);
    expect(result.stderr).toContain("Uso:");
    expect(existsSync(defaultHook())).toBe(false);
  });
});
