import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Pagination } from "./Pagination";

describe("Pagination", () => {
  it("não renderiza nada com uma página só (ou zero)", () => {
    const { container, rerender } = render(
      <Pagination
        page={1}
        pageCount={1}
        pathname="/admin/setores"
        params={{}}
      />,
    );
    expect(container).toBeEmptyDOMElement();

    rerender(
      <Pagination
        page={1}
        pageCount={0}
        pathname="/admin/setores"
        params={{}}
      />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("na primeira página 'Anterior' não é link e 'Próxima' vai para a página 2", () => {
    render(
      <Pagination
        page={1}
        pageCount={3}
        pathname="/admin/setores"
        params={{}}
      />,
    );

    expect(
      screen.getByRole("navigation", { name: "Paginação" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Página 1 de 3")).toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: "Anterior" }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Anterior" })).toBeDisabled();
    expect(screen.getByRole("link", { name: "Próxima" })).toHaveAttribute(
      "href",
      "/admin/setores?pagina=2",
    );
  });

  it("no meio os dois links existem e voltar à página 1 remove o parâmetro", () => {
    const { rerender } = render(
      <Pagination
        page={2}
        pageCount={3}
        pathname="/admin/setores"
        params={{}}
      />,
    );

    expect(screen.getByText("Página 2 de 3")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Anterior" })).toHaveAttribute(
      "href",
      "/admin/setores",
    );
    expect(screen.getByRole("link", { name: "Próxima" })).toHaveAttribute(
      "href",
      "/admin/setores?pagina=3",
    );

    rerender(
      <Pagination
        page={3}
        pageCount={3}
        pathname="/admin/setores"
        params={{}}
      />,
    );
    expect(
      screen.queryByRole("link", { name: "Próxima" }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Próxima" })).toBeDisabled();
    expect(screen.getByRole("link", { name: "Anterior" })).toHaveAttribute(
      "href",
      "/admin/setores?pagina=2",
    );
  });

  it("preserva os outros parâmetros, como o setor", () => {
    render(
      <Pagination
        page={1}
        pageCount={2}
        pathname="/admin/turnos"
        params={{ setor: "abc-123", pagina: "1", vazio: undefined }}
      />,
    );

    expect(screen.getByRole("link", { name: "Próxima" })).toHaveAttribute(
      "href",
      "/admin/turnos?setor=abc-123&pagina=2",
    );
  });

  it("o nome do nav é 'Paginação' por padrão e pode ser trocado por label", () => {
    const { rerender } = render(
      <Pagination
        page={1}
        pageCount={2}
        pathname="/admin/equipe"
        params={{}}
      />,
    );
    expect(
      screen.getByRole("navigation", { name: "Paginação" }),
    ).toBeInTheDocument();

    rerender(
      <Pagination
        page={1}
        pageCount={2}
        pathname="/admin/equipe"
        params={{}}
        label="Paginação das pessoas"
      />,
    );
    expect(
      screen.getByRole("navigation", { name: "Paginação das pessoas" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("navigation", { name: "Paginação" }),
    ).not.toBeInTheDocument();
  });

  it("duas paginações na mesma tela têm nomes distintos", () => {
    render(
      <>
        <Pagination
          page={1}
          pageCount={2}
          pathname="/admin/equipe"
          params={{}}
          param="convites"
          label="Paginação dos convites pendentes"
        />
        <Pagination
          page={2}
          pageCount={2}
          pathname="/admin/equipe"
          params={{}}
          label="Paginação das pessoas"
        />
      </>,
    );

    const names = screen
      .getAllByRole("navigation")
      .map((nav) => nav.getAttribute("aria-label"));
    expect(names).toEqual([
      "Paginação dos convites pendentes",
      "Paginação das pessoas",
    ]);
  });

  it("na primeira e na última página o lado sem destino é botão desativado, nunca link nem texto solto", () => {
    const { rerender } = render(
      <Pagination
        page={1}
        pageCount={2}
        pathname="/admin/setores"
        params={{}}
      />,
    );
    expect(screen.getByRole("button", { name: "Anterior" })).toBeDisabled();
    expect(screen.getAllByRole("button")).toHaveLength(1);

    rerender(
      <Pagination
        page={2}
        pageCount={2}
        pathname="/admin/setores"
        params={{}}
      />,
    );
    expect(screen.getByRole("button", { name: "Próxima" })).toBeDisabled();
    expect(screen.getAllByRole("button")).toHaveLength(1);
  });

  it("usa o parâmetro pedido (lista de convites da Equipe)", () => {
    render(
      <Pagination
        page={2}
        pageCount={3}
        pathname="/admin/equipe"
        params={{ pagina: "4" }}
        param="convites"
      />,
    );

    expect(screen.getByRole("link", { name: "Anterior" })).toHaveAttribute(
      "href",
      "/admin/equipe?pagina=4",
    );
    expect(screen.getByRole("link", { name: "Próxima" })).toHaveAttribute(
      "href",
      "/admin/equipe?pagina=4&convites=3",
    );
  });
});
