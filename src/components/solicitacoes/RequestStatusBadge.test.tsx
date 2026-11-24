import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { REQUEST_STATUSES } from "@/lib/requestStatuses";
import { RequestStatusBadge } from "./RequestStatusBadge";
import { REQUEST_STATUS_STYLE } from "./statusStyle";

describe("RequestStatusBadge", () => {
  it.each([
    ["requested", "Solicitada", "bg-info", "text-info-foreground"],
    [
      "in_transit",
      "Em separação / Trânsito",
      "bg-warning",
      "text-warning-foreground",
    ],
    ["delivered", "Entregue", "bg-success", "text-success-foreground"],
    ["cancelled", "Cancelada", "bg-muted", "text-muted-foreground"],
  ] as const)("%s mostra ícone e texto e a classe do token certo", (status, text, background, foreground) => {
    const { container } = render(<RequestStatusBadge status={status} />);

    const badge = screen.getByText(text);
    expect(badge).toBeInTheDocument();
    expect(badge).toHaveClass(background, foreground);
    // Nunca só cor: o ícone vem junto e é decorativo.
    const icon = container.querySelector("svg");
    expect(icon).not.toBeNull();
    expect(icon).toHaveAttribute("aria-hidden", "true");
  });

  it("cada status tem um ícone diferente", () => {
    const icons = REQUEST_STATUSES.map(
      (status) => REQUEST_STATUS_STYLE[status].icon,
    );

    expect(new Set(icons).size).toBe(REQUEST_STATUSES.length);
  });

  it("o botão do status de destino usa a mesma cor do selo, com o hover do token", () => {
    expect(REQUEST_STATUS_STYLE.requested.buttonClass).toBe(
      "bg-info text-info-foreground border-transparent hover:bg-info/80",
    );
    expect(REQUEST_STATUS_STYLE.in_transit.buttonClass).toBe(
      "bg-warning text-warning-foreground border-transparent hover:bg-warning/80",
    );
    expect(REQUEST_STATUS_STYLE.delivered.buttonClass).toBe(
      "bg-success text-success-foreground border-transparent hover:bg-success/80",
    );
    for (const status of REQUEST_STATUSES) {
      expect(
        REQUEST_STATUS_STYLE[status].buttonClass.startsWith(
          REQUEST_STATUS_STYLE[status].badgeClass,
        ),
      ).toBe(true);
    }
  });

  it("usa só tokens de cor (sem classe crua do Tailwind nem hex)", () => {
    for (const status of REQUEST_STATUSES) {
      const { container, unmount } = render(
        <RequestStatusBadge status={status} />,
      );
      const style = REQUEST_STATUS_STYLE[status];

      for (const text of [
        container.innerHTML,
        style.badgeClass,
        style.buttonClass,
      ]) {
        expect(text).not.toMatch(
          /\b(?:bg|text|border)-(?:red|green|blue|yellow|amber|orange|gray|slate|zinc)-\d+/,
        );
        expect(text).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
      }
      unmount();
    }
  });
});
