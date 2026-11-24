import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { TooltipProvider } from "@/components/ui/tooltip";
import { fail, ok } from "@/features/admin/result";
import type { RequestFormChoices } from "@/features/requests/types";
import { NewRequestDialog } from "./NewRequestDialog";

const SECTOR = "11111111-1111-4111-8111-111111111111";
const DOCA = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const CREATED_ID = "ffffffff-ffff-4fff-8fff-ffffffffffff";

const CHOICES: RequestFormChoices = {
  destinations: [{ id: DOCA, name: "Doca 3" }],
  bySector: { [SECTOR]: { stockItems: [], defaultDestinationId: DOCA } },
};

const mocks = vi.hoisted(() => ({
  createRequestAction: vi.fn(),
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
}));

vi.mock("@/app/(app)/solicitacoes/actions", () => ({
  createRequestAction: mocks.createRequestAction,
}));
vi.mock("sonner", () => ({
  toast: { success: mocks.toastSuccess, error: mocks.toastError },
}));

function setup(triggerVariant?: "default" | "outline") {
  render(
    <TooltipProvider>
      <NewRequestDialog
        sectors={null}
        initialSectorId={SECTOR}
        choices={CHOICES}
        originRef={null}
        triggerVariant={triggerVariant}
      />
    </TooltipProvider>,
  );
}

const trigger = () => screen.getByRole("button", { name: "Nova solicitação" });
const dialog = () => screen.getByRole("dialog", { name: "Nova solicitação" });
const description = () =>
  within(dialog()).getByRole("textbox", { name: "Descrição" });

describe("NewRequestDialog", () => {
  beforeEach(() => {
    for (const mock of Object.values(mocks)) mock.mockReset();
  });

  it("começa fechado; o gatilho abre o diálogo com título, descrição e o formulário", async () => {
    setup();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    await userEvent.click(trigger());

    expect(dialog()).toBeInTheDocument();
    expect(
      within(dialog()).getByText(
        "Ela entra como Solicitada. A equipe do setor move o status até a entrega.",
      ),
    ).toBeInTheDocument();
    expect(
      within(dialog()).getByRole("button", { name: "Criar solicitação" }),
    ).toBeInTheDocument();
    // O X do primitivo fica desligado: "Voltar" é o jeito de fechar.
    expect(
      within(dialog()).queryByRole("button", { name: "Fechar" }),
    ).not.toBeInTheDocument();
  });

  it("sucesso: fecha o diálogo e mostra o toast 'Solicitação criada.'", async () => {
    mocks.createRequestAction.mockResolvedValue(ok({ id: CREATED_ID }));
    setup();

    await userEvent.click(trigger());
    await userEvent.type(description(), "Luvas para a doca");
    await userEvent.click(
      within(dialog()).getByRole("button", { name: "Criar solicitação" }),
    );

    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
    );
    expect(mocks.toastSuccess).toHaveBeenCalledWith("Solicitação criada.");
    expect(mocks.createRequestAction).toHaveBeenCalledTimes(1);
  });

  it("erro: o diálogo continua aberto, com a mensagem e o texto digitado", async () => {
    mocks.createRequestAction.mockResolvedValue(
      fail(
        "SECTOR_INACTIVE",
        "Este setor está inativo. Peça a um administrador para reativá-lo.",
      ),
    );
    setup();

    await userEvent.click(trigger());
    await userEvent.type(description(), "Luvas para a doca");
    await userEvent.click(
      within(dialog()).getByRole("button", { name: "Criar solicitação" }),
    );

    expect(
      await within(dialog()).findByText(
        "Este setor está inativo. Peça a um administrador para reativá-lo.",
      ),
    ).toBeInTheDocument();
    expect(description()).toHaveValue("Luvas para a doca");
  });

  it("'Voltar' fecha sem chamar a action e a próxima abertura começa do zero", async () => {
    setup();

    await userEvent.click(trigger());
    await userEvent.type(description(), "Rascunho que será descartado");
    await userEvent.click(
      within(dialog()).getByRole("button", { name: "Voltar" }),
    );
    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
    );
    expect(mocks.createRequestAction).not.toHaveBeenCalled();

    await userEvent.click(trigger());

    expect(description()).toHaveValue("");
    expect(
      within(dialog()).getByRole("combobox", { name: "Destino" }),
    ).toHaveValue(DOCA);
  });

  it("o gatilho aceita a variante outline (usada dentro da passagem)", () => {
    setup("outline");

    expect(trigger().className).toContain("border-border");
  });
});
