import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  HOOK_MARKER,
  hookScript,
  isOurHook,
} from "../../scripts/visual/install-hooks.mjs";
import { createTempRepo, type TempRepo } from "./tempRepo";

// O pre-commit do check-names (spec §7): o script, a marca e o CLI que instala,
// regrava e remove só o nosso, num repositório git temporário.

const FOREIGN_HOOK = "#!/bin/sh\nexec npx lint-staged\n";

describe("hookScript", () => {
  it("é o script da spec §7, com LF e a marca na segunda linha", () => {
    expect(HOOK_MARKER).toBe("# closery:check-names");
    expect(hookScript()).toBe(
      "#!/bin/sh\n# closery:check-names (instalado por scripts/visual/install-hooks.mjs)\nexec node scripts/visual/check-names.mjs --staged\n",
    );
    expect(hookScript()).not.toContain("\r");
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
