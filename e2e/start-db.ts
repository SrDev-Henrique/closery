import { PGlite } from "@electric-sql/pglite";
import { PGLiteSocketServer } from "@electric-sql/pglite-socket";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";

// Mesma porta de e2e/db.ts (não importamos de lá para este processo não
// carregar o driver `pg` à toa).
const PORT = 54329;

// Banco efêmero: PGlite em memória, com as migrações reais de ./drizzle.
const client = new PGlite();
await migrate(drizzle(client), { migrationsFolder: "./drizzle" });

// O Pool do app tem max 10 e o teste abre conexões próprias; com o padrão
// (maxConnections: 1) a segunda conexão é derrubada.
const server = new PGLiteSocketServer({
  db: client,
  host: "127.0.0.1",
  port: PORT,
  maxConnections: 20,
});
await server.start();
console.log("pglite-socket pronto", server.getServerConn());

async function shutdown() {
  await server.stop();
  await client.close();
  process.exit(0);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
