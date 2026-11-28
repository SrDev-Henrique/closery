import { execFileSync, spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";

// Repositório git descartável para os testes dos CLIs de scripts/visual. A
// configuração do computador fica de fora (sem a global, sem a do sistema e sem
// nenhuma variável GIT_*: um teste rodado de dentro de um hook não enxerga o
// repositório de verdade). A lista de nomes, quando um teste precisa dela, é
// sintética e mora no .git/sdd do repositório temporário.

/** Pasta dos scripts; o Vitest roda na raiz do repositório. */
export const SCRIPTS_DIR = resolve("scripts", "visual");

export type CliResult = {
  status: number | null;
  stdout: string;
  stderr: string;
};

export type TempRepo = {
  /** a árvore de trabalho */
  dir: string;
  git: (...args: string[]) => string;
  /** roda o git sem lançar: devolve o código, a saída e o erro (ex.: um commit que o hook recusa) */
  gitResult: (...args: string[]) => CliResult;
  write: (relative: string, content: string) => void;
  /** roda `node scripts/visual/<script>` com a raiz do repositório temporário como cwd */
  run: (script: string, args?: string[]) => CliResult;
  remove: () => void;
};

export function createTempRepo(): TempRepo {
  const base = mkdtempSync(join(tmpdir(), "closery-visual-"));
  const dir = join(base, "repo");
  mkdirSync(dir);
  const globalConfig = join(base, "gitconfig");
  writeFileSync(globalConfig, "");
  const env = {
    ...Object.fromEntries(
      Object.entries(process.env).filter(([key]) => !key.startsWith("GIT_")),
    ),
    GIT_CONFIG_GLOBAL: globalConfig,
    GIT_CONFIG_NOSYSTEM: "1",
    GIT_AUTHOR_NAME: "Ana Teste",
    GIT_AUTHOR_EMAIL: "ana.teste@example.com",
    GIT_COMMITTER_NAME: "Ana Teste",
    GIT_COMMITTER_EMAIL: "ana.teste@example.com",
  } as unknown as NodeJS.ProcessEnv;
  const git = (...args: string[]) =>
    execFileSync("git", args, {
      cwd: dir,
      env,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
  const gitResult = (...args: string[]): CliResult => {
    const result = spawnSync("git", args, {
      cwd: dir,
      env,
      encoding: "utf8",
    });
    return {
      status: result.status,
      stdout: result.stdout,
      stderr: result.stderr,
    };
  };
  const write = (relative: string, content: string) => {
    const file = join(dir, relative);
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, content);
  };
  const run = (script: string, args: string[] = []): CliResult => {
    const result = spawnSync(
      process.execPath,
      [join(SCRIPTS_DIR, script), ...args],
      { cwd: dir, env, encoding: "utf8" },
    );
    return {
      status: result.status,
      stdout: result.stdout,
      stderr: result.stderr,
    };
  };
  git("init", "-q", "-b", "main");
  return {
    dir,
    git,
    gitResult,
    write,
    run,
    remove: () => rmSync(base, { recursive: true, force: true }),
  };
}
