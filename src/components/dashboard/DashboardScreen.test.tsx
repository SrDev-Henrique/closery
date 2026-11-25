import type { PGlite } from "@electric-sql/pglite";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  Children,
  isValidElement,
  type ReactElement,
  type ReactNode,
  Suspense,
} from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { db } from "@/db";
import type { Authz } from "@/features/authz/authz";
import type { DashboardScope } from "@/features/dashboard/types";
import { authzOf } from "../../../test/authz";
import { spDate } from "../../../test/clock";
import { resetDb } from "../../../test/db";
import { deactivateSector, insertSector } from "../../../test/fixtures";
import { DashboardBlockBoundary } from "./DashboardBlockBoundary";
import { DashboardBlockSkeleton } from "./DashboardBlockSkeleton";
import { DashboardScreen } from "./DashboardScreen";

const mocks = vi.hoisted(
  (): {
    requireUser: ReturnType<typeof vi.fn>;
    readRememberedSector: ReturnType<typeof vi.fn>;
    chooseSectorAction: ReturnType<typeof vi.fn>;
    push: ReturnType<typeof vi.fn>;
    received: Map<string, BlockProps>;
    client: PGlite | undefined;
  } => ({
    requireUser: vi.fn(),
    readRememberedSector: vi.fn(),
    chooseSectorAction: vi.fn(),
    push: vi.fn(),
    received: new Map(),
    client: undefined,
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
vi.mock("@/app/(app)/actions", () => ({
  chooseSectorAction: mocks.chooseSectorAction,
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: mocks.push }) }));

// Os quatro blocos são async e têm testes próprios: aqui só mostram as props
// que a tela lhes passa (e guardam as props em `mocks.received`, para o teste
// ler o escopo tipado, sem cast).
type BlockProps = { actor: Authz; scope: DashboardScope; now?: Date };

function probe(testId: string) {
  return function Probe(props: BlockProps) {
    mocks.received.set(testId, props);
    return (
      <div
        data-testid={testId}
        data-actor={props.actor.userId}
        data-now={props.now?.toISOString() ?? ""}
      />
    );
  };
}

vi.mock("@/components/dashboard/DashboardPassages", () => ({
  DashboardPassages: probe("bloco-passagens"),
}));
vi.mock("@/components/dashboard/DashboardControls", () => ({
  DashboardControls: probe("bloco-controles"),
}));
vi.mock("@/components/dashboard/DashboardStock", () => ({
  DashboardStock: probe("bloco-estoque"),
}));
vi.mock("@/components/dashboard/DashboardRequests", () => ({
  DashboardRequests: probe("bloco-solicitacoes"),
}));

// 20/11/2026 15:00 em São Paulo. Só o Date é falso: o PGlite continua real.
const NOW = spDate("2026-11-20", "15:00");
const TITLES = ["Passagens", "Controles", "Estoque", "Solicitações"] as const;

async function renderScreen(search: Record<string, string> = {}) {
  render(await DashboardScreen({ searchParams: Promise.resolve(search) }));
}

function scopeOf(testId: string): DashboardScope {
  const props = mocks.received.get(testId);
  if (!props) throw new Error(`o bloco ${testId} não foi renderizado`);
  return props.scope;
}

type BoundaryProps = { title: string; children: ReactNode };
type SuspenseProps = { fallback: ReactElement<{ title: string }> };

function isBoundary(node: ReactNode): node is ReactElement<BoundaryProps> {
  return isValidElement(node) && node.type === DashboardBlockBoundary;
}

function isSuspense(node: ReactNode): node is ReactElement<SuspenseProps> {
  return isValidElement(node) && node.type === Suspense;
}

// Os limites de erro na árvore que a tela devolve (antes de renderizar).
function findBoundaries(node: ReactNode): ReactElement<BoundaryProps>[] {
  const found: ReactElement<BoundaryProps>[] = [];
  Children.forEach(node, (child) => {
    if (isBoundary(child)) found.push(child);
    if (isValidElement<{ children?: ReactNode }>(child)) {
      found.push(...findBoundaries(child.props.children));
    }
  });
  return found;
}

async function seed() {
  const uld = await insertSector(db, "ULD Teste");
  const camara = await insertSector(db, "Câmara Teste");
  return { uld, camara };
}

describe("DashboardScreen", () => {
  beforeEach(async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(NOW);
    if (mocks.client) await resetDb(mocks.client);
    mocks.received.clear();
    mocks.requireUser.mockReset();
    mocks.push.mockReset();
    mocks.chooseSectorAction.mockReset();
    mocks.chooseSectorAction.mockResolvedValue({ ok: true });
    mocks.readRememberedSector.mockReset();
    mocks.readRememberedSector.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("operador: título, rótulo do período, exportar sem setor, os quatro blocos na ordem e nenhum seletor de setor", async () => {
    const { uld, camara } = await seed();
    const ana = authzOf({ role: "operator", sectorId: uld.id, userId: "ana" });
    mocks.requireUser.mockResolvedValue(ana);

    // ?setor= de outro setor: ignorado, o operador vê o próprio.
    await renderScreen({ setor: camara.id });

    expect(
      screen.getByRole("heading", { level: 1, name: "Dashboard" }),
    ).toBeInTheDocument();
    expect(screen.getByText("últimos 7 dias · 14–20 nov")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Exportar CSV" })).toHaveAttribute(
      "href",
      "/api/dashboard/export",
    );
    expect(
      screen.queryByRole("group", { name: "Setor" }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("navigation", { name: "Período" }),
    ).toBeInTheDocument();
    const order = screen
      .getAllByTestId(/^bloco-/)
      .map((block) => block.getAttribute("data-testid"));
    expect(order).toEqual([
      "bloco-passagens",
      "bloco-controles",
      "bloco-estoque",
      "bloco-solicitacoes",
    ]);
    const scope = scopeOf("bloco-passagens");
    expect(scope.sectorId).toBe(uld.id);
    expect(scope.sectorName).toBe("ULD Teste");
    expect(scope.sectorParam).toBeNull();
    expect(scope.showSector).toBe(false);
    expect(scope.today).toBe("2026-11-20");
    expect(scope.days).toBe(7);
    expect(scope.period).toEqual({
      period: "7",
      from: "2026-11-14",
      to: "2026-11-20",
    });
    expect(scope.previous).toEqual({ from: "2026-11-07", to: "2026-11-13" });
    expect(screen.getByTestId("bloco-passagens")).toHaveAttribute(
      "data-actor",
      "ana",
    );
    expect(screen.getByTestId("bloco-passagens")).toHaveAttribute(
      "data-now",
      NOW.toISOString(),
    );
    expect(screen.getByTestId("bloco-controles")).toHaveAttribute(
      "data-now",
      "",
    );
    expect(screen.getByTestId("bloco-solicitacoes")).toHaveAttribute(
      "data-now",
      NOW.toISOString(),
    );
  });

  it("admin: seletor com Todos os setores, setor do cookie ou o primeiro, e o exportar leva o setor", async () => {
    const { uld, camara } = await seed();
    mocks.requireUser.mockResolvedValue(authzOf({ role: "admin" }));
    mocks.readRememberedSector.mockResolvedValue(uld.id);

    await renderScreen();

    const picker = screen.getByRole("group", { name: "Setor" });
    expect(
      within(picker).getByRole("button", { name: "ULD Teste" }),
    ).toHaveAttribute("aria-pressed", "true");
    expect(
      within(picker).getByRole("button", { name: "Câmara Teste" }),
    ).toHaveAttribute("aria-pressed", "false");
    expect(
      within(picker).getByRole("button", { name: "Todos os setores" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Exportar CSV" })).toHaveAttribute(
      "href",
      `/api/dashboard/export?setor=${uld.id}`,
    );
    expect(scopeOf("bloco-controles").sectorParam).toBe(uld.id);
    expect(scopeOf("bloco-controles").sectorId).toBe(uld.id);
    expect(camara.id).not.toBe(uld.id);
  });

  it("admin sem cookie nem ?setor= cai no primeiro setor ativo (nunca em Todos os setores)", async () => {
    const { camara } = await seed();
    mocks.requireUser.mockResolvedValue(authzOf({ role: "admin" }));

    await renderScreen();

    // Ordem por nome: "Câmara Teste" vem antes de "ULD Teste".
    expect(scopeOf("bloco-passagens").sectorId).toBe(camara.id);
    expect(scopeOf("bloco-passagens").showSector).toBe(false);
  });

  it("admin em Todos os setores com 30 dias: showSector, sem setor no escopo e o período em tudo", async () => {
    await seed();
    mocks.requireUser.mockResolvedValue(authzOf({ role: "admin" }));

    await renderScreen({ setor: "todos", periodo: "30" });

    const scope = scopeOf("bloco-estoque");
    expect(scope.sectorId).toBeNull();
    expect(scope.sectorName).toBeNull();
    expect(scope.sectorParam).toBe("todos");
    expect(scope.showSector).toBe(true);
    expect(scope.days).toBe(30);
    expect(scope.period.period).toBe("30");
    expect(
      screen.getByText("últimos 30 dias · 22 out – 20 nov"),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Exportar CSV" })).toHaveAttribute(
      "href",
      "/api/dashboard/export?periodo=30&setor=todos",
    );
    expect(
      screen.getByRole("button", { name: "Todos os setores" }),
    ).toHaveAttribute("aria-pressed", "true");
  });

  it("intervalo: o rótulo mostra só as datas e o formulário do intervalo já vem aberto", async () => {
    const { uld } = await seed();
    mocks.requireUser.mockResolvedValue(
      authzOf({ role: "operator", sectorId: uld.id }),
    );

    await renderScreen({
      periodo: "intervalo",
      de: "2026-11-01",
      ate: "2026-11-05",
    });

    expect(screen.getByText("1–5 nov")).toBeInTheDocument();
    expect(
      screen.getByRole("form", { name: "Intervalo do período" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Exportar CSV" })).toHaveAttribute(
      "href",
      "/api/dashboard/export?periodo=intervalo&de=2026-11-01&ate=2026-11-05",
    );
  });

  it("a escolha de setor leva o período no query (validado no servidor depois)", async () => {
    await seed();
    mocks.requireUser.mockResolvedValue(authzOf({ role: "admin" }));
    await renderScreen({ periodo: "30" });

    await userEvent.click(
      screen.getByRole("button", { name: "Todos os setores" }),
    );

    expect(mocks.chooseSectorAction).toHaveBeenCalledWith({
      sectorId: "todos",
      path: "/dashboard",
      query: "periodo=30",
    });
  });

  it("no período padrão, o query do seletor é vazio (mas existe)", async () => {
    await seed();
    mocks.requireUser.mockResolvedValue(authzOf({ role: "admin" }));
    await renderScreen();

    await userEvent.click(
      screen.getByRole("button", { name: "Todos os setores" }),
    );

    expect(mocks.chooseSectorAction).toHaveBeenCalledWith({
      sectorId: "todos",
      path: "/dashboard",
      query: "",
    });
  });

  it("admin sem setor ativo: estado vazio com o atalho para Setores", async () => {
    const { uld, camara } = await seed();
    await deactivateSector(db, uld.id);
    await deactivateSector(db, camara.id);
    mocks.requireUser.mockResolvedValue(authzOf({ role: "admin" }));

    await renderScreen();

    expect(
      screen.getByRole("heading", { level: 1, name: "Dashboard" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Nenhum setor ativo.")).toBeInTheDocument();
    expect(
      screen.getByText("Cadastre ou reative um setor para ver o dashboard."),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Ir para Setores" }),
    ).toHaveAttribute("href", "/admin/setores");
    expect(screen.queryByTestId("bloco-passagens")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: "Exportar CSV" }),
    ).not.toBeInTheDocument();
  });

  it("operador de setor inativo: 'Seu setor está inativo.' e nenhum bloco", async () => {
    const { uld } = await seed();
    await deactivateSector(db, uld.id);
    mocks.requireUser.mockResolvedValue(
      authzOf({ role: "operator", sectorId: uld.id }),
    );

    await renderScreen();

    expect(screen.getByText("Seu setor está inativo.")).toBeInTheDocument();
    expect(
      screen.getByText("Peça a um administrador para reativá-lo."),
    ).toBeInTheDocument();
    expect(screen.queryByTestId("bloco-passagens")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: "Exportar CSV" }),
    ).not.toBeInTheDocument();
  });

  it("sem sessão propaga o redirect de requireUser (nada é lido)", async () => {
    mocks.requireUser.mockRejectedValue(new Error("NEXT_REDIRECT"));

    await expect(
      DashboardScreen({ searchParams: Promise.resolve({}) }),
    ).rejects.toThrow("NEXT_REDIRECT");
  });
});

describe("DashboardScreen: limite e Suspense de cada bloco", () => {
  beforeEach(async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(NOW);
    if (mocks.client) await resetDb(mocks.client);
    mocks.requireUser.mockReset();
    mocks.readRememberedSector.mockReset();
    mocks.readRememberedSector.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  async function boundaries(
    actor: Authz,
    search: Record<string, string>,
  ): Promise<ReactElement<BoundaryProps>[]> {
    mocks.requireUser.mockResolvedValue(actor);
    const tree = await DashboardScreen({
      searchParams: Promise.resolve(search),
    });
    return findBoundaries(tree);
  }

  it("cada bloco fica dentro de um limite com título e, dentro dele, a Suspense com o esqueleto do bloco", async () => {
    const { uld } = await seed();

    const found = await boundaries(
      authzOf({ role: "operator", sectorId: uld.id }),
      {},
    );

    expect(found).toHaveLength(4);
    expect(found.map((element) => element.props.title)).toEqual([...TITLES]);
    for (const element of found) {
      const { title } = element.props;
      const [child] = Children.toArray(element.props.children);
      if (!isSuspense(child)) throw new Error(`${title}: faltou a Suspense`);
      expect(child.props.fallback.type).toBe(DashboardBlockSkeleton);
      expect(child.props.fallback.props).toEqual({ title });
    }
  });

  it("a key do limite é o título + o href do período e do setor: muda com o período e com o setor", async () => {
    const { uld, camara } = await seed();
    const admin = authzOf({ role: "admin" });
    const keysOf = (found: ReactElement<BoundaryProps>[]) =>
      found.map((e) => e.key);

    const operator = await boundaries(
      authzOf({ role: "operator", sectorId: uld.id }),
      {},
    );
    expect(keysOf(operator)).toEqual([
      "Passagens:/dashboard",
      "Controles:/dashboard",
      "Estoque:/dashboard",
      "Solicitações:/dashboard",
    ]);

    const adminUld = await boundaries(admin, { setor: uld.id });
    const adminCamara = await boundaries(admin, { setor: camara.id });
    const adminThirty = await boundaries(admin, {
      setor: uld.id,
      periodo: "30",
    });
    expect(adminUld[0]?.key).toBe(`Passagens:/dashboard?setor=${uld.id}`);
    expect(adminCamara[0]?.key).toBe(`Passagens:/dashboard?setor=${camara.id}`);
    expect(adminThirty[0]?.key).toBe(
      `Passagens:/dashboard?periodo=30&setor=${uld.id}`,
    );
    expect(
      new Set([adminUld[0]?.key, adminCamara[0]?.key, adminThirty[0]?.key])
        .size,
    ).toBe(3);
  });
});
