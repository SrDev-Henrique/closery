import { describe, expect, it } from "vitest";

import { poolMaxFrom } from "./poolSize";

describe("poolMaxFrom", () => {
  it("sem a variável, o pool é o de sempre (10)", () => {
    expect(poolMaxFrom({})).toBe(10);
    expect(poolMaxFrom({ DATABASE_POOL_MAX: undefined })).toBe(10);
  });

  it("aceita um inteiro de 1 a 10", () => {
    expect(poolMaxFrom({ DATABASE_POOL_MAX: "1" })).toBe(1);
    expect(poolMaxFrom({ DATABASE_POOL_MAX: "5" })).toBe(5);
    expect(poolMaxFrom({ DATABASE_POOL_MAX: "10" })).toBe(10);
  });

  it.each([
    "",
    "0",
    "11",
    "100",
    "-1",
    "1.5",
    "abc",
    " 3 ",
    "1e1",
    "٣",
  ])("valor inválido %j cai em 10, nunca em 0 nem em NaN", (value) => {
    expect(poolMaxFrom({ DATABASE_POOL_MAX: value })).toBe(10);
  });
});
