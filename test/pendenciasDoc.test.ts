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

  it("Fase 5: P13, P19, P45 e P48 resolvidas", () => {
    for (const id of ["P13", "P19", "P45", "P48"]) {
      const entry = entries.get(id);
      expect(entry?.state, id).toBe("Resolvido");
      expect(entry?.section, id).toBe("5");
      expect(
        entry?.updates.some((date) => date >= "2026-11-24"),
        id,
      ).toBe(true);
    }
  });

  it("Fase 6: P12 resolvida pelo guarda de alvos de toque", () => {
    const entry = entries.get("P12");
    expect(entry?.state, "P12").toBe("Resolvido");
    expect(entry?.section, "P12").toBe("5");
    expect(
      entry?.updates.some((date) => date >= "2026-11-25"),
      "P12",
    ).toBe(true);
  });

  it("Fase 4: P44, P46 e P47 entraram como Aberto, não triado", () => {
    for (const id of ["P44", "P46", "P47"]) {
      const entry = entries.get(id);
      expect(entry?.state, id).toBe("Aberto, não triado");
      expect(entry?.section, id).toBe("1");
    }
  });

  it("Fase 5: P53 a P61 entraram como Aberto, não triado", () => {
    for (const id of [
      "P53",
      "P54",
      "P55",
      "P56",
      "P57",
      "P58",
      "P59",
      "P60",
      "P61",
    ]) {
      const entry = entries.get(id);
      expect(entry?.state, id).toBe("Aberto, não triado");
      expect(entry?.section, id).toBe("1");
    }
  });

  it("Fase 6: P16 e P22 resolvidas", () => {
    for (const id of ["P16", "P22"]) {
      const entry = entries.get(id);
      expect(entry?.state, id).toBe("Resolvido");
      expect(entry?.section, id).toBe("5");
      expect(
        entry?.updates.some((date) => date >= "2026-11-25"),
        id,
      ).toBe(true);
    }
  });

  it("Fase 6: P8 continua bloqueada no dono e ganhou a Atualização do link do admin", () => {
    const entry = entries.get("P8");
    expect(entry?.state).toBe("Bloqueado no dono");
    expect(entry?.section).toBe("3");
    expect(entry?.updates.some((date) => date >= "2026-11-25")).toBe(true);
  });
  it("Fase 6: P62 a P80 entraram como Aberto, não triado", () => {
    for (let number = 62; number <= 80; number++) {
      const id = `P${number}`;
      const entry = entries.get(id);
      expect(entry?.state, id).toBe("Aberto, não triado");
      expect(entry?.section, id).toBe("1");
      expect(index.get(id), `${id}: índice`).toBe("Aberto, não triado");
    }
  });

  it("Fase 6: P1, P6 e P10 ganharam a Atualização da produção", () => {
    for (const id of ["P1", "P6", "P10"]) {
      expect(
        entries.get(id)?.updates.some((date) => date >= "2026-11-25"),
        id,
      ).toBe(true);
    }
    expect(entries.get("P6")?.state).toBe("Bloqueado no dono");
    expect(entries.get("P10")?.state).toBe("Bloqueado no dono");
    expect(entries.get("P1")?.state).toBe("Resolvido");
  });

  it("Visual: P81 a P108 entraram como Aberto, não triado (menos as que o PR B fechou)", () => {
    const closedByPrB = new Set(["P81", "P83"]);
    for (let number = 81; number <= 108; number++) {
      const id = `P${number}`;
      if (closedByPrB.has(id)) continue;
      const entry = entries.get(id);
      expect(entry?.state, id).toBe("Aberto, não triado");
      expect(entry?.section, id).toBe("1");
      expect(index.get(id), `${id}: índice`).toBe("Aberto, não triado");
    }
  });

  it("Visual: P17 resolvida pelo tema próprio; P67 (aviso ao sair) e P70 (tema medido) com Atualização", () => {
    const p17 = entries.get("P17");
    expect(p17?.state, "P17").toBe("Resolvido");
    expect(p17?.section, "P17").toBe("5");
    expect(p17?.updates, "P17").toContain("2026-11-27");
    for (const id of ["P67", "P70"]) {
      const entry = entries.get(id);
      expect(entry?.state, id).toBe("Aberto, não triado");
      expect(entry?.updates, id).toContain("2026-11-27");
    }
  });

  it("PR B: P81 resolvida pelo espelho do @detalhe; P44 continua aberta, com Atualização", () => {
    const p81 = entries.get("P81");
    expect(p81?.state, "P81").toBe("Resolvido");
    expect(p81?.section, "P81").toBe("5");
    expect(p81?.updates, "P81").toContain("2026-11-27");
    const p44 = entries.get("P44");
    expect(p44?.state, "P44").toBe("Aberto, não triado");
    expect(p44?.section, "P44").toBe("1");
    expect(p44?.updates, "P44").toContain("2026-11-27");
  });

  it("PR B: P83 resolvida pelo guarda do bg-muted", () => {
    const p83 = entries.get("P83");
    expect(p83?.state, "P83").toBe("Resolvido");
    expect(p83?.section, "P83").toBe("5");
    expect(p83?.updates, "P83").toContain("2026-11-27");
  });

  it("Processo visual: P62 ganhou a Atualização de 2026-11-28 e continua aberta", () => {
    const entry = entries.get("P62");
    expect(entry?.state).toBe("Aberto, não triado");
    expect(entry?.section).toBe("1");
    expect(entry?.updates).toContain("2026-11-28");
  });

  it("Processo visual: P109 a P118 entraram como Aberto, não triado", () => {
    for (let number = 109; number <= 118; number++) {
      const id = `P${number}`;
      expect(entries.get(id)?.state, id).toBe("Aberto, não triado");
      expect(entries.get(id)?.section, id).toBe("1");
      expect(index.get(id), `${id}: índice`).toBe("Aberto, não triado");
    }
  });
});
