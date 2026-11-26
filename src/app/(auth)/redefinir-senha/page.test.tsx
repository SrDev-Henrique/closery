import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import Page, { metadata } from "./page";

vi.mock("@/lib/auth/client", () => ({
  authClient: { resetPassword: vi.fn() },
}));

describe("/redefinir-senha", () => {
  it("o título da aba é Redefinir senha", () => {
    expect(metadata.title).toBe("Redefinir senha");
  });

  it("renderiza o formulário de redefinição (sem fragmento: link incompleto)", async () => {
    render(<Page />);

    expect(
      await screen.findByRole("heading", { name: "Link incompleto" }),
    ).toBeInTheDocument();
  });
});
