// Auditoria de legibilidade (spec §5.3): para cada tela do `audit` da configuração, em cada tema e
// tamanho, captura a página e mede no próprio DOM o contraste do texto, o alvo de toque abaixo de
// 860px, a rolagem horizontal, a borda de campo e o fundo que some no do pai (contrast.mjs). Rodar
// com node, com o estado semeado antes (bun run visual:seed state geral:rico). Uma sessão por pessoa,
// reaproveitada; um contexto por captura.
//   node scripts/visual/audit.mjs --screen=legibilidade --out=processo [--only=a,b] [--themes=dark,light] [--sizes=1440x900,390x844] [--dir=legibilidade]
// Grava <out>/<dir>/<tela>-<escuro|claro>-<largura>.png e mescla <out>/<dir>/audit.json.
import { existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { pathToFileURL } from "node:url";

import pg from "pg";

import { HIDE_DEV_CSS, launchBrowser, loginAs, settle } from "./capture.mjs";
import {
  assertVisualBaseUrl,
  assertVisualDbUrl,
  parseCliArgs,
  parseSizes,
  THEME_STORAGE_KEY,
  VISUAL_BASE_URL,
  VISUAL_DB_URL,
} from "./config.mjs";
import { auditScript } from "./contrast.mjs";
import {
  assertInsideSdd,
  readJsonInsideSdd,
  sddPath,
  writeInsideSdd,
} from "./paths.mjs";
import { loadScreen, readState, resolvePath } from "./screen.mjs";
import { runSteps } from "./steps.mjs";

/** @typedef {import("./screen.mjs").AuditScreen} AuditScreen */
/** @typedef {import("./screen.mjs").PersonKey} PersonKey */

const USAGE =
  "uso: node scripts/visual/audit.mjs --screen=<nome> | --config=<relativo> --out=<pasta em .git/sdd> [--only=a,b] [--themes=dark,light] [--sizes=1440x900,390x844] [--dir=legibilidade]";
const KNOWN_FLAGS = [
  "screen",
  "config",
  "out",
  "only",
  "themes",
  "sizes",
  "dir",
];
const BASE = assertVisualBaseUrl(VISUAL_BASE_URL);
const LOAD_TIMEOUT_MS = 120_000;
const EXTRA_WIDTH_HEIGHT = 900;
const AFTER_SETTLE_MS = 600;
// Os marcadores que a auditoria resolve no banco visual (o {setor} vem do state.json).
const ID_QUERIES = {
  pendente:
    "select id from handover where status = 'delivered' order by delivered_at desc limit 1",
  corrigida:
    "select handover_id as id from handover_correction order by corrected_at limit 1",
  solicitacao:
    "select id from request where status = 'requested' order by status_changed_at limit 1",
};

/** @param {unknown} error */
function messageOf(error) {
  return error instanceof Error ? error.message : String(error);
}

/**
 * @param {string | true | undefined} value
 * @returns {("dark" | "light")[]}
 */
function parseThemes(value) {
  const themes = String(value ?? "dark,light")
    .split(",")
    .map((t) => t.trim());
  for (const theme of themes) {
    if (theme !== "dark" && theme !== "light")
      throw new Error(`tema inválido: ${theme}`);
  }
  return /** @type {("dark" | "light")[]} */ (themes);
}

/**
 * "1440x900,390x844" → [[1440, 900], [390, 844]].
 * @param {string | true | undefined} value
 * @returns {[number, number][]}
 */
function parseViewports(value) {
  return String(value ?? "1440x900,390x844")
    .split(",")
    .map((token) => {
      const match = /^(\d+)x(\d+)$/.exec(token.trim());
      if (!match) throw new Error(`tamanho no formato LxA: ${token}`);
      const [width = 0] = parseSizes(match[1], []);
      const [height = 0] = parseSizes(match[2], []);
      return /** @type {[number, number]} */ ([width, height]);
    });
}

/**
 * Os ids que os caminhos escolhidos pedem, por consulta ao banco visual.
 * @param {readonly AuditScreen[]} entries
 * @returns {Promise<Record<string, string>>}
 */
async function resolveIds(entries) {
  const wanted = Object.keys(ID_QUERIES).filter((key) =>
    entries.some((entry) => entry.path.includes(`{${key}}`)),
  );
  if (wanted.length === 0) return {};
  const client = new pg.Client({
    connectionString: assertVisualDbUrl(VISUAL_DB_URL),
  });
  await client.connect();
  try {
    /** @type {Record<string, string>} */
    const ids = {};
    for (const key of wanted) {
      const result = await client.query(
        ID_QUERIES[/** @type {keyof typeof ID_QUERIES} */ (key)],
      );
      const id = result.rows[0]?.id;
      if (typeof id !== "string") {
        throw new Error(
          `sem valor para {${key}} no banco visual (semeie geral:rico)`,
        );
      }
      ids[key] = id;
    }
    return ids;
  } finally {
    await client.end();
  }
}

async function main() {
  const { flags, positional } = parseCliArgs(process.argv.slice(2));
  const unknown = Object.keys(flags).filter(
    (name) => !KNOWN_FLAGS.includes(name),
  );
  if (unknown.length > 0 || positional.length > 0) throw new Error(USAGE);
  if (typeof flags.out !== "string" || flags.out === "")
    throw new Error(`falta --out\n${USAGE}`);
  const dirName =
    typeof flags.dir === "string" && flags.dir !== ""
      ? flags.dir
      : "legibilidade";
  const dir = sddPath(flags.out, dirName);
  const screen = await loadScreen({
    screen: /** @type {string | undefined} */ (flags.screen),
    config: /** @type {string | undefined} */ (flags.config),
  });
  const audit = screen.audit ?? [];
  if (audit.length === 0)
    throw new Error(`a tela ${screen.name} não tem audit`);
  const only =
    typeof flags.only === "string"
      ? flags.only
          .split(",")
          .map((name) => name.trim())
          .filter(Boolean)
      : null;
  const missing = (only ?? []).filter(
    (name) => !audit.some((entry) => entry.name === name),
  );
  if (missing.length > 0)
    throw new Error(`tela desconhecida no audit: ${missing.join(", ")}`);
  const entries = only
    ? audit.filter((entry) => only.includes(entry.name))
    : audit;
  const themes = parseThemes(flags.themes);
  const viewports = parseViewports(flags.sizes);

  const state = readState();
  console.log(`estado do banco: ${state.state} (setor ${state.sector})`);
  const values = { sectorId: state.sectorId, ...(await resolveIds(entries)) };

  const auditFile = join(dir, "audit.json");
  /** @type {Record<string, unknown>} */
  const results = existsSync(auditFile)
    ? /** @type {Record<string, unknown>} */ (readJsonInsideSdd(auditFile))
    : {};
  /** @type {Partial<Record<PersonKey, Awaited<ReturnType<import("@playwright/test").BrowserContext["storageState"]>>>>} */
  const sessions = {};
  let failures = 0;

  const browser = await launchBrowser();
  /** @param {PersonKey} person */
  const sessionOf = async (person) => {
    const cached = sessions[person];
    if (cached) return cached;
    const context = await browser.newContext();
    try {
      await loginAs(context, person);
      const storage = await context.storageState();
      sessions[person] = storage;
      return storage;
    } finally {
      await context.close();
    }
  };

  try {
    for (const entry of entries) {
      const sizes = [
        ...viewports,
        ...(entry.extraWidths ?? []).map(
          (w) => /** @type {[number, number]} */ ([w, EXTRA_WIDTH_HEIGHT]),
        ),
      ];
      for (const theme of themes) {
        for (const [width, height] of sizes) {
          const tag = `${entry.name}-${theme === "dark" ? "escuro" : "claro"}-${width}`;
          const context = await browser.newContext({
            viewport: { width, height },
            deviceScaleFactor: 1,
            reducedMotion: "reduce",
            ...(entry.person
              ? { storageState: await sessionOf(entry.person) }
              : {}),
          });
          try {
            await context.addInitScript(
              ({ key, value }) => {
                try {
                  localStorage.setItem(key, value);
                } catch {
                  // Storage bloqueado: fica o tema padrão (escuro).
                }
              },
              { key: THEME_STORAGE_KEY, value: theme },
            );
            const page = await context.newPage();
            await page.goto(
              new URL(resolvePath(entry.path, values), BASE).href,
              {
                waitUntil: "load",
                timeout: LOAD_TIMEOUT_MS,
              },
            );
            await page.addStyleTag({ content: HIDE_DEV_CSS });
            if (entry.steps) {
              await runSteps(page, entry.steps);
              // Um passo que navega perde o estilo: põe de novo.
              await page.addStyleTag({ content: HIDE_DEV_CSS });
            }
            await settle(page);
            await page.waitForTimeout(AFTER_SETTLE_MS);
            const file = assertInsideSdd(join(dir, `${tag}.png`));
            mkdirSync(dirname(file), { recursive: true });
            await page.screenshot({
              path: file,
              fullPage: !entry.viewportOnly,
            });
            const found = await page.evaluate(auditScript());
            results[tag] = found;
            const weakFields = found.inputs.filter(
              (i) => i.border < 1.3 && i.fill < 1.1,
            ).length;
            console.log(
              `${tag}: contraste ${found.contrast.length}, alvos ${found.targets.length}, campos ${weakFields}, some ${found.sameBg.length}${found.overflow ? `, ROLA ${found.overflow}px` : ""}`,
            );
          } catch (error) {
            failures += 1;
            console.log(`${tag}: ERRO ${messageOf(error).slice(0, 200)}`);
          } finally {
            await context.close();
          }
        }
      }
    }
  } finally {
    await browser.close();
    writeInsideSdd(auditFile, `${JSON.stringify(results, null, 1)}\n`);
  }
  if (failures > 0) process.exitCode = 1;
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  main().catch((error) => {
    console.error(`visual:audit: ${messageOf(error)}`);
    process.exitCode = 1;
  });
}
