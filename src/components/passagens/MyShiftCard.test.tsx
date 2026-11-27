import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { MyShiftState } from "@/features/handovers/home";
import { SECTOR_COLOR_BG, SECTOR_COLORS } from "@/features/sectors/colors";
import { spDate } from "../../../test/clock";
import { MyShiftCard } from "./MyShiftCard";

const SECTOR_ID = "11111111-1111-4111-8111-111111111111";
const SHIFT = {
  id: "22222222-2222-4222-8222-222222222222",
  name: "Turno Manhã",
  startsAt: "06:00",
  endsAt: "14:00",
};
const REF = {
  sectorId: SECTOR_ID,
  shiftId: SHIFT.id,
  operationalDate: "2026-11-20",
};
const PROGRESS = {
  startLabel: "06:00",
  endLabel: "14:00",
  nowLabel: "08:42",
  pct: 34,
};
const AVATAR = "data:image/svg+xml,rascunho";

const START: MyShiftState = {
  kind: "start",
  ref: REF,
  shift: SHIFT,
  saved: null,
  progress: PROGRESS,
};
const CONTINUE: MyShiftState = {
  kind: "continue",
  ref: REF,
  shift: SHIFT,
  saved: {
    at: spDate("2026-11-20", "13:41"),
    byName: "Ana Teste",
    byId: "u-ana",
  },
  progress: PROGRESS,
};
const DELIVERED: MyShiftState = {
  kind: "delivered",
  handoverId: "h1",
  ref: REF,
  shift: SHIFT,
  deliveredByName: "Ana Teste",
  deliveredAt: spDate("2026-11-20", "14:05"),
  confirmedByName: null,
  confirmedAt: null,
};
const CONFIRMED: MyShiftState = {
  kind: "confirmed",
  handoverId: "h1",
  ref: REF,
  shift: SHIFT,
  deliveredByName: "Ana Teste",
  deliveredAt: spDate("2026-11-20", "14:05"),
  confirmedByName: "Bia Teste",
  confirmedAt: spDate("2026-11-20", "14:20"),
};
const NO_SHIFTS: MyShiftState = { kind: "no-shifts" };

type Props = Parameters<typeof MyShiftCard>[0];

function renderCard(
  state: MyShiftState,
  props: Partial<Omit<Props, "state">> = {},
) {
  return render(
    <MyShiftCard
      state={state}
      sectorId={SECTOR_ID}
      sectorName="ULD"
      sectorColor="lilac"
      canManageCatalog={false}
      sectorParam={null}
      avatarSrc={null}
      {...props}
    />,
  );
}

function cardOf(container: HTMLElement): HTMLElement {
  const card = container.querySelector('[data-slot="card"]');
  if (!(card instanceof HTMLElement)) throw new Error("cartão ausente");
  return card;
}

describe("MyShiftCard", () => {
  it("start: título, turno, horário, data, barra, nota de sugestão e 'Começar passagem'", () => {
    renderCard(START);

    expect(
      screen.getByRole("heading", { level: 2, name: "Passagem do meu turno" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Turno Manhã")).toBeInTheDocument();
    expect(screen.getByText("06:00–14:00")).toBeInTheDocument();
    expect(screen.getByText("20/11/2026")).toBeInTheDocument();
    expect(
      screen.getByRole("progressbar", { name: "Progresso do turno" }),
    ).toHaveAttribute("aria-valuenow", "34");
    expect(screen.getByText("agora 08:42")).toBeInTheDocument();
    expect(
      screen.getByText("Turno sugerido pelo horário de agora."),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Começar passagem" }),
    ).toHaveAttribute(
      "href",
      `/passagens/nova?turno=${SHIFT.id}&data=2026-11-20`,
    );
    expect(screen.queryByText(/Rascunho salvo/)).not.toBeInTheDocument();
  });

  it("start de admin leva o setor na URL", () => {
    renderCard(START, { sectorParam: SECTOR_ID });

    expect(
      screen.getByRole("link", { name: "Começar passagem" }),
    ).toHaveAttribute(
      "href",
      `/passagens/nova?turno=${SHIFT.id}&data=2026-11-20&setor=${SECTOR_ID}`,
    );
  });

  it("o cartão leva a cor do setor, a tinta de pastel e o crossfade que respeita movimento reduzido", () => {
    const { container } = renderCard(START, { sectorColor: "peach" });

    const card = cardOf(container);
    expect(card).toHaveClass(
      SECTOR_COLOR_BG.peach,
      "text-on-pastel",
      "transition-colors",
      "duration-[450ms]",
      "motion-reduce:transition-none",
    );
  });

  it.each(
    SECTOR_COLORS,
  )("a cor %s do setor vira o fundo do cartão", (color) => {
    const { container } = renderCard(START, { sectorColor: color });

    expect(cardOf(container)).toHaveClass(SECTOR_COLOR_BG[color]);
  });

  it("o chip mostra o nome do setor, sem quebrar linha (reticências se for longo)", () => {
    renderCard(START, { sectorName: "Operações de Pátio Internacional" });

    const chip = screen.getByText("Operações de Pátio Internacional");
    expect(chip).toHaveClass("truncate", "whitespace-nowrap", "bg-on-pastel");
    expect(chip).toHaveAttribute("title", "Operações de Pátio Internacional");
  });

  it("o horário usa tabular-nums e os tamanhos 64/52/44 por container query e celular", () => {
    renderCard(START);

    const time = screen.getByText("06:00–14:00");
    expect(time).toHaveClass(
      "tabular-nums",
      "font-black",
      "text-[64px]",
      "max-md:text-[44px]",
      "@min-[1040px]/main:@max-[1239px]/main:text-[52px]",
    );
  });

  it("continue: barra, quando e por quem o rascunho foi salvo (com avatar) e 'Continuar passagem'", () => {
    const { container } = renderCard(CONTINUE, { avatarSrc: AVATAR });

    expect(
      screen.getByText("Rascunho salvo às 13:41 por Ana Teste"),
    ).toBeInTheDocument();
    const avatar = container.querySelector("img");
    expect(avatar).toHaveAttribute("src", AVATAR);
    expect(avatar).toHaveAttribute("alt", "");
    expect(screen.getByRole("progressbar")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Continuar passagem" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: "Começar passagem" }),
    ).not.toBeInTheDocument();
  });

  it("continue sem marca de salvamento não inventa a frase nem o avatar", () => {
    const { container } = renderCard(
      { ...CONTINUE, saved: null },
      { avatarSrc: AVATAR },
    );

    expect(screen.queryByText(/Rascunho salvo/)).not.toBeInTheDocument();
    expect(container.querySelector("img")).toBeNull();
    expect(
      screen.getByRole("link", { name: "Continuar passagem" }),
    ).toBeInTheDocument();
  });

  it("continue com marca, mas sem avatar: a frase aparece e a imagem não", () => {
    const { container } = renderCard(CONTINUE, { avatarSrc: null });

    expect(
      screen.getByText("Rascunho salvo às 13:41 por Ana Teste"),
    ).toBeInTheDocument();
    expect(container.querySelector("img")).toBeNull();
  });

  it("delivered: selo 'Aguardando recebimento', quem entregou, link para a passagem e sem barra", () => {
    renderCard(DELIVERED);

    // Selo pastel no tamanho do protótipo (28px, 12px de padding, 13px).
    expect(screen.getByText("Aguardando recebimento")).toHaveClass(
      "bg-pastel-pending",
      "text-pastel-pending-foreground",
      "h-7",
      "px-3",
      "text-[13px]",
    );
    expect(screen.getByText("Aguardando recebimento")).not.toHaveClass("h-6");
    expect(
      screen.getByText(
        "Entregue às 14:05 por Ana Teste. Aguardando recebimento.",
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Ver passagem" })).toHaveAttribute(
      "href",
      "/passagens/h1",
    );
    expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
    expect(
      screen.queryByText("Turno sugerido pelo horário de agora."),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: "Começar passagem" }),
    ).not.toBeInTheDocument();
  });

  it("confirmed: selo 'Confirmada', entrega e confirmação com nomes e horas", () => {
    renderCard(CONFIRMED);

    expect(screen.getByText("Confirmada")).toHaveClass(
      "bg-pastel-confirmed",
      "text-pastel-confirmed-foreground",
      "h-7",
    );
    expect(
      screen.getByText(
        "Entregue por Ana Teste às 14:05. Confirmada por Bia Teste às 14:20.",
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Ver passagem" })).toHaveAttribute(
      "href",
      "/passagens/h1",
    );
  });

  it("confirmed sem quem confirmou nem hora: 'outra pessoa', sem inventar a hora", () => {
    renderCard({ ...CONFIRMED, confirmedByName: null, confirmedAt: null });

    expect(
      screen.getByText(
        "Entregue por Ana Teste às 14:05. Confirmada por outra pessoa.",
      ),
    ).toBeInTheDocument();
  });

  it.each([
    ["start", START],
    ["continue", CONTINUE],
    ["delivered", DELIVERED],
    ["confirmed", CONFIRMED],
    ["no-shifts", NO_SHIFTS],
  ] as const)("estado %s tem o link secundário 'Ver todas as passagens'", (_name, state) => {
    renderCard(state);

    expect(
      screen.getByRole("link", { name: "Ver todas as passagens" }),
    ).toHaveAttribute("href", "/passagens");
  });

  it("primário on-pastel com 22px de padding; secundário com 20px (protótipo)", () => {
    renderCard(START);

    expect(screen.getByRole("link", { name: "Começar passagem" })).toHaveClass(
      "bg-on-pastel",
      "px-[22px]",
    );
    const secondary = screen.getByRole("link", {
      name: "Ver todas as passagens",
    });
    expect(secondary).toHaveClass("bg-on-pastel-secondary", "px-5");
    expect(secondary).not.toHaveClass("px-[22px]");
  });

  it("sem turnos, operador: pede ao administrador, sem horário, sem barra e sem 'Ir para Turnos'", () => {
    renderCard(NO_SHIFTS);

    expect(screen.getByText("Nenhum turno neste setor.")).toBeInTheDocument();
    expect(
      screen.getByText(
        "Peça a um administrador para cadastrar os turnos do setor.",
      ),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: "Ir para Turnos" }),
    ).not.toBeInTheDocument();
    expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
    expect(screen.queryByText(/\d\d:\d\d–\d\d:\d\d/)).not.toBeInTheDocument();
  });

  it("sem turnos, admin: texto próprio e 'Ir para Turnos' do setor", () => {
    renderCard(NO_SHIFTS, { canManageCatalog: true });

    expect(
      screen.getByText("Cadastre os turnos do setor para começar a passagem."),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Ir para Turnos" }),
    ).toHaveAttribute("href", `/admin/turnos?setor=${SECTOR_ID}`);
  });

  it("sem turnos mantém a cor do setor e o chip", () => {
    const { container } = renderCard(NO_SHIFTS, { sectorColor: "green" });

    expect(cardOf(container)).toHaveClass(SECTOR_COLOR_BG.green);
    expect(screen.getByText("ULD")).toBeInTheDocument();
  });

  it("usa só tokens de cor (sem hex nem classe crua do Tailwind)", () => {
    for (const state of [START, CONTINUE, DELIVERED, CONFIRMED, NO_SHIFTS]) {
      const { container, unmount } = renderCard(state, { avatarSrc: AVATAR });

      expect(container.innerHTML).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
      expect(container.innerHTML).not.toMatch(
        /\b(?:bg|text|border)-(?:red|green|blue|yellow|amber|orange|gray|slate|zinc)-\d+/,
      );
      unmount();
    }
  });
});
