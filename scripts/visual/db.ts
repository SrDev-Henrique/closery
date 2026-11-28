// Banco do ambiente visual (bun; spec §5.3): PGlite gravado em disco, em
// <git-common-dir>/sdd/visual-db/pgdata (sobrevive aos reinícios do harness), com as migrações reais
// de ./drizzle, servido em 127.0.0.1:54332. Idempotente: se a porta já responde como banco, avisa e
// sai com 0. Recusa qualquer outra porta. Para zerar: parar o processo e apagar a pasta pgdata.
//   bun run visual:db
import { mkdirSync } from "node:fs";
import { createConnection } from "node:net";
import { join } from "node:path";

import { PGlite } from "@electric-sql/pglite";
import { PGLiteSocketServer } from "@electric-sql/pglite-socket";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { Client } from "pg";

import {
  assertVisualDbUrl,
  parseCliArgs,
  VISUAL_DB_HOST,
  VISUAL_DB_PORT,
  VISUAL_DB_URL,
} from "./config.mjs";
import {
  repoRoot,
  VISUAL_DB_DIR,
  VISUAL_DB_FILES,
  visualDbDir,
} from "./paths.mjs";

const USAGE = "uso: bun run visual:db [--port=54332]";

function portInUse(): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = createConnection({
      host: VISUAL_DB_HOST,
      port: VISUAL_DB_PORT,
    });
    socket.once("connect", () => {
      socket.destroy();
      resolve(true);
    });
    socket.once("error", () => resolve(false));
  });
}

async function answersSelectOne(): Promise<boolean> {
  const client = new Client({
    connectionString: assertVisualDbUrl(VISUAL_DB_URL),
    connectionTimeoutMillis: 5_000,
  });
  try {
    await client.connect();
    await client.query("select 1");
    return true;
  } catch {
    return false;
  } finally {
    await client.end().catch(() => undefined);
  }
}

// Devolve o código de saída, ou null quando o servidor fica de pé.
async function main(): Promise<number | null> {
  const { flags, positional } = parseCliArgs(process.argv.slice(2));
  const unknown = Object.keys(flags).filter((name) => name !== "port");
  if (unknown.length > 0 || positional.length > 0) {
    console.error(USAGE);
    return 1;
  }
  if (flags.port !== undefined && flags.port !== String(VISUAL_DB_PORT)) {
    console.error(
      `porta recusada: ${String(flags.port)} (o banco visual só usa a ${VISUAL_DB_PORT})`,
    );
    return 1;
  }

  if (await portInUse()) {
    if (await answersSelectOne()) {
      console.log(
        `banco visual já está de pé em ${VISUAL_DB_HOST}:${VISUAL_DB_PORT}`,
      );
      return 0;
    }
    console.error(
      `porta ${VISUAL_DB_PORT} ocupada por outro processo (não responde como banco)`,
    );
    return 1;
  }

  const dataDir = join(visualDbDir(), VISUAL_DB_FILES.data);
  mkdirSync(dataDir, { recursive: true });
  const client = new PGlite(dataDir);
  await migrate(drizzle(client), {
    migrationsFolder: join(repoRoot(), "drizzle"),
  });

  // maxConnections: 20, como no E2E: o Pool do app e o seed abrem conexões próprias.
  const server = new PGLiteSocketServer({
    db: client,
    host: VISUAL_DB_HOST,
    port: VISUAL_DB_PORT,
    maxConnections: 20,
  });
  await server.start();
  console.log(
    `banco visual pronto em ${server.getServerConn()} (dados em .git/sdd/${VISUAL_DB_DIR}/${VISUAL_DB_FILES.data})`,
  );

  const shutdown = async () => {
    await server.stop();
    await client.close();
    process.exit(0);
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
  return null;
}

main().then(
  (code) => {
    if (code !== null) process.exit(code);
  },
  (error: unknown) => {
    console.error(
      `visual:db: ${error instanceof Error ? error.message : String(error)}`,
    );
    process.exit(1);
  },
);
