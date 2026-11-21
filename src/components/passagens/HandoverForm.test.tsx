import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { TooltipProvider } from "@/components/ui/tooltip";
import { type AdminResult, fail, ok } from "@/features/admin/result";
import type { SavedField } from "@/features/handovers/draft";
import type { HandoverFormState } from "@/features/handovers/formState";
import { UNSAVED_DELIVER_MESSAGE } from "@/features/handovers/messages";
import type { FormMode } from "@/features/handovers/types";
import { spDate } from "../../../test/clock";
import { HandoverForm } from "./HandoverForm";

const mocks = vi.hoisted(() => ({
  save: vi.fn(),
  deliver: vi.fn(),
  push: vi.fn(),
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
}));

vi.mock("@/app/(app)/passagens/actions", () => ({
  saveHandoverFieldAction: mocks.save,
  deliverHandoverAction: mocks.deliver,
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mocks.push }),
}));
vi.mock("sonner", () => ({
  toast: { success: mocks.toastSuccess, error: mocks.toastError },
}));

const SECTOR_ID = "11111111-1111-4111-8111-111111111111";
const MANHA = "22222222-2222-4222-8222-222222222222";
const TARDE = "33333333-3333-4333-8333-333333333333";
const REDE_ID = "44444444-4444-4444-8444-444444444444";
const FITA_ID = "55555555-5555-4555-8555-555555555555";
const SHIFTS = [
  { id: MANHA, name: "Turno Manhã", startsAt: "06:00", endsAt: "14:00" },
  { id: TARDE, name: "Turno Tarde", startsAt: "14:00", endsAt: "22:00" },
];

const REDE = {
  itemId: REDE_ID,
  name: "Rede de proteção",
  unit: "rolo",
  kind: "control",
  quantity: 0,
  note: "",
} as const;

const STATE: HandoverFormState & { mode: FormMode } = {
  ref: { sectorId: SECTOR_ID, shiftId: MANHA, operationalDate: "2026-11-20" },
  handoverId: null,
  status: null,
  sectorName: "ULD",
  shiftName: "Turno Manhã",
  occurrencesText: "",
  nextShiftText: "",
  controls: [REDE],
  stock: [
    {
      itemId: FITA_ID,
      name: "Fita adesiva",
      unit: "rolo",
      kind: "stock",
      quantity: 0,
      note: "",
    },
  ],
  saved: null,
  deliveredByName: null,
  deliveredAt: null,
  mode: "draft",
};

function renderForm(
  state: HandoverFormState & { mode: FormMode } = STATE,
  props: { sectorParam?: string | null } = {},
) {
  render(
    <TooltipProvider>
      <HandoverForm
        state={state}
        shifts={SHIFTS}
        today="2026-11-20"
        minDate="2026-10-20"
        sectorParam={props.sectorParam ?? null}
        canManageCatalog={false}
      />
    </TooltipProvider>,
  );
}

const savedOk = (hour = "10:00") =>
  ok({
    handoverId: "h1",
    savedAt: spDate("2026-11-20", hour),
    savedByName: "Ana Teste",
  });

const deliverButton = () =>
  screen.getByRole("button", { name: /Entregar turno|Entregando…/ });

describe("HandoverForm", () => {
  beforeEach(() => {
    for (const mock of Object.values(mocks)) mock.mockReset();
    mocks.save.mockResolvedValue(savedOk());
    mocks.deliver.mockResolvedValue(ok({ id: "h1", deliveredAt: new Date() }));
  });

  it("nunca começa em branco: números em 0, textos vazios e 'Nada salvo ainda.'", () => {
    renderForm();

    expect(
      screen.getByRole("textbox", { name: "Quantidade de Rede de proteção" }),
    ).toHaveValue("0");
    expect(
      screen.getByRole("textbox", { name: "Quantidade de Fita adesiva" }),
    ).toHaveValue("0");
    expect(screen.getByLabelText("Ocorrências do turno")).toHaveValue("");
    expect(screen.getByText("Nada salvo ainda.")).toBeInTheDocument();
    expect(mocks.save).not.toHaveBeenCalled();
  });

  it("mostra o último salvamento de um rascunho que já existe", () => {
    renderForm({
      ...STATE,
      handoverId: "h1",
      status: "draft",
      saved: { at: spDate("2026-11-20", "09:10"), byName: "Bia Teste" },
    });

    expect(
      screen.getByText("Último salvamento às 09:10 por Bia Teste"),
    ).toBeInTheDocument();
  });

  it("começa com os valores do rascunho salvo", () => {
    renderForm({
      ...STATE,
      occurrencesText: "Rede rasgada no box 4.",
      controls: [{ ...REDE, quantity: 7, note: "box 4" }],
    });

    expect(
      screen.getByRole("textbox", { name: "Quantidade de Rede de proteção" }),
    ).toHaveValue("7");
    expect(screen.getByLabelText("Observação de Rede de proteção")).toHaveValue(
      "box 4",
    );
    expect(screen.getByLabelText("Ocorrências do turno")).toHaveValue(
      "Rede rasgada no box 4.",
    );
  });

  it("+ salva na hora e mostra 'Salvo às HH:mm'", async () => {
    renderForm();

    await userEvent.click(
      screen.getByRole("button", { name: "Aumentar Rede de proteção" }),
    );

    await waitFor(() =>
      expect(mocks.save).toHaveBeenCalledWith({
        sectorId: SECTOR_ID,
        shiftId: MANHA,
        operationalDate: "2026-11-20",
        field: "quantity",
        itemId: REDE_ID,
        value: 1,
      }),
    );
    expect(await screen.findByText("Salvo às 10:00")).toBeInTheDocument();
  });

  it("texto digitado salva sozinho depois do debounce, uma vez só", async () => {
    renderForm();

    // Um único evento de change: digitar letra por letra numa máquina lenta
    // pode estourar os 800 ms entre teclas e salvar antes da hora.
    fireEvent.change(screen.getByLabelText("Ocorrências do turno"), {
      target: { value: "Aviso" },
    });
    expect(mocks.save).not.toHaveBeenCalled();

    await waitFor(() => expect(mocks.save).toHaveBeenCalledTimes(1), {
      timeout: 3000,
    });
    expect(mocks.save).toHaveBeenCalledWith(
      expect.objectContaining({ field: "occurrences", value: "Aviso" }),
    );
  });

  it("'Entregar turno' salva o pendente ANTES de entregar", async () => {
    const order: string[] = [];
    let finishSave: (result: AdminResult<SavedField>) => void = () => {};
    mocks.save.mockImplementation(() => {
      order.push("save");
      return new Promise((resolve) => {
        finishSave = resolve;
      });
    });
    mocks.deliver.mockImplementation(async () => {
      order.push("deliver");
      return ok({ id: "h1", deliveredAt: new Date() });
    });
    renderForm();

    // Um único change: com o debounce real, digitar letra por letra pode
    // disparar um salvamento intermediário e o teste depende da velocidade.
    fireEvent.change(screen.getByLabelText("Ocorrências do turno"), {
      target: { value: "Aviso" },
    });
    await userEvent.click(deliverButton());

    await waitFor(() => expect(order).toEqual(["save"]));
    expect(mocks.deliver).not.toHaveBeenCalled();

    finishSave(savedOk());
    await waitFor(() => expect(order).toEqual(["save", "deliver"]));
  });

  it("entrega com sucesso: toast e navegação para o resumo", async () => {
    renderForm();

    await userEvent.click(deliverButton());

    await waitFor(() =>
      expect(mocks.push).toHaveBeenCalledWith("/passagens/h1"),
    );
    expect(mocks.deliver).toHaveBeenCalledWith({
      sectorId: SECTOR_ID,
      shiftId: MANHA,
      operationalDate: "2026-11-20",
    });
    expect(mocks.toastSuccess).toHaveBeenCalledWith("Turno entregue.");
    // Depois de entregar o botão fica travado até a navegação terminar.
    expect(screen.getByRole("button", { name: "Entregando…" })).toBeDisabled();
  });

  it("entregar com tudo zerado e sem texto é permitido (nada bloqueia)", async () => {
    renderForm();

    await userEvent.click(deliverButton());

    await waitFor(() => expect(mocks.deliver).toHaveBeenCalledTimes(1));
  });

  it("falha ao salvar bloqueia a entrega e mostra o texto de aviso", async () => {
    mocks.save.mockResolvedValue(fail("INTERNAL", "Sem rede."));
    renderForm();

    await userEvent.click(
      screen.getByRole("button", { name: "Aumentar Rede de proteção" }),
    );
    await userEvent.click(deliverButton());

    expect(
      await screen.findByText(UNSAVED_DELIVER_MESSAGE),
    ).toBeInTheDocument();
    expect(UNSAVED_DELIVER_MESSAGE).toBe(
      "Há alterações sem salvar. Toque em “Tentar de novo” e entregue de novo.",
    );
    expect(mocks.deliver).not.toHaveBeenCalled();
    expect(mocks.push).not.toHaveBeenCalled();
    expect(screen.getByText("Não salvo.")).toBeInTheDocument();
    // O digitado fica.
    expect(
      screen.getByRole("textbox", { name: "Quantidade de Rede de proteção" }),
    ).toHaveValue("1");
  });

  it("'Tentar de novo' reenvia e depois dá para entregar", async () => {
    mocks.save.mockResolvedValueOnce(fail("INTERNAL", "Sem rede."));
    renderForm();

    await userEvent.click(
      screen.getByRole("button", { name: "Aumentar Rede de proteção" }),
    );
    await userEvent.click(
      await screen.findByRole("button", { name: "Tentar de novo" }),
    );

    expect(await screen.findByText("Salvo às 10:00")).toBeInTheDocument();
    expect(mocks.save).toHaveBeenCalledTimes(2);

    await userEvent.click(deliverButton());
    await waitFor(() => expect(mocks.deliver).toHaveBeenCalledTimes(1));
  });

  it("segunda entrega: a mensagem do servidor aparece no formulário, sem perder o digitado", async () => {
    mocks.deliver.mockResolvedValue(
      fail(
        "ALREADY_DELIVERED",
        "Esta passagem já foi entregue por Bia Teste às 14:05.",
      ),
    );
    renderForm();

    await userEvent.type(
      screen.getByLabelText("Ocorrências do turno"),
      "Aviso",
    );
    await userEvent.click(deliverButton());

    expect(
      await screen.findByText(
        "Esta passagem já foi entregue por Bia Teste às 14:05.",
      ),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Ocorrências do turno")).toHaveValue("Aviso");
    expect(mocks.push).not.toHaveBeenCalled();
    expect(mocks.toastError).not.toHaveBeenCalled();
  });

  it("enquanto entrega, o botão fica desabilitado como 'Entregando…'", async () => {
    let finish: (
      result: AdminResult<{ id: string; deliveredAt: Date }>,
    ) => void = () => {};
    mocks.deliver.mockImplementation(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    renderForm();

    await userEvent.click(deliverButton());

    expect(
      await screen.findByRole("button", { name: "Entregando…" }),
    ).toBeDisabled();
    finish(ok({ id: "h1", deliveredAt: new Date() }));
    await waitFor(() => expect(mocks.push).toHaveBeenCalled());
  });

  it("mostra a ajuda de que dá para corrigir até alguém confirmar", () => {
    renderForm();

    expect(
      screen.getByText(
        "Você ainda pode corrigir até alguém confirmar o recebimento.",
      ),
    ).toBeInTheDocument();
  });

  it("trocar de turno salva o pendente e navega com turno, data e setor", async () => {
    renderForm(STATE, { sectorParam: SECTOR_ID });

    await userEvent.click(
      screen.getByRole("button", { name: "Aumentar Rede de proteção" }),
    );
    await userEvent.selectOptions(screen.getByLabelText("Turno"), TARDE);

    await waitFor(() =>
      expect(mocks.push).toHaveBeenCalledWith(
        `/passagens/nova?turno=${TARDE}&data=2026-11-20&setor=${SECTOR_ID}`,
      ),
    );
    expect(mocks.save).toHaveBeenCalledTimes(1);
  });

  it("trocar de turno com falha de salvamento não navega e avisa", async () => {
    mocks.save.mockResolvedValue(fail("INTERNAL", "Sem rede."));
    renderForm();

    await userEvent.click(
      screen.getByRole("button", { name: "Aumentar Rede de proteção" }),
    );
    await userEvent.selectOptions(screen.getByLabelText("Turno"), TARDE);

    await waitFor(() =>
      expect(mocks.toastError).toHaveBeenCalledWith(
        "Não foi possível salvar. Tente de novo antes de trocar de turno.",
      ),
    );
    expect(mocks.push).not.toHaveBeenCalled();
  });

  describe("passagem entregue (mode edit)", () => {
    const EDIT = {
      ...STATE,
      handoverId: "h1",
      status: "delivered" as const,
      mode: "edit" as const,
    };

    it("sem cabeçalho de troca nem botão de entregar; com link para o resumo", () => {
      renderForm(EDIT);

      expect(screen.queryByLabelText("Turno")).not.toBeInTheDocument();
      expect(
        screen.queryByRole("button", { name: "Entregar turno" }),
      ).not.toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: "Ver resumo" }),
      ).toBeInTheDocument();
    });

    it("'Ver resumo' espera o salvamento terminar e só então navega", async () => {
      let finish: (value: ReturnType<typeof savedOk>) => void = () => {};
      mocks.save.mockImplementation(
        () =>
          new Promise((resolve) => {
            finish = resolve;
          }),
      );
      renderForm(EDIT);
      await userEvent.click(
        screen.getByRole("button", { name: "Aumentar Fita adesiva" }),
      );
      await waitFor(() => expect(mocks.save).toHaveBeenCalledTimes(1));

      await userEvent.click(screen.getByRole("button", { name: "Ver resumo" }));
      expect(mocks.push).not.toHaveBeenCalled();

      finish(savedOk());
      await waitFor(() =>
        expect(mocks.push).toHaveBeenCalledWith("/passagens/h1"),
      );
    });

    it("'Ver resumo' com falha de salvamento fica na tela e avisa", async () => {
      mocks.save.mockResolvedValue(fail("INTERNAL", "Sem rede."));
      renderForm(EDIT);
      await userEvent.click(
        screen.getByRole("button", { name: "Aumentar Fita adesiva" }),
      );

      await userEvent.click(screen.getByRole("button", { name: "Ver resumo" }));

      expect(await screen.findByText(/Há alterações sem salvar/)).toBeVisible();
      expect(mocks.push).not.toHaveBeenCalled();
    });

    it("'Ver resumo' sem nada pendente navega direto", async () => {
      renderForm(EDIT);

      await userEvent.click(screen.getByRole("button", { name: "Ver resumo" }));

      await waitFor(() =>
        expect(mocks.push).toHaveBeenCalledWith("/passagens/h1"),
      );
    });

    it("continua salvando sozinho", async () => {
      renderForm(EDIT);

      await userEvent.click(
        screen.getByRole("button", { name: "Aumentar Fita adesiva" }),
      );

      await waitFor(() =>
        expect(mocks.save).toHaveBeenCalledWith(
          expect.objectContaining({ field: "quantity", itemId: FITA_ID }),
        ),
      );
    });
  });
});
