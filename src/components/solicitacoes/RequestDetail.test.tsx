import type { PGlite } from "@electric-sql/pglite";
import { render, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { db } from "@/db";
import { authzOf } from "../../../test/authz";
import { spDate } from "../../../test/clock";
import { resetDb } from "../../../test/db";
import {
  insertDestination,
  insertHandover,
  insertItem,
  insertRequest,
  insertRequestComment,
  insertRequestItem,
  insertSector,
  insertShift,
  insertUser,
} from "../../../test/fixtures";
import { RequestDetail } from "./RequestDetail";

const mocks = vi.hoisted(
  (): {
    requireUser: ReturnType<typeof vi.fn>;
    client: PGlite | undefined;
  } => ({ requireUser: vi.fn(), client: undefined }),
);

vi.mock("@/lib/auth/session", () => ({ requireUser: mocks.requireUser }));
vi.mock("@/db", async () => {
  const { createTestDb } = await import("../../../test/db");
  const { client, db } = await createTestDb();
  mocks.client = client;
  return { db };
});
vi.mock("@/app/(app)/solicitacoes/actions", () => ({
  moveRequestAction: vi.fn(),
  cancelRequestAction: vi.fn(),
  addCommentAction: vi.fn(),
  deleteCommentAction: vi.fn(),
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), back: vi.fn() }),
  notFound: () => {
    throw new Error("NEXT_NOT_FOUND");
  },
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

// 23/11/2026 14:30 em São Paulo. Só o Date é falso: o PGlite continua real.
const NOW = spDate("2026-11-23", "14:30");
const DAY = 86_400_000;
const NIL_ID = "00000000-0000-4000-8000-000000000000";

function inSheet(ui: ReactNode) {
  return render(
    <Sheet open>
      <SheetContent>{ui}</SheetContent>
    </Sheet>,
  );
}

async function seed() {
  const sector = await insertSector(db, "Setor Teste");
  const other = await insertSector(db, "Setor Outro");
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
  const cris = await insertUser(db, {
    role: "operator",
    sectorId: other.id,
    name: "Cris Teste",
  });
  const doca = await insertDestination(db, { name: "Doca 3" });
  return { sector, other, ana, bia, cris, doca };
}

function as(role: "operator" | "admin", sectorId: string, userId: string) {
  mocks.requireUser.mockResolvedValue(
    role === "admin"
      ? authzOf({ role: "admin", userId, name: "Admin Teste" })
      : authzOf({ role: "operator", sectorId, userId, name: "Ana Teste" }),
  );
}

async function page(id: string, commentsLimit = 50) {
  render(await RequestDetail({ id, variant: "page", commentsLimit }));
}

async function sheet(id: string, commentsLimit = 50) {
  inSheet(await RequestDetail({ id, variant: "sheet", commentsLimit }));
}

describe("RequestDetail", () => {
  beforeEach(async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(NOW);
    if (mocks.client) await resetDb(mocks.client);
    mocks.requireUser.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("página: h1 com o destino, descrição, propriedades e link para todas", async () => {
    const { sector, ana, doca } = await seed();
    const created = await insertRequest(db, {
      sectorId: sector.id,
      createdBy: ana.id,
      destinationId: doca.id,
      description: "Rolos para a doca\nurgente",
    });
    as("operator", sector.id, ana.id);

    await page(created.id);

    expect(
      screen.getByRole("heading", {
        level: 1,
        name: "Solicitação para Doca 3",
      }),
    ).toBeInTheDocument();
    expect(screen.getByText(/Rolos para a doca/)).toBeInTheDocument();
    expect(screen.getByText("Solicitada")).toBeInTheDocument();
    expect(screen.getByText("Doca 3")).toBeInTheDocument();
    expect(
      screen.getByText("Ana Teste em 20/11/2026 às 09:00"),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Ver todas as solicitações" }),
    ).toHaveAttribute("href", "/solicitacoes");
    expect(
      screen.queryByRole("link", { name: "Abrir página completa" }),
    ).toBeNull();
    // Operador não vê o setor.
    expect(screen.queryByText("Setor")).toBeNull();
  });

  it("página: 'Ver todas as solicitações' tem alvo de toque de 44px no celular e a classe do desktop continua (P12)", async () => {
    const { sector, ana, doca } = await seed();
    const created = await insertRequest(db, {
      sectorId: sector.id,
      createdBy: ana.id,
      destinationId: doca.id,
    });
    as("operator", sector.id, ana.id);

    await page(created.id);

    const link = screen.getByRole("link", {
      name: "Ver todas as solicitações",
    });
    expect(link).toHaveClass(
      "max-md:inline-flex",
      "max-md:min-h-11",
      "max-md:items-center",
    );
    expect(link).toHaveClass("w-fit", "text-sm", "underline");
  });

  it("página do admin: mostra o setor e o link leva ao setor da solicitação", async () => {
    const { sector, ana } = await seed();
    const created = await insertRequest(db, {
      sectorId: sector.id,
      createdBy: ana.id,
    });
    as("admin", sector.id, "admin-1");

    await page(created.id);

    expect(screen.getByText("Setor")).toBeInTheDocument();
    expect(screen.getByText("Setor Teste")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Ver todas as solicitações" }),
    ).toHaveAttribute("href", `/solicitacoes?setor=${sector.id}`);
  });

  it("Sheet: título no cabeçalho do Sheet e link <a> para a página completa", async () => {
    const { sector, ana, doca } = await seed();
    const created = await insertRequest(db, {
      sectorId: sector.id,
      createdBy: ana.id,
      destinationId: doca.id,
    });
    as("operator", sector.id, ana.id);

    await sheet(created.id);

    const dialog = screen.getByRole("dialog");
    expect(
      within(dialog).getByRole("heading", { name: "Solicitação para Doca 3" }),
    ).toBeInTheDocument();
    const open = within(dialog).getByRole("link", {
      name: "Abrir página completa",
    });
    expect(open).toHaveAttribute("href", `/solicitacoes/${created.id}`);
    expect(
      within(dialog).queryByRole("link", { name: "Ver todas as solicitações" }),
    ).toBeNull();
  });

  it("seções: h2 na página e h3 no Sheet", async () => {
    const { sector, ana } = await seed();
    const created = await insertRequest(db, {
      sectorId: sector.id,
      createdBy: ana.id,
    });
    as("operator", sector.id, ana.id);

    await page(created.id);
    for (const name of [
      "Itens",
      "Mudar status",
      "Linha do tempo",
      "Comentários",
    ]) {
      expect(
        screen.getByRole("heading", { level: 2, name }),
      ).toBeInTheDocument();
    }
  });

  it("seções no Sheet são h3", async () => {
    const { sector, ana } = await seed();
    const created = await insertRequest(db, {
      sectorId: sector.id,
      createdBy: ana.id,
    });
    as("operator", sector.id, ana.id);

    await sheet(created.id);

    for (const name of [
      "Itens",
      "Mudar status",
      "Linha do tempo",
      "Comentários",
    ]) {
      expect(
        screen.getByRole("heading", { level: 3, name }),
      ).toBeInTheDocument();
    }
  });

  it("destino digitado ('Outro') mostra o rótulo de outro destino", async () => {
    const { sector, ana } = await seed();
    const created = await insertRequest(db, {
      sectorId: sector.id,
      createdBy: ana.id,
      destinationOther: "Galpão Anexo",
    });
    as("operator", sector.id, ana.id);

    await page(created.id);

    expect(
      screen.getByRole("heading", {
        level: 1,
        name: "Solicitação para Galpão Anexo",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Galpão Anexo (outro destino)"),
    ).toBeInTheDocument();
  });

  it("id malformado e solicitação de outro setor: página dá notFound, Sheet mostra o estado", async () => {
    const { sector, other, ana, cris } = await seed();
    const foreign = await insertRequest(db, {
      sectorId: other.id,
      createdBy: cris.id,
    });
    as("operator", sector.id, ana.id);

    await expect(
      RequestDetail({ id: "nao-e-uuid", variant: "page", commentsLimit: 50 }),
    ).rejects.toThrow("NEXT_NOT_FOUND");
    await expect(
      RequestDetail({ id: foreign.id, variant: "page", commentsLimit: 50 }),
    ).rejects.toThrow("NEXT_NOT_FOUND");
    await expect(
      RequestDetail({ id: NIL_ID, variant: "page", commentsLimit: 50 }),
    ).rejects.toThrow("NEXT_NOT_FOUND");

    await sheet(foreign.id);

    expect(screen.getByText("Solicitação não encontrada.")).toBeInTheDocument();
    expect(
      screen.getByText("Ela não existe ou é de outro setor."),
    ).toBeInTheDocument();
    expect(screen.queryByText("Mudar status")).toBeNull();
  });

  it("origem: link para a passagem com o turno e o dia", async () => {
    const { sector, ana } = await seed();
    const morning = await insertShift(db, {
      sectorId: sector.id,
      name: "Turno Manhã",
    });
    const origin = await insertHandover(db, {
      sectorId: sector.id,
      shiftId: morning.id,
      operationalDate: "2026-11-20",
    });
    const created = await insertRequest(db, {
      sectorId: sector.id,
      createdBy: ana.id,
      originHandoverId: origin.id,
    });
    as("operator", sector.id, ana.id);

    await page(created.id);

    expect(
      screen.getByRole("link", {
        name: "Criada na passagem de Turno Manhã de 20/11/2026",
      }),
    ).toHaveAttribute("href", `/passagens/${origin.id}`);
  });

  it("sem origem a linha Origem não aparece", async () => {
    const { sector, ana } = await seed();
    const created = await insertRequest(db, {
      sectorId: sector.id,
      createdBy: ana.id,
    });
    as("operator", sector.id, ana.id);

    await page(created.id);

    expect(screen.queryByText("Origem")).toBeNull();
  });

  it("itens com quantidade e unidade", async () => {
    const { sector, ana } = await seed();
    const stock = await insertItem(db, {
      sectorId: sector.id,
      kind: "stock",
      name: "Rolo",
      unit: "rolos",
    });
    const withItems = await insertRequest(db, {
      sectorId: sector.id,
      createdBy: ana.id,
    });
    await insertRequestItem(db, {
      requestId: withItems.id,
      itemId: stock.id,
      quantity: 1200,
    });
    as("operator", sector.id, ana.id);

    await page(withItems.id);
    const row = screen.getByText("Rolo").closest("li");
    expect(row).not.toBeNull();
    expect(row).toHaveTextContent("1.200 rolos");
  });

  it("sem itens mostra 'Nenhum item.'", async () => {
    const { sector, ana } = await seed();
    const created = await insertRequest(db, {
      sectorId: sector.id,
      createdBy: ana.id,
    });
    as("operator", sector.id, ana.id);

    await page(created.id);

    expect(screen.getByText("Nenhum item.")).toBeInTheDocument();
  });

  it("parada: selo com os dias contados pelo relógio injetado", async () => {
    const { sector, ana } = await seed();
    const created = await insertRequest(db, {
      sectorId: sector.id,
      createdBy: ana.id,
      createdAt: new Date(NOW.getTime() - 5 * DAY),
    });
    as("operator", sector.id, ana.id);

    await page(created.id);

    expect(screen.getByText("Parada há 5 dias")).toBeInTheDocument();
  });

  it("Solicitada oferece os destinos de movimento e o cancelar", async () => {
    const { sector, ana } = await seed();
    const created = await insertRequest(db, {
      sectorId: sector.id,
      createdBy: ana.id,
    });
    as("operator", sector.id, ana.id);

    await page(created.id);

    for (const name of [
      "Mover para Em separação / Trânsito",
      "Mover para Entregue",
      "Cancelar solicitação",
    ]) {
      expect(screen.getByRole("button", { name })).toBeInTheDocument();
    }
    expect(
      screen.queryByRole("button", { name: "Mover para Solicitada" }),
    ).toBeNull();
  });

  it("Cancelada: linha do tempo com o motivo, comentário com o rótulo e sem Apagar, e reabre sem cancelar", async () => {
    const { sector, ana } = await seed();
    const created = await insertRequest(db, {
      sectorId: sector.id,
      createdBy: ana.id,
      status: "cancelled",
      cancelReason: "Pedido duplicado",
      createdAt: new Date(NOW.getTime() - 2 * DAY),
      statusChangedAt: new Date(NOW.getTime() - 1 * DAY),
    });
    as("operator", sector.id, ana.id);

    await page(created.id);

    expect(screen.getByText("Ana Teste cancelou")).toBeInTheDocument();
    expect(screen.getByText("Motivo: Pedido duplicado")).toBeInTheDocument();
    expect(screen.getByText("Motivo do cancelamento")).toBeInTheDocument();
    expect(screen.getByText("Pedido duplicado")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Apagar/ })).toBeNull();
    expect(
      screen.getByRole("button", { name: "Mover para Solicitada" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Cancelar solicitação" }),
    ).toBeNull();
  });

  it("Apagar só no próprio comentário; o de outra pessoa fica sem o botão", async () => {
    const { sector, ana, bia } = await seed();
    const created = await insertRequest(db, {
      sectorId: sector.id,
      createdBy: ana.id,
    });
    await insertRequestComment(db, {
      requestId: created.id,
      authorId: ana.id,
      body: "meu comentário",
    });
    await insertRequestComment(db, {
      requestId: created.id,
      authorId: bia.id,
      body: "comentário da Bia",
    });
    as("operator", sector.id, ana.id);

    await page(created.id);

    expect(
      screen.getByRole("heading", { level: 2, name: "Comentários (2)" }),
    ).toBeInTheDocument();
    expect(
      screen.getAllByRole("button", { name: /^Apagar comentário de/ }),
    ).toHaveLength(1);
    expect(screen.getByLabelText("Novo comentário")).toBeInTheDocument();
  });

  it("Ver comentários anteriores só com mais do que a janela, e sempre como <a>", async () => {
    const { sector, ana } = await seed();
    const created = await insertRequest(db, {
      sectorId: sector.id,
      createdBy: ana.id,
    });
    for (let index = 0; index < 51; index += 1) {
      await insertRequestComment(db, {
        requestId: created.id,
        authorId: ana.id,
        body: `Comentário ${String(index).padStart(2, "0")}`,
        createdAt: new Date(NOW.getTime() - (60 - index) * 60_000),
      });
    }
    as("operator", sector.id, ana.id);

    await page(created.id);

    expect(
      screen.getByRole("link", { name: "Ver comentários anteriores" }),
    ).toHaveAttribute("href", `/solicitacoes/${created.id}?comentarios=100`);
    expect(screen.queryByText("Comentário 00")).toBeNull();
    expect(screen.getByText("Comentário 01")).toBeInTheDocument();
  });

  it("com poucos comentários não há o link de anteriores", async () => {
    const { sector, ana } = await seed();
    const created = await insertRequest(db, {
      sectorId: sector.id,
      createdBy: ana.id,
    });
    await insertRequestComment(db, { requestId: created.id, authorId: ana.id });
    as("operator", sector.id, ana.id);

    await page(created.id);
    expect(
      screen.queryByRole("link", { name: "Ver comentários anteriores" }),
    ).toBeNull();
  });

  it("setor inativo: aviso, só leitura, sem Mudar status, sem compositor e sem Apagar", async () => {
    const sector = await insertSector(db, "Setor Parado", { active: false });
    const ana = await insertUser(db, {
      role: "operator",
      sectorId: sector.id,
      name: "Ana Teste",
    });
    const created = await insertRequest(db, {
      sectorId: sector.id,
      createdBy: ana.id,
    });
    await insertRequestComment(db, {
      requestId: created.id,
      authorId: ana.id,
      body: "meu comentário",
    });
    as("operator", sector.id, ana.id);

    await page(created.id);

    expect(screen.getByText("Setor inativo: só leitura.")).toBeInTheDocument();
    expect(
      screen.getByText("Peça a um administrador para reativá-lo."),
    ).toBeInTheDocument();
    expect(screen.queryByText("Mudar status")).toBeNull();
    expect(screen.queryByLabelText("Novo comentário")).toBeNull();
    expect(screen.queryByRole("button", { name: /Apagar/ })).toBeNull();
    expect(screen.getByText("meu comentário")).toBeInTheDocument();
  });

  it("o admin lê a solicitação de um setor inativo, só leitura", async () => {
    const sector = await insertSector(db, "Setor Parado", { active: false });
    const ana = await insertUser(db, {
      role: "operator",
      sectorId: sector.id,
    });
    const created = await insertRequest(db, {
      sectorId: sector.id,
      createdBy: ana.id,
    });
    as("admin", sector.id, "admin-1");

    await page(created.id);

    expect(screen.getByText("Setor inativo: só leitura.")).toBeInTheDocument();
    expect(screen.queryByText("Mudar status")).toBeNull();
  });
});
