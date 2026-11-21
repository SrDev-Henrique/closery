import { describe, expect, it } from "vitest";

import { moveId, planSortUpdates } from "@/features/admin/reorder";

describe("moveId", () => {
  const ids = ["a", "b", "c"];

  it("sobe um passo", () => {
    expect(moveId(ids, "b", "up")).toEqual(["b", "a", "c"]);
    expect(moveId(ids, "c", "up")).toEqual(["a", "c", "b"]);
  });

  it("desce um passo", () => {
    expect(moveId(ids, "a", "down")).toEqual(["b", "a", "c"]);
    expect(moveId(ids, "b", "down")).toEqual(["a", "c", "b"]);
  });

  it("devolve null nas bordas: primeiro não sobe, último não desce", () => {
    expect(moveId(ids, "a", "up")).toBeNull();
    expect(moveId(ids, "c", "down")).toBeNull();
  });

  it("devolve null para id ausente e para lista vazia", () => {
    expect(moveId(ids, "x", "up")).toBeNull();
    expect(moveId([], "a", "down")).toBeNull();
  });

  it("lista de um só: nenhum movimento", () => {
    expect(moveId(["a"], "a", "up")).toBeNull();
    expect(moveId(["a"], "a", "down")).toBeNull();
  });

  it("não altera a lista recebida", () => {
    moveId(ids, "b", "up");
    expect(ids).toEqual(["a", "b", "c"]);
  });
});

describe("planSortUpdates", () => {
  it("não muda nada quando a ordem já está certa", () => {
    const current = [
      { id: "a", sortOrder: 1 },
      { id: "b", sortOrder: 2 },
    ];
    expect(planSortUpdates(current, ["a", "b"])).toEqual([]);
  });

  it("troca de dois vizinhos atualiza só os dois", () => {
    const current = [
      { id: "a", sortOrder: 1 },
      { id: "b", sortOrder: 2 },
      { id: "c", sortOrder: 3 },
    ];
    expect(planSortUpdates(current, ["b", "a", "c"])).toEqual([
      { id: "b", sortOrder: 1 },
      { id: "a", sortOrder: 2 },
    ]);
  });

  it("renumera 1..n quando há buracos (ordens 5, 9, 12)", () => {
    const current = [
      { id: "a", sortOrder: 5 },
      { id: "b", sortOrder: 9 },
      { id: "c", sortOrder: 12 },
    ];
    expect(planSortUpdates(current, ["a", "b", "c"])).toEqual([
      { id: "a", sortOrder: 1 },
      { id: "b", sortOrder: 2 },
      { id: "c", sortOrder: 3 },
    ]);
  });

  it("desfaz empate de sort_order (dois com o mesmo valor)", () => {
    const current = [
      { id: "a", sortOrder: 1 },
      { id: "b", sortOrder: 1 },
    ];
    expect(planSortUpdates(current, ["b", "a"])).toEqual([
      { id: "a", sortOrder: 2 },
    ]);
  });

  it("lista vazia não gera atualização", () => {
    expect(planSortUpdates([], [])).toEqual([]);
  });
});
