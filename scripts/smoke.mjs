// Smoke test de produção: `bun run smoke https://<projeto>.vercel.app`.
// Só GET, sem credencial e sem seguir redirecionamento. As regras vivem em
// scripts/smokeChecks.mjs (testadas); aqui só se busca cada página uma vez e se
// repassa o resultado. Use --local para o `next start` do próprio computador
// (as verificações que só a Vercel responde ficam PULADO).
import {
  checkHealth,
  checkHsts,
  checkNoindex,
  checkNoReferrer,
  checkPublicPage,
  checkRedirectToSignIn,
  checkRegion,
  checkRobots,
  checkSecurityHeaders,
  formatSmokeReport,
  parseSmokeArgs,
  SMOKE_LABELS,
} from "./smokeChecks.mjs";

/**
 * @param {string} origin
 * @param {string} path
 * @returns {Promise<{ status: number, headers: Headers, body: string } | null>}
 */
async function fetchPage(origin, path) {
  try {
    const response = await fetch(`${origin}${path}`, {
      redirect: "manual",
      cache: "no-store",
      headers: { "user-agent": "closery-smoke" },
    });
    return {
      status: response.status,
      headers: response.headers,
      body: await response.text(),
    };
  } catch {
    return null;
  }
}

/**
 * A página que não respondeu reprova todas as verificações dela.
 * @typedef {{ status: number, headers: Headers, body: string }} Page
 * @param {import("./smokeChecks.mjs").SmokeId} id
 * @param {Page | null} page
 * @param {(page: Page) => import("./smokeChecks.mjs").SmokeResult} check
 * @returns {import("./smokeChecks.mjs").SmokeResult}
 */
function runCheck(id, page, check) {
  if (page === null) {
    return {
      id,
      label: SMOKE_LABELS[id],
      status: "falhou",
      detail: "sem resposta",
    };
  }
  return check(page);
}

async function main() {
  const { origin, local } = parseSmokeArgs(process.argv.slice(2));

  const health = await fetchPage(origin, "/api/health");
  const signIn = await fetchPage(origin, "/entrar");
  const robots = await fetchPage(origin, "/robots.txt");
  const invite = await fetchPage(origin, "/convite/smoke-token-inexistente");
  const reset = await fetchPage(origin, "/redefinir-senha");
  const home = await fetchPage(origin, "/");
  const privacy = await fetchPage(origin, "/privacidade");

  // Com --local, região e HSTS só a Vercel responde: ficam PULADO mesmo que a
  // página não tenha respondido.
  const results = [
    runCheck("health", health, (page) => checkHealth(page.status, page.body)),
    local
      ? checkRegion(null, true)
      : runCheck("region", health, (page) =>
          checkRegion(page.headers.get("x-vercel-id"), false),
        ),
    local
      ? checkHsts(new Headers(), true)
      : runCheck("hsts", signIn, (page) => checkHsts(page.headers, false)),
    runCheck("security-headers", signIn, (page) =>
      checkSecurityHeaders(page.status, page.headers),
    ),
    runCheck("noindex", signIn, (page) =>
      checkNoindex(page.headers, page.body),
    ),
    runCheck("robots", robots, (page) => checkRobots(page.status, page.body)),
    runCheck("no-referrer-convite", invite, (page) =>
      checkNoReferrer("no-referrer-convite", page.headers),
    ),
    runCheck("no-referrer-redefinir", reset, (page) =>
      checkNoReferrer("no-referrer-redefinir", page.headers),
    ),
    runCheck("redirect", home, (page) =>
      checkRedirectToSignIn(page.status, page.headers.get("location")),
    ),
    runCheck("privacy", privacy, (page) => checkPublicPage(page.status)),
  ];

  const report = formatSmokeReport(results);
  console.log(report.text);
  process.exitCode = report.exitCode;
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : "Falha inesperada.");
  process.exitCode = 1;
});
