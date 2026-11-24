import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// Guarda de consistência de .context/pendencias.md: o índice, a seção e o campo
// Estado de cada pendência dizem a mesma coisa, o próximo id livre é o certo e
// uma pendência fechada ganha uma Atualização datada (nunca é apagada).

const SECTION_STATE: Record<string, string> = {
  "1": "Aberto, não triado",
  "2": "Triado, plano pronto",
  "3": "Bloqueado no dono",
  "4": "Teto aceito",
  "5": "Resolvido",
};

type Entry = {
  id: string;
  section: string;
  state: string;
  updates: string[];
};

const source = readFileSync(".context/pendencias.md", "utf8");
// Só as linhas fora de blocos de código: o template "P999" do arquivo não conta.
const lines: string[] = [];
let inFence = false;
for (const line of source.split(/\r?\n/)) {
  if (line.startsWith("```")) {
    inFence = !inFence;
    continue;
  }
  if (!inFence) lines.push(line);
}

const index = new Map<string, string>();
for (const line of lines) {
  const match = /^\| (P\d+) \| .+ \| \S+ \| (.+) \|$/.exec(line);
  if (match?.[1] && match[2]) index.set(match[1], match[2]);
}

const entries = new Map<string, Entry>();
let section = "";
let current: Entry | null = null;
for (const line of lines) {
  const sectionMatch = /^## (\d)\. /.exec(line);
  if (sectionMatch?.[1]) {
    section = sectionMatch[1];
    current = null;
    continue;
  }
  const headingMatch = /^#### (P\d+) — /.exec(line);
  if (headingMatch?.[1]) {
    current = { id: headingMatch[1], section, state: "", updates: [] };
    entries.set(current.id, current);
    continue;
  }
  const stateMatch = /^\*\*Estado:\*\* (.+)$/.exec(line);
  if (stateMatch?.[1] && current) current.state = stateMatch[1];
  const updateMatch = /^\*\*Atualização \((\d{4}-\d{2}-\d{2})\):\*\*/.exec(
    line,
  );
  if (updateMatch?.[1] && current) current.updates.push(updateMatch[1]);
}

function idNumber(id: string): number {
  return Number(id.slice(1));
}

describe(".context/pendencias.md", () => {
  it("o índice e as seções listam as mesmas pendências", () => {
    expect([...index.keys()].sort()).toEqual([...entries.keys()].sort());
  });

  it("cada pendência está na seção do seu estado, igual ao índice", () => {
    for (const entry of entries.values()) {
      expect(entry.state, `${entry.id}: campo Estado`).toBe(
        SECTION_STATE[entry.section],
      );
      expect(index.get(entry.id), `${entry.id}: índice`).toBe(entry.state);
    }
  });

  it("o próximo id livre é o maior id mais um", () => {
    const max = Math.max(...[...entries.keys()].map(idNumber));
    expect(source).toContain(`**Próximo id livre: P${max + 1}.**`);
  });

  it("pendência resolvida tem ao menos uma Atualização datada", () => {
    for (const entry of entries.values()) {
      if (entry.state === "Resolvido") {
        expect(
          entry.updates.length,
          `${entry.id} sem Atualização`,
        ).toBeGreaterThan(0);
      }
    }
  });

  it("Fase 2: P11 e P18 resolvidas em 2026-11-21", () => {
    for (const id of ["P11", "P18"]) {
      const entry = entries.get(id);
      expect(entry?.state, id).toBe("Resolvido");
      expect(entry?.section, id).toBe("5");
      expect(entry?.updates, id).toContain("2026-11-21");
    }
  });

  it("Fase 2: 'Editar o nome de uma pessoa' entrou como Aberto, não triado", () => {
    const titles = lines.filter(
      (line) =>
        line.startsWith("#### P") &&
        line.includes("Editar o nome de uma pessoa"),
    );
    expect(titles).toHaveLength(1);
    const id = /^#### (P\d+)/.exec(titles[0] ?? "")?.[1] ?? "";
    expect(entries.get(id)?.state).toBe("Aberto, não triado");
  });

  it("Fase 3: P26 e P27 resolvidas em 2026-11-21", () => {
    for (const id of ["P26", "P27"]) {
      const entry = entries.get(id);
      expect(entry?.state, id).toBe("Resolvido");
      expect(entry?.section, id).toBe("5");
      expect(entry?.updates, id).toContain("2026-11-21");
    }
  });

  it("Fase 3: P34 a P36 entraram como Aberto, não triado", () => {
    for (const id of ["P34", "P35", "P36"]) {
      const entry = entries.get(id);
      expect(entry?.state, id).toBe("Aberto, não triado");
      expect(entry?.section, id).toBe("1");
    }
  });

  it("Fase 4: P29, P33, P37 e P40 resolvidas", () => {
    for (const id of ["P29", "P33", "P37", "P40"]) {
      const entry = entries.get(id);
      expect(entry?.state, id).toBe("Resolvido");
      expect(entry?.section, id).toBe("5");
      expect(
        entry?.updates.some((date) => date >= "2026-11-23"),
        id,
      ).toBe(true);
    }
  });
});
