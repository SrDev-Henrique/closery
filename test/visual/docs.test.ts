import { readFileSync } from "node:fs";
import { join } from "node:path";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  compareHeadings,
  DOC_HEADING_LEVELS,
  editRegistryEntry,
  headingsOf,
} from "../../scripts/visual/docs.mjs";
import { createTempRepo, type TempRepo } from "./tempRepo";

// As regras do registro e das pendências (spec §5.3) com documentos sintéticos
// no formato dos de verdade, e os dois CLIs num repositório git temporário.

const REGISTRY = [
  "# UI Registry",
  "",
  "## Como documentar um componente",
  "",
  "```",
  "### <Nome>",
  "- **Histórico:** mudanças relevantes.",
  "```",
  "",
  "## 1. Primitivos",
  "",
  "### Botao",
  "- **Status:** pronto",
  "- **Usa:** tokens `accent`.",
  "- **Histórico:** 2026-11-20 — gerado. 2026-11-21 — segunda",
  "  linha do histórico.",
  "",
  "### Selo",
  "- **Status:** pronto",
  "- **Usa:** tokens `muted`.",
  "",
  "## 2. Aplicação",
  "",
  "### Cartao",
  "- **Usa:** `bg-muted/50` no rodapé e `bg-muted/50` no corpo.",
  "- **Histórico:** 2026-11-20 — criado.",
  "",
].join("\n");

const PENDENCIAS = [
  "# Pendências",
  "",
  "```markdown",
  "#### P999 — Modelo",
  "```",
  "",
  "## 1. Aberto, não triado",
  "",
  "#### P1 — Primeira 🟡",
  "**Estado:** Aberto, não triado",
  "",
  "#### P2 — Segunda ⚪",
  "**Estado:** Aberto, não triado",
  "",
].join("\n");

describe("DOC_HEADING_LEVELS", () => {
  it("são os dois documentos, com o nível de cada um", () => {
    expect(DOC_HEADING_LEVELS).toEqual({
      ".context/ui-registry.md": 3,
      ".context/pendencias.md": 4,
    });
  });
});

describe("headingsOf", () => {
  it("lista os cabeçalhos do nível, fora dos blocos de código", () => {
    expect(headingsOf(REGISTRY, 3)).toEqual([
      "### Botao",
      "### Selo",
      "### Cartao",
    ]);
    expect(headingsOf(REGISTRY, 2)).toEqual([
      "## Como documentar um componente",
      "## 1. Primitivos",
      "## 2. Aplicação",
    ]);
    expect(headingsOf(PENDENCIAS, 4)).toEqual([
      "#### P1 — Primeira 🟡",
      "#### P2 — Segunda ⚪",
    ]);
  });

  it("texto vazio ou sem o nível: lista vazia", () => {
    expect(headingsOf("", 3)).toEqual([]);
    expect(headingsOf(REGISTRY, 4)).toEqual([]);
  });

  it.each([0, 7, 1.5])("nível %s é recusado", (level) => {
    expect(() => headingsOf(REGISTRY, level)).toThrow(
      `nível de cabeçalho inválido: ${level}`,
    );
  });
});

describe("editRegistryEntry", () => {
  it("historico: acrescenta a frase ao fim do parágrafo, sem tocar no resto", () => {
    const out = editRegistryEntry(
      REGISTRY,
      "Botao",
      "historico",
      "2026-11-27 — nova frase.",
    );
    const before = REGISTRY.split("\n");
    const after = out.split("\n");
    expect(after).toHaveLength(before.length);
    const changed = after.flatMap((line, index) =>
      line === before[index] ? [] : [index],
    );
    expect(changed).toEqual([before.indexOf("  linha do histórico.")]);
    expect(out).toContain("  linha do histórico. 2026-11-27 — nova frase.");
  });

  it("historico na última entrada do arquivo", () => {
    const out = editRegistryEntry(
      REGISTRY,
      "Cartao",
      "historico",
      "2026-11-27 — x.",
    );
    expect(out).toContain(
      "- **Histórico:** 2026-11-20 — criado. 2026-11-27 — x.",
    );
  });

  it("entrada sem Histórico e entrada que não existe são recusadas", () => {
    expect(() => editRegistryEntry(REGISTRY, "Selo", "historico", "x")).toThrow(
      "entrada sem Histórico",
    );
    expect(() =>
      editRegistryEntry(REGISTRY, "Inexistente", "historico", "x"),
    ).toThrow("sem a entrada ### Inexistente");
  });

  it("o modelo dentro do bloco de código não é uma entrada", () => {
    expect(() =>
      editRegistryEntry(REGISTRY, "<Nome>", "historico", "x"),
    ).toThrow("sem a entrada ### <Nome>");
  });

  it("troca: um trecho único da entrada; $& e $1 no texto novo ficam literais", () => {
    const out = editRegistryEntry(
      REGISTRY,
      "Botao",
      "troca",
      "tokens `accent`.",
      "tokens `accent` e $& $1.",
    );
    expect(out).toContain("- **Usa:** tokens `accent` e $& $1.");
    expect(out).toContain("- **Usa:** tokens `muted`.");
  });

  it("troca repetida ou ausente na entrada é recusada", () => {
    expect(() =>
      editRegistryEntry(
        REGISTRY,
        "Cartao",
        "troca",
        "bg-muted/50",
        "bg-accent/50",
      ),
    ).toThrow('"bg-muted/50" aparece 2 vezes na entrada');
    expect(() =>
      editRegistryEntry(REGISTRY, "Selo", "troca", "accent", "card"),
    ).toThrow('"accent" aparece 0 vezes na entrada');
  });

  it("troca que apaga ou cria um cabeçalho ### é recusada", () => {
    expect(() =>
      editRegistryEntry(REGISTRY, "Botao", "troca", "### Botao", "Botao"),
    ).toThrow("um cabeçalho ### sumiu");
    expect(() =>
      editRegistryEntry(
        REGISTRY,
        "Selo",
        "troca",
        "- **Status:** pronto",
        "### Novo",
      ),
    ).toThrow("a troca criou um cabeçalho ###");
  });

  it("op desconhecida e argumentos que faltam são recusados", () => {
    expect(() =>
      // @ts-expect-error: op fora do contrato, de propósito
      editRegistryEntry(REGISTRY, "Botao", "apaga", "x"),
    ).toThrow("op: historico | troca");
    expect(() => editRegistryEntry(REGISTRY, "Botao", "historico", "")).toThrow(
      "historico: falta a frase",
    );
    expect(() =>
      editRegistryEntry(REGISTRY, "Botao", "troca", "accent"),
    ).toThrow("troca: falta o trecho de origem ou o novo");
  });

  it("mantém o CRLF de um arquivo com CRLF", () => {
    const crlf = REGISTRY.replaceAll("\n", "\r\n");
    const out = editRegistryEntry(crlf, "Botao", "historico", "x.");
    expect(out.split("\r\n")).toHaveLength(crlf.split("\r\n").length);
    expect(out.replaceAll("\r\n", "")).not.toContain("\n");
  });
});

describe("compareHeadings", () => {
  it("lista o que sumiu e o que apareceu", () => {
    const head = PENDENCIAS.replace(
      "#### P2 — Segunda ⚪",
      "#### P3 — Terceira ⚪",
    );
    expect(compareHeadings(PENDENCIAS, head, 4)).toEqual({
      removed: ["#### P2 — Segunda ⚪"],
      added: ["#### P3 — Terceira ⚪"],
    });
  });

  it("conta repetidos: dois iguais viram um, e um sumiu", () => {
    expect(compareHeadings("### X\n### X\n", "### X\n", 3)).toEqual({
      removed: ["### X"],
      added: [],
    });
  });

  it("igual, vazio ou só no bloco de código: nada", () => {
    expect(compareHeadings(REGISTRY, REGISTRY, 3)).toEqual({
      removed: [],
      added: [],
    });
    expect(compareHeadings("", "", 4)).toEqual({ removed: [], added: [] });
    expect(compareHeadings("```\n### X\n```\n", "", 3)).toEqual({
      removed: [],
      added: [],
    });
  });
});

describe("registry.mjs (CLI)", () => {
  let repo: TempRepo;
  const registryFile = () => join(repo.dir, ".context", "ui-registry.md");

  beforeAll(() => {
    repo = createTempRepo();
    repo.write(join(".context", "ui-registry.md"), REGISTRY);
    repo.write(join(".context", "outro.md"), "não muda\n");
    repo.git("add", ".");
    repo.git("commit", "-q", "-m", "inicio");
  });

  afterAll(() => repo.remove());

  it("edita só a entrada pedida e grava só o ui-registry.md", () => {
    const result = repo.run("registry.mjs", [
      "Botao",
      "historico",
      "2026-11-27 — pelo CLI.",
    ]);
    expect(result.status).toBe(0);
    expect(result.stdout).toContain("ok: Botao (historico)");
    expect(readFileSync(registryFile(), "utf8")).toBe(
      editRegistryEntry(
        REGISTRY,
        "Botao",
        "historico",
        "2026-11-27 — pelo CLI.",
      ),
    );
    expect(repo.git("status", "--porcelain").trim()).toBe(
      "M .context/ui-registry.md",
    );
    repo.git("checkout", "--", ".context/ui-registry.md");
  });

  it("edição recusada: código 1, com o motivo, e nada gravado", () => {
    const result = repo.run("registry.mjs", ["Inexistente", "historico", "x"]);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("sem a entrada ### Inexistente");
    expect(readFileSync(registryFile(), "utf8")).toBe(REGISTRY);
  });

  it.each([
    [["Botao"]],
    [["Botao", "troca", "a"]],
    [["Botao", "apaga", "a"]],
    [[]],
  ])("uso errado %j: código 2", (args) => {
    const result = repo.run("registry.mjs", args);
    expect(result.status).toBe(2);
    expect(result.stderr).toContain("Uso:");
  });
});

describe("registry-diff.mjs (CLI)", () => {
  let repo: TempRepo;

  beforeAll(() => {
    repo = createTempRepo();
    repo.write("LEIA.md", "sem os documentos ainda\n");
    repo.git("add", ".");
    repo.git("commit", "-q", "-m", "c0");
    repo.git("tag", "c0");
    repo.write(join(".context", "ui-registry.md"), REGISTRY);
    repo.write(join(".context", "pendencias.md"), PENDENCIAS);
    repo.git("add", ".");
    repo.git("commit", "-q", "-m", "c1");
    repo.git("tag", "c1");
    const withoutSelo = REGISTRY.replace("### Selo\n", "");
    repo.write(join(".context", "ui-registry.md"), withoutSelo);
    repo.write(
      join(".context", "pendencias.md"),
      `${PENDENCIAS}#### P3 — Terceira ⚪\n**Estado:** Aberto, não triado\n`,
    );
    repo.git("add", ".");
    repo.git("commit", "-q", "-m", "c2");
    repo.git("tag", "c2");
    repo.write(join(".context", "ui-registry.md"), `${withoutSelo}### Novo\n`);
    repo.git("add", ".");
    repo.git("commit", "-q", "-m", "c3");
  });

  afterAll(() => repo.remove());

  it("um cabeçalho sumiu: código 1, com o que sumiu e o que apareceu", () => {
    const result = repo.run("registry-diff.mjs", ["c1", "c2"]);
    expect(result.status).toBe(1);
    expect(result.stdout).toContain("SUMIU  ### Selo");
    expect(result.stdout).toContain("NOVO   #### P3 — Terceira ⚪");
    expect(result.stderr).toContain("algum cabeçalho sumiu");
  });

  it("só cabeçalhos novos, ou nada mudou: código 0 (head padrão = HEAD)", () => {
    expect(repo.run("registry-diff.mjs", ["c2"]).status).toBe(0);
    expect(repo.run("registry-diff.mjs", ["c1", "c1"]).status).toBe(0);
  });

  it("documento que não existia na base: tudo é novo, código 0", () => {
    const result = repo.run("registry-diff.mjs", ["c0", "c1"]);
    expect(result.status).toBe(0);
    expect(result.stdout).toContain(".context/ui-registry.md: 0 cabeçalho(s)");
  });

  it.each([
    [[]],
    [["c1", "c2", "c3"]],
    [["--base=c1"]],
  ])("uso errado %j: código 2", (args) => {
    expect(repo.run("registry-diff.mjs", args).status).toBe(2);
  });

  it("revisão desconhecida: código 2", () => {
    const result = repo.run("registry-diff.mjs", ["nao-existe"]);
    expect(result.status).toBe(2);
    expect(result.stderr).toContain("revisão desconhecida: nao-existe");
  });
});
