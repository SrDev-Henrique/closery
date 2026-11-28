import { execFileSync, spawnSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

// Guarda do scripts/visual/env.sh (spec §5.3): banco 54332, app 3202, o .git/sdd achado
// pelo git rev-parse e o segredo nunca impresso. O texto é conferido sempre; a execução,
// só onde existe `sh` (no Windows, o Vitest pelo Git Bash).

const ENV_SH = resolve("scripts/visual/env.sh");
const source = readFileSync(ENV_SH, "utf8");
const code = source.split("\n").filter((line) => !line.trim().startsWith("#"));
const hasSh = spawnSync("sh", ["-c", "exit 0"]).status === 0;

describe("env.sh, o texto", () => {
  it("aponta para o banco 54332 e o app 3202, nunca para as portas dos outros", () => {
    expect(code).toContain(
      'export DATABASE_URL="postgres://postgres:postgres@127.0.0.1:54332/postgres"',
    );
    expect(code).toContain('export DATABASE_URL_POOLED="$DATABASE_URL"');
    expect(code).toContain('export DATABASE_POOL_MAX="1"');
    expect(code).toContain('export BETTER_AUTH_URL="http://localhost:3202"');
    for (const port of ["3000", "3200", "3201", "54329", "54331"]) {
      expect(source).not.toContain(`:${port}`);
    }
  });

  it("acha o .git pelo git rev-parse --git-common-dir, nunca por um caminho fixo", () => {
    expect(source).toContain(
      "git rev-parse --path-format=absolute --git-common-dir",
    );
    expect(source).not.toMatch(/\.git\//);
  });

  it("nunca imprime o segredo: nenhum echo/printf com ele; o cat só na atribuição", () => {
    for (const line of code) {
      if (/\b(echo|printf)\b/.test(line)) expect(line).not.toMatch(/secret/i);
    }
    expect(code.filter((line) => /\bcat\b/.test(line))).toEqual([
      'BETTER_AUTH_SECRET="$(cat "$VISUAL_SECRET_FILE")"',
    ]);
  });

  it("esvazia o login social e o Sentry", () => {
    expect(code).toContain(
      'export GOOGLE_CLIENT_ID="" GOOGLE_CLIENT_SECRET="" FACEBOOK_CLIENT_ID="" FACEBOOK_CLIENT_SECRET=""',
    );
    expect(code).toContain(
      'export NEXT_PUBLIC_SENTRY_DSN="" SENTRY_AUTH_TOKEN=""',
    );
  });
});

describe.skipIf(!hasSh)("env.sh, rodando no sh", () => {
  const root = realpathSync.native(mkdtempSync(join(tmpdir(), "closery-env-")));
  const repo = join(root, "repo");
  const outside = join(root, "solto");
  const secretFile = join(repo, ".git", "sdd", "visual-db", "secret");
  // O sh do Git Bash aceita "C:/…"; a barra invertida, não em todo lugar.
  const script = ENV_SH.replaceAll("\\", "/");
  const run = (cwd: string) =>
    spawnSync(
      "sh",
      [
        "-c",
        '. "$ENV_SH" && printf "%s\\n%s\\n" "$DATABASE_URL" "$BETTER_AUTH_URL" && [ -n "$BETTER_AUTH_SECRET" ] && echo com-segredo',
      ],
      {
        cwd,
        encoding: "utf8",
        env: { ...process.env, ENV_SH: script, GIT_CEILING_DIRECTORIES: root },
      },
    );

  beforeAll(() => {
    mkdirSync(repo);
    mkdirSync(outside);
    execFileSync("git", ["init", "-q"], { cwd: repo });
  });

  afterAll(() => {
    rmSync(root, { recursive: true, force: true });
  });

  it("gera o segredo em <git-common-dir>/sdd/visual-db/secret, sem imprimi-lo, e exporta as URLs", () => {
    const result = run(repo);
    expect(result.status).toBe(0);
    const secret = readFileSync(secretFile, "utf8");
    expect(Buffer.from(secret, "base64")).toHaveLength(32);
    expect(result.stdout.split(/\r?\n/).slice(0, 3)).toEqual([
      "postgres://postgres:postgres@127.0.0.1:54332/postgres",
      "http://localhost:3202",
      "com-segredo",
    ]);
    expect(`${result.stdout}${result.stderr}`).not.toContain(secret);
  });

  it("na segunda vez, reaproveita o mesmo segredo", () => {
    const before = readFileSync(secretFile, "utf8");
    expect(run(repo).status).toBe(0);
    expect(readFileSync(secretFile, "utf8")).toBe(before);
  });

  it("fora de um repositório, falha com a mensagem e não grava nada", () => {
    const result = run(outside);
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("rode dentro do repositório");
    expect(existsSync(join(outside, "sdd"))).toBe(false);
  });
});
