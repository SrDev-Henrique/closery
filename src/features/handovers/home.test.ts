import type { PGlite } from "@electric-sql/pglite";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { handover } from "@/db/schema/handovers";
import type { Authz } from "@/features/authz/authz";
import { spDate } from "../../../test/clock";
import { createTestDb, resetDb, type TestDb } from "../../../test/db";
import {
  insertHandover,
  insertSector,
  insertShift,
  insertUser,
} from "../../../test/fixtures";
import { getHomeHandovers } from "./home";
import { NEXT_SHIFT_PREVIEW_LENGTH } from "./limits";

const NIL_ID = "00000000-0000-4000-8000-000000000000";
// 14:05: o fim mais próximo é o da Manhã (14:00), do dia 21/11.
const NOW = spDate("2026-11-21", "14:05");

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

function operator(id: string, name: string, sectorId: string): Authz {
  return {
    userId: id,
    name,
    email: `${id}@example.test`,
    role: "operator",
    sectorId,
  };
}

async function seed() {
  const uld = await insertSector(db, "ULD");
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
  const manha = await insertShift(db, {
    sectorId: uld.id,
    name: "Manhã",
    startsAt: "06:00",
    endsAt: "14:00",
  });
  const tarde = await insertShift(db, {
    sectorId: uld.id,
    name: "Tarde",
    startsAt: "14:00",
    endsAt: "22:00",
  });
  return {
    uld,
    manha,
    tarde,
    ana: ana.id,
    bia: bia.id,
    root: root.id,
    anaAuthz: operator(ana.id, "Ana Teste", uld.id),
    biaAuthz: operator(bia.id, "Bia Teste", uld.id),
    rootAuthz: {
      userId: root.id,
      name: "Admin Teste",
      email: "admin@example.test",
      role: "admin",
      sectorId: null,
    } satisfies Authz,
  };
}

async function homeOf(actor: Authz, sectorId: string, now = NOW) {
  const result = await getHomeHandovers(db, actor, sectorId, now);
  if (!result.ok) throw new Error(`início falhou: ${result.message}`);
  return result.home;
}

describe("getHomeHandovers", () => {
  describe("passagem para confirmar (pending)", () => {
    it("sem nenhuma entregue: null", async () => {
      const { uld, biaAuthz } = await seed();

      expect((await homeOf(biaAuthz, uld.id)).pending).toBeNull();
    });

    it("mostra a entregue mais recente do setor a quem não entregou", async () => {
      const { uld, manha, tarde, ana, biaAuthz } = await seed();
      await insertHandover(db, {
        sectorId: uld.id,
        shiftId: manha.id,
        operationalDate: "2026-11-20",
        status: "delivered",
        deliveredBy: ana,
        deliveredAt: spDate("2026-11-20", "14:02"),
        nextShiftText: "Velha",
      });
      const recent = await insertHandover(db, {
        sectorId: uld.id,
        shiftId: tarde.id,
        operationalDate: "2026-11-20",
        status: "delivered",
        deliveredBy: ana,
        deliveredAt: spDate("2026-11-20", "22:03"),
        nextShiftText: "Conferir a rede 7.",
        shiftNameSnapshot: "Tarde (nome antigo)",
      });

      const { pending } = await homeOf(biaAuthz, uld.id);

      expect(pending).toEqual({
        id: recent.id,
        sectorName: "ULD",
        shiftName: "Tarde (nome antigo)",
        operationalDate: "2026-11-20",
        deliveredByName: "Ana Teste",
        deliveredAt: spDate("2026-11-20", "22:03"),
        nextShiftPreview: "Conferir a rede 7.",
      });
    });

    it("some para quem entregou e não cai para uma mais antiga", async () => {
      const { uld, manha, tarde, ana, bia, anaAuthz, biaAuthz } = await seed();
      await insertHandover(db, {
        sectorId: uld.id,
        shiftId: manha.id,
        operationalDate: "2026-11-20",
        status: "delivered",
        deliveredBy: bia,
        deliveredAt: spDate("2026-11-20", "14:02"),
      });
      await insertHandover(db, {
        sectorId: uld.id,
        shiftId: tarde.id,
        operationalDate: "2026-11-20",
        status: "delivered",
        deliveredBy: ana,
        deliveredAt: spDate("2026-11-20", "22:03"),
      });

      expect((await homeOf(anaAuthz, uld.id)).pending).toBeNull();
      expect((await homeOf(biaAuthz, uld.id)).pending?.deliveredByName).toBe(
        "Ana Teste",
      );
    });

    it("uma confirmada mais nova esconde a entregue mais antiga (F3-6); rascunho não conta", async () => {
      const { uld, manha, tarde, ana, bia, biaAuthz } = await seed();
      await insertHandover(db, {
        sectorId: uld.id,
        shiftId: manha.id,
        operationalDate: "2026-11-19",
        status: "delivered",
        deliveredBy: ana,
        deliveredAt: spDate("2026-11-19", "14:02"),
      });
      await insertHandover(db, {
        sectorId: uld.id,
        shiftId: tarde.id,
        operationalDate: "2026-11-19",
        status: "confirmed",
        deliveredBy: ana,
        confirmedBy: bia,
        deliveredAt: spDate("2026-11-19", "22:03"),
      });
      await insertHandover(db, {
        sectorId: uld.id,
        shiftId: manha.id,
        operationalDate: "2026-11-20",
      });

      expect((await homeOf(biaAuthz, uld.id)).pending).toBeNull();
    });

    it("um rascunho mais novo não esconde a entregue: ela continua pendente", async () => {
      const { uld, manha, tarde, ana, biaAuthz } = await seed();
      const delivered = await insertHandover(db, {
        sectorId: uld.id,
        shiftId: manha.id,
        operationalDate: "2026-11-19",
        status: "delivered",
        deliveredBy: ana,
        deliveredAt: spDate("2026-11-19", "14:02"),
      });
      await insertHandover(db, {
        sectorId: uld.id,
        shiftId: tarde.id,
        operationalDate: "2026-11-20",
      });

      expect((await homeOf(biaAuthz, uld.id)).pending?.id).toBe(delivered.id);
    });

    it("não vaza passagem de outro setor", async () => {
      const { uld, ana, biaAuthz } = await seed();
      const outro = await insertSector(db, "Outro");
      const turno = await insertShift(db, { sectorId: outro.id });
      await insertHandover(db, {
        sectorId: outro.id,
        shiftId: turno.id,
        status: "delivered",
        deliveredBy: ana,
      });

      expect((await homeOf(biaAuthz, uld.id)).pending).toBeNull();
    });

    it("trecho do próximo turno: null se vazio ou só espaços; corta em 200 pontos de código com reticências", async () => {
      const { uld, manha, ana, biaAuthz } = await seed();
      const passagem = await insertHandover(db, {
        sectorId: uld.id,
        shiftId: manha.id,
        operationalDate: "2026-11-20",
        status: "delivered",
        deliveredBy: ana,
      });
      const previewOf = async (text: string) => {
        await db
          .update(handover)
          .set({ nextShiftText: text })
          .where(eq(handover.id, passagem.id));
        return (await homeOf(biaAuthz, uld.id)).pending?.nextShiftPreview;
      };
      const exact = "😀".repeat(NEXT_SHIFT_PREVIEW_LENGTH);

      expect(await previewOf("")).toBeNull();
      expect(await previewOf(" \n ")).toBeNull();
      expect(await previewOf("  Conferir a rede 7.  ")).toBe(
        "Conferir a rede 7.",
      );
      expect(await previewOf(exact)).toBe(exact);
      expect(await previewOf(`${exact}😀`)).toBe(`${exact}…`);
    });
  });

  describe("passagem do meu turno (mine)", () => {
    it("setor sem turnos ativos: no-shifts", async () => {
      const uld = await insertSector(db, "ULD");
      await insertShift(db, { sectorId: uld.id, active: false });
      const root = await insertUser(db, {
        role: "admin",
        sectorId: null,
      });

      const home = await homeOf(
        {
          userId: root.id,
          name: "Admin Teste",
          email: "a@example.test",
          role: "admin",
          sectorId: null,
        },
        uld.id,
      );

      expect(home.mine).toEqual({ kind: "no-shifts" });
    });

    it("start: turno sugerido pelo horário, sem passagem", async () => {
      const { uld, manha, anaAuthz } = await seed();

      const { mine } = await homeOf(anaAuthz, uld.id);

      expect(mine).toEqual({
        kind: "start",
        ref: {
          sectorId: uld.id,
          shiftId: manha.id,
          operationalDate: "2026-11-21",
        },
        shift: {
          id: manha.id,
          name: "Manhã",
          startsAt: "06:00",
          endsAt: "14:00",
        },
        saved: null,
      });
    });

    it("continue: rascunho existe e traz quem salvou por último", async () => {
      const { uld, manha, bia, anaAuthz } = await seed();
      await insertHandover(db, {
        sectorId: uld.id,
        shiftId: manha.id,
        operationalDate: "2026-11-21",
        updatedBy: bia,
      });

      const { mine } = await homeOf(anaAuthz, uld.id);

      expect(mine.kind).toBe("continue");
      if (mine.kind !== "continue") throw new Error("estado inesperado");
      expect(mine.saved?.byName).toBe("Bia Teste");
      expect(mine.saved?.at).toBeInstanceOf(Date);
    });

    it("continue sem updatedBy: saved null", async () => {
      const { uld, manha, anaAuthz } = await seed();
      await insertHandover(db, {
        sectorId: uld.id,
        shiftId: manha.id,
        operationalDate: "2026-11-21",
      });

      const { mine } = await homeOf(anaAuthz, uld.id);

      expect(mine).toMatchObject({ kind: "continue", saved: null });
    });

    it("delivered: traz id, quem entregou e quando", async () => {
      const { uld, manha, ana, anaAuthz } = await seed();
      const passagem = await insertHandover(db, {
        sectorId: uld.id,
        shiftId: manha.id,
        operationalDate: "2026-11-21",
        status: "delivered",
        deliveredBy: ana,
        deliveredAt: spDate("2026-11-21", "14:02"),
      });

      const { mine } = await homeOf(anaAuthz, uld.id);

      expect(mine).toMatchObject({
        kind: "delivered",
        handoverId: passagem.id,
        deliveredByName: "Ana Teste",
        deliveredAt: spDate("2026-11-21", "14:02"),
        confirmedByName: null,
        confirmedAt: null,
      });
    });

    it("confirmed: traz quem confirmou e quando", async () => {
      const { uld, manha, ana, bia, anaAuthz } = await seed();
      await insertHandover(db, {
        sectorId: uld.id,
        shiftId: manha.id,
        operationalDate: "2026-11-21",
        status: "confirmed",
        deliveredBy: ana,
        confirmedBy: bia,
        deliveredAt: spDate("2026-11-21", "14:02"),
        confirmedAt: spDate("2026-11-21", "14:04"),
      });

      const { mine } = await homeOf(anaAuthz, uld.id);

      expect(mine).toMatchObject({
        kind: "confirmed",
        confirmedByName: "Bia Teste",
        confirmedAt: spDate("2026-11-21", "14:04"),
      });
    });

    it("à 00:10 o turno sugerido é a Tarde do dia anterior", async () => {
      const { uld, tarde, anaAuthz } = await seed();

      const { mine } = await homeOf(
        anaAuthz,
        uld.id,
        spDate("2026-11-21", "00:10"),
      );

      expect(mine).toMatchObject({
        kind: "start",
        ref: { shiftId: tarde.id, operationalDate: "2026-11-20" },
      });
    });

    it("turno inativo não é sugerido, mesmo com o fim mais perto de agora", async () => {
      const { uld, manha, anaAuthz } = await seed();
      await insertShift(db, {
        sectorId: uld.id,
        name: "Extra",
        startsAt: "13:00",
        endsAt: "14:08",
        active: false,
      });

      const { mine } = await homeOf(anaAuthz, uld.id);

      expect(mine).toMatchObject({ kind: "start", shift: { id: manha.id } });
    });
  });

  describe("escopo e setor", () => {
    it("admin vê qualquer setor ativo", async () => {
      const { uld, rootAuthz } = await seed();

      const home = await homeOf(rootAuthz, uld.id);

      expect(home.sector).toEqual({ id: uld.id, name: "ULD" });
    });

    it("operador de outro setor e id inexistente: NOT_FOUND", async () => {
      const { uld, rootAuthz } = await seed();
      const outro = await insertSector(db, "Outro");
      const caio = await insertUser(db, {
        role: "operator",
        sectorId: outro.id,
      });
      const actor = operator(caio.id, "Caio Teste", outro.id);

      const foreign = await getHomeHandovers(db, actor, uld.id, NOW);
      const missing = await getHomeHandovers(db, rootAuthz, NIL_ID, NOW);

      expect(foreign).toEqual({
        ok: false,
        code: "NOT_FOUND",
        message: "Setor não encontrado. Atualize a página.",
      });
      expect(missing).toEqual(foreign);
    });

    it("setor inativo: SECTOR_INACTIVE", async () => {
      const fechado = await insertSector(db, "Fechado", { active: false });
      const root = await insertUser(db, { role: "admin", sectorId: null });

      const result = await getHomeHandovers(
        db,
        {
          userId: root.id,
          name: "Admin Teste",
          email: "a@example.test",
          role: "admin",
          sectorId: null,
        },
        fechado.id,
        NOW,
      );

      expect(result).toEqual({
        ok: false,
        code: "SECTOR_INACTIVE",
        message:
          "Este setor está inativo. Peça a um administrador para reativá-lo.",
      });
    });
  });
});
