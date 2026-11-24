import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { TooltipProvider } from "@/components/ui/tooltip";
import { fail, ok } from "@/features/admin/result";
import type { HandoverFormState } from "@/features/handovers/formState";
import { CorrectionForm } from "./CorrectionForm";

const HANDOVER_ID = "6f1d2a3b-4c5d-4e6f-8a9b-0c1d2e3f4a5b";
const NETS_ID = "7a2e3b4c-5d6e-4f70-8b9c-1d2e3f4a5b6c";
const TAPE_ID = "8b3f4c5d-6e7f-4081-9cad-2e3f4a5b6c7d";

const mocks = vi.hoisted(() => ({
  correctHandoverAction: vi.fn(),
  push: vi.fn(),
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
}));

vi.mock("@/app/(app)/passagens/actions", () => ({
  correctHandoverAction: mocks.correctHandoverAction,
  saveHandoverFieldAction: vi.fn(),
  deliverHandoverAction: vi.fn(),
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mocks.push }),
}));
vi.mock("sonner", () => ({
  toast: { success: mocks.toastSuccess, error: mocks.toastError },
}));

type CorrectionState = HandoverFormState & { mode: "correction" };

function makeState(overrides: Partial<CorrectionState> = {}): CorrectionState {
  return {
    ref: {
      sectorId: "9c4a5d6e-7f80-4192-8dbe-3f4a5b6c7d8e",
      shiftId: "ad5b6e7f-8091-42a3-9ecf-4a5b6c7d8e9f",
      operationalDate: "2026-11-19",
    },
    handoverId: HANDOVER_ID,
    status: "confirmed",
    sectorName: "ULD",
    shiftName: "Manhã",
    occurrencesText: "Chuva forte",
    nextShiftText: "Conferir as redes",
    controls: [
      {
        itemId: NETS_ID,
        name: "Rede de proteção",
        unit: "unidade",
        kind: "control",
        quantity: 2,
        note: "",
      },
    ],
    stock: [
      {
        itemId: TAPE_ID,
        name: "Fita adesiva",
        unit: "rolo",
        kind: "stock",
        quantity: 10,
        note: "Pedir mais",
      },
    ],
    saved: null,
    deliveredByName: "Ana Teste",
    deliveredAt: new Date("2026-11-19T17:05:00Z"),
    mode: "correction",
    ...overrides,
  };
}

function setup(state: CorrectionState = makeState()) {
  const user = userEvent.setup();
  render(
    <TooltipProvider>
      <CorrectionForm state={state} />
    </TooltipProvider>,
  );
  return { user };
}

const reasonField = () =>
  screen.getByRole("textbox", { name: "Motivo da correção" });
const occurrencesField = () =>
  screen.getByRole("textbox", { name: "Ocorrências do turno" });
const nextShiftField = () =>
  screen.getByRole("textbox", { name: "Fica para o próximo turno" });
const quantityField = (name: string) =>
  screen.getByRole("textbox", { name: `Quantidade de ${name}` });
const submit = () =>
  screen.getByRole("button", { name: /^Registrar correção$|^Registrando…$/ });

describe("CorrectionForm", () => {
  beforeEach(() => {
    for (const mock of Object.values(mocks)) mock.mockReset();
  });

  it("começa com os valores vigentes, o motivo vazio e o botão com o nome do resultado", () => {
    setup();

    expect(occurrencesField()).toHaveValue("Chuva forte");
    expect(nextShiftField()).toHaveValue("Conferir as redes");
    expect(quantityField("Rede de proteção")).toHaveValue("2");
    expect(quantityField("Fita adesiva")).toHaveValue("10");
    expect(
      screen.getByRole("textbox", { name: "Observação de Fita adesiva" }),
    ).toHaveValue("Pedir mais");
    expect(reasonField()).toHaveValue("");
    expect(reasonField()).toHaveAttribute("maxlength", "500");
    expect(
      screen.getByText("Obrigatório. Aparece na lista de correções."),
    ).toBeInTheDocument();
    expect(submit()).toHaveTextContent("Registrar correção");
    expect(screen.getByRole("link", { name: "Cancelar" })).toHaveAttribute(
      "href",
      `/passagens/${HANDOVER_ID}`,
    );
  });

  it("sem motivo: erro no campo, a action não é chamada e o digitado fica", async () => {
    const { user } = setup();

    await user.type(occurrencesField(), " e granizo");
    await user.click(
      screen.getByRole("button", { name: "Aumentar Rede de proteção" }),
    );
    await user.click(submit());

    expect(
      await screen.findByText("Informe o motivo da correção."),
    ).toBeInTheDocument();
    expect(reasonField()).toHaveAttribute("aria-invalid", "true");
    expect(mocks.correctHandoverAction).not.toHaveBeenCalled();
    expect(occurrencesField()).toHaveValue("Chuva forte e granizo");
    expect(quantityField("Rede de proteção")).toHaveValue("3");
  });

  it("motivo só com espaços também é recusado", async () => {
    const { user } = setup();

    await user.type(reasonField(), "     ");
    await user.click(submit());

    expect(
      await screen.findByText("Informe o motivo da correção."),
    ).toBeInTheDocument();
    expect(mocks.correctHandoverAction).not.toHaveBeenCalled();
  });

  it("envia o estado completo desejado e o motivo; sucesso mostra o toast e volta ao resumo", async () => {
    mocks.correctHandoverAction.mockResolvedValue(ok({ changes: 2 }));
    const { user } = setup();

    await user.click(
      screen.getByRole("button", { name: "Aumentar Rede de proteção" }),
    );
    await user.clear(nextShiftField());
    await user.type(nextShiftField(), "Nada pendente");
    await user.type(reasonField(), "Contagem errada");
    await user.click(submit());

    await waitFor(() =>
      expect(mocks.push).toHaveBeenCalledWith(`/passagens/${HANDOVER_ID}`),
    );
    expect(mocks.correctHandoverAction).toHaveBeenCalledWith({
      id: HANDOVER_ID,
      reason: "Contagem errada",
      occurrencesText: "Chuva forte",
      nextShiftText: "Nada pendente",
      items: [
        { itemId: NETS_ID, quantity: 3, note: "" },
        { itemId: TAPE_ID, quantity: 10, note: "Pedir mais" },
      ],
    });
    expect(mocks.toastSuccess).toHaveBeenCalledWith("Correção registrada.");
    expect(mocks.toastError).not.toHaveBeenCalled();
  });

  it("a observação do item entra na correção", async () => {
    mocks.correctHandoverAction.mockResolvedValue(ok({ changes: 1 }));
    const { user } = setup();

    await user.click(
      screen.getByRole("button", {
        name: "Adicionar observação em Rede de proteção",
      }),
    );
    await user.type(
      screen.getByRole("textbox", { name: "Observação de Rede de proteção" }),
      "Rasgada",
    );
    await user.type(reasonField(), "Faltou anotar");
    await user.click(submit());

    await waitFor(() => expect(mocks.correctHandoverAction).toHaveBeenCalled());
    expect(mocks.correctHandoverAction.mock.calls[0]?.[0]).toMatchObject({
      items: [
        { itemId: NETS_ID, quantity: 2, note: "Rasgada" },
        { itemId: TAPE_ID, quantity: 10, note: "Pedir mais" },
      ],
    });
  });

  it("NO_CHANGES: mostra a mensagem, não navega e mantém tudo", async () => {
    mocks.correctHandoverAction.mockResolvedValue(
      fail(
        "NO_CHANGES",
        "Nada foi alterado. Mude algum campo para registrar a correção.",
      ),
    );
    const { user } = setup();

    await user.type(reasonField(), "Só conferindo");
    await user.click(submit());

    expect(
      await screen.findByText(
        "Nada foi alterado. Mude algum campo para registrar a correção.",
      ),
    ).toBeInTheDocument();
    expect(mocks.push).not.toHaveBeenCalled();
    expect(mocks.toastSuccess).not.toHaveBeenCalled();
    expect(mocks.toastError).not.toHaveBeenCalled();
    expect(reasonField()).toHaveValue("Só conferindo");
    expect(submit()).toBeEnabled();
  });

  it("erro do servidor no motivo aparece no campo", async () => {
    mocks.correctHandoverAction.mockResolvedValue(
      fail("INVALID_INPUT", "O motivo pode ter no máximo 500 caracteres.", {
        reason: "O motivo pode ter no máximo 500 caracteres.",
      }),
    );
    const { user } = setup();

    await user.type(reasonField(), "Motivo");
    await user.click(submit());

    expect(
      await screen.findByText("O motivo pode ter no máximo 500 caracteres."),
    ).toBeInTheDocument();
    expect(reasonField()).toHaveAttribute("aria-invalid", "true");
    expect(reasonField()).toHaveValue("Motivo");
  });

  it("recusa de domínio (FORBIDDEN) aparece inline e o digitado fica", async () => {
    mocks.correctHandoverAction.mockResolvedValue(
      fail(
        "FORBIDDEN",
        "Só um administrador pode corrigir uma passagem confirmada.",
      ),
    );
    const { user } = setup();

    await user.click(
      screen.getByRole("button", { name: "Aumentar Fita adesiva" }),
    );
    await user.type(reasonField(), "Tentativa");
    await user.click(submit());

    expect(
      await screen.findByText(
        "Só um administrador pode corrigir uma passagem confirmada.",
      ),
    ).toBeInTheDocument();
    expect(quantityField("Fita adesiva")).toHaveValue("11");
    expect(reasonField()).toHaveValue("Tentativa");
    expect(mocks.push).not.toHaveBeenCalled();
  });

  it("exceção da action vira a mensagem genérica, sem vazar o texto", async () => {
    mocks.correctHandoverAction.mockRejectedValue(new Error("rede caiu"));
    const { user } = setup();

    await user.type(reasonField(), "Motivo");
    await user.click(submit());

    expect(
      await screen.findByText("Não foi possível concluir. Tente de novo."),
    ).toBeInTheDocument();
    expect(screen.queryByText("rede caiu")).not.toBeInTheDocument();
  });

  it("enquanto registra: 'Registrando…' desabilitado e um envio só", async () => {
    let finish: (value: unknown) => void = () => {};
    mocks.correctHandoverAction.mockReturnValue(
      new Promise((resolve) => {
        finish = resolve;
      }),
    );
    const { user } = setup();

    await user.type(reasonField(), "Motivo");
    await user.click(submit());

    await waitFor(() => expect(submit()).toHaveTextContent("Registrando…"));
    expect(submit()).toBeDisabled();
    await user.click(submit());
    expect(mocks.correctHandoverAction).toHaveBeenCalledTimes(1);

    finish(ok({ changes: 1 }));
    await waitFor(() => expect(mocks.push).toHaveBeenCalled());
  });

  it("sem itens no setor: corrige só os textos", async () => {
    mocks.correctHandoverAction.mockResolvedValue(ok({ changes: 1 }));
    const { user } = setup(makeState({ controls: [], stock: [] }));

    await user.clear(occurrencesField());
    await user.type(occurrencesField(), "Sem ocorrências");
    await user.type(reasonField(), "Texto errado");
    await user.click(submit());

    await waitFor(() => expect(mocks.correctHandoverAction).toHaveBeenCalled());
    expect(mocks.correctHandoverAction.mock.calls[0]?.[0]).toMatchObject({
      occurrencesText: "Sem ocorrências",
      items: [],
    });
  });

  it("sem id de passagem (estado impossível): recusa sem chamar a action", async () => {
    const { user } = setup(makeState({ handoverId: null }));

    await user.type(reasonField(), "Motivo");
    await user.click(submit());

    expect(
      await screen.findByText("Passagem não encontrada. Atualize a página."),
    ).toBeInTheDocument();
    expect(mocks.correctHandoverAction).not.toHaveBeenCalled();
    expect(screen.getByRole("link", { name: "Cancelar" })).toHaveAttribute(
      "href",
      "/passagens",
    );
  });
});
