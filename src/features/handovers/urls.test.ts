import { describe, expect, it } from "vitest";

import {
  chooseSectorPath,
  handoverHref,
  newHandoverHref,
  SECTOR_PICKER_PATHS,
} from "./urls";

const REF = {
  sectorId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  shiftId: "11111111-1111-4111-8111-111111111111",
  operationalDate: "2026-11-21",
};

describe("newHandoverHref", () => {
  it("leva turno e data juntos", () => {
    expect(newHandoverHref(REF)).toBe(
      "/passagens/nova?turno=11111111-1111-4111-8111-111111111111&data=2026-11-21",
    );
  });

  it("preserva o setor do admin quando informado", () => {
    expect(newHandoverHref(REF, REF.sectorId)).toBe(
      `/passagens/nova?turno=${REF.shiftId}&data=2026-11-21&setor=${REF.sectorId}`,
    );
  });

  it("setor vazio ou ausente não entra na URL", () => {
    expect(newHandoverHref(REF, undefined)).toBe(newHandoverHref(REF));
    expect(newHandoverHref(REF, "")).toBe(newHandoverHref(REF));
  });
});

describe("handoverHref", () => {
  it("resumo e edição", () => {
    expect(handoverHref("abc")).toBe("/passagens/abc");
    expect(handoverHref("abc", {})).toBe("/passagens/abc");
    expect(handoverHref("abc", { edit: false })).toBe("/passagens/abc");
    expect(handoverHref("abc", { edit: true })).toBe("/passagens/abc?editar=1");
  });
});

describe("chooseSectorPath", () => {
  it("anexa ?setor= ao caminho", () => {
    expect(chooseSectorPath("/", "s1")).toBe("/?setor=s1");
    expect(chooseSectorPath("/passagens", "todos")).toBe(
      "/passagens?setor=todos",
    );
    expect(chooseSectorPath("/passagens/nova", "s1")).toBe(
      "/passagens/nova?setor=s1",
    );
  });
});

describe("SECTOR_PICKER_PATHS", () => {
  it("lista fechada de quatro caminhos", () => {
    expect([...SECTOR_PICKER_PATHS]).toEqual([
      "/",
      "/passagens",
      "/passagens/nova",
      "/solicitacoes",
    ]);
  });
});
