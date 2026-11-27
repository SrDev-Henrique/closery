import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { HomeRequests } from "@/features/requests/types";
import { openRequest } from "../../../test/openRequests";
import { RequestsHomeCard } from "./RequestsHomeCard";

const AVATAR = "data:image/svg+xml,logado";
const FIRST_ACCESS_LINE =
  "Os pedidos da equipe aparecem aqui assim que alguém registrar o primeiro.";

function home(overrides: Partial<HomeRequests> = {}): HomeRequests {
  return { openCount: 0, staleCount: 0, stale: [], ...overrides };
}

function renderCard(
  props: Partial<Parameters<typeof RequestsHomeCard>[0]> = {},
) {
  return render(
    <RequestsHomeCard
      home={home()}
      allHref="/solicitacoes"
      avatarSrc={AVATAR}
      {...props}
    />,
  );
}

describe("RequestsHomeCard", () => {
  it("o título é um h2 'Solicitações' num card feature", () => {
    const { container } = renderCard();

    expect(
      screen.getByRole("heading", { level: 2, name: "Solicitações" }),
    ).toBeInTheDocument();
    expect(container.querySelector('[data-slot="card"]')).toHaveClass(
      "bg-card",
    );
  });

  it("sem abertas: avatar de quem está logado, 'Nenhuma solicitação aberta.' e o link", () => {
    const { container } = renderCard();

    expect(screen.getByText("Nenhuma solicitação aberta.")).toBeInTheDocument();
    const avatar = container.querySelector("img");
    expect(avatar).toHaveAttribute("src", AVATAR);
    expect(avatar).toHaveAttribute("alt", "");
    expect(screen.queryByText("abertas")).not.toBeInTheDocument();
    expect(screen.queryByText("Paradas há mais tempo")).not.toBeInTheDocument();
    expect(screen.queryByText(FIRST_ACCESS_LINE)).not.toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Ver solicitações" }),
    ).toHaveAttribute("href", "/solicitacoes");
  });

  it("sem abertas no primeiro acesso do admin: acrescenta a linha de apoio", () => {
    renderCard({ firstAccess: true });

    expect(screen.getByText(FIRST_ACCESS_LINE)).toBeInTheDocument();
  });

  it("com abertas, a linha de apoio do primeiro acesso nunca aparece", () => {
    renderCard({ firstAccess: true, home: home({ openCount: 2 }) });

    expect(screen.queryByText(FIRST_ACCESS_LINE)).not.toBeInTheDocument();
  });

  it("singular: '1' e 'aberta', sem selo de paradas e sem a lista", () => {
    renderCard({ home: home({ openCount: 1, staleCount: 0 }) });

    expect(screen.getByText("1")).toBeInTheDocument();
    expect(screen.getByText("aberta")).toBeInTheDocument();
    expect(screen.queryByText(/\bparadas?\b/i)).not.toBeInTheDocument();
    expect(screen.queryByRole("list")).not.toBeInTheDocument();
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
  });

  it("plural: '7', 'abertas', selo '2 paradas' e as paradas listadas com link", () => {
    renderCard({
      home: home({
        openCount: 7,
        staleCount: 2,
        stale: [
          openRequest({
            description: "Mais antiga",
            stale: true,
            daysInStatus: 6,
          }),
          openRequest({ description: "Parada", stale: true, daysInStatus: 4 }),
        ],
      }),
    });

    expect(screen.getByText("7")).toBeInTheDocument();
    expect(screen.getByText("abertas")).toBeInTheDocument();
    expect(screen.getByText("2 paradas")).toHaveClass(
      "bg-warning",
      "text-warning-foreground",
      "whitespace-nowrap",
      "h-6",
      "text-[12.5px]",
    );
    expect(screen.getByText("Paradas há mais tempo")).toBeInTheDocument();
    const items = within(screen.getByRole("list")).getAllByRole("listitem");
    expect(items).toHaveLength(2);
    expect(items[0]).toHaveTextContent("Mais antiga");
    expect(items[0]).toHaveTextContent("Parada há 6 dias");
    expect(
      within(items[1] as HTMLElement).getByRole("link", { name: "Parada" }),
    ).toHaveAttribute("href", expect.stringMatching(/^\/solicitacoes\/.+/));
  });

  it("uma parada: '3' 'abertas' e selo '1 parada'", () => {
    renderCard({
      home: home({
        openCount: 3,
        staleCount: 1,
        stale: [openRequest({ stale: true, daysInStatus: 3 })],
      }),
    });

    expect(screen.getByText("3")).toBeInTheDocument();
    expect(screen.getByText("abertas")).toBeInTheDocument();
    expect(screen.getByText("1 parada")).toBeInTheDocument();
  });

  it("contagem alta (1234) aparece inteira, com tabular-nums e os tamanhos 76/60/52", () => {
    renderCard({ home: home({ openCount: 1234, staleCount: 0 }) });

    expect(screen.getByText("1234")).toHaveClass(
      "tabular-nums",
      "font-black",
      "text-[76px]",
      "max-md:text-[52px]",
      "@min-[1040px]/main:@max-[1239px]/main:text-[60px]",
    );
  });

  it("zero abertas mas com lista vazia não mostra contador", () => {
    renderCard({ home: home({ openCount: 0 }) });

    expect(screen.queryByText("0")).not.toBeInTheDocument();
  });

  it("o link usa o allHref (admin leva ?setor=) e é um botão pill primário", () => {
    renderCard({ allHref: "/solicitacoes?setor=abc" });

    const link = screen.getByRole("link", { name: "Ver solicitações" });
    expect(link).toHaveAttribute("href", "/solicitacoes?setor=abc");
    expect(link.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
    // `default` + `pill` com os 20px do protótipo (não os 22px dos primários on-pastel).
    expect(link).toHaveClass("bg-primary", "h-12", "px-5", "mt-auto", "w-fit");
    expect(link).not.toHaveClass("px-[22px]");
  });
});
