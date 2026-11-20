import { describe, expect, it } from "vitest";
import {
  INVITE_UNAVAILABLE_HINT,
  INVITE_UNAVAILABLE_TITLE,
  inviteUnavailableMessage,
} from "./inviteMessages";

describe("inviteUnavailableMessage", () => {
  it.each([
    ["expired", "Este convite expirou."],
    ["used", "Este convite já foi usado."],
    ["cancelled", "Este convite foi cancelado."],
    ["not_found", "Convite não encontrado."],
  ] as const)("%s -> %s", (reason, message) => {
    expect(inviteUnavailableMessage(reason)).toBe(message);
  });

  it("expõe título e dica fixos", () => {
    expect(INVITE_UNAVAILABLE_TITLE).toBe("Convite indisponível");
    expect(INVITE_UNAVAILABLE_HINT).toBe(
      "Peça um novo convite a quem te convidou.",
    );
  });
});
