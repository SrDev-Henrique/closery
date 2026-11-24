import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type {
  RequestComment,
  RequestCommentsPage,
} from "@/features/requests/types";
import { RequestComments } from "./RequestComments";

vi.mock("@/app/(app)/solicitacoes/actions", () => ({
  addCommentAction: vi.fn(),
  deleteCommentAction: vi.fn(),
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const ID = "11111111-1111-4111-8111-111111111111";

function comment(overrides: Partial<RequestComment> = {}): RequestComment {
  return {
    id: crypto.randomUUID(),
    authorName: "Ana Teste",
    body: "Separado e na doca",
    createdAt: new Date("2026-11-20T12:00:00Z"),
    isCancelReason: false,
    canDelete: false,
    ...overrides,
  };
}

function page(
  rows: RequestComment[],
  overrides: Partial<RequestCommentsPage> = {},
): RequestCommentsPage {
  return {
    rows,
    total: rows.length,
    hasEarlier: false,
    limit: 50,
    ...overrides,
  };
}

function setup(
  comments: RequestCommentsPage,
  props: Partial<Parameters<typeof RequestComments>[0]> = {},
) {
  render(
    <RequestComments
      requestId={ID}
      comments={comments}
      canComment
      earlierHref={null}
      {...props}
    />,
  );
}

describe("RequestComments", () => {
  it("título com a contagem quando há comentários", () => {
    setup(page([comment(), comment()]));

    expect(
      screen.getByRole("heading", { level: 2, name: "Comentários (2)" }),
    ).toBeInTheDocument();
  });

  it("sem comentários: título sem contagem e uma linha", () => {
    setup(page([]));

    expect(
      screen.getByRole("heading", { level: 2, name: "Comentários" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Nenhum comentário ainda.")).toBeInTheDocument();
    expect(screen.queryByRole("list")).toBeNull();
  });

  it("o nível do título muda no Sheet (h3)", () => {
    setup(page([comment()]), { headingLevel: 3 });

    expect(
      screen.getByRole("heading", { level: 3, name: "Comentários (1)" }),
    ).toBeInTheDocument();
  });

  it("mostra autor, data e hora e o texto com as quebras de linha", () => {
    setup(page([comment({ body: "linha 1\nlinha 2" })]));

    const item = screen.getByRole("listitem");
    expect(within(item).getByText("Ana Teste")).toBeInTheDocument();
    expect(within(item).getByText("20/11/2026, 09:00")).toBeInTheDocument();
    const body = within(item).getByText(/linha 1/);
    expect(body).toHaveTextContent("linha 1 linha 2");
    expect(body.className).toContain("whitespace-pre-wrap");
  });

  it("Ver comentários anteriores é um <a> acima da lista, só com href", () => {
    setup(page([comment()], { total: 120, hasEarlier: true }), {
      earlierHref: `/solicitacoes/${ID}?comentarios=100`,
    });

    const link = screen.getByRole("link", {
      name: "Ver comentários anteriores",
    });
    expect(link).toHaveAttribute("href", `/solicitacoes/${ID}?comentarios=100`);
    const list = screen.getByRole("list");
    expect(
      link.compareDocumentPosition(list) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it("sem earlierHref não há o link", () => {
    setup(page([comment()]));

    expect(
      screen.queryByRole("link", { name: "Ver comentários anteriores" }),
    ).toBeNull();
  });

  it("o motivo do cancelamento ganha o rótulo e nunca o Apagar", () => {
    setup(
      page([
        comment({
          body: "Pedido duplicado",
          isCancelReason: true,
          canDelete: false,
        }),
      ]),
    );

    const item = screen.getByRole("listitem");
    expect(
      within(item).getByText("Motivo do cancelamento"),
    ).toBeInTheDocument();
    expect(within(item).getByText("Pedido duplicado")).toBeInTheDocument();
    expect(within(item).queryByRole("button", { name: /Apagar/ })).toBeNull();
  });

  it("Apagar só nos comentários que a pessoa pode apagar", () => {
    setup(
      page([
        comment({ body: "meu", canDelete: true }),
        comment({ body: "de outra pessoa", canDelete: false }),
      ]),
    );

    expect(
      screen.getAllByRole("button", { name: /^Apagar comentário de/ }),
    ).toHaveLength(1);
  });

  it("o compositor aparece só com canComment", () => {
    setup(page([]), { canComment: true });
    expect(screen.getByLabelText("Novo comentário")).toBeInTheDocument();
  });

  it("setor inativo (sem canComment): sem compositor", () => {
    setup(page([comment()]), { canComment: false });

    expect(screen.queryByLabelText("Novo comentário")).toBeNull();
    expect(screen.queryByRole("button", { name: "Comentar" })).toBeNull();
  });
});
