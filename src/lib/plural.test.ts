import { describe, expect, it } from "vitest";

import { pluralize } from "@/lib/plural";

describe("pluralize", () => {
  it("usa o singular só para 1", () => {
    expect(pluralize(1, "pessoa", "pessoas")).toBe("1 pessoa");
  });

  it("usa o plural para 0, 2 e números grandes", () => {
    expect(pluralize(0, "pessoa", "pessoas")).toBe("0 pessoas");
    expect(pluralize(2, "pessoa", "pessoas")).toBe("2 pessoas");
    expect(pluralize(1000, "pessoa", "pessoas")).toBe("1000 pessoas");
  });

  it("aceita expressões com mais de uma palavra", () => {
    expect(pluralize(1, "convite pendente", "convites pendentes")).toBe(
      "1 convite pendente",
    );
    expect(pluralize(3, "convite pendente", "convites pendentes")).toBe(
      "3 convites pendentes",
    );
  });
});
