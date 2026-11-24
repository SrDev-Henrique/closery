import { describe, expect, it } from "vitest";

import { MAX_QUANTITY } from "./limits";
import { stepQuantity } from "./quantity";

// O terceiro argumento é o mínimo (padrão 0): a solicitação de itens trava em 1.
describe("stepQuantity com mínimo", () => {
  it("trava no mínimo ao diminuir", () => {
    expect(stepQuantity(1, -1, 1)).toBe(1);
    expect(stepQuantity(2, -1, 1)).toBe(1);
    expect(stepQuantity(0, -1, 1)).toBe(1);
  });

  it("aumentar não é afetado pelo mínimo e trava no teto", () => {
    expect(stepQuantity(1, 1, 1)).toBe(2);
    expect(stepQuantity(MAX_QUANTITY, 1, 1)).toBe(MAX_QUANTITY);
  });

  it("sem o terceiro argumento o mínimo continua 0", () => {
    expect(stepQuantity(0, -1)).toBe(0);
    expect(stepQuantity(1, -1)).toBe(0);
    expect(stepQuantity(5, 1)).toBe(6);
  });
});
