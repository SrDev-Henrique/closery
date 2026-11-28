import { rmSync } from "node:fs";
import { join } from "node:path";

import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import {
  addedLinesFromDiff,
  findForbidden,
  NAMES_LIST_FILE,
  normalizeText,
  parseNamesList,
} from "../../scripts/visual/names.mjs";
import { createTempRepo, type TempRepo } from "./tempRepo";

// Regras do check-names (spec §7) com uma lista sintética de termos inventados.
// Nada aqui lê a lista de verdade (.git/sdd/nomes-proibidos.txt), que só existe
// na máquina do controlador; os CLIs rodam num repositório git temporário.

const LIST_TEXT = [
  "# termos inventados para o teste",
  "",
  "Zorvalda",
  "Lampião Torto",
  "zorvalda.torto@exemplo.test",
  "Ação Ímpar",
  "!Zorvalda Teste",
  "!zorvalda.teste@example.com",
  "!",
].join("\n");

const list = parseNamesList(LIST_TEXT);

describe("normalizeText", () => {
  it("tira acento e caixa", () => {
    expect(normalizeText("Ação ÍMPAR Çedilha")).toBe("acao impar cedilha");
  });

  it("texto vazio continua vazio", () => {
    expect(normalizeText("")).toBe("");
  });
});

describe("parseNamesList", () => {
  it("ignora comentário e linha vazia e guarda a linha de cada termo no arquivo", () => {
    expect(list.terms).toEqual([
      { listLine: 3, kind: "palavra", value: "zorvalda" },
      { listLine: 4, kind: "frase", value: "lampiao torto" },
      { listLine: 5, kind: "email", value: "zorvalda.torto@exemplo.test" },
      { listLine: 6, kind: "frase", value: "acao impar" },
    ]);
  });

  it('"!" marca uma frase permitida; "!" sozinho não conta', () => {
    expect(list.allowed).toEqual([
      "zorvalda teste",
      "zorvalda.teste@example.com",
    ]);
  });

  it("lista vazia ou só com comentários não tem termo", () => {
    expect(parseNamesList("")).toEqual({ terms: [], allowed: [] });
    expect(parseNamesList("# só comentário\n\n   \n").terms).toEqual([]);
  });

  it("aceita CRLF, BOM e espaços repetidos", () => {
    const parsed = parseNamesList("﻿# c\r\n  Lampião    Torto  \r\n");
    expect(parsed.terms).toEqual([
      { listLine: 2, kind: "frase", value: "lampiao torto" },
    ]);
  });
});

describe("findForbidden", () => {
  it("palavra casa só inteira, sem caixa e sem acento", () => {
    expect(findForbidden("a ZÓRVALDA chegou.", list)).toEqual([
      { line: 1, listLine: 3 },
    ]);
    expect(findForbidden("Zorvalda.", list)).toEqual([
      { line: 1, listLine: 3 },
    ]);
    expect(findForbidden("Zorvaldas", list)).toEqual([]);
    expect(findForbidden("xzorvalda", list)).toEqual([]);
    expect(findForbidden("zorvalda_2", list)).toEqual([]);
  });

  it("frase casa com qualquer espaço entre as palavras, nunca pela metade", () => {
    expect(findForbidden("o lampiao   TORTO apagou", list)).toEqual([
      { line: 1, listLine: 4 },
    ]);
    expect(findForbidden("acao impar", list)).toEqual([
      { line: 1, listLine: 6 },
    ]);
    expect(findForbidden("Lampião", list)).toEqual([]);
    expect(findForbidden("lampião tortos", list)).toEqual([]);
  });

  it("e-mail casa como trecho (e a palavra dentro dele também)", () => {
    expect(findForbidden("<zorvalda.torto@exemplo.test>", list)).toEqual([
      { line: 1, listLine: 3 },
      { line: 1, listLine: 5 },
    ]);
  });

  it("o trecho permitido sai do texto antes da busca", () => {
    expect(findForbidden("Zorvalda Teste assinou", list)).toEqual([]);
    expect(findForbidden("zorvalda.teste@example.com", list)).toEqual([]);
    expect(findForbidden("Zorvalda Teste e Zorvalda", list)).toEqual([
      { line: 1, listLine: 3 },
    ]);
  });

  it("o trecho permitido não junta as palavras dos dois lados numa frase proibida", () => {
    expect(findForbidden("Lampião Zorvalda Teste Torto", list)).toEqual([]);
  });

  it("conta as linhas a partir de 1, com LF ou CRLF", () => {
    expect(findForbidden("ok\nZorvalda\r\nok\nLampião Torto", list)).toEqual([
      { line: 2, listLine: 3 },
      { line: 4, listLine: 4 },
    ]);
  });

  it("caractere especial de regex no termo é literal", () => {
    const special = parseNamesList("C++ (beta)\n[x]*");
    expect(findForbidden("uso C++ (beta) aqui", special)).toEqual([
      { line: 1, listLine: 1 },
    ]);
    expect(findForbidden("C (beta)", special)).toEqual([]);
  });

  it("texto vazio ou lista vazia: nada", () => {
    expect(findForbidden("", list)).toEqual([]);
    expect(findForbidden("Zorvalda", parseNamesList(""))).toEqual([]);
  });
});

describe("addedLinesFromDiff", () => {
  it("lê vários arquivos e hunks do diff -U0, com o número da linha nova", () => {
    const diff = [
      "diff --git a/a.txt b/a.txt",
      "index 1111111..2222222 100644",
      "--- a/a.txt",
      "+++ b/a.txt",
      "@@ -1,0 +2,2 @@",
      "+linha dois",
      "+linha três",
      "@@ -10 +12 @@",
      "-velha",
      "+nova",
      "diff --git a/dir com espaço/b.md b/dir com espaço/b.md",
      "new file mode 100644",
      "index 0000000..3333333",
      "--- /dev/null",
      "+++ b/dir com espaço/b.md\t",
      "@@ -0,0 +1,2 @@",
      "+++ começa com mais",
      "+fim",
      "\\ No newline at end of file",
      "diff --git a/apagado.txt b/apagado.txt",
      "deleted file mode 100644",
      "--- a/apagado.txt",
      "+++ /dev/null",
      "@@ -1 +0,0 @@",
      "-adeus",
      "",
    ].join("\n");
    expect(addedLinesFromDiff(diff)).toEqual([
      { file: "a.txt", line: 2, text: "linha dois" },
      { file: "a.txt", line: 3, text: "linha três" },
      { file: "a.txt", line: 12, text: "nova" },
      { file: "dir com espaço/b.md", line: 1, text: "++ começa com mais" },
      { file: "dir com espaço/b.md", line: 2, text: "fim" },
    ]);
  });

  it("caminho entre aspas, com bytes em octal, vira UTF-8", () => {
    const diff = [
      'diff --git "a/acentua\\303\\247\\303\\243o.md" "b/acentua\\303\\247\\303\\243o.md"',
      '+++ "b/acentua\\303\\247\\303\\243o.md"',
      "@@ -0,0 +1 @@",
      "+x",
    ].join("\n");
    expect(addedLinesFromDiff(diff)).toEqual([
      { file: "acentuação.md", line: 1, text: "x" },
    ]);
  });

  it("conta as linhas de contexto quando o diff não é -U0", () => {
    const diff = [
      "+++ b/c.txt",
      "@@ -1,3 +1,4 @@",
      " contexto",
      "+novo",
      " contexto",
      " contexto",
    ].join("\n");
    expect(addedLinesFromDiff(diff)).toEqual([
      { file: "c.txt", line: 2, text: "novo" },
    ]);
  });

  it("diff vazio e arquivo binário não têm linha", () => {
    expect(addedLinesFromDiff("")).toEqual([]);
    expect(
      addedLinesFromDiff(
        "diff --git a/x.png b/x.png\nBinary files /dev/null and b/x.png differ\n",
      ),
    ).toEqual([]);
  });
});

describe("check-names.mjs (CLI)", () => {
  let repo: TempRepo;
  const listFile = () => join(repo.dir, ".git", "sdd", NAMES_LIST_FILE);
  const writeList = (text: string) =>
    repo.write(join(".git", "sdd", NAMES_LIST_FILE), text);
  const output = (result: { stdout: string; stderr: string }) =>
    `${result.stdout}${result.stderr}`;

  beforeAll(() => {
    repo = createTempRepo();
    repo.write("LEIA.md", "repositório de teste\n");
    repo.git("add", "LEIA.md");
    repo.git("commit", "-q", "-m", "inicio");
  });

  afterAll(() => repo.remove());

  beforeEach(() => {
    repo.git("reset", "-q");
    writeList(LIST_TEXT);
  });

  it("sem a lista: código 2, com o caminho dela e a saída do hook", () => {
    rmSync(listFile());
    const result = repo.run("check-names.mjs", ["--staged"]);
    expect(result.status).toBe(2);
    expect(result.stderr).toContain(NAMES_LIST_FILE);
    expect(result.stderr).toContain("bun run visual:hooks --remove");
  });

  it("lista só com comentários conta como vazia: código 2", () => {
    writeList("# nada aqui\n\n!Zorvalda Teste\n");
    expect(repo.run("check-names.mjs", ["--staged"]).status).toBe(2);
  });

  it.each([
    [[]],
    [["--staged", "--file=LEIA.md"]],
    [["--range=main"]],
    [["--range=main..HEAD"]],
    [["--staged=sim"]],
    [["--desconhecido"]],
    [["--staged", "extra"]],
  ])("uso errado %j: código 2 com o uso", (args) => {
    const result = repo.run("check-names.mjs", args);
    expect(result.status).toBe(2);
    expect(result.stderr).toContain("Uso:");
  });

  it("--staged limpo: código 0", () => {
    repo.write("ok.txt", "nada da lista aqui\nZorvalda Teste assinou\n");
    repo.git("add", "ok.txt");
    const result = repo.run("check-names.mjs", ["--staged"]);
    expect(result.status).toBe(0);
    expect(result.stdout).toContain("nada da lista");
  });

  it("--staged com um termo: código 1, arquivo e linha, sem imprimir o termo", () => {
    repo.write("notas.txt", "linha um\na Zorvalda veio\n");
    repo.git("add", "notas.txt");
    const result = repo.run("check-names.mjs", ["--staged"]);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain(
      "notas.txt:2 — termo nº 1 da lista (linha 3)",
    );
    expect(normalizeText(output(result))).not.toContain("zorvalda");
  });

  it("--staged com o termo no caminho: o caminho vira número e não é impresso", () => {
    repo.write(join("pasta", "Zorvalda.txt"), "conteúdo limpo\n");
    repo.git("add", "pasta");
    const result = repo.run("check-names.mjs", ["--staged"]);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain(
      "caminho nº 1 do diff — termo nº 1 da lista (linha 3)",
    );
    expect(normalizeText(output(result))).not.toContain("zorvalda");
  });

  it("--file confere o arquivo inteiro; arquivo que não existe é uso errado", () => {
    repo.write("conferir.html", "<p>ok</p>\n<p>Ação Ímpar</p>\n");
    const found = repo.run("check-names.mjs", ["--file=conferir.html"]);
    expect(found.status).toBe(1);
    expect(found.stderr).toContain(
      "conferir.html:2 — termo nº 4 da lista (linha 6)",
    );
    expect(normalizeText(output(found))).not.toContain("impar");
    expect(repo.run("check-names.mjs", ["--file=nao-existe.txt"]).status).toBe(
      2,
    );
  });
});

describe("check-names.mjs --range (CLI)", () => {
  let repo: TempRepo;
  let sha = "";

  beforeAll(() => {
    repo = createTempRepo();
    repo.write(join(".git", "sdd", NAMES_LIST_FILE), LIST_TEXT);
    repo.write("LEIA.md", "repositório de teste\n");
    repo.git("add", "LEIA.md");
    repo.git("commit", "-q", "-m", "inicio");
    repo.git("switch", "-q", "-c", "limpa");
    repo.write("limpo.txt", "nada aqui\n");
    repo.git("add", "limpo.txt");
    repo.git("commit", "-q", "-m", "limpo");
    repo.git("switch", "-q", "-c", "suja");
    repo.write("texto.md", "começo\n\nfim com Lampião Torto\n");
    repo.write(
      join(".git", "sdd", "msg.txt"),
      "assunto\n\ncorpo com Zorvalda\n",
    );
    repo.git("add", "texto.md");
    repo.git("commit", "-q", "-F", join(".git", "sdd", "msg.txt"));
    sha = repo.git("rev-parse", "--short=7", "HEAD").trim();
    repo.git("switch", "-q", "main");
  });

  afterAll(() => repo.remove());

  it("diff e mensagens limpos: código 0", () => {
    expect(repo.run("check-names.mjs", ["--range=main...limpa"]).status).toBe(
      0,
    );
  });

  it("acha no diff e na mensagem do commit, sem imprimir o termo", () => {
    const result = repo.run("check-names.mjs", ["--range=main...suja"]);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain(
      "texto.md:3 — termo nº 2 da lista (linha 4)",
    );
    expect(result.stderr).toContain(
      `mensagem do commit ${sha}, linha 3 — termo nº 1 da lista (linha 3)`,
    );
    expect(normalizeText(`${result.stdout}${result.stderr}`)).not.toMatch(
      /zorvalda|lampiao/,
    );
  });

  it("revisão que não existe: código 2", () => {
    expect(repo.run("check-names.mjs", ["--range=main...nada"]).status).toBe(2);
  });
});
