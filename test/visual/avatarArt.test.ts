import { describe, expect, it } from "vitest";

import { avatarDataUri } from "@/lib/avatar";
import { visualAvatarUri } from "../../scripts/visual/seed/avatarArt";

// A arte das cópias do protótipo é a do app: mesma semente (o id do usuário), mesmo
// data URI. Se o src/lib/avatar.ts mudar de fundo ou de estilo, este teste reprova.

describe("visualAvatarUri", () => {
  it.each([
    "0d4f6f1c2a3b4c5d6e7f8091a2b3c4d5",
    "id-com-hifen",
    "X",
  ])("dá a mesma arte do app para a semente %s", (seed) => {
    expect(visualAvatarUri(seed)).toBe(avatarDataUri(seed));
  });

  it("sementes diferentes dão artes diferentes", () => {
    expect(visualAvatarUri("um")).not.toBe(visualAvatarUri("dois"));
  });

  it("é um data URI de SVG", () => {
    expect(visualAvatarUri("abc")).toMatch(/^data:image\/svg\+xml/);
  });

  it("semente vazia ou só de espaços lança, como no app", () => {
    expect(() => visualAvatarUri("")).toThrow("a semente não pode ser vazia");
    expect(() => visualAvatarUri("   ")).toThrow(
      "a semente não pode ser vazia",
    );
  });
});
