import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { findForbidden, loadNamesList } from "../scripts/visual/names.mjs";

// Guarda da skill handoff-visual (spec §10): o frontmatter, os oito modelos
// citados e presentes, e nenhuma referência velha (comando visual:* que não
// existe no package.json, ferramenta que não existe em scripts/visual). Com a
// lista de nomes presente (só na máquina do controlador), nenhum termo dela.

const SKILL_DIR = join(".claude", "skills", "handoff-visual");
const TEMPLATES = [
  "global-constraints",
  "plan-contract",
  "task-brief",
  "review-brief",
  "final-review-brief",
  "pixel-brief",
  "legibilidade-brief",
  "pr-body",
];

const skill = readFileSync(join(SKILL_DIR, "SKILL.md"), "utf8");
const templateFiles = existsSync(join(SKILL_DIR, "templates"))
  ? readdirSync(join(SKILL_DIR, "templates")).sort()
  : [];
const documents: [string, string][] = [
  ["SKILL.md", skill],
  ...templateFiles.map((file): [string, string] => [
    `templates/${file}`,
    readFileSync(join(SKILL_DIR, "templates", file), "utf8"),
  ]),
];
const scripts = Object.keys(
  (
    JSON.parse(readFileSync("package.json", "utf8")) as {
      scripts: Record<string, string>;
    }
  ).scripts,
);
const namesList = loadNamesList();

function frontmatter(text: string): Record<string, string> {
  const block = /^---\r?\n([\s\S]*?)\r?\n---\r?\n/.exec(text)?.[1] ?? "";
  return Object.fromEntries(
    block.split(/\r?\n/).flatMap((line) => {
      const match = /^([a-z-]+):\s*(.+)$/.exec(line);
      return match?.[1] && match[2] ? [[match[1], match[2].trim()]] : [];
    }),
  );
}

describe("skill handoff-visual", () => {
  it("abre com o frontmatter: name e description com o gatilho", () => {
    const meta = frontmatter(skill);
    expect(meta.name).toBe("handoff-visual");
    expect(meta.description).toMatch(/handoff do Claude Design/);
  });

  it("o primeiro passo manda ler o roteiro e o mapa da tela", () => {
    expect(skill).toContain(".git/sdd/roadmap/roteiro.md");
    expect(skill).toContain(".git/sdd/roadmap/map-<slug>.md");
  });

  it.each(TEMPLATES)("cita templates/%s.md, e o arquivo existe", (name) => {
    expect(skill).toContain(`templates/${name}.md`);
    expect(existsSync(join(SKILL_DIR, "templates", `${name}.md`))).toBe(true);
  });

  it("a pasta templates tem só os oito modelos", () => {
    expect(templateFiles).toEqual(TEMPLATES.map((name) => `${name}.md`).sort());
  });

  it.each(TEMPLATES)("o modelo %s usa o marcador <slug>", (name) => {
    const text = readFileSync(
      join(SKILL_DIR, "templates", `${name}.md`),
      "utf8",
    );
    expect(text).toContain("<slug>");
  });

  it.each(
    documents,
  )("%s: todo `bun run visual:*` existe no package.json", (_file, text) => {
    const cited = [...text.matchAll(/bun run (visual:[\w-]+)/g)].map(
      (match) => match[1] ?? "",
    );
    expect(cited.filter((name) => !scripts.includes(name))).toEqual([]);
  });

  it.each(
    documents,
  )("%s: toda ferramenta de scripts/visual citada existe", (_file, text) => {
    const cited = [
      ...text.matchAll(/scripts\/visual\/[\w./-]+\.(?:mjs|ts|sh)\b/g),
    ].map((match) => match[0]);
    expect(cited.filter((path) => !existsSync(path))).toEqual([]);
  });

  it.skipIf(namesList === null)(
    "nenhum termo da lista de nomes proibidos aparece na skill",
    () => {
      const list = namesList ?? { terms: [], allowed: [] };
      const hits = documents.flatMap(([file, text]) =>
        findForbidden(text, list).map(
          (hit) => `${file}:${hit.line} — linha ${hit.listLine} da lista`,
        ),
      );
      expect(hits).toEqual([]);
    },
  );
});
