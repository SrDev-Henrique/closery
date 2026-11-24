import type { PGlite } from "@electric-sql/pglite";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { db } from "@/db";
import { authzOf } from "../../../test/authz";
import { spDate } from "../../../test/clock";
import { resetDb } from "../../../test/db";
import {
  insertHandover,
  insertHandoverCorrection,
  insertSector,
  insertShift,
  insertUser,
} from "../../../test/fixtures";
import { HandoverHistory } from "./HandoverHistory";

const mocks = vi.hoisted(
  (): {
    requireUser: ReturnType<typeof vi.fn>;
    readRememberedSector: ReturnType<typeof vi.fn>;
    client: PGlite | undefined;
    push: ReturnType<typeof vi.fn>;
  } => ({
    requireUser: vi.fn(),
    readRememberedSector: vi.fn(),
    client: undefined,
    push: vi.fn(),
  }),
);

vi.mock("@/lib/auth/session", () => ({ requireUser: mocks.requireUser }));
vi.mock("@/features/handovers/sectorCookie", () => ({
  readRememberedSector: mocks.readRememberedSector,
}));
vi.mock("@/db", async () => {
  const { createTestDb } = await import("../../../test/db");
  const { client, db } = await createTestDb();
  mocks.client = client;
  return { db };
});
vi.mock("@/app/(app)/actions", () => ({ chooseSectorAction: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: mocks.push }) }));

// 21/11/2026 14:30 em São Paulo. Só o Date é falso: o PGlite continua real.
const NOW = spDate("2026-11-21", "14:30");
const LONG_AGO = new Date("2026-01-01T00:00:00Z");

async function renderHistory(search: Record<string, string> = {}) {
  render(await HandoverHistory({ searchParams: Promise.resolve(search) }));
}

async function seed() {
  const sector = await insertSector(db, "Setor Teste");
  const other = await insertSector(db, "Setor Outro");
  const morning = await insertShift(db, {
    sectorId: sector.id,
    name: "Turno Manhã",
    startsAt: "06:00",
    endsAt: "14:00",
    createdAt: LONG_AGO,
  });
  const otherShift = await insertShift(db, {
    sectorId: other.id,
    name: "Turno Outro",
    startsAt: "06:00",
    endsAt: "14:00",
    createdAt: LONG_AGO,
  });
  const ana = await insertUser(db, {
    role: "operator",
    sectorId: sector.id,
    name: "Ana Teste",
  });
  const bia = await insertUser(db, {
    role: "operator",
    sectorId: sector.id,
    name: "Bia Teste",
  });
  return { sector, other, morning, otherShift, ana, bia };
}

describe("HandoverHistory", () => {
  beforeEach(async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(NOW);
    if (mocks.client) await resetDb(mocks.client);
    mocks.requireUser.mockReset();
    mocks.push.mockReset();
    mocks.readRememberedSector.mockReset();
    mocks.readRememberedSector.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("operador: título, só o próprio setor, sem seletor, e cada situação com o selo certo", async () => {
    const { sector, morning, otherShift, other, ana, bia } = await seed();
    const confirmed = await insertHandover(db, {
      sectorId: sector.id,
      shiftId: morning.id,
      operationalDate: "2026-11-19",
      status: "confirmed",
      deliveredBy: ana.id,
      confirmedBy: bia.id,
      deliveredAt: new Date("2026-11-19T17:00:00Z"),
    });
    await insertHandoverCorrection(db, {
      handoverId: confirmed.id,
      field: "occurrences_text",
      correctedBy: bia.id,
    });
    await insertHandover(db, {
      sectorId: sector.id,
      shiftId: morning.id,
      operationalDate: "2026-11-20",
      status: "delivered",
      deliveredBy: ana.id,
      deliveredAt: new Date("2026-11-20T17:00:00Z"),
    });
    // Passagem de outro setor: nunca aparece para o operador.
    await insertHandover(db, {
      sectorId: other.id,
      shiftId: otherShift.id,
      operationalDate: "2026-11-20",
      status: "delivered",
      deliveredBy: ana.id,
    });
    mocks.requireUser.mockResolvedValue(
      authzOf({ role: "operator", sectorId: sector.id, userId: bia.id }),
    );

    await renderHistory({ setor: other.id });

    expect(
      screen.getByRole("heading", { level: 1, name: "Passagens" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "Histórico de passagens de turno, do dia mais recente ao mais antigo.",
      ),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("group", { name: "Setor" }),
    ).not.toBeInTheDocument();
    expect(screen.queryByText("Turno Outro")).not.toBeInTheDocument();
    expect(screen.getByText(/Período:/)).toHaveTextContent(
      "Período: 15/11/2026 a 21/11/2026",
    );

    const items = screen.getAllByRole("listitem");
    const text = items.map((item) => item.textContent ?? "");
    // 21/11 (sem passagem, encerrado às 14:00), 20/11 (a mais recente
    // entregue do setor: aguardando) e 19/11 (confirmada e corrigida).
    expect(text[0]).toContain("21/11/2026");
    expect(text[0]).toContain("Sem passagem");
    expect(text[1]).toContain("20/11/2026");
    expect(text[1]).toContain("Aguardando recebimento");
    expect(text[2]).toContain("19/11/2026");
    expect(text[2]).toContain("Confirmada por Bia Teste");
    expect(text[2]).toContain("Corrigida");
    expect(
      screen.getByRole("link", {
        name: "Entregar turno de Turno Manhã em 21/11/2026",
      }),
    ).toHaveAttribute(
      "href",
      `/passagens/nova?turno=${morning.id}&data=2026-11-21`,
    );
  });

  it("admin: seletor de setor com 'Todos os setores', e em 'todos' as linhas mostram o setor", async () => {
    const { sector, other, otherShift, ana } = await seed();
    await insertHandover(db, {
      sectorId: other.id,
      shiftId: otherShift.id,
      operationalDate: "2026-11-20",
      status: "delivered",
      deliveredBy: ana.id,
      deliveredAt: new Date("2026-11-20T17:00:00Z"),
    });
    mocks.requireUser.mockResolvedValue(authzOf({ role: "admin" }));

    await renderHistory({ setor: "todos", situacao: "aguardando" });

    const picker = screen.getByRole("group", { name: "Setor" });
    expect(
      within(picker).getByRole("button", { name: "Todos os setores" }),
    ).toHaveAttribute("aria-pressed", "true");
    expect(
      within(picker).getByRole("button", { name: sector.name }),
    ).toHaveAttribute("aria-pressed", "false");
    // Em "todos os setores" não há filtro de turno.
    expect(screen.queryByLabelText("Turno")).not.toBeInTheDocument();
    expect(screen.getByRole("listitem")).toHaveTextContent(
      "Setor Outro · Entregue por Ana Teste",
    );
  });

  it("admin com setor escolhido (cookie): filtra o setor e oferece os turnos dele", async () => {
    const { sector, other } = await seed();
    mocks.requireUser.mockResolvedValue(authzOf({ role: "admin" }));
    mocks.readRememberedSector.mockResolvedValue(other.id);

    await renderHistory({ situacao: "sem-passagem" });

    expect(
      within(screen.getByRole("group", { name: "Setor" })).getByRole("button", {
        name: other.name,
      }),
    ).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByLabelText("Turno")).toBeInTheDocument();
    expect(
      within(screen.getByLabelText("Turno")).getByRole("option", {
        name: "Turno Outro",
      }),
    ).toBeInTheDocument();
    expect(screen.queryByText("Turno Manhã")).not.toBeInTheDocument();
    expect(sector.id).not.toBe(other.id);
  });

  it("os controles dos filtros seguem a URL: 'Limpar filtros' e troca de setor não deixam estado velho", async () => {
    const { sector, other } = await seed();
    mocks.requireUser.mockResolvedValue(authzOf({ role: "admin" }));
    const first = await HandoverHistory({
      searchParams: Promise.resolve({ setor: sector.id, periodo: "30" }),
    });
    const { rerender } = render(first);
    expect(screen.getByLabelText("Período")).toHaveValue("30");

    // Mesma tela, URL sem filtros (Limpar filtros): os selects voltam ao padrão.
    rerender(
      await HandoverHistory({
        searchParams: Promise.resolve({ setor: sector.id }),
      }),
    );
    expect(screen.getByLabelText("Período")).toHaveValue("7");

    // Mesma tela, outro setor: o turno do setor novo, não o do antigo.
    rerender(
      await HandoverHistory({
        searchParams: Promise.resolve({ setor: other.id, periodo: "30" }),
      }),
    );
    expect(screen.getByLabelText("Período")).toHaveValue("30");
    rerender(
      await HandoverHistory({
        searchParams: Promise.resolve({ setor: other.id }),
      }),
    );
    expect(screen.getByLabelText("Período")).toHaveValue("7");
  });

  it("trocar de setor com um turno escolhido mostra os turnos do setor novo com 'Todos os turnos'", async () => {
    const { sector, other, morning, otherShift } = await seed();
    mocks.requireUser.mockResolvedValue(authzOf({ role: "admin" }));
    const { rerender } = render(
      await HandoverHistory({
        searchParams: Promise.resolve({ setor: sector.id, turno: morning.id }),
      }),
    );
    expect(screen.getByLabelText("Turno")).toHaveValue(morning.id);

    rerender(
      await HandoverHistory({
        searchParams: Promise.resolve({ setor: other.id }),
      }),
    );

    const next = screen.getByLabelText("Turno");
    expect(next).toHaveValue("all");
    expect(
      within(next).getByRole("option", { name: otherShift.name }),
    ).toBeInTheDocument();
    expect(
      within(next).queryByRole("option", { name: "Turno Manhã" }),
    ).not.toBeInTheDocument();
    // O estado não guarda o turno do setor antigo: aplicar não o leva na URL.
    await userEvent.click(
      screen.getByRole("button", { name: "Aplicar filtros" }),
    );
    expect(mocks.push).toHaveBeenCalledTimes(1);
    expect(String(mocks.push.mock.calls[0][0])).not.toContain("turno=");
  });

  it("sem nenhuma passagem no período: estado vazio com a dica", async () => {
    const { sector } = await seed();
    mocks.requireUser.mockResolvedValue(
      authzOf({ role: "operator", sectorId: sector.id }),
    );

    await renderHistory({ situacao: "corrigida" });

    expect(
      screen.getByText("Nenhuma passagem neste período."),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Mude o período ou os filtros para ver mais."),
    ).toBeInTheDocument();
    expect(screen.queryByRole("listitem")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("navigation", { name: "Paginação" }),
    ).not.toBeInTheDocument();
  });

  it("a filtragem de turno e de situação chega às linhas", async () => {
    const { sector, morning, ana } = await seed();
    const night = await insertShift(db, {
      sectorId: sector.id,
      name: "Turno Noite",
      startsAt: "22:00",
      endsAt: "06:00",
      createdAt: LONG_AGO,
    });
    await insertHandover(db, {
      sectorId: sector.id,
      shiftId: night.id,
      operationalDate: "2026-11-20",
      status: "delivered",
      deliveredBy: ana.id,
      deliveredAt: new Date("2026-11-21T09:00:00Z"),
    });
    mocks.requireUser.mockResolvedValue(
      authzOf({ role: "operator", sectorId: sector.id }),
    );

    await renderHistory({ turno: morning.id, situacao: "sem-passagem" });

    const items = screen.getAllByRole("listitem");
    expect(items.length).toBeGreaterThan(0);
    for (const item of items) {
      expect(item).toHaveTextContent("Turno Manhã");
      expect(item).toHaveTextContent("Sem passagem");
    }
  });

  it("paginação: 50 por página e os filtros e o setor seguem nos links", async () => {
    const { sector } = await seed();
    mocks.requireUser.mockResolvedValue(authzOf({ role: "admin" }));

    // 1 turno antigo × 93 dias (o máximo) = 93 linhas "sem passagem" (2 páginas).
    await renderHistory({
      setor: sector.id,
      periodo: "intervalo",
      de: "2026-08-21",
      ate: "2026-11-21",
      situacao: "sem-passagem",
    });

    expect(screen.getAllByRole("listitem")).toHaveLength(50);
    const nav = screen.getByRole("navigation", { name: "Paginação" });
    expect(within(nav).getByText("Página 1 de 2")).toBeInTheDocument();
    const href = within(nav).getByRole("link", { name: "Próxima" });
    const url = new URL(href.getAttribute("href") ?? "", "http://x");
    expect(url.pathname).toBe("/passagens");
    expect(Object.fromEntries(url.searchParams)).toEqual({
      periodo: "intervalo",
      de: "2026-08-21",
      ate: "2026-11-21",
      situacao: "sem-passagem",
      setor: sector.id,
      pagina: "2",
    });
  });

  it("página fora do intervalo é clampada: nunca lista vazia por engano", async () => {
    const { sector } = await seed();
    mocks.requireUser.mockResolvedValue(
      authzOf({ role: "operator", sectorId: sector.id }),
    );

    await renderHistory({ pagina: "99", periodo: "30" });

    expect(screen.getAllByRole("listitem").length).toBeGreaterThan(0);
  });

  it("operador com setor inativo vê o aviso e nenhuma lista", async () => {
    const parado = await insertSector(db, "Setor Parado", { active: false });
    mocks.requireUser.mockResolvedValue(
      authzOf({ role: "operator", sectorId: parado.id }),
    );

    await renderHistory();

    expect(screen.getByText("Seu setor está inativo.")).toBeInTheDocument();
    expect(screen.queryByRole("listitem")).not.toBeInTheDocument();
  });

  it("admin sem setor ativo vê o estado vazio com link para Setores", async () => {
    await insertSector(db, "Setor Parado", { active: false });
    mocks.requireUser.mockResolvedValue(authzOf({ role: "admin" }));

    await renderHistory();

    expect(screen.getByText("Nenhum setor ativo.")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Ir para Setores" }),
    ).toHaveAttribute("href", "/admin/setores");
  });
});
