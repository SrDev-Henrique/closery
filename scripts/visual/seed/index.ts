// CLI do seed visual (bun; spec §5.3). Banco: o PGlite da 54332 (bun run visual:db), conferido por
// assertVisualDbUrl antes de abrir a conexão. Grava em .git/sdd/visual-db/ e nunca imprime token.
//   bun run visual:seed base                                   -> world.json
//   bun run visual:seed state <tela>:<estado> [--setor=<nome>]  -> state.json
//   bun run visual:seed reopen-invites                         -> reabre os convites não usados
//   bun run visual:seed avatars                                -> avatars.json (semente = id)
import { join } from "node:path";

import { isNull } from "drizzle-orm";

import { createDb, createPool } from "@/db/client";
import { invite } from "@/db/schema/invites";

import { assertVisualDbUrl, parseCliArgs, VISUAL_DB_URL } from "../config.mjs";
import { VISUAL_DB_FILES, visualDbDir, writeInsideSdd } from "../paths.mjs";
import { VISUAL_PEOPLE } from "../vocabulary.mjs";
import { visualAvatarUri } from "./avatarArt";
import { STATES, seedState } from "./states/index";
import { type PersonKey, type SeedDb, seedBase, userIdByEmail } from "./world";

const USAGE =
  "uso: bun run visual:seed base | state <tela>:<estado> [--setor=<nome>] | reopen-invites | avatars";

function writeVisualJson(name: string, value: unknown): void {
  writeInsideSdd(
    join(visualDbDir(), name),
    `${JSON.stringify(value, null, 1)}\n`,
  );
}

async function runCommand(
  db: SeedDb,
  command: string | undefined,
  args: string[],
  setor: string | true | undefined,
): Promise<void> {
  if (setor !== undefined && command !== "state") throw new Error(USAGE);

  if (command === "base" && args.length === 0) {
    const world = await seedBase(db);
    writeVisualJson(VISUAL_DB_FILES.world, world);
    console.log(
      `mundo pronto: ${Object.keys(world.sectors).length} setores e ${Object.keys(world.invites).length} convites (em .git/sdd/visual-db/${VISUAL_DB_FILES.world})`,
    );
    return;
  }

  if (command === "state" && args.length === 1) {
    const [name] = args;
    if (!name || !Object.hasOwn(STATES, name)) {
      throw new Error(
        `estado desconhecido: ${String(name)} (estados: ${Object.keys(STATES).join(", ")})`,
      );
    }
    if (setor === true || setor === "") {
      throw new Error("--setor precisa do nome do setor");
    }
    const file = await seedState(db, name, { sector: setor });
    writeVisualJson(VISUAL_DB_FILES.state, file);
    console.log(`estado ${name} pronto (setor ${file.sector})`);
    return;
  }

  if (command === "reopen-invites" && args.length === 0) {
    const rows = await db
      .update(invite)
      .set({ cancelledAt: null })
      .where(isNull(invite.usedAt))
      .returning({ id: invite.id });
    console.log(`convites reabertos: ${rows.length}`);
    return;
  }

  if (command === "avatars" && args.length === 0) {
    const avatars = {} as Record<PersonKey, string>;
    for (const key of Object.keys(VISUAL_PEOPLE) as PersonKey[]) {
      avatars[key] = visualAvatarUri(
        await userIdByEmail(db, VISUAL_PEOPLE[key].email),
      );
    }
    writeVisualJson(VISUAL_DB_FILES.avatars, avatars);
    console.log(`avatares: ${Object.keys(avatars).join(", ")}`);
    return;
  }

  throw new Error(USAGE);
}

async function main(): Promise<void> {
  const { flags, positional } = parseCliArgs(process.argv.slice(2));
  const unknown = Object.keys(flags).filter((name) => name !== "setor");
  if (unknown.length > 0) throw new Error(USAGE);
  const [command, ...args] = positional;
  const pool = createPool(assertVisualDbUrl(VISUAL_DB_URL));
  try {
    await runCommand(createDb(pool), command, args, flags.setor);
  } finally {
    await pool.end();
  }
}

main().catch((error: unknown) => {
  // Só a mensagem: o erro do Drizzle traz o SQL e os parâmetros.
  const message =
    error instanceof Error ? error.message.split("\n")[0] : String(error);
  console.error(`visual:seed: ${message}`);
  process.exitCode = 1;
});
