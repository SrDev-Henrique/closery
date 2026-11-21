import type { PGlite } from "@electric-sql/pglite";
import { eq } from "drizzle-orm";
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import { invite } from "@/db/schema/invites";
import { createTestDb, resetDb, type TestDb } from "../../../test/db";
import { insertInvite, insertSector, insertUser } from "../../../test/fixtures";
import {
  cancelInvite,
  consumeInvite,
  createInvite,
  findInviteByToken,
  recordInviteUser,
} from "./inviteQueries";
import { INVITE_TTL_MS } from "./inviteState";
import { generateInviteToken, hashInviteToken } from "./token";

// PGlite é uma conexão só e serializa tudo: Promise.all de dois consumos
// passaria mesmo com um SELECT+UPDATE não atômico, então não prova nada. A
// atomicidade vem de ser um único UPDATE condicional; aqui testamos a
// sequência (segundo consumo devolve null) e a forma da query.

const NOW = new Date("2026-11-20T12:00:00.000Z");
const ONE_MINUTE = 60_000;
const MALFORMED_TOKENS = [
  "",
  "curto",
  "a".repeat(44),
  `${"a".repeat(42)}+`,
  `${"a".repeat(42)}\n`,
];

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
  vi.restoreAllMocks();
});

async function readInvite(id: string) {
  const [row] = await db.select().from(invite).where(eq(invite.id, id));
  if (!row) throw new Error("convite não encontrado");
  return row;
}

describe("createInvite", () => {
  it("cria convite de admin sem setor, válido por 7 dias", async () => {
    const created = await createInvite(db, {
      role: "admin",
      sectorId: null,
      inviteeLabel: null,
      invitedBy: null,
      now: NOW,
    });

    expect(created.expiresAt).toEqual(new Date(NOW.getTime() + INVITE_TTL_MS));
    const row = await readInvite(created.id);
    expect(row.role).toBe("admin");
    expect(row.sectorId).toBeNull();
    expect(row.expiresAt).toEqual(created.expiresAt);
    expect(row.usedAt).toBeNull();
    expect(row.cancelledAt).toBeNull();
  });

  it("cria convite de operador com setor, rótulo e quem convidou", async () => {
    const setor = await insertSector(db);
    const admin = await insertUser(db, { role: "admin", sectorId: null });

    const created = await createInvite(db, {
      role: "operator",
      sectorId: setor.id,
      inviteeLabel: "Turno da manhã",
      invitedBy: admin.id,
      now: NOW,
    });

    const row = await readInvite(created.id);
    expect(row.role).toBe("operator");
    expect(row.sectorId).toBe(setor.id);
    expect(row.inviteeLabel).toBe("Turno da manhã");
    expect(row.invitedBy).toBe(admin.id);
  });

  it("lança para operador sem setor e não grava nada", async () => {
    await expect(
      createInvite(db, {
        role: "operator",
        sectorId: null,
        inviteeLabel: null,
        invitedBy: null,
        now: NOW,
      }),
    ).rejects.toThrow("Convite de operador exige um setor.");

    expect(await db.select().from(invite)).toHaveLength(0);
  });

  it("grava só o hash; o token bruto não aparece em nenhuma coluna", async () => {
    const created = await createInvite(db, {
      role: "admin",
      sectorId: null,
      inviteeLabel: null,
      invitedBy: null,
      now: NOW,
    });

    const row = await readInvite(created.id);
    expect(row.tokenHash).toBe(hashInviteToken(created.token));
    expect(JSON.stringify(row)).not.toContain(created.token);
  });

  it("gera um token diferente a cada convite", async () => {
    const input = {
      role: "admin",
      sectorId: null,
      inviteeLabel: null,
      invitedBy: null,
      now: NOW,
    } as const;

    const first = await createInvite(db, input);
    const second = await createInvite(db, input);

    expect(first.token).not.toBe(second.token);
    expect(first.id).not.toBe(second.id);
  });
});

describe("findInviteByToken", () => {
  it("valid: devolve papel, setor e quem convidou", async () => {
    const setor = await insertSector(db, "ULD");
    const admin = await insertUser(db, {
      role: "admin",
      sectorId: null,
      name: "Admin Teste",
    });
    const { token } = await insertInvite(db, {
      role: "operator",
      sectorId: setor.id,
      invitedBy: admin.id,
      inviteeLabel: "Fulano",
      now: NOW,
    });

    const found = await findInviteByToken(db, token, NOW);

    expect(found).toEqual({
      state: "valid",
      role: "operator",
      sectorName: "ULD",
      inviterName: "Admin Teste",
      inviteeLabel: "Fulano",
      expiresAt: new Date(NOW.getTime() + INVITE_TTL_MS),
    });
  });

  it("convite de admin do script: sectorName e inviterName nulos", async () => {
    const { token } = await insertInvite(db, { now: NOW });

    const found = await findInviteByToken(db, token, NOW);

    expect(found?.state).toBe("valid");
    expect(found?.role).toBe("admin");
    expect(found?.sectorName).toBeNull();
    expect(found?.inviterName).toBeNull();
    expect(found?.inviteeLabel).toBeNull();
  });

  it("expired: expiresAt no passado e exatamente igual a now", async () => {
    const past = await insertInvite(db, {
      expiresAt: new Date(NOW.getTime() - ONE_MINUTE),
    });
    const boundary = await insertInvite(db, { expiresAt: NOW });

    expect((await findInviteByToken(db, past.token, NOW))?.state).toBe(
      "expired",
    );
    expect((await findInviteByToken(db, boundary.token, NOW))?.state).toBe(
      "expired",
    );
  });

  it("used e cancelled", async () => {
    const used = await insertInvite(db, {
      now: NOW,
      usedAt: new Date(NOW.getTime() - ONE_MINUTE),
    });
    const cancelled = await insertInvite(db, {
      now: NOW,
      cancelledAt: new Date(NOW.getTime() - ONE_MINUTE),
    });

    expect((await findInviteByToken(db, used.token, NOW))?.state).toBe("used");
    expect((await findInviteByToken(db, cancelled.token, NOW))?.state).toBe(
      "cancelled",
    );
  });

  it("cancelled vence used quando os dois estão preenchidos", async () => {
    const both = await insertInvite(db, {
      now: NOW,
      usedAt: new Date(NOW.getTime() - ONE_MINUTE),
      cancelledAt: new Date(NOW.getTime() - ONE_MINUTE),
    });

    expect((await findInviteByToken(db, both.token, NOW))?.state).toBe(
      "cancelled",
    );
  });

  it("token bem formado mas inexistente devolve null", async () => {
    await insertInvite(db, { now: NOW });

    expect(
      await findInviteByToken(db, generateInviteToken().token, NOW),
    ).toBeNull();
  });

  it("token malformado devolve null sem consultar o banco", async () => {
    const select = vi.spyOn(db, "select");

    for (const token of MALFORMED_TOKENS) {
      expect(await findInviteByToken(db, token, NOW)).toBeNull();
    }
    expect(select).not.toHaveBeenCalled();
  });

  it("não encontra pelo hash: o hash não serve como token", async () => {
    const { token } = await insertInvite(db, { now: NOW });

    expect(await findInviteByToken(db, hashInviteToken(token), NOW)).toBeNull();
  });
});

describe("consumeInvite", () => {
  it("válido: devolve papel e setor e preenche used_at", async () => {
    const setor = await insertSector(db);
    const { id, token } = await insertInvite(db, {
      role: "operator",
      sectorId: setor.id,
      now: NOW,
    });

    const consumed = await consumeInvite(db, token, NOW);

    expect(consumed).toEqual({ role: "operator", sectorId: setor.id });
    expect((await readInvite(id)).usedAt).toEqual(NOW);
  });

  it("convite de admin devolve sectorId nulo", async () => {
    const { token } = await insertInvite(db, { now: NOW });

    expect(await consumeInvite(db, token, NOW)).toEqual({
      role: "admin",
      sectorId: null,
    });
  });

  it("segundo consumo devolve null e não altera used_at", async () => {
    const { id, token } = await insertInvite(db, { now: NOW });
    const later = new Date(NOW.getTime() + ONE_MINUTE);

    expect(await consumeInvite(db, token, NOW)).not.toBeNull();
    expect(await consumeInvite(db, token, later)).toBeNull();
    expect((await readInvite(id)).usedAt).toEqual(NOW);
  });

  it("expirado, inclusive no instante exato, devolve null e não marca uso", async () => {
    const past = await insertInvite(db, {
      expiresAt: new Date(NOW.getTime() - ONE_MINUTE),
    });
    const boundary = await insertInvite(db, { expiresAt: NOW });

    expect(await consumeInvite(db, past.token, NOW)).toBeNull();
    expect(await consumeInvite(db, boundary.token, NOW)).toBeNull();
    expect((await readInvite(past.id)).usedAt).toBeNull();
    expect((await readInvite(boundary.id)).usedAt).toBeNull();
  });

  it("um milissegundo antes de expirar ainda consome", async () => {
    const { token } = await insertInvite(db, {
      expiresAt: new Date(NOW.getTime() + 1),
    });

    expect(await consumeInvite(db, token, NOW)).not.toBeNull();
  });

  it("cancelado devolve null e não marca uso", async () => {
    const { id, token } = await insertInvite(db, {
      now: NOW,
      cancelledAt: new Date(NOW.getTime() - ONE_MINUTE),
    });

    expect(await consumeInvite(db, token, NOW)).toBeNull();
    expect((await readInvite(id)).usedAt).toBeNull();
  });

  it("inexistente devolve null", async () => {
    expect(
      await consumeInvite(db, generateInviteToken().token, NOW),
    ).toBeNull();
  });

  it("token malformado devolve null sem consultar o banco", async () => {
    const update = vi.spyOn(db, "update");

    for (const token of MALFORMED_TOKENS) {
      expect(await consumeInvite(db, token, NOW)).toBeNull();
    }
    expect(update).not.toHaveBeenCalled();
  });

  it("é um único UPDATE condicional (sem SELECT antes)", async () => {
    const { token } = await insertInvite(db, { now: NOW });
    const select = vi.spyOn(db, "select");
    const update = vi.spyOn(db, "update");

    await consumeInvite(db, token, NOW);

    expect(update).toHaveBeenCalledTimes(1);
    expect(select).not.toHaveBeenCalled();
  });
});

describe("recordInviteUser", () => {
  it("grava used_by uma vez e não sobrescreve", async () => {
    const first = await insertUser(db, { role: "admin", sectorId: null });
    const second = await insertUser(db, { role: "admin", sectorId: null });
    const { id, token } = await insertInvite(db, { now: NOW });

    await recordInviteUser(db, token, first.id);
    await recordInviteUser(db, token, second.id);

    expect((await readInvite(id)).usedBy).toBe(first.id);
  });

  it("token inexistente não altera nada e não lança", async () => {
    const user = await insertUser(db, { role: "admin", sectorId: null });
    const { id } = await insertInvite(db, { now: NOW });

    await recordInviteUser(db, generateInviteToken().token, user.id);

    expect((await readInvite(id)).usedBy).toBeNull();
  });

  it("token malformado não consulta o banco", async () => {
    const update = vi.spyOn(db, "update");

    for (const token of MALFORMED_TOKENS) {
      await recordInviteUser(db, token, "qualquer");
    }
    expect(update).not.toHaveBeenCalled();
  });

  it("fluxo completo: consumir e depois registrar quem usou", async () => {
    const user = await insertUser(db, { role: "admin", sectorId: null });
    const { id, token } = await insertInvite(db, { now: NOW });

    await consumeInvite(db, token, NOW);
    await recordInviteUser(db, token, user.id);

    const row = await readInvite(id);
    expect(row.usedAt).toEqual(NOW);
    expect(row.usedBy).toBe(user.id);
  });
});

describe("constraints do banco", () => {
  function pgCode(error: unknown): string | undefined {
    const source =
      error instanceof Error && error.cause !== undefined ? error.cause : error;
    if (typeof source === "object" && source !== null && "code" in source) {
      return String(source.code);
    }
    return undefined;
  }

  it("invite de operador sem setor viola o check (23514)", async () => {
    const { tokenHash } = generateInviteToken();

    const attempt = db
      .insert(invite)
      .values({
        tokenHash,
        role: "operator",
        sectorId: null,
        expiresAt: new Date(NOW.getTime() + INVITE_TTL_MS),
      })
      .then(
        () => undefined,
        (error: unknown) => error,
      );
    const error = await attempt;

    expect(pgCode(error)).toBe("23514");
  });

  it("user operador sem setor viola o check (23514)", async () => {
    const error = await insertUser(db, {
      role: "operator",
      sectorId: null,
    }).then(
      () => undefined,
      (caught: unknown) => caught,
    );

    expect(pgCode(error)).toBe("23514");
  });

  it("não deixa apagar setor que tem convite (FK restrict, 23001)", async () => {
    const setor = await insertSector(db);
    await insertInvite(db, { role: "operator", sectorId: setor.id, now: NOW });

    const error = await client
      .query("DELETE FROM sector WHERE id = $1", [setor.id])
      .then(
        () => undefined,
        (caught: unknown) => caught,
      );

    expect(pgCode(error)).toBe("23001");
  });

  it("apagar quem convidou mantém o convite (set null)", async () => {
    const admin = await insertUser(db, { role: "admin", sectorId: null });
    const { id } = await insertInvite(db, { invitedBy: admin.id, now: NOW });

    await client.query('DELETE FROM "user" WHERE id = $1', [admin.id]);

    expect((await readInvite(id)).invitedBy).toBeNull();
  });
});

describe("cancelInvite", () => {
  it("cancela convite pendente, grava a hora e devolve true", async () => {
    const { id } = await insertInvite(db, { now: NOW });

    expect(await cancelInvite(db, id, NOW)).toBe(true);

    expect((await readInvite(id)).cancelledAt).toEqual(NOW);
  });

  it("depois de cancelar, o link deixa de funcionar", async () => {
    const { id, token } = await insertInvite(db, { now: NOW });

    await cancelInvite(db, id, NOW);

    expect((await findInviteByToken(db, token, NOW))?.state).toBe("cancelled");
    expect(await consumeInvite(db, token, NOW)).toBeNull();
  });

  it("segundo cancelamento devolve false e mantém a primeira hora", async () => {
    const { id } = await insertInvite(db, { now: NOW });
    const later = new Date(NOW.getTime() + ONE_MINUTE);

    expect(await cancelInvite(db, id, NOW)).toBe(true);
    expect(await cancelInvite(db, id, later)).toBe(false);

    expect((await readInvite(id)).cancelledAt).toEqual(NOW);
  });

  it("convite já usado não é cancelado", async () => {
    const { id } = await insertInvite(db, { now: NOW, usedAt: NOW });

    expect(await cancelInvite(db, id, NOW)).toBe(false);
    expect((await readInvite(id)).cancelledAt).toBeNull();
  });

  it("convite expirado não é cancelado, nem no instante exato da expiração", async () => {
    const expiresAt = new Date(NOW.getTime() + ONE_MINUTE);
    const { id } = await insertInvite(db, { now: NOW, expiresAt });

    expect(await cancelInvite(db, id, expiresAt)).toBe(false);
    expect(await cancelInvite(db, id, new Date(expiresAt.getTime() + 1))).toBe(
      false,
    );
    expect((await readInvite(id)).cancelledAt).toBeNull();
  });

  it("um instante antes de expirar ainda cancela", async () => {
    const expiresAt = new Date(NOW.getTime() + ONE_MINUTE);
    const { id } = await insertInvite(db, { now: NOW, expiresAt });

    expect(await cancelInvite(db, id, new Date(expiresAt.getTime() - 1))).toBe(
      true,
    );
  });

  it("id inexistente devolve false", async () => {
    expect(
      await cancelInvite(db, "00000000-0000-4000-8000-000000000000", NOW),
    ).toBe(false);
  });

  it("só cancela o convite pedido", async () => {
    const target = await insertInvite(db, { now: NOW });
    const other = await insertInvite(db, { now: NOW });

    await cancelInvite(db, target.id, NOW);

    expect((await readInvite(other.id)).cancelledAt).toBeNull();
  });
});
