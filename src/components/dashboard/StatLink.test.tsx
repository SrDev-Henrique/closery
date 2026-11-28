import { render, screen } from "@testing-library/react";
import { Clock } from "lucide-react";
import { describe, expect, it } from "vitest";

import { StatLink } from "./StatLink";

describe("StatLink", () => {
  it("é um link com número, rótulo e legenda no nome acessível", () => {
    render(
      <StatLink
        label="Esperadas"
        value={1234}
        href="/passagens?situacao=esperadas"
        icon={Clock}
        caption="turnos já encerrados"
      />,
    );

    const link = screen.getByRole("link", {
      name: "1.234 Esperadas turnos já encerrados",
    });
    expect(link).toHaveAttribute("href", "/passagens?situacao=esperadas");
    expect(link).toHaveClass("min-h-11");
    expect(screen.getByText("1.234")).toHaveClass("tabular-nums");
  });

  it("zero continua sendo um número escrito (nunca vazio)", () => {
    render(
      <StatLink
        label="Sem passagem"
        value={0}
        href="/passagens"
        icon={Clock}
      />,
    );

    expect(
      screen.getByRole("link", { name: "0 Sem passagem" }),
    ).toBeInTheDocument();
  });

  it("o ícone é decorativo e a legenda é opcional", () => {
    const { container } = render(
      <StatLink label="Entregues" value={3} href="/passagens" icon={Clock} />,
    );

    expect(container.querySelector("svg")).toHaveAttribute(
      "aria-hidden",
      "true",
    );
    expect(screen.getByRole("link")).toHaveAccessibleName("3 Entregues");
  });

  it("o hover usa bg-accent (o bg-muted era o próprio card e o hover sumia)", () => {
    render(
      <StatLink label="Entregues" value={3} href="/passagens" icon={Clock} />,
    );
    const link = screen.getByRole("link");
    expect(link).toHaveClass("bg-card", "hover:bg-accent");
    expect(link).not.toHaveClass("hover:bg-muted");
  });
});
