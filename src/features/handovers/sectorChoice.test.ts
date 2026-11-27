import { describe, expect, it } from "vitest";

import type { SectorChoice } from "@/features/admin/sectors";
import { resolveHandoverSector } from "./sectorChoice";

const ULD: SectorChoice = {
  id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  name: "ULD",
  color: "lilac",
};
const CARGA: SectorChoice = {
  id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
  name: "Carga",
  color: "peach",
};
const SECTORS = [CARGA, ULD];
const OTHER = "99999999-9999-4999-8999-999999999999";
const pick = (sector: typeof ULD) => ({ kind: "sector", sector });

describe("resolveHandoverSector", () => {
  it("o setor da URL vence o cookie", () => {
    expect(
      resolveHandoverSector(SECTORS, { url: ULD.id, cookie: CARGA.id }),
    ).toEqual(pick(ULD));
  });

  it("sem URL, vale o cookie; sem os dois, o primeiro da lista", () => {
    expect(
      resolveHandoverSector(SECTORS, { url: undefined, cookie: ULD.id }),
    ).toEqual(pick(ULD));
    expect(
      resolveHandoverSector(SECTORS, { url: undefined, cookie: undefined }),
    ).toEqual(pick(CARGA));
  });

  it("URL ou cookie fora da lista (inexistente, inativo, lixo) são ignorados", () => {
    expect(
      resolveHandoverSector(SECTORS, { url: OTHER, cookie: ULD.id }),
    ).toEqual(pick(ULD));
    expect(
      resolveHandoverSector(SECTORS, { url: undefined, cookie: OTHER }),
    ).toEqual(pick(CARGA));
    expect(resolveHandoverSector(SECTORS, { url: "lixo", cookie: "" })).toEqual(
      pick(CARGA),
    );
  });

  it("lista vazia: none, mesmo com URL e cookie", () => {
    expect(resolveHandoverSector([], { url: ULD.id, cookie: ULD.id })).toEqual({
      kind: "none",
    });
    expect(
      resolveHandoverSector(
        [],
        { url: "todos", cookie: undefined },
        { allowAll: true },
      ),
    ).toEqual({ kind: "none" });
  });

  it("url=todos só vale com allowAll", () => {
    const sources = { url: "todos", cookie: ULD.id };
    expect(resolveHandoverSector(SECTORS, sources, { allowAll: true })).toEqual(
      { kind: "all" },
    );
    expect(resolveHandoverSector(SECTORS, sources)).toEqual(pick(ULD));
    expect(
      resolveHandoverSector(SECTORS, sources, { allowAll: false }),
    ).toEqual(pick(ULD));
  });

  it("cookie=todos nunca vale (não é gravado) e cai no primeiro", () => {
    expect(
      resolveHandoverSector(
        SECTORS,
        { url: undefined, cookie: "todos" },
        { allowAll: true },
      ),
    ).toEqual(pick(CARGA));
  });

  it("URL repetida (array): vale o primeiro valor", () => {
    expect(
      resolveHandoverSector(SECTORS, {
        url: [ULD.id, CARGA.id],
        cookie: undefined,
      }),
    ).toEqual(pick(ULD));
    expect(
      resolveHandoverSector(
        SECTORS,
        { url: ["todos", ULD.id], cookie: undefined },
        { allowAll: true },
      ),
    ).toEqual({ kind: "all" });
    expect(resolveHandoverSector(SECTORS, { url: [], cookie: ULD.id })).toEqual(
      pick(ULD),
    );
  });
});
