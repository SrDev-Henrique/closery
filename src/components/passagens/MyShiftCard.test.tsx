import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { MyShiftState } from "@/features/handovers/home";
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

function renderCard(
  state: MyShiftState,
  props: { canManageCatalog?: boolean; sectorParam?: string | null } = {},
) {
  return render(
    <MyShiftCard
      state={state}
      sectorId={SECTOR_ID}
      canManageCatalog={props.canManageCatalog ?? false}
      sectorParam={props.sectorParam ?? null}
    />,
  );
}

describe("MyShiftCard", () => {
  it("start: turno, horário, data, nota de sugestão e 'Começar passagem'", () => {
    renderCard({ kind: "start", ref: REF, shift: SHIFT, saved: null });

    expect(
      screen.getByRole("heading", { name: "Passagem do meu turno" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        (_, element) =>
          element?.tagName === "P" &&
          element.textContent === "Turno Manhã · 06:00–14:00 · 20/11/2026",
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Turno sugerido pelo horário de agora."),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Começar passagem" }),
    ).toHaveAttribute(
      "href",
      `/passagens/nova?turno=${SHIFT.id}&data=2026-11-20`,
    );
  });

  it("start de admin leva o setor na URL", () => {
    renderCard(
      { kind: "start", ref: REF, shift: SHIFT, saved: null },
      { sectorParam: SECTOR_ID },
    );

    expect(
      screen.getByRole("link", { name: "Começar passagem" }),
    ).toHaveAttribute(
      "href",
      `/passagens/nova?turno=${SHIFT.id}&data=2026-11-20&setor=${SECTOR_ID}`,
    );
  });

  it("continue: mostra quando e por quem o rascunho foi salvo", () => {
    renderCard({
      kind: "continue",
      ref: REF,
      shift: SHIFT,
      saved: { at: spDate("2026-11-20", "13:41"), byName: "Ana Teste" },
    });

    expect(
      screen.getByText("Rascunho salvo às 13:41 por Ana Teste"),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Continuar passagem" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: "Começar passagem" }),
    ).not.toBeInTheDocument();
  });

  it("continue sem marca de salvamento não inventa a frase", () => {
    renderCard({ kind: "continue", ref: REF, shift: SHIFT, saved: null });

    expect(screen.queryByText(/Rascunho salvo/)).not.toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Continuar passagem" }),
    ).toBeInTheDocument();
  });

  it("delivered: quem entregou, aguardando recebimento e link para a passagem", () => {
    renderCard({
      kind: "delivered",
      handoverId: "h1",
      ref: REF,
      shift: SHIFT,
      deliveredByName: "Ana Teste",
      deliveredAt: spDate("2026-11-20", "14:05"),
      confirmedByName: null,
      confirmedAt: null,
    });

    expect(
      screen.getByText(
        "Entregue às 14:05 por Ana Teste. Aguardando recebimento.",
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Ver passagem" })).toHaveAttribute(
      "href",
      "/passagens/h1",
    );
    expect(
      screen.queryByRole("link", { name: "Começar passagem" }),
    ).not.toBeInTheDocument();
  });

  it("confirmed: entrega e confirmação com nomes e horas", () => {
    renderCard({
      kind: "confirmed",
      handoverId: "h1",
      ref: REF,
      shift: SHIFT,
      deliveredByName: "Ana Teste",
      deliveredAt: spDate("2026-11-20", "14:05"),
      confirmedByName: "Bia Teste",
      confirmedAt: spDate("2026-11-20", "14:20"),
    });

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

  it.each([
    [{ kind: "start", ref: REF, shift: SHIFT, saved: null }],
    [{ kind: "continue", ref: REF, shift: SHIFT, saved: null }],
    [
      {
        kind: "delivered",
        handoverId: "h1",
        ref: REF,
        shift: SHIFT,
        deliveredByName: "Ana Teste",
        deliveredAt: spDate("2026-11-20", "14:05"),
        confirmedByName: null,
        confirmedAt: null,
      },
    ],
    [
      {
        kind: "confirmed",
        handoverId: "h1",
        ref: REF,
        shift: SHIFT,
        deliveredByName: "Ana Teste",
        deliveredAt: spDate("2026-11-20", "14:05"),
        confirmedByName: "Bia Teste",
        confirmedAt: spDate("2026-11-20", "14:20"),
      },
    ],
  ] as const satisfies readonly (readonly [
    MyShiftState,
  ])[])("estado %# tem o link secundário 'Ver todas as passagens'", (state) => {
    renderCard(state);

    expect(
      screen.getByRole("link", { name: "Ver todas as passagens" }),
    ).toHaveAttribute("href", "/passagens");
  });

  it("sem turnos, operador: pede ao administrador e não mostra link", () => {
    renderCard({ kind: "no-shifts" });

    expect(screen.getByText("Nenhum turno neste setor.")).toBeInTheDocument();
    expect(
      screen.getByText(
        "Peça a um administrador para cadastrar os turnos do setor.",
      ),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: "Ir para Turnos" }),
    ).not.toBeInTheDocument();
  });

  it("sem turnos, admin: texto próprio e link para Turnos do setor", () => {
    renderCard({ kind: "no-shifts" }, { canManageCatalog: true });

    expect(
      screen.getByText("Cadastre os turnos do setor para começar a passagem."),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Ir para Turnos" }),
    ).toHaveAttribute("href", `/admin/turnos?setor=${SECTOR_ID}`);
  });

  it("o horário usa tabular-nums", () => {
    renderCard({ kind: "start", ref: REF, shift: SHIFT, saved: null });

    expect(screen.getByText("06:00–14:00")).toHaveClass("tabular-nums");
  });
});
