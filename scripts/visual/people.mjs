// Cadastra as quatro pessoas fictícias no app visual (node; spec §5.3), pela API do Better Auth, com
// o cookie do convite que a página /convite/<token> gravaria. "Já existe" conta como sucesso: rodar
// duas vezes não quebra. Antes: o app de pé na 3202 (com o env.sh) e `bun run visual:seed base`
// (os convites ficam em .git/sdd/visual-db/world.json). Nunca imprime token nem senha.
//   bun run visual:people
import { join } from "node:path";
import { pathToFileURL } from "node:url";

import {
  assertVisualBaseUrl,
  fakeClientIp,
  VISUAL_BASE_URL,
  VISUAL_INVITE_COOKIE,
} from "./config.mjs";
import { readJsonInsideSdd, VISUAL_DB_FILES, visualDbDir } from "./paths.mjs";
import { VISUAL_PASSWORD, VISUAL_PEOPLE } from "./vocabulary.mjs";

// Base dos IPs do cadastro: o rate limit do sign-up é por IP (10 por minuto no `next start`).
const IP_BASE = 100;
const SIGN_UP_TIMEOUT_MS = 180_000;

/**
 * Lê a resposta do sign-up: 2xx é cadastro novo; 422 com o código USER_ALREADY_EXISTS (o Better
 * Auth 1.7 devolve USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL) é "já existe", que também é sucesso; o
 * resto falhou.
 * @param {number} status
 * @param {string} body
 * @returns {"ok" | "existe" | "falhou"}
 */
export function signUpOutcome(status, body) {
  if (status >= 200 && status < 300) return "ok";
  if (status === 422 && /USER_ALREADY_EXISTS/.test(body)) return "existe";
  return "falhou";
}

/**
 * @param {"ok" | "existe" | "falhou"} outcome
 * @param {number} status
 */
function outcomeText(outcome, status) {
  if (outcome === "ok") return "cadastrada";
  if (outcome === "existe") return "já existe";
  return `falhou (HTTP ${status}; convite cancelado por um state? rode bun run visual:seed reopen-invites)`;
}

async function main() {
  const base = assertVisualBaseUrl(VISUAL_BASE_URL);
  const world = /** @type {{ invites?: Record<string, string> }} */ (
    readJsonInsideSdd(join(visualDbDir(), VISUAL_DB_FILES.world))
  );
  let failed = 0;
  for (const [index, [key, person]] of Object.entries(
    VISUAL_PEOPLE,
  ).entries()) {
    const token = world.invites?.[key];
    if (!token) {
      console.log(
        `${key}: sem convite no world.json (rode bun run visual:seed base)`,
      );
      failed += 1;
      continue;
    }
    let response;
    try {
      response = await fetch(`${base}/api/auth/sign-up/email`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          origin: base,
          "x-forwarded-for": fakeClientIp(IP_BASE + index),
          cookie: `${VISUAL_INVITE_COOKIE}=${token}`,
        },
        body: JSON.stringify({
          name: person.name,
          email: person.email,
          password: VISUAL_PASSWORD,
        }),
        signal: AbortSignal.timeout(SIGN_UP_TIMEOUT_MS),
      });
    } catch {
      console.log(
        `${key}: o app visual não respondeu em ${base} (suba o next na 3202 com o env.sh)`,
      );
      failed += 1;
      continue;
    }
    const outcome = signUpOutcome(response.status, await response.text());
    if (outcome === "falhou") failed += 1;
    console.log(`${key}: ${outcomeText(outcome, response.status)}`);
  }
  if (failed > 0) process.exitCode = 1;
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  main().catch((error) => {
    console.error(
      `visual:people: ${error instanceof Error ? error.message : String(error)}`,
    );
    process.exitCode = 1;
  });
}
