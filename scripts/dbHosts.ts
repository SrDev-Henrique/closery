import { loadEnvConfig } from "@next/env";

import { formatDatabaseHosts } from "@/db/databaseHost";
import { resolveDatabaseUrls } from "@/db/databaseUrl";

// Só o host de cada banco, nunca usuário, senha nem o nome do banco: serve para
// conferir o alvo antes de `bun run db:migrate` (o drizzle-kit não tem trava).
loadEnvConfig(process.cwd());
console.log(formatDatabaseHosts(resolveDatabaseUrls(process.env)));
