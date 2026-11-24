import type { PGlite } from "@electric-sql/pglite";
import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { TooltipProvider } from "@/components/ui/tooltip";
import { db } from "@/db";
import { handover } from "@/db/schema/handovers";
import { authzOf } from "../../../test/authz";
import { spDate } from "../../../test/clock";
import { resetDb } from "../../../test/db";
import {
  insertHandover,
  insertHandoverItem,
  insertItem,
  insertSector,
  insertShift,
  insertUser,
} from "../../../test/fixtures";
import { NewHandover } from "./NewHandover";

const mocks = vi.hoisted(
  (): {
    requireUser: ReturnType<typeof vi.fn>;
    cookie: { value: string | undefined };
    client: PGlite | undefined;
  } => ({
    requireUser: vi.fn(),
    cookie: { value: undefined },
    client: undefined,
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
// redirect() e notFound() ficam de verdade (lançam); só o useRouter, que
// precisa do roteador montado, é trocado.
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
// O diálogo "Nova solicitação" do rascunho importa a action de criar.
vi.mock("@/app/(app)/solicitacoes/actions", () => ({
  createRequestAction: vi.fn(),
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
  const rede = await insertItem(db, {
    sectorId: uld.id,
    name: "Rede de proteção",
    unit: "rolo",
    kind: "control",
  });
  const fita = await insertItem(db, {
    sectorId: uld.id,
    name: "Fita adesiva",
    unit: "rolo",
    kind: "stock",
  });
  const ana = await insertUser(db, {
    role: "operator",
    sectorId: uld.id,
    name: "Ana Teste",
  });
  const bia = await insertUser(db, { role: "operator", sectorId: uld.id });
  return { uld, manha, rede, fita, ana, bia };
}

function asOperator(userId: string, sectorId: string) {
  mocks.requireUser.mockResolvedValue(
    authzOf({ role: "operator", userId, sectorId }),
  );
}

async function redirectDigest(promise: Promise<unknown>): Promise<string> {
  try {
    await promise;
  } catch (error) {
    if (error instanceof Error && "digest" in error) {
      return String(error.digest);
    }
    throw error;
  }
  throw new Error("devia redirecionar");
}

describe("NewHandover", () => {
  beforeEach(async () => {
    if (mocks.client) await resetDb(mocks.client);
    mocks.requireUser.mockReset();
    mocks.cookie.value = undefined;
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(spDate(TODAY, "10:00"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("sem sessão, propaga o redirect do requireUser", async () => {
    const redirectError = new Error("NEXT_REDIRECT");
    mocks.requireUser.mockRejectedValue(redirectError);

    await expect(
      NewHandover({ searchParams: Promise.resolve({}) }),
    ).rejects.toBe(redirectError);
  });

  it("abre o formulário do turno sugerido, em branco de verdade: 0 e textos vazios", async () => {
    const { uld, ana } = await setup();
    asOperator(ana.id, uld.id);

    await renderPage();

    expect(
      screen.getByRole("heading", { level: 1, name: "Passagem de turno" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "Registre o que aconteceu no turno. Tudo é salvo sozinho.",
      ),
    ).toBeInTheDocument();
    expect(screen.getByText("ULD")).toBeInTheDocument();
    expect(screen.getByLabelText("Turno")).toHaveDisplayValue(
      "Turno Manhã (06:00–14:00)",
    );
    expect(screen.getByLabelText("Data")).toHaveValue(TODAY);
    expect(
      screen.getByRole("textbox", { name: "Quantidade de Rede de proteção" }),
    ).toHaveValue("0");
    expect(
      screen.getByRole("textbox", { name: "Quantidade de Fita adesiva" }),
    ).toHaveValue("0");
    expect(screen.getByLabelText("Ocorrências do turno")).toHaveValue("");
    expect(
      screen.getByRole("button", { name: "Entregar turno" }),
    ).toBeInTheDocument();
  });

  it("GET nunca escreve: abrir e recarregar não criam rascunho", async () => {
    const { uld, ana } = await setup();
    asOperator(ana.id, uld.id);

    await renderPage();
    await renderPage();

    expect(await db.select().from(handover)).toEqual([]);
  });

  it("não mostra item inativo", async () => {
    const { uld, ana } = await setup();
    await insertItem(db, {
      sectorId: uld.id,
      name: "Item velho",
      active: false,
    });
    asOperator(ana.id, uld.id);

    await renderPage();

    expect(screen.queryByText("Item velho")).not.toBeInTheDocument();
  });

  it("rascunho existente volta com o que foi salvo", async () => {
    const { uld, manha, rede, ana } = await setup();
    const draft = await insertHandover(db, {
      sectorId: uld.id,
      shiftId: manha.id,
      operationalDate: TODAY,
      occurrencesText: "Rede rasgada.",
      nextShiftText: "Conferir o box 4.",
      updatedBy: ana.id,
    });
    await insertHandoverItem(db, {
      handoverId: draft.id,
      itemId: rede.id,
      quantity: 6,
      note: "box 4",
    });
    asOperator(ana.id, uld.id);

    await renderPage();

    expect(
      screen.getByRole("textbox", { name: "Quantidade de Rede de proteção" }),
    ).toHaveValue("6");
    expect(screen.getByLabelText("Observação de Rede de proteção")).toHaveValue(
      "box 4",
    );
    expect(screen.getByLabelText("Ocorrências do turno")).toHaveValue(
      "Rede rasgada.",
    );
    expect(screen.getByLabelText("Fica para o próximo turno")).toHaveValue(
      "Conferir o box 4.",
    );
    expect(
      screen.getByText(/Último salvamento às .* por Ana Teste/),
    ).toBeInTheDocument();
  });

  it("turno e data da URL valem quando são válidos", async () => {
    const { uld, ana } = await setup();
    const tarde = await insertShift(db, {
      sectorId: uld.id,
      name: "Turno Tarde",
      startsAt: "14:00",
      endsAt: "22:00",
    });
    asOperator(ana.id, uld.id);

    await renderPage({ turno: tarde.id, data: "2026-11-19" });

    expect(screen.getByLabelText("Turno")).toHaveDisplayValue(
      "Turno Tarde (14:00–22:00)",
    );
    expect(screen.getByLabelText("Data")).toHaveValue("2026-11-19");
  });

  it.each([
    ["data futura", { data: "2026-11-21" }],
    ["data de 32 dias atrás", { data: "2026-10-19" }],
    ["data impossível", { data: "2026-02-30" }],
    ["só a data, sem o turno", { data: "2026-11-19" }],
  ])("%s: volta à sugestão", async (_name, extra) => {
    const { uld, manha, ana } = await setup();
    asOperator(ana.id, uld.id);

    await renderPage(extra);

    expect(screen.getByLabelText("Turno")).toHaveValue(manha.id);
    expect(screen.getByLabelText("Data")).toHaveValue(TODAY);
  });

  it("turno de outro setor na URL é ignorado (volta à sugestão)", async () => {
    const { uld, manha, ana } = await setup();
    const carga = await insertSector(db, "Carga");
    const alheio = await insertShift(db, { sectorId: carga.id });
    asOperator(ana.id, uld.id);

    await renderPage({ turno: alheio.id, data: TODAY });

    expect(screen.getByLabelText("Turno")).toHaveValue(manha.id);
  });

  it("turno inativo na URL é ignorado", async () => {
    const { uld, manha, ana } = await setup();
    const velho = await insertShift(db, { sectorId: uld.id, active: false });
    asOperator(ana.id, uld.id);

    await renderPage({ turno: velho.id, data: TODAY });

    expect(screen.getByLabelText("Turno")).toHaveValue(manha.id);
  });

  it("operador não vê o seletor de setor e ?setor= de outro setor não vale", async () => {
    const { uld, ana } = await setup();
    const carga = await insertSector(db, "Carga");
    await insertShift(db, { sectorId: carga.id, name: "Turno Carga" });
    asOperator(ana.id, uld.id);

    await renderPage({ setor: carga.id });

    expect(
      screen.queryByRole("group", { name: "Setor" }),
    ).not.toBeInTheDocument();
    expect(screen.getByText("ULD")).toBeInTheDocument();
    expect(
      screen.queryByText("Turno Carga", { exact: false }),
    ).not.toBeInTheDocument();
  });

  it.each([
    "delivered",
    "confirmed",
  ] as const)("combinação já %s: redireciona para o resumo", async (status) => {
    const { uld, manha, ana, bia } = await setup();
    const row = await insertHandover(db, {
      sectorId: uld.id,
      shiftId: manha.id,
      operationalDate: TODAY,
      status,
      deliveredBy: ana.id,
      confirmedBy: status === "confirmed" ? bia.id : undefined,
    });
    asOperator(bia.id, uld.id);

    const digest = await redirectDigest(
      NewHandover({ searchParams: Promise.resolve({}) }),
    );

    expect(digest).toContain(`/passagens/${row.id}`);
  });

  it("setor sem turnos: operador vê o pedido ao administrador", async () => {
    const uld = await insertSector(db, "ULD");
    const ana = await insertUser(db, { role: "operator", sectorId: uld.id });
    asOperator(ana.id, uld.id);

    await renderPage();

    expect(screen.getByText("Nenhum turno neste setor.")).toBeInTheDocument();
    expect(
      screen.getByText(
        "Peça a um administrador para cadastrar os turnos do setor.",
      ),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Entregar turno" }),
    ).not.toBeInTheDocument();
  });

  it("operador de setor inativo vê o aviso", async () => {
    const parado = await insertSector(db, "Parado", { active: false });
    const ana = await insertUser(db, { role: "operator", sectorId: parado.id });
    asOperator(ana.id, parado.id);

    await renderPage();

    expect(screen.getByText("Seu setor está inativo.")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Entregar turno" }),
    ).not.toBeInTheDocument();
  });

  it("admin: seletor de setor e o setor vai na URL das trocas", async () => {
    const { uld } = await setup();
    mocks.requireUser.mockResolvedValue(authzOf({ role: "admin" }));

    await renderPage({ setor: uld.id });

    expect(screen.getByRole("group", { name: "Setor" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "ULD" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByLabelText("Turno")).toHaveDisplayValue(
      "Turno Manhã (06:00–14:00)",
    );
  });

  it("admin: o cookie escolhe o setor quando a URL não diz", async () => {
    await setup();
    const carga = await insertSector(db, "Carga");
    await insertShift(db, { sectorId: carga.id, name: "Turno Carga" });
    mocks.cookie.value = carga.id;
    mocks.requireUser.mockResolvedValue(authzOf({ role: "admin" }));

    await renderPage();

    expect(screen.getByRole("button", { name: "Carga" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByLabelText("Turno")).toHaveDisplayValue(/Turno Carga/);
  });

  it("admin: setor sem turnos tem link para Turnos", async () => {
    const vazio = await insertSector(db, "Vazio");
    mocks.requireUser.mockResolvedValue(authzOf({ role: "admin" }));

    await renderPage({ setor: vazio.id });

    expect(
      screen.getByRole("link", { name: "Ir para Turnos" }),
    ).toHaveAttribute("href", `/admin/turnos?setor=${vazio.id}`);
  });

  it("admin sem setor ativo: estado vazio com link para Setores", async () => {
    await insertSector(db, "Parado", { active: false });
    mocks.requireUser.mockResolvedValue(authzOf({ role: "admin" }));

    await renderPage();

    expect(screen.getByText("Nenhum setor ativo.")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Ir para Setores" }),
    ).toHaveAttribute("href", "/admin/setores");
  });
});
