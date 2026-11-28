// O registro dos estados visuais (spec §5.4), com o nome `<tela>:<estado>`. Cada branch de tela
// acrescenta `seed/states/<tela>.ts` e o registra aqui, no STATES.
import { VISUAL_PEOPLE, VISUAL_SECTORS } from "../../vocabulary.mjs";
import {
  DEFAULT_SECTOR,
  type PersonKey,
  resetVariable,
  type SeedDb,
  sectorIdByName,
  userIdByEmail,
} from "../world";
import { GERAL_STATES } from "./geral";
import { INICIO_STATES } from "./inicio";

export type StateContext = { sector: string; now: Date };
export type StateSeeder = (db: SeedDb, ctx: StateContext) => Promise<void>;
export type StateFile = {
  state: string;
  sector: string;
  sectorId: string;
  sectors: Record<string, string>;
  users: Record<PersonKey, string>;
  at: string;
};

function prefixed(
  screen: string,
  states: Record<string, StateSeeder>,
): Record<string, StateSeeder> {
  return Object.fromEntries(
    Object.entries(states).map(([name, seeder]) => [
      `${screen}:${name}`,
      seeder,
    ]),
  );
}

/** "inicio:admin" … "inicio:sem-turnos" e "geral:rico". */
export const STATES: Record<string, StateSeeder> = Object.freeze({
  ...prefixed("inicio", INICIO_STATES),
  ...prefixed("geral", GERAL_STATES),
});

/**
 * Zera a parte variável e monta o estado, numa transação. Confere antes de apagar qualquer coisa:
 * o nome do estado ("estado desconhecido: <nome>"), o setor e as quatro pessoas.
 */
export async function seedState(
  db: SeedDb,
  name: string,
  options: { sector?: string; now?: Date } = {},
): Promise<StateFile> {
  const seeder = Object.hasOwn(STATES, name) ? STATES[name] : undefined;
  if (!seeder) throw new Error(`estado desconhecido: ${name}`);
  const sector = options.sector ?? DEFAULT_SECTOR;
  const now = options.now ?? new Date();

  const sectorId = await sectorIdByName(db, sector);
  const sectors: Record<string, string> = {};
  for (const { name: sectorName } of VISUAL_SECTORS) {
    sectors[sectorName] = await sectorIdByName(db, sectorName);
  }
  const users = {} as Record<PersonKey, string>;
  for (const key of Object.keys(VISUAL_PEOPLE) as PersonKey[]) {
    users[key] = await userIdByEmail(db, VISUAL_PEOPLE[key].email);
  }

  await db.transaction(async (tx) => {
    await resetVariable(tx);
    await seeder(tx, { sector, now });
  });
  return {
    state: name,
    sector,
    sectorId,
    sectors,
    users,
    at: now.toISOString(),
  };
}
