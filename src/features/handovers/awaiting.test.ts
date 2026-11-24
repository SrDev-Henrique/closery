import type { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import type { Authz } from "@/features/authz/authz";

import { authzOf } from "../../../test/authz";
import { spDate } from "../../../test/clock";
import { createTestDb, resetDb, type TestDb } from "../../../test/db";
import {
  insertHandover,
  insertSector,
  insertShift,
  insertUser,
} from "../../../test/fixtures";
import { listHandoverHistory } from "./history";
import type { HistoryFilters } from "./historyFilters";
import { getHomeHandovers } from "./home";
import { getHandoverSummary } from "./summary";

// "Aguardando recebimento" é a mesma regra escrita em três lugares: o resumo
// (`situationOf` em JS + consulta), o histórico (SQL) e o cartão do Início
// (`loadPending`). Hoje são equivalentes; este teste os faz concordar: mudar
// um sem os outros reprova aqui. A regra: entre as entregues e as confirmadas
// do setor, só a mais recente (por `delivered_at` e, no empate, pelo maior id)
// está aguardando; qualquer entregue mais antiga é "não confirmada".
const NOW = spDate("2026-11-21", "14:05");
const FILTERS: HistoryFilters = {
  period: "range",
  from: "2026-11-14",
  to: "2026-11-21",
  shiftId: null,
  situation: "all",
};

let client: PGlite;
let db: TestDb;

beforeAll(async () => {
  ({ client, db } = await createTestDb());
});

afterAll(async () => {
  await client.close();
});

beforeEach(async () => {
  await resetDb(client);
});

async function seed() {
  const uld = await insertSector(db, "ULD");
  const turno = await insertShift(db, {
    sectorId: uld.id,
    name: "Manhã",
    startsAt: "06:00",
    endsAt: "14:00",
  });
  const ana = await insertUser(db, {
    role: "operator",
    sectorId: uld.id,
    name: "Ana Teste",
  });
  const bia = await insertUser(db, {
    role: "operator",
    sectorId: uld.id,
    name: "Bia Teste",
  });
  const root = await insertUser(db, {
    role: "admin",
    sectorId: null,
    name: "Admin Teste",
  });
  return {
    uld,
    turno,
    ana: ana.id,
    bia: bia.id,
    anaAuthz: authzOf({ role: "operator", userId: ana.id, sectorId: uld.id }),
    biaAuthz: authzOf({ role: "operator", userId: bia.id, sectorId: uld.id }),
    rootAuthz: authzOf({ role: "admin", userId: root.id }),
  };
}

type Situations = {
  summary: Map<string, string | null>;
  history: Map<string, string>;
};

// A situação de cada passagem segundo o resumo e segundo o histórico.
async function situationsOf(
  ids: readonly string[],
  sectorId: string,
  admin: Authz,
): Promise<Situations> {
  const summary = new Map<string, string | null>();
  for (const id of ids) {
    const result = await getHandoverSummary(db, admin, id);
    if (!result.ok) throw new Error(`resumo falhou: ${result.message}`);
    summary.set(id, result.summary.situation);
  }
  const page = await listHandoverHistory(
    db,
    admin,
    { filters: FILTERS, sectorId, page: 1 },
    NOW,
  );
  const history = new Map<string, string>();
  for (const row of page.rows) {
    if (row.handoverId !== null) history.set(row.handoverId, row.situation);
  }
  return { summary, history };
}

// O id do cartão "Passagem para confirmar" de quem olha (ou null).
async function pendingIdOf(viewer: Authz, sectorId: string) {
  const result = await getHomeHandovers(db, viewer, sectorId, NOW);
  if (!result.ok) throw new Error(`início falhou: ${result.message}`);
  return result.home.pending?.id ?? null;
}

describe("regra 'awaiting' (resumo × histórico × Início)", () => {
  it("(a) uma entregue: aguardando nos três; o cartão aparece para quem não entregou e some para quem entregou", async () => {
    const { uld, turno, ana, anaAuthz, biaAuthz, rootAuthz } = await seed();
    const only = await insertHandover(db, {
      sectorId: uld.id,
      shiftId: turno.id,
      operationalDate: "2026-11-20",
      status: "delivered",
      deliveredBy: ana,
      deliveredAt: spDate("2026-11-20", "14:00"),
    });

    const { summary, history } = await situationsOf(
      [only.id],
      uld.id,
      rootAuthz,
    );

    expect(summary.get(only.id)).toBe("awaiting");
    expect(history.get(only.id)).toBe("awaiting");
    expect(await pendingIdOf(biaAuthz, uld.id)).toBe(only.id);
    expect(await pendingIdOf(anaAuthz, uld.id)).toBeNull();
  });

  it("(b) duas entregues: a antiga é 'não confirmada' no resumo e no histórico; o cartão é só da nova", async () => {
    const { uld, turno, ana, biaAuthz, rootAuthz } = await seed();
    const older = await insertHandover(db, {
      sectorId: uld.id,
      shiftId: turno.id,
      operationalDate: "2026-11-19",
      status: "delivered",
      deliveredBy: ana,
      deliveredAt: spDate("2026-11-19", "14:00"),
    });
    const newer = await insertHandover(db, {
      sectorId: uld.id,
      shiftId: turno.id,
      operationalDate: "2026-11-20",
      status: "delivered",
      deliveredBy: ana,
      deliveredAt: spDate("2026-11-20", "14:00"),
    });

    const { summary, history } = await situationsOf(
      [older.id, newer.id],
      uld.id,
      rootAuthz,
    );

    expect(summary.get(older.id)).toBe("unconfirmed");
    expect(history.get(older.id)).toBe("unconfirmed");
    expect(summary.get(newer.id)).toBe("awaiting");
    expect(history.get(newer.id)).toBe("awaiting");
    expect(await pendingIdOf(biaAuthz, uld.id)).toBe(newer.id);
  });

  it("(c) entregue e uma confirmada mais nova: a entregue é 'não confirmada' e o cartão não existe", async () => {
    const { uld, turno, ana, bia, biaAuthz, rootAuthz } = await seed();
    const delivered = await insertHandover(db, {
      sectorId: uld.id,
      shiftId: turno.id,
      operationalDate: "2026-11-19",
      status: "delivered",
      deliveredBy: ana,
      deliveredAt: spDate("2026-11-19", "14:00"),
    });
    const confirmed = await insertHandover(db, {
      sectorId: uld.id,
      shiftId: turno.id,
      operationalDate: "2026-11-20",
      status: "confirmed",
      deliveredBy: ana,
      deliveredAt: spDate("2026-11-20", "14:00"),
      confirmedBy: bia,
      confirmedAt: spDate("2026-11-20", "14:30"),
    });

    const { summary, history } = await situationsOf(
      [delivered.id, confirmed.id],
      uld.id,
      rootAuthz,
    );

    expect(summary.get(delivered.id)).toBe("unconfirmed");
    expect(history.get(delivered.id)).toBe("unconfirmed");
    expect(summary.get(confirmed.id)).toBe("confirmed");
    expect(history.get(confirmed.id)).toBe("confirmed");
    expect(await pendingIdOf(biaAuthz, uld.id)).toBeNull();
  });

  it("(d) empate de delivered_at: o maior id é o aguardando nas três", async () => {
    const { uld, turno, ana, biaAuthz, rootAuthz } = await seed();
    const tied = spDate("2026-11-20", "14:00");
    const first = await insertHandover(db, {
      sectorId: uld.id,
      shiftId: turno.id,
      operationalDate: "2026-11-19",
      status: "delivered",
      deliveredBy: ana,
      deliveredAt: tied,
    });
    const second = await insertHandover(db, {
      sectorId: uld.id,
      shiftId: turno.id,
      operationalDate: "2026-11-20",
      status: "delivered",
      deliveredBy: ana,
      deliveredAt: tied,
    });
    // uuid em minúsculas: a ordem do texto é a ordem do tipo uuid no Postgres.
    const winner = first.id > second.id ? first.id : second.id;
    const loser = winner === first.id ? second.id : first.id;

    const { summary, history } = await situationsOf(
      [first.id, second.id],
      uld.id,
      rootAuthz,
    );

    expect(summary.get(winner)).toBe("awaiting");
    expect(history.get(winner)).toBe("awaiting");
    expect(summary.get(loser)).toBe("unconfirmed");
    expect(history.get(loser)).toBe("unconfirmed");
    expect(await pendingIdOf(biaAuthz, uld.id)).toBe(winner);
  });

  it("passagem de outro setor não entra na conta: continua aguardando", async () => {
    const { uld, turno, ana, rootAuthz } = await seed();
    const outro = await insertSector(db, "Outro");
    const outroTurno = await insertShift(db, { sectorId: outro.id });
    const mine = await insertHandover(db, {
      sectorId: uld.id,
      shiftId: turno.id,
      operationalDate: "2026-11-19",
      status: "delivered",
      deliveredBy: ana,
      deliveredAt: spDate("2026-11-19", "14:00"),
    });
    await insertHandover(db, {
      sectorId: outro.id,
      shiftId: outroTurno.id,
      operationalDate: "2026-11-20",
      status: "delivered",
      deliveredBy: ana,
      deliveredAt: spDate("2026-11-20", "14:00"),
    });

    const { summary, history } = await situationsOf(
      [mine.id],
      uld.id,
      rootAuthz,
    );

    expect(summary.get(mine.id)).toBe("awaiting");
    expect(history.get(mine.id)).toBe("awaiting");
  });
});
