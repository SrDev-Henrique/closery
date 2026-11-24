import type { PGlite } from "@electric-sql/pglite";
import { render, screen, within } from "@testing-library/react";
import { count } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { TooltipProvider } from "@/components/ui/tooltip";
import { db } from "@/db";
import { handover } from "@/db/schema/handovers";
import { request } from "@/db/schema/requests";
import { authzOf } from "../../../test/authz";
import { spDate } from "../../../test/clock";
import { resetDb } from "../../../test/db";
import {
  insertDestination,
  insertHandover,
  insertItem,
  insertRequest,
  insertSector,
  insertShift,
  insertUser,
} from "../../../test/fixtures";
import { NewHandover } from "./NewHandover";

// A seção "Solicitações abertas" do formulário do rascunho (F4-13). O diálogo
// de criação é trocado por um espião: o que importa aqui é o que NewHandover
// entrega a ele (setor, escolhas e a tripla da passagem); o diálogo em si tem
// os testes dele.
const mocks = vi.hoisted(
  (): {
    requireUser: ReturnType<typeof vi.fn>;
    cookie: { value: string | undefined };
    client: PGlite | undefined;
    dialogProps: unknown[];
  } => ({
    requireUser: vi.fn(),
    cookie: { value: undefined },
    client: undefined,
    dialogProps: [],
  }),
);

vi.mock("@/lib/auth/session", () => ({ requireUser: mocks.requireUser }));
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) =>
      name === "closery_setor" && mocks.cookie.value !== undefined
        ? { name, value: mocks.cookie.value }
        : undefined,
  }),
}));
vi.mock("next/navigation", async () => ({
  ...(await vi.importActual<typeof import("next/navigation")>(
    "next/navigation",
  )),
  useRouter: () => ({ push: vi.fn() }),
}));
vi.mock("@/app/(app)/actions", () => ({ chooseSectorAction: vi.fn() }));
vi.mock("@/app/(app)/passagens/actions", () => ({
  saveHandoverFieldAction: vi.fn(),
  deliverHandoverAction: vi.fn(),
}));
vi.mock("@/components/solicitacoes/NewRequestDialog", () => ({
  NewRequestDialog: (props: unknown) => {
    mocks.dialogProps.push(props);
    return <button type="button">Nova solicitação</button>;
  },
}));
vi.mock("@/db", async () => {
  const { createTestDb } = await import("../../../test/db");
  const { client, db } = await createTestDb();
  mocks.client = client;
  return { db };
});

const TODAY = "2026-11-20";

async function renderPage(search: Record<string, string> = {}) {
  render(
    <TooltipProvider>
      {await NewHandover({ searchParams: Promise.resolve(search) })}
    </TooltipProvider>,
  );
}

async function setup() {
  const uld = await insertSector(db, "ULD");
  const manha = await insertShift(db, {
    sectorId: uld.id,
    name: "Turno Manhã",
    startsAt: "06:00",
    endsAt: "14:00",
  });
  const fita = await insertItem(db, {
    sectorId: uld.id,
    name: "Fita adesiva",
    unit: "rolo",
    kind: "stock",
  });
  const rede = await insertItem(db, {
    sectorId: uld.id,
    name: "Rede de proteção",
    unit: "rolo",
    kind: "control",
  });
  const doca = await insertDestination(db, { name: "Doca 3" });
  const ana = await insertUser(db, {
    role: "operator",
    sectorId: uld.id,
    name: "Ana Teste",
  });
  return { uld, manha, fita, rede, doca, ana };
}

function asOperator(userId: string, sectorId: string) {
  mocks.requireUser.mockResolvedValue(
    authzOf({ role: "operator", userId, sectorId }),
  );
}

function lastDialogProps(): Record<string, unknown> {
  const props = mocks.dialogProps.at(-1);
  if (typeof props !== "object" || props === null) {
    throw new Error("o diálogo de nova solicitação não foi renderizado");
  }
  return Object.fromEntries(Object.entries(props));
}

describe("NewHandover: seção Solicitações abertas", () => {
  beforeEach(async () => {
    if (mocks.client) await resetDb(mocks.client);
    mocks.requireUser.mockReset();
    mocks.cookie.value = undefined;
    mocks.dialogProps.length = 0;
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(spDate(TODAY, "10:00"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("fica entre Estoque e Ocorrências do turno, com título, ajuda e atalhos", async () => {
    const { uld, ana } = await setup();
    asOperator(ana.id, uld.id);

    await renderPage();

    const heading = screen.getByRole("heading", {
      level: 2,
      name: "Solicitações abertas",
    });
    expect(
      screen.getByText(
        "Do setor, agora. As paradas há mais tempo aparecem primeiro.",
      ),
    ).toBeInTheDocument();
    const stock = screen.getByRole("heading", { name: "Estoque" });
    const occurrences = screen.getByLabelText("Ocorrências do turno");
    expect(
      stock.compareDocumentPosition(heading) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(
      heading.compareDocumentPosition(occurrences) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(screen.getByText("Nenhuma solicitação aberta.")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Ver todas as solicitações" }),
    ).toHaveAttribute("href", "/solicitacoes");
    expect(
      screen.getByRole("button", { name: "Nova solicitação" }),
    ).toBeInTheDocument();
  });

  it("lista as abertas de agora, a mais antiga no status primeiro, e só as do setor", async () => {
    const { uld, ana, doca } = await setup();
    const carga = await insertSector(db, "Carga");
    await insertRequest(db, {
      sectorId: uld.id,
      createdBy: ana.id,
      destinationId: doca.id,
      description: "Mais nova",
      createdAt: spDate("2026-11-19", "09:00"),
    });
    await insertRequest(db, {
      sectorId: uld.id,
      createdBy: ana.id,
      destinationOther: "Hangar 2",
      description: "Mais antiga",
      createdAt: spDate("2026-11-18", "09:00"),
      status: "in_transit",
      statusChangedAt: spDate("2026-11-18", "10:00"),
    });
    await insertRequest(db, {
      sectorId: uld.id,
      createdBy: ana.id,
      description: "Já entregue",
      status: "delivered",
      createdAt: spDate("2026-11-17", "09:00"),
      statusChangedAt: spDate("2026-11-17", "11:00"),
    });
    await insertRequest(db, {
      sectorId: uld.id,
      createdBy: ana.id,
      description: "Cancelada",
      status: "cancelled",
      createdAt: spDate("2026-11-17", "09:00"),
      statusChangedAt: spDate("2026-11-17", "11:00"),
    });
    await insertRequest(db, {
      sectorId: carga.id,
      createdBy: ana.id,
      description: "De outro setor",
    });
    asOperator(ana.id, uld.id);

    await renderPage();

    const section = screen
      .getByRole("heading", { name: "Solicitações abertas" })
      .closest("section");
    if (!section) throw new Error("seção não encontrada");
    const items = within(section).getAllByRole("listitem");
    expect(items).toHaveLength(2);
    expect(items[0]).toHaveTextContent("Mais antiga");
    expect(items[0]).toHaveTextContent("Para Hangar 2");
    expect(items[0]).toHaveTextContent("Em separação / Trânsito");
    expect(items[1]).toHaveTextContent("Mais nova");
    expect(items[1]).toHaveTextContent("Para Doca 3");
    expect(screen.queryByText("Já entregue")).not.toBeInTheDocument();
    expect(screen.queryByText("Cancelada")).not.toBeInTheDocument();
    expect(screen.queryByText("De outro setor")).not.toBeInTheDocument();
  });

  it("a parada de agora tem o selo com os dias (relógio de São Paulo)", async () => {
    const { uld, ana } = await setup();
    await insertRequest(db, {
      sectorId: uld.id,
      createdBy: ana.id,
      description: "Esquecida",
      createdAt: spDate("2026-11-16", "09:00"),
    });
    await insertRequest(db, {
      sectorId: uld.id,
      createdBy: ana.id,
      description: "Recente",
      createdAt: spDate("2026-11-19", "09:00"),
    });
    asOperator(ana.id, uld.id);

    await renderPage();

    expect(screen.getAllByText(/^Parada há /)).toHaveLength(1);
    expect(screen.getByText("Parada há 4 dias")).toBeInTheDocument();
  });

  it("com 21 abertas mostra 20 e 'Mostrando 20 de 21.'", async () => {
    const { uld, ana } = await setup();
    for (let index = 0; index < 21; index += 1) {
      await insertRequest(db, {
        sectorId: uld.id,
        createdBy: ana.id,
        description: `Pedido ${index}`,
        createdAt: spDate("2026-11-19", "09:00"),
      });
    }
    asOperator(ana.id, uld.id);

    await renderPage();

    const section = screen
      .getByRole("heading", { name: "Solicitações abertas" })
      .closest("section");
    if (!section) throw new Error("seção não encontrada");
    expect(within(section).getAllByRole("listitem")).toHaveLength(20);
    expect(screen.getByText("Mostrando 20 de 21.")).toBeInTheDocument();
  });

  it("'Nova solicitação' recebe o setor, as escolhas e a tripla da passagem como originRef", async () => {
    const { uld, manha, fita, doca, ana } = await setup();
    asOperator(ana.id, uld.id);

    await renderPage();

    expect(lastDialogProps()).toMatchObject({
      sectors: null,
      initialSectorId: uld.id,
      triggerVariant: "outline",
      originRef: {
        sectorId: uld.id,
        shiftId: manha.id,
        operationalDate: TODAY,
      },
      choices: {
        destinations: [{ id: doca.id, name: "Doca 3" }],
        bySector: {
          [uld.id]: {
            stockItems: [{ id: fita.id, name: "Fita adesiva", unit: "rolo" }],
            defaultDestinationId: doca.id,
          },
        },
      },
    });
  });

  it("o originRef acompanha o turno e o dia da URL", async () => {
    const { uld, ana } = await setup();
    const tarde = await insertShift(db, {
      sectorId: uld.id,
      name: "Turno Tarde",
      startsAt: "14:00",
      endsAt: "22:00",
    });
    asOperator(ana.id, uld.id);

    await renderPage({ turno: tarde.id, data: "2026-11-19" });

    expect(lastDialogProps()).toMatchObject({
      originRef: {
        sectorId: uld.id,
        shiftId: tarde.id,
        operationalDate: "2026-11-19",
      },
    });
  });

  it("operador: 'Ver todas as solicitações' não leva ?setor=", async () => {
    const { uld, ana } = await setup();
    asOperator(ana.id, uld.id);

    await renderPage({ setor: "qualquer" });

    expect(
      screen.getByRole("link", { name: "Ver todas as solicitações" }),
    ).toHaveAttribute("href", "/solicitacoes");
  });

  it("admin: 'Ver todas as solicitações' leva ?setor= e o diálogo usa o setor escolhido", async () => {
    const { uld } = await setup();
    mocks.requireUser.mockResolvedValue(authzOf({ role: "admin" }));

    await renderPage({ setor: uld.id });

    expect(
      screen.getByRole("link", { name: "Ver todas as solicitações" }),
    ).toHaveAttribute("href", `/solicitacoes?setor=${uld.id}`);
    expect(lastDialogProps()).toMatchObject({
      sectors: null,
      initialSectorId: uld.id,
    });
  });

  it("GET nunca escreve: a seção e o diálogo não criam passagem nem solicitação", async () => {
    const { uld, ana } = await setup();
    await insertRequest(db, { sectorId: uld.id, createdBy: ana.id });
    asOperator(ana.id, uld.id);

    await renderPage();

    const [handovers] = await db.select({ total: count() }).from(handover);
    const [requests] = await db.select({ total: count() }).from(request);
    expect(handovers?.total).toBe(0);
    expect(requests?.total).toBe(1);
  });

  it("setor sem itens de estoque: a seção aparece e as escolhas vêm sem itens", async () => {
    const uld = await insertSector(db, "ULD");
    await insertShift(db, { sectorId: uld.id, name: "Turno Manhã" });
    const ana = await insertUser(db, { role: "operator", sectorId: uld.id });
    asOperator(ana.id, uld.id);

    await renderPage();

    expect(
      screen.getByRole("heading", { name: "Solicitações abertas" }),
    ).toBeInTheDocument();
    expect(lastDialogProps()).toMatchObject({
      choices: {
        destinations: [],
        bySector: { [uld.id]: { stockItems: [], defaultDestinationId: null } },
      },
    });
  });

  it("setor inativo não mostra a seção nem monta o diálogo", async () => {
    const parado = await insertSector(db, "Parado", { active: false });
    const ana = await insertUser(db, { role: "operator", sectorId: parado.id });
    asOperator(ana.id, parado.id);

    await renderPage();

    expect(screen.getByText("Seu setor está inativo.")).toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: "Solicitações abertas" }),
    ).not.toBeInTheDocument();
    expect(mocks.dialogProps).toHaveLength(0);
  });

  it("passagem entregue redireciona e nunca mostra a seção do formulário", async () => {
    const { uld, manha, ana } = await setup();
    const bia = await insertUser(db, { role: "operator", sectorId: uld.id });
    await insertHandover(db, {
      sectorId: uld.id,
      shiftId: manha.id,
      operationalDate: TODAY,
      status: "delivered",
      deliveredBy: ana.id,
    });
    asOperator(bia.id, uld.id);

    await expect(
      NewHandover({ searchParams: Promise.resolve({}) }),
    ).rejects.toMatchObject({
      digest: expect.stringContaining("NEXT_REDIRECT"),
    });
    expect(mocks.dialogProps).toHaveLength(0);
  });
});
