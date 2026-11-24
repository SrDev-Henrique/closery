import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { TooltipProvider } from "@/components/ui/tooltip";
import { fail, ok } from "@/features/admin/result";
import type { HandoverRef } from "@/features/handovers/types";
import {
  DESCRIPTION_REQUIRED_MESSAGE,
  DESCRIPTION_TOO_LONG_MESSAGE,
  DESTINATION_INACTIVE_MESSAGE,
  DESTINATION_OTHER_REQUIRED_MESSAGE,
  ORIGIN_LOCKED_MESSAGE,
} from "@/features/requests/messages";
import type { RequestFormChoices } from "@/features/requests/types";
import { RequestForm } from "./RequestForm";

const SECTOR_A = "11111111-1111-4111-8111-111111111111";
const SECTOR_B = "22222222-2222-4222-8222-222222222222";
const DOCA = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const BALCAO = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const LUVA = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const FITA = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
const COLA = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";
const CREATED_ID = "ffffffff-ffff-4fff-8fff-ffffffffffff";

const CHOICES: RequestFormChoices = {
  destinations: [
    { id: BALCAO, name: "Balcão" },
    { id: DOCA, name: "Doca 3" },
  ],
  bySector: {
    [SECTOR_A]: {
      stockItems: [
        { id: LUVA, name: "Luva", unit: "par" },
        { id: FITA, name: "Fita", unit: "rolo" },
      ],
      defaultDestinationId: DOCA,
    },
    [SECTOR_B]: {
      stockItems: [
        { id: FITA, name: "Fita", unit: "rolo" },
        { id: COLA, name: "Cola", unit: "frasco" },
      ],
      defaultDestinationId: BALCAO,
    },
  },
};

const NO_DESTINATIONS: RequestFormChoices = {
  destinations: [],
  bySector: {
    [SECTOR_A]: { stockItems: [], defaultDestinationId: null },
  },
};

const REF: HandoverRef = {
  sectorId: SECTOR_A,
  shiftId: "99999999-9999-4999-8999-999999999999",
  operationalDate: "2026-11-20",
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

function setup(
  props: {
    choices?: RequestFormChoices;
    sectors?: { id: string; name: string }[] | null;
    initialSectorId?: string;
    originRef?: HandoverRef | null;
  } = {},
) {
  const onCreated = vi.fn();
  const onCancel = vi.fn();
  render(
    <TooltipProvider>
      <RequestForm
        sectors={props.sectors ?? null}
        initialSectorId={props.initialSectorId ?? SECTOR_A}
        choices={props.choices ?? CHOICES}
        originRef={props.originRef ?? null}
        onCreated={onCreated}
        onCancel={onCancel}
      />
    </TooltipProvider>,
  );
  return { onCreated, onCancel };
}

const destination = () => screen.getByRole("combobox", { name: "Destino" });
const description = () => screen.getByRole("textbox", { name: "Descrição" });
const submit = () =>
  screen.getByRole("button", { name: /^Criar solicitação$|^Criando…$/ });
const addItem = () => screen.getByRole("button", { name: "Adicionar item" });
const itemSelects = () => screen.queryAllByRole("combobox", { name: "Item" });
const optionNames = (select: HTMLElement) =>
  Array.from(select.querySelectorAll("option")).map((o) => o.textContent);

function hover(element: HTMLElement) {
  fireEvent.pointerEnter(element, { pointerType: "mouse" });
  fireEvent.mouseEnter(element);
  fireEvent.pointerMove(element, { pointerType: "mouse" });
  fireEvent.mouseMove(element);
}

describe("RequestForm", () => {
  beforeEach(() => {
    for (const mock of Object.values(mocks)) mock.mockReset();
  });

  describe("nunca começa em branco", () => {
    it("o destino já vem escolhido: o padrão do setor; 'Outro' é a última opção", () => {
      setup();

      expect(destination()).toHaveValue(DOCA);
      expect(optionNames(destination())).toEqual(["Balcão", "Doca 3", "Outro"]);
      expect(screen.queryByLabelText("Qual destino?")).not.toBeInTheDocument();
      expect(description()).toHaveValue("");
      expect(itemSelects()).toHaveLength(0);
      expect(submit()).toHaveTextContent("Criar solicitação");
    });

    it("sem destinos ativos o padrão é 'Outro' e o campo 'Qual destino?' já aparece", () => {
      setup({ choices: NO_DESTINATIONS });

      expect(destination()).toHaveValue("outro");
      expect(optionNames(destination())).toEqual(["Outro"]);
      expect(screen.getByLabelText("Qual destino?")).toHaveValue("");
    });

    it("escolher 'Outro' revela 'Qual destino?' e voltar para a lista o esconde", async () => {
      setup();

      await userEvent.selectOptions(destination(), "outro");
      expect(screen.getByLabelText("Qual destino?")).toBeInTheDocument();

      await userEvent.selectOptions(destination(), BALCAO);
      expect(screen.queryByLabelText("Qual destino?")).not.toBeInTheDocument();
    });

    it("operador (sem campo Setor) não vê o seletor de setor", () => {
      setup({ sectors: null });

      expect(
        screen.queryByRole("combobox", { name: "Setor" }),
      ).not.toBeInTheDocument();
    });
  });

  describe("itens", () => {
    it("'Adicionar item' acrescenta o primeiro item ainda não escolhido com quantidade 1", async () => {
      setup();

      await userEvent.click(addItem());
      expect(itemSelects()).toHaveLength(1);
      expect(itemSelects()[0]).toHaveValue(LUVA);
      expect(
        screen.getByRole("textbox", { name: "Quantidade de Luva" }),
      ).toHaveValue("1");
      expect(screen.getByText("par")).toBeInTheDocument();

      await userEvent.click(addItem());
      expect(itemSelects()).toHaveLength(2);
      expect(itemSelects()[1]).toHaveValue(FITA);
    });

    it("cada linha oferece só os itens que ninguém escolheu (e o próprio); o botão desativa quando acabam", async () => {
      setup();

      await userEvent.click(addItem());
      await userEvent.click(addItem());

      const [first, second] = itemSelects();
      expect(optionNames(first as HTMLElement)).toEqual(["Luva"]);
      expect(optionNames(second as HTMLElement)).toEqual(["Fita"]);
      expect(addItem()).toBeDisabled();
    });

    it("trocar o item da linha mantém a quantidade", async () => {
      setup();
      await userEvent.click(addItem());
      await userEvent.click(
        screen.getByRole("button", { name: "Aumentar Luva" }),
      );
      expect(
        screen.getByRole("textbox", { name: "Quantidade de Luva" }),
      ).toHaveValue("2");

      await userEvent.selectOptions(itemSelects()[0] as HTMLElement, FITA);

      expect(itemSelects()[0]).toHaveValue(FITA);
      expect(
        screen.getByRole("textbox", { name: "Quantidade de Fita" }),
      ).toHaveValue("2");
    });

    it("a quantidade tem mínimo 1: − desativado em 1", async () => {
      setup();
      await userEvent.click(addItem());

      expect(
        screen.getByRole("button", { name: "Diminuir Luva" }),
      ).toBeDisabled();
      await userEvent.click(
        screen.getByRole("button", { name: "Aumentar Luva" }),
      );
      expect(
        screen.getByRole("button", { name: "Diminuir Luva" }),
      ).toBeEnabled();
    });

    it("remover tem aria-label, tooltip e tira a linha (o item volta a ficar disponível)", async () => {
      setup();
      await userEvent.click(addItem());
      const remove = screen.getByRole("button", { name: "Remover Luva" });

      hover(remove);
      await waitFor(() =>
        expect(screen.getByText("Remover item")).toBeInTheDocument(),
      );
      await userEvent.click(remove);

      expect(itemSelects()).toHaveLength(0);
      expect(addItem()).toBeEnabled();
      await userEvent.click(addItem());
      expect(itemSelects()[0]).toHaveValue(LUVA);
    });

    it("setor sem itens de estoque mostra o texto e não oferece 'Adicionar item'", () => {
      setup({ choices: NO_DESTINATIONS });

      expect(
        screen.getByText("Nenhum item de estoque neste setor."),
      ).toBeInTheDocument();
      expect(
        screen.queryByRole("button", { name: "Adicionar item" }),
      ).not.toBeInTheDocument();
    });
  });

  describe("admin", () => {
    const SECTORS = [
      { id: SECTOR_A, name: "Almoxarifado Teste" },
      { id: SECTOR_B, name: "Outro Setor" },
    ];

    it("trocar o setor limpa os itens, troca a lista de itens e mantém o destino", async () => {
      setup({ sectors: SECTORS });
      expect(screen.getByRole("combobox", { name: "Setor" })).toHaveValue(
        SECTOR_A,
      );
      await userEvent.selectOptions(destination(), BALCAO);
      await userEvent.click(addItem());
      expect(itemSelects()).toHaveLength(1);

      await userEvent.selectOptions(
        screen.getByRole("combobox", { name: "Setor" }),
        SECTOR_B,
      );

      expect(itemSelects()).toHaveLength(0);
      expect(destination()).toHaveValue(BALCAO);
      await userEvent.click(addItem());
      expect(itemSelects()[0]).toHaveValue(FITA);
      await userEvent.click(addItem());
      expect(itemSelects()[1]).toHaveValue(COLA);
    });

    it("manda o setor escolhido", async () => {
      mocks.createRequestAction.mockResolvedValue(ok({ id: CREATED_ID }));
      setup({ sectors: SECTORS });

      await userEvent.selectOptions(
        screen.getByRole("combobox", { name: "Setor" }),
        SECTOR_B,
      );
      await userEvent.type(description(), "Cola para a doca");
      await userEvent.click(submit());

      await waitFor(() =>
        expect(mocks.createRequestAction).toHaveBeenCalledTimes(1),
      );
      expect(mocks.createRequestAction.mock.calls[0]?.[0]).toMatchObject({
        sectorId: SECTOR_B,
        // O destino padrão do setor A (Doca 3) fica ao trocar de setor.
        destinationId: DOCA,
      });
    });
  });

  describe("validação antes de chamar a action", () => {
    it("descrição vazia: erro no campo e a action não é chamada", async () => {
      setup();

      await userEvent.click(submit());

      expect(
        await screen.findByText(DESCRIPTION_REQUIRED_MESSAGE),
      ).toBeInTheDocument();
      expect(mocks.createRequestAction).not.toHaveBeenCalled();
      expect(description()).toHaveAttribute("aria-invalid", "true");
    });

    it("descrição só com espaços também é recusada", async () => {
      setup();

      await userEvent.type(description(), "   ");
      await userEvent.click(submit());

      expect(
        await screen.findByText(DESCRIPTION_REQUIRED_MESSAGE),
      ).toBeInTheDocument();
      expect(mocks.createRequestAction).not.toHaveBeenCalled();
    });

    it("descrição com 501 pontos de código: erro no campo, sem chamar a action", async () => {
      setup();

      fireEvent.change(description(), { target: { value: "a".repeat(501) } });
      await userEvent.click(submit());

      expect(
        await screen.findByText(DESCRIPTION_TOO_LONG_MESSAGE),
      ).toBeInTheDocument();
      expect(mocks.createRequestAction).not.toHaveBeenCalled();
    });

    it("descrição com 500 pontos de código passa", async () => {
      mocks.createRequestAction.mockResolvedValue(ok({ id: CREATED_ID }));
      setup();

      fireEvent.change(description(), { target: { value: "a".repeat(500) } });
      await userEvent.click(submit());

      await waitFor(() =>
        expect(mocks.createRequestAction).toHaveBeenCalledTimes(1),
      );
    });

    it("'Outro' sem texto: erro no campo 'Qual destino?'", async () => {
      setup({ choices: NO_DESTINATIONS });

      await userEvent.type(description(), "Pedido avulso");
      await userEvent.click(submit());

      expect(
        await screen.findByText(DESTINATION_OTHER_REQUIRED_MESSAGE),
      ).toBeInTheDocument();
      expect(screen.getByLabelText("Qual destino?")).toHaveAttribute(
        "aria-invalid",
        "true",
      );
      expect(mocks.createRequestAction).not.toHaveBeenCalled();
    });
  });

  describe("envio", () => {
    it("manda destino da lista, descrição e itens; sucesso chama onCreated e mostra o toast", async () => {
      mocks.createRequestAction.mockResolvedValue(ok({ id: CREATED_ID }));
      const { onCreated } = setup();

      await userEvent.type(description(), "Luvas para a doca");
      await userEvent.click(addItem());
      await userEvent.click(
        screen.getByRole("button", { name: "Aumentar Luva" }),
      );
      await userEvent.click(submit());

      await waitFor(() => expect(onCreated).toHaveBeenCalledWith(CREATED_ID));
      expect(mocks.createRequestAction).toHaveBeenCalledWith({
        sectorId: SECTOR_A,
        destinationId: DOCA,
        destinationOther: "",
        description: "Luvas para a doca",
        items: [{ itemId: LUVA, quantity: 2 }],
        originRef: null,
      });
      expect(mocks.toastSuccess).toHaveBeenCalledWith("Solicitação criada.");
    });

    it("com 'Outro' manda o texto digitado e destinationId nulo", async () => {
      mocks.createRequestAction.mockResolvedValue(ok({ id: CREATED_ID }));
      setup();

      await userEvent.selectOptions(destination(), "outro");
      await userEvent.type(
        screen.getByLabelText("Qual destino?"),
        "Cliente avulso",
      );
      await userEvent.type(description(), "Entrega externa");
      await userEvent.click(submit());

      await waitFor(() =>
        expect(mocks.createRequestAction).toHaveBeenCalledTimes(1),
      );
      expect(mocks.createRequestAction.mock.calls[0]?.[0]).toMatchObject({
        destinationId: null,
        destinationOther: "Cliente avulso",
      });
    });

    it("o originRef da passagem vai na action", async () => {
      mocks.createRequestAction.mockResolvedValue(ok({ id: CREATED_ID }));
      setup({ originRef: REF });

      await userEvent.type(description(), "Pedido da passagem");
      await userEvent.click(submit());

      await waitFor(() =>
        expect(mocks.createRequestAction).toHaveBeenCalledTimes(1),
      );
      expect(mocks.createRequestAction.mock.calls[0]?.[0]).toMatchObject({
        originRef: REF,
      });
    });

    it("erro do servidor no campo certo; o digitado não se perde", async () => {
      mocks.createRequestAction.mockResolvedValue(
        fail("DESTINATION_INACTIVE", DESTINATION_INACTIVE_MESSAGE, {
          destinationId: DESTINATION_INACTIVE_MESSAGE,
        }),
      );
      const { onCreated } = setup();

      await userEvent.type(description(), "Luvas para a doca");
      await userEvent.click(addItem());
      await userEvent.click(submit());

      expect(
        await screen.findByText(DESTINATION_INACTIVE_MESSAGE),
      ).toBeInTheDocument();
      expect(destination()).toHaveAttribute("aria-invalid", "true");
      expect(description()).toHaveValue("Luvas para a doca");
      expect(itemSelects()).toHaveLength(1);
      expect(onCreated).not.toHaveBeenCalled();
      expect(mocks.toastSuccess).not.toHaveBeenCalled();
      expect(mocks.toastError).not.toHaveBeenCalled();
    });

    it("erro sem campo (passagem já confirmada) aparece no pé, com o digitado preservado", async () => {
      mocks.createRequestAction.mockResolvedValue(
        fail("HANDOVER_LOCKED", ORIGIN_LOCKED_MESSAGE),
      );
      setup({ originRef: REF });

      await userEvent.type(description(), "Pedido da passagem");
      await userEvent.click(submit());

      expect(
        await screen.findByText(ORIGIN_LOCKED_MESSAGE),
      ).toBeInTheDocument();
      expect(description()).toHaveValue("Pedido da passagem");
      expect(submit()).toBeEnabled();
    });

    it("exceção da action vira o erro genérico, sem perder o digitado", async () => {
      mocks.createRequestAction.mockRejectedValue(new Error("rede"));
      setup();

      await userEvent.type(description(), "Pedido");
      await userEvent.click(submit());

      expect(
        await screen.findByText("Não foi possível concluir. Tente de novo."),
      ).toBeInTheDocument();
      expect(description()).toHaveValue("Pedido");
    });

    it("pendente: 'Criando…', tudo desativado e um segundo envio não chama a action de novo", async () => {
      let resolve: (value: unknown) => void = () => {};
      mocks.createRequestAction.mockReturnValue(
        new Promise((done) => {
          resolve = done;
        }),
      );
      setup();

      await userEvent.type(description(), "Pedido");
      await userEvent.click(submit());

      expect(
        await screen.findByRole("button", { name: "Criando…" }),
      ).toBeDisabled();
      expect(description()).toBeDisabled();
      fireEvent.submit(description().closest("form") as HTMLFormElement);
      expect(mocks.createRequestAction).toHaveBeenCalledTimes(1);

      resolve(ok({ id: CREATED_ID }));
      await waitFor(() => expect(submit()).toBeEnabled());
    });
  });

  it("'Voltar' chama onCancel sem tocar na action", async () => {
    const { onCancel } = setup();

    await userEvent.click(screen.getByRole("button", { name: "Voltar" }));

    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(mocks.createRequestAction).not.toHaveBeenCalled();
  });

  it("campos digitáveis com text-base e alvos de 44px no celular", () => {
    setup({ choices: NO_DESTINATIONS });

    expect(description()).toHaveClass("text-base");
    expect(screen.getByLabelText("Qual destino?")).toHaveClass("text-base");
    expect(submit().className).toContain("max-md:h-11");
  });
});
