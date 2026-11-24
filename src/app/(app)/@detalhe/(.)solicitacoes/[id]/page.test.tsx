import { render, screen } from "@testing-library/react";
import { isValidElement, type ReactElement, type ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

import { RequestSheet } from "@/components/solicitacoes/RequestSheet";
import InterceptedRequestPage from "./page";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ back: vi.fn() }),
}));
vi.mock("@/components/solicitacoes/RequestDetail", () => ({
  RequestDetail: () => null,
}));

// O conteúdo do Suspense é um componente assíncrono de servidor: o jsdom não o
// renderiza. O que o teste cobre é o fallback de carregamento, que é o que a
// pessoa vê (e o leitor de tela anuncia) enquanto o detalhe chega.
function loadingFallback(): ReactNode {
  const page = InterceptedRequestPage({ params: new Promise(() => {}) });
  const sheet = page as ReactElement<{ children: ReactElement }>;
  expect(sheet.type).toBe(RequestSheet);
  const suspense = sheet.props.children as ReactElement<{
    fallback: ReactNode;
  }>;
  expect(isValidElement(suspense)).toBe(true);
  return suspense.props.fallback;
}

describe("detalhe interceptado: fallback de carregamento", () => {
  it("o diálogo tem nome acessível enquanto o detalhe carrega", () => {
    render(<RequestSheet>{loadingFallback()}</RequestSheet>);

    expect(
      screen.getByRole("dialog", { name: "Carregando solicitação" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Carregando solicitação")).toHaveClass("sr-only");
  });
});
