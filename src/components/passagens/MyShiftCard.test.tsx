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
const DELIVERED_AVATAR = "data:image/svg+xml,entregou";
const CONFIRMED_AVATAR = "data:image/svg+xml,confirmou";

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
  deliveredById: "u-ana",
  deliveredByName: "Ana Teste",
  deliveredAt: spDate("2026-11-20", "14:05"),
  confirmedById: null,
  confirmedByName: null,
  confirmedAt: null,
};
const CONFIRMED: MyShiftState = {
  kind: "confirmed",
  handoverId: "h1",
  ref: REF,
  shift: SHIFT,
  deliveredById: "u-ana",
  deliveredByName: "Ana Teste",
  deliveredAt: spDate("2026-11-20", "14:05"),
  confirmedById: "u-bia",
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
      deliveredAvatarSrc={null}
      confirmedAvatarSrc={null}
      {...props}
    />,
  );
}

function cardOf(container: HTMLElement): HTMLElement {
  const card = container.querySelector('[data-slot="card"]');
  if (!(card instanceof HTMLElement)) throw new Error("cartão ausente");
  return card;
}

function parentOf(element: Element | undefined): HTMLElement {
  const parent = element?.parentElement;
  if (!(parent instanceof HTMLElement)) throw new Error("elemento sem pai");
  return parent;
}

function avatarsIn(element: Element): HTMLImageElement[] {
  return Array.from(element.querySelectorAll("img"));
}

/** `later` vem depois de `earlier` na ordem do documento (sem ser filho dele). */
function follows(earlier: Node, later: Node): boolean {
  return (
    earlier.compareDocumentPosition(later) === Node.DOCUMENT_POSITION_FOLLOWING
  );
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

  it("delivered: bloco 'Aguardando recebimento' de largura inteira, sem selo, com ícone decorativo", () => {
    const { container } = renderCard(DELIVERED);

    // Pack de correção (spec §6.4.1): bloco, não mais o selo em pílula.
    const block = screen.getByText("Aguardando recebimento");
    expect(block.tagName).toBe("P");
    expect(block).toHaveClass(
      "flex",
      "items-center",
      "gap-2.5",
      "self-stretch",
      "rounded-[22px]",
      "px-[22px]",
      "py-[18px]",
      "font-heading",
      "text-base",
      "leading-[normal]",
      "font-bold",
      "bg-on-pastel/10",
      "text-on-pastel",
    );
    expect(block).not.toHaveClass("h-7");
    expect(block).not.toHaveClass("rounded-full");
    expect(container.querySelector('[data-slot="badge"]')).toBeNull();
    const icon = block.querySelector("svg");
    expect(icon).toHaveAttribute("aria-hidden", "true");
    expect(icon).toHaveClass("size-[18px]", "shrink-0");
  });

  it("delivered: linha de entrega com o avatar de quem entregou (36px, +3°) e a frase em 15px/1.5", () => {
    renderCard(DELIVERED, { deliveredAvatarSrc: DELIVERED_AVATAR });

    const sentence = screen.getByText(
      "Entregue às 14:05 por Ana Teste. Aguardando recebimento.",
    );
    expect(sentence).toHaveClass("text-[15px]", "leading-normal");
    const line = parentOf(sentence);
    expect(line).toHaveClass("flex", "items-center", "gap-2.5");
    const [avatar, ...rest] = avatarsIn(line);
    expect(rest).toHaveLength(0);
    expect(avatar).toHaveAttribute("src", DELIVERED_AVATAR);
    expect(avatar).toHaveAttribute("alt", "");
    const frame = parentOf(avatar);
    expect(frame).toHaveClass("size-[36px]", "bg-on-pastel");
    expect(frame.style.transform).toBe("rotate(3deg)");
  });

  it("delivered: bloco, linha de entrega e ações nessa ordem; 12px entre o bloco e a linha; sem barra", () => {
    renderCard(DELIVERED, { deliveredAvatarSrc: DELIVERED_AVATAR });

    const block = screen.getByText("Aguardando recebimento");
    const line = parentOf(
      screen.getByText(
        "Entregue às 14:05 por Ana Teste. Aguardando recebimento.",
      ),
    );
    const group = parentOf(block);
    expect(parentOf(line)).toBe(group);
    expect(group).toHaveClass("flex", "flex-col", "items-start", "gap-3");
    const primary = screen.getByRole("link", { name: "Ver passagem" });
    expect(follows(block, line)).toBe(true);
    expect(follows(line, primary)).toBe(true);
    expect(primary).toHaveAttribute("href", "/passagens/h1");
    expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
    expect(
      screen.queryByText("Turno sugerido pelo horário de agora."),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: "Começar passagem" }),
    ).not.toBeInTheDocument();
  });

  it("delivered sem avatar: a frase aparece sozinha, sem imagem nem pilha", () => {
    const { container } = renderCard(DELIVERED);

    expect(
      screen.getByText(
        "Entregue às 14:05 por Ana Teste. Aguardando recebimento.",
      ),
    ).toBeInTheDocument();
    expect(container.querySelector("img")).toBeNull();
    expect(container.querySelector('[data-slot="avatar-stack"]')).toBeNull();
  });

  it("delivered ignora o avatar de quem confirmou (ainda não houve confirmação)", () => {
    const { container } = renderCard(DELIVERED, {
      deliveredAvatarSrc: DELIVERED_AVATAR,
      confirmedAvatarSrc: CONFIRMED_AVATAR,
    });

    expect(avatarsIn(container).map((img) => img.getAttribute("src"))).toEqual([
      DELIVERED_AVATAR,
    ]);
  });

  it("confirmed: bloco verde 'Confirmada' de largura inteira, sem selo, com ícone decorativo", () => {
    const { container } = renderCard(CONFIRMED);

    const block = screen.getByText("Confirmada");
    expect(block.tagName).toBe("P");
    expect(block).toHaveClass(
      "flex",
      "items-center",
      "gap-2.5",
      "self-stretch",
      "rounded-[22px]",
      "px-[22px]",
      "py-[18px]",
      "font-heading",
      "text-base",
      "leading-[normal]",
      "font-bold",
      "bg-on-pastel-success-soft",
      "text-on-pastel-success",
    );
    expect(block).not.toHaveClass("bg-on-pastel/10");
    expect(block).not.toHaveClass("h-7");
    expect(container.querySelector('[data-slot="badge"]')).toBeNull();
    expect(block.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
  });

  it("confirmed: pilha com quem entregou por cima (+3°) e quem confirmou 8px por baixo (−4°), com nomes e horas", () => {
    renderCard(CONFIRMED, {
      deliveredAvatarSrc: DELIVERED_AVATAR,
      confirmedAvatarSrc: CONFIRMED_AVATAR,
    });

    const sentence = screen.getByText(
      "Entregue por Ana Teste às 14:05. Confirmada por Bia Teste às 14:20.",
    );
    expect(sentence).toHaveClass("text-[15px]", "leading-normal");
    const line = parentOf(sentence);
    expect(line).toHaveClass("flex", "items-center", "gap-2.5");
    expect(line.querySelector('[data-slot="avatar-stack"]')).not.toBeNull();
    const [delivered, confirmed, ...rest] = avatarsIn(line);
    expect(rest).toHaveLength(0);
    expect(delivered).toHaveAttribute("src", DELIVERED_AVATAR);
    expect(confirmed).toHaveAttribute("src", CONFIRMED_AVATAR);
    expect(parentOf(delivered)).toHaveClass(
      "relative",
      "z-1",
      "size-[36px]",
      "bg-on-pastel",
    );
    expect(parentOf(delivered).style.transform).toBe("rotate(3deg)");
    expect(parentOf(confirmed)).toHaveClass("-ml-2", "size-[36px]");
    expect(parentOf(confirmed).style.transform).toBe("rotate(-4deg)");

    const block = screen.getByText("Confirmada");
    expect(parentOf(line)).toBe(parentOf(block));
    expect(parentOf(block)).toHaveClass("flex-col", "items-start", "gap-3");
    expect(follows(block, line)).toBe(true);
    expect(screen.getByRole("link", { name: "Ver passagem" })).toHaveAttribute(
      "href",
      "/passagens/h1",
    );
  });

  it("confirmed sem o avatar de quem confirmou: só o de quem entregou, por cima e sem recuo", () => {
    const { container } = renderCard(CONFIRMED, {
      deliveredAvatarSrc: DELIVERED_AVATAR,
    });

    const [only, ...rest] = avatarsIn(container);
    expect(rest).toHaveLength(0);
    expect(only).toHaveAttribute("src", DELIVERED_AVATAR);
    expect(parentOf(only)).toHaveClass("relative", "z-1");
    expect(parentOf(only)).not.toHaveClass("-ml-2");
  });

  it("confirmed sem avatares: a frase inteira e nenhuma imagem", () => {
    const { container } = renderCard(CONFIRMED);

    expect(
      screen.getByText(
        "Entregue por Ana Teste às 14:05. Confirmada por Bia Teste às 14:20.",
      ),
    ).toBeInTheDocument();
    expect(container.querySelector("img")).toBeNull();
  });

  it("confirmed sem quem confirmou nem hora: 'outra pessoa', sem inventar a hora", () => {
    renderCard({ ...CONFIRMED, confirmedByName: null, confirmedAt: null });

    expect(
      screen.getByText(
        "Entregue por Ana Teste às 14:05. Confirmada por outra pessoa.",
      ),
    ).toBeInTheDocument();
  });

  // Pixel perfect do pack de correção: com a frase partida em vários nós (e os
  // comentários que o SSR põe entre eles), o Chromium posiciona alguns glifos
  // diferente do protótipo, que tem a frase num nó só.
  it.each<[string, MyShiftState, string]>([
    [
      "delivered",
      DELIVERED,
      "Entregue às 14:05 por Ana Teste. Aguardando recebimento.",
    ],
    [
      "confirmed",
      CONFIRMED,
      "Entregue por Ana Teste às 14:05. Confirmada por Bia Teste às 14:20.",
    ],
    [
      "confirmed sem quem confirmou nem hora",
      { ...CONFIRMED, confirmedByName: null, confirmedAt: null },
      "Entregue por Ana Teste às 14:05. Confirmada por outra pessoa.",
    ],
  ])("%s: a frase da linha de entrega é um nó de texto só", (_name, state, text) => {
    renderCard(state, { deliveredAvatarSrc: DELIVERED_AVATAR });

    const sentence = screen.getByText(text);
    expect(Array.from(sentence.childNodes, (node) => node.nodeType)).toEqual([
      Node.TEXT_NODE,
    ]);
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
      const { container, unmount } = renderCard(state, {
        avatarSrc: AVATAR,
        deliveredAvatarSrc: DELIVERED_AVATAR,
        confirmedAvatarSrc: CONFIRMED_AVATAR,
      });

      expect(container.innerHTML).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
      expect(container.innerHTML).not.toMatch(
        /\b(?:bg|text|border)-(?:red|green|blue|yellow|amber|orange|gray|slate|zinc)-\d+/,
      );
      unmount();
    }
  });
});
