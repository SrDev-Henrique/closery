import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { InviteUnavailable } from "./InviteUnavailable";

describe("InviteUnavailable", () => {
  it.each([
    ["expired", "Este convite expirou."],
    ["used", "Este convite já foi usado."],
    ["cancelled", "Este convite foi cancelado."],
    ["not_found", "Convite não encontrado."],
  ] as const)("%s mostra título, motivo e a dica", (reason, message) => {
    render(<InviteUnavailable reason={reason} />);
    expect(
      screen.getByRole("heading", { name: "Convite indisponível" }),
    ).toBeInTheDocument();
    expect(screen.getByText(message)).toBeInTheDocument();
    expect(
      screen.getByText("Peça um novo convite a quem te convidou."),
    ).toBeInTheDocument();
  });

  it("não oferece formulário nem botão de cadastro", () => {
    render(<InviteUnavailable reason="expired" />);
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("E-mail")).not.toBeInTheDocument();
  });
});
