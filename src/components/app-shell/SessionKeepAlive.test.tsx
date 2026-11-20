import { render } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { SessionKeepAlive } from "@/components/app-shell/SessionKeepAlive";

const mocks = vi.hoisted(() => ({ getSession: vi.fn() }));

vi.mock("@/lib/auth/client", () => ({
  authClient: { getSession: mocks.getSession },
}));

describe("SessionKeepAlive", () => {
  beforeEach(() => {
    mocks.getSession.mockReset();
    mocks.getSession.mockResolvedValue({ data: null, error: null });
  });

  it("chama getSession exatamente uma vez ao montar", () => {
    render(<SessionKeepAlive />);
    expect(mocks.getSession).toHaveBeenCalledTimes(1);
  });

  it("re-render não chama de novo", () => {
    const { rerender } = render(<SessionKeepAlive />);
    rerender(<SessionKeepAlive />);
    rerender(<SessionKeepAlive />);
    expect(mocks.getSession).toHaveBeenCalledTimes(1);
  });

  it("não renderiza conteúdo", () => {
    const { container } = render(<SessionKeepAlive />);
    expect(container).toBeEmptyDOMElement();
  });

  it("rejeição fica em silêncio: não lança e não renderiza nada", async () => {
    mocks.getSession.mockRejectedValue(new Error("offline"));
    const unhandled = vi.fn();
    process.on("unhandledRejection", unhandled);
    const { container } = render(<SessionKeepAlive />);
    await new Promise((resolve) => setTimeout(resolve, 10));
    process.off("unhandledRejection", unhandled);
    expect(unhandled).not.toHaveBeenCalled();
    expect(container).toBeEmptyDOMElement();
  });

  it("erro devolvido (sem lançar) também é ignorado", async () => {
    mocks.getSession.mockResolvedValue({
      data: null,
      error: { status: 500, statusText: "x" },
    });
    const { container } = render(<SessionKeepAlive />);
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(container).toBeEmptyDOMElement();
  });
});
