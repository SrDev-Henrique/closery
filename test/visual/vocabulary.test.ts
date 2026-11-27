import { describe, expect, it } from "vitest";

import { SECTOR_COLORS } from "@/features/sectors/colors";
import { REQUEST_STATUSES } from "@/lib/requestStatuses";
import {
  VISUAL_DESTINATIONS,
  VISUAL_ITEMS,
  VISUAL_PASSWORD,
  VISUAL_PEOPLE,
  VISUAL_SECTORS,
  VISUAL_SHIFTS,
  VISUAL_TEXTS,
} from "../../scripts/visual/vocabulary.mjs";

// Guarda do vocabulário inventado do mundo visual (spec §5.4): só pessoas fictícias,
// @example.com, cores da paleta e nada repetido.

/** Todos os textos do vocabulário, para conferir que nenhum está vazio. */
function allStrings(value: unknown): string[] {
  if (typeof value === "string") return [value];
  if (value && typeof value === "object") {
    return Object.values(value).flatMap((inner) => allStrings(inner));
  }
  return [];
}

const VOCABULARY = {
  VISUAL_PEOPLE,
  VISUAL_PASSWORD,
  VISUAL_SECTORS,
  VISUAL_SHIFTS,
  VISUAL_ITEMS,
  VISUAL_DESTINATIONS,
  VISUAL_TEXTS,
};

describe("pessoas", () => {
  it("são as quatro fictícias: a Ana admin e três operadores", () => {
    expect(Object.keys(VISUAL_PEOPLE)).toEqual([
      "ana",
      "bruno",
      "carla",
      "diego",
    ]);
    expect(VISUAL_PEOPLE.ana.role).toBe("admin");
    for (const key of ["bruno", "carla", "diego"] as const) {
      expect(VISUAL_PEOPLE[key].role).toBe("operator");
    }
  });

  it("e-mail <nome>.teste@example.com e nome terminado em ' Teste', sem repetir", () => {
    const people = Object.entries(VISUAL_PEOPLE);
    for (const [key, person] of people) {
      expect(person.email).toBe(`${key}.teste@example.com`);
      expect(person.name.endsWith(" Teste")).toBe(true);
    }
    expect(new Set(people.map(([, p]) => p.email)).size).toBe(4);
    expect(new Set(people.map(([, p]) => p.name)).size).toBe(4);
  });

  it("a senha é a do E2E", () => {
    expect(VISUAL_PASSWORD).toBe("senha-de-teste-123");
  });
});

describe("setores, turnos, itens e destinos", () => {
  it("quatro setores com cor da paleta, sem repetir nome nem cor", () => {
    expect(VISUAL_SECTORS.map((s) => s.name)).toEqual([
      "ULD",
      "Carga",
      "Operações",
      "Rampa",
    ]);
    for (const sector of VISUAL_SECTORS) {
      expect(SECTOR_COLORS).toContain(sector.color);
    }
    expect(new Set(VISUAL_SECTORS.map((s) => s.color)).size).toBe(4);
  });

  it("em ordem alfabética, o ULD continua o quarto", () => {
    const sorted = VISUAL_SECTORS.map((s) => s.name).sort((a, b) =>
      a.localeCompare(b, "pt-BR"),
    );
    expect(sorted.indexOf("ULD")).toBe(3);
  });

  it("três turnos com HH:MM válido; o 3 atravessa a meia-noite", () => {
    expect(VISUAL_SHIFTS.map((s) => s.name)).toEqual([
      "Turno 1",
      "Turno 2",
      "Turno 3",
    ]);
    for (const turn of VISUAL_SHIFTS) {
      expect(turn.startsAt).toMatch(/^([01]\d|2[0-3]):[0-5]\d$/);
      expect(turn.endsAt).toMatch(/^([01]\d|2[0-3]):[0-5]\d$/);
    }
    const last = VISUAL_SHIFTS[2];
    expect(last && last.endsAt < last.startsAt).toBe(true);
  });

  it("nove itens, um grupo por setor, sem repetir dentro do setor; o Stretch é do ULD", () => {
    expect(Object.keys(VISUAL_ITEMS)).toEqual(
      VISUAL_SECTORS.map((s) => s.name),
    );
    const items = Object.values(VISUAL_ITEMS);
    expect(items.flat()).toHaveLength(9);
    for (const group of items) expect(new Set(group).size).toBe(group.length);
    expect(VISUAL_ITEMS.ULD).toContain("Stretch");
  });

  it("cinco destinos sem repetir; todo destino dos textos existe", () => {
    expect(VISUAL_DESTINATIONS).toHaveLength(5);
    expect(new Set(VISUAL_DESTINATIONS).size).toBe(5);
    const used = [
      ...VISUAL_TEXTS.staleRequests.map((r) => r.destination),
      VISUAL_TEXTS.recentRequests.destination,
      ...VISUAL_TEXTS.historyRequests.map((r) => r.destination),
    ];
    for (const destination of used)
      expect(VISUAL_DESTINATIONS).toContain(destination);
  });
});

describe("textos", () => {
  it("três paradas e cinco do histórico, com status válidos e uma cancelada", () => {
    expect(VISUAL_TEXTS.staleRequests).toHaveLength(3);
    expect(VISUAL_TEXTS.historyRequests).toHaveLength(5);
    for (const entry of VISUAL_TEXTS.historyRequests) {
      expect(REQUEST_STATUSES).toContain(entry.status);
    }
    expect(
      VISUAL_TEXTS.historyRequests.filter((r) => r.status === "cancelled"),
    ).toHaveLength(1);
    expect(VISUAL_TEXTS.recentRequests.descriptionPrefix).toBe(
      "Pedido recente",
    );
  });

  it("a correção vai do texto antigo para o de ocorrências, que são diferentes", () => {
    expect(VISUAL_TEXTS.history.correctionOld).not.toBe(
      VISUAL_TEXTS.history.occurrences,
    );
  });

  it("nenhum texto vazio nem só de espaços", () => {
    const strings = allStrings(VOCABULARY);
    expect(strings.length).toBeGreaterThan(40);
    for (const text of strings) expect(text.trim()).not.toBe("");
  });

  it("é imutável", () => {
    expect(Object.isFrozen(VISUAL_PEOPLE)).toBe(true);
    expect(Object.isFrozen(VISUAL_PEOPLE.ana)).toBe(true);
    expect(Object.isFrozen(VISUAL_ITEMS.ULD)).toBe(true);
    expect(Object.isFrozen(VISUAL_TEXTS.staleRequests[0])).toBe(true);
  });
});
