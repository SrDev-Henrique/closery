import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { redirect } from "next/navigation";
import { Component, type ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { SectorPicker } from "./SectorPicker";

const mocks = vi.hoisted(() => ({
  chooseSectorAction: vi.fn(),
  toastError: vi.fn(),
}));

vi.mock("@/app/(app)/actions", () => ({
  chooseSectorAction: mocks.chooseSectorAction,
}));
vi.mock("sonner", () => ({ toast: { error: mocks.toastError } }));

const ULD = { id: "11111111-1111-4111-8111-111111111111", name: "ULD" };
const CARGA = { id: "22222222-2222-4222-8222-222222222222", name: "Carga" };

class Catcher extends Component<{ children: ReactNode }, { error: unknown }> {
  state: { error: unknown } = { error: null };
  static getDerivedStateFromError(error: unknown) {
    return { error };
  }
  render() {
    return this.state.error ? <p>capturado</p> : this.props.children;
  }
}

describe("SectorPicker", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  beforeEach(() => {
    mocks.chooseSectorAction.mockReset();
    mocks.toastError.mockReset();
  });

  it("um botão por setor, o selecionado com aria-pressed", () => {
    render(
      <SectorPicker sectors={[ULD, CARGA]} selectedId={ULD.id} path="/" />,
    );

    expect(screen.getByRole("group", { name: "Setor" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "ULD" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByRole("button", { name: "Carga" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
  });

  it("clicar em outro setor chama a action com setor e caminho", async () => {
    mocks.chooseSectorAction.mockResolvedValue({ ok: true });
    render(
      <SectorPicker
        sectors={[ULD, CARGA]}
        selectedId={ULD.id}
        path="/passagens/nova"
      />,
    );

    await userEvent.click(screen.getByRole("button", { name: "Carga" }));

    expect(mocks.chooseSectorAction).toHaveBeenCalledWith({
      sectorId: CARGA.id,
      path: "/passagens/nova",
    });
  });

  it("com query, a action recebe o query dos filtros junto (P45)", async () => {
    mocks.chooseSectorAction.mockResolvedValue({ ok: true });
    render(
      <SectorPicker
        sectors={[ULD, CARGA]}
        selectedId={ULD.id}
        path="/passagens"
        query="periodo=30&situacao=aguardando"
      />,
    );

    await userEvent.click(screen.getByRole("button", { name: "Carga" }));

    expect(mocks.chooseSectorAction).toHaveBeenCalledWith({
      sectorId: CARGA.id,
      path: "/passagens",
      query: "periodo=30&situacao=aguardando",
    });
  });

  it("com query vazio, a action recebe o query vazio (a tela sem filtros)", async () => {
    mocks.chooseSectorAction.mockResolvedValue({ ok: true });
    render(
      <SectorPicker
        sectors={[ULD, CARGA]}
        selectedId={ULD.id}
        path="/solicitacoes"
        query=""
      />,
    );

    await userEvent.click(screen.getByRole("button", { name: "Carga" }));

    expect(mocks.chooseSectorAction).toHaveBeenCalledWith({
      sectorId: CARGA.id,
      path: "/solicitacoes",
      query: "",
    });
  });

  it("clicar no setor já selecionado não chama a action", async () => {
    render(
      <SectorPicker sectors={[ULD, CARGA]} selectedId={ULD.id} path="/" />,
    );

    await userEvent.click(screen.getByRole("button", { name: "ULD" }));

    expect(mocks.chooseSectorAction).not.toHaveBeenCalled();
  });

  it("falha da action vira toast com a mensagem", async () => {
    mocks.chooseSectorAction.mockResolvedValue({
      ok: false,
      code: "SECTOR_INACTIVE",
      message:
        "Este setor está inativo. Peça a um administrador para reativá-lo.",
    });
    render(
      <SectorPicker sectors={[ULD, CARGA]} selectedId={ULD.id} path="/" />,
    );

    await userEvent.click(screen.getByRole("button", { name: "Carga" }));

    await waitFor(() =>
      expect(mocks.toastError).toHaveBeenCalledWith(
        "Este setor está inativo. Peça a um administrador para reativá-lo.",
      ),
    );
  });

  it("exceção de rede vira o toast genérico", async () => {
    mocks.chooseSectorAction.mockRejectedValue(new Error("Failed to fetch"));
    render(
      <SectorPicker sectors={[ULD, CARGA]} selectedId={ULD.id} path="/" />,
    );

    await userEvent.click(screen.getByRole("button", { name: "Carga" }));

    await waitFor(() =>
      expect(mocks.toastError).toHaveBeenCalledWith(
        "Não foi possível concluir. Tente de novo.",
      ),
    );
  });

  it("o redirect do sucesso segue adiante: sem toast", async () => {
    mocks.chooseSectorAction.mockImplementation(async () => {
      redirect("/?setor=x");
    });
    vi.spyOn(console, "error").mockImplementation(() => {});
    render(
      <Catcher>
        <SectorPicker sectors={[ULD, CARGA]} selectedId={ULD.id} path="/" />
      </Catcher>,
    );

    await userEvent.click(screen.getByRole("button", { name: "Carga" }));

    expect(await screen.findByText("capturado")).toBeInTheDocument();
    expect(mocks.toastError).not.toHaveBeenCalled();
  });

  it("allowAll acrescenta 'Todos os setores'", async () => {
    mocks.chooseSectorAction.mockResolvedValue({ ok: true });
    render(
      <SectorPicker
        sectors={[ULD]}
        selectedId="todos"
        path="/passagens"
        allowAll
      />,
    );

    expect(
      screen.getByRole("button", { name: "Todos os setores" }),
    ).toHaveAttribute("aria-pressed", "true");

    await userEvent.click(screen.getByRole("button", { name: "ULD" }));
    expect(mocks.chooseSectorAction).toHaveBeenCalledWith({
      sectorId: ULD.id,
      path: "/passagens",
    });
  });

  it("sem allowAll não há 'Todos os setores'", () => {
    render(<SectorPicker sectors={[ULD]} selectedId={ULD.id} path="/" />);

    expect(
      screen.queryByRole("button", { name: "Todos os setores" }),
    ).not.toBeInTheDocument();
  });
});
