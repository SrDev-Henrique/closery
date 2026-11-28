// Captura do app (3202) e do protótipo (a cópia em .git/sdd) no mesmo tamanho (spec §5.3). Rodar com
// node: o Chromium do Playwright não abre pelo Bun no Windows. Login pela API (cada login sai de um
// IP próprio, por causa do rate limit do `next start`), tema no localStorage antes da página,
// indicador do `next dev` escondido, movimento reduzido (PB-D6) e espera das fontes e das animações.
// "Página inteira" é uma janela da altura do conteúdo, não o fullPage do Playwright: a moldura do
// protótipo é 100vh com o <main> rolando por dentro, e a sidebar (100svh) vai até o fim nos dois lados.
//   node scripts/visual/capture.mjs app <caminho> <LxA> <dark|light> <saída> [pessoa]
//   node scripts/visual/capture.mjs proto <arquivo> <LxA> <saída>
// (arquivo e saída relativos a .git/sdd; a altura final é a maior entre A e a do conteúdo)
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { pathToFileURL } from "node:url";

import { chromium } from "@playwright/test";

import {
  assertVisualBaseUrl,
  fakeClientIp,
  parseCliArgs,
  parseSizes,
  THEME_STORAGE_KEY,
  VISUAL_BASE_URL,
} from "./config.mjs";
import { assertInsideSdd, sddPath } from "./paths.mjs";
import { minHeight, protoFile } from "./screen.mjs";
import { runSteps } from "./steps.mjs";
import { VISUAL_PASSWORD, VISUAL_PEOPLE } from "./vocabulary.mjs";

/** @typedef {import("@playwright/test").Browser} Browser */
/** @typedef {import("@playwright/test").BrowserContext} BrowserContext */
/** @typedef {import("@playwright/test").Page} Page */
/** @typedef {import("./screen.mjs").PersonKey} PersonKey */
/** @typedef {import("./screen.mjs").ScreenConfig} ScreenConfig */
/** @typedef {import("./screen.mjs").StateConfig} StateConfig */
/** @typedef {import("./steps.mjs").StepLog} StepLog */
/** @typedef {{ context: BrowserContext, page: Page, height: number }} Opened */

/** O indicador do `next dev` (canto inferior) não existe em produção. */
export const HIDE_DEV_CSS = "nextjs-portal{display:none!important}";

const BASE = assertVisualBaseUrl(VISUAL_BASE_URL);
const LOAD_TIMEOUT_MS = 180_000;
const PROTO_TIMEOUT_MS = 120_000;
const ANIMATIONS_TIMEOUT_MS = 3_000;
const SETTLE_MS = 300;
const IP_SPACE = 65_024;
const USAGE =
  "uso: node scripts/visual/capture.mjs app <caminho> <LxA> <dark|light> <saída> [pessoa] | proto <arquivo> <LxA> <saída> (arquivo e saída relativos a .git/sdd)";

// Base aleatória: duas rodadas seguidas não repetem os IPs dentro da janela do rate limit.
let nextIp = Math.floor(Math.random() * 60_000);

/** @returns {Promise<Browser>} */
export async function launchBrowser() {
  return chromium.launch();
}

/**
 * Entra como a pessoa pela API do Better Auth; o cookie da sessão fica no contexto.
 * @param {BrowserContext} context
 * @param {PersonKey} person
 */
export async function loginAs(context, person) {
  if (!Object.hasOwn(VISUAL_PEOPLE, person)) {
    throw new Error(`pessoa desconhecida: ${String(person)}`);
  }
  const ip = fakeClientIp(nextIp % IP_SPACE);
  nextIp += 1;
  const response = await context.request.post(
    `${BASE}/api/auth/sign-in/email`,
    {
      data: { email: VISUAL_PEOPLE[person].email, password: VISUAL_PASSWORD },
      headers: { origin: BASE, "x-forwarded-for": ip },
      timeout: LOAD_TIMEOUT_MS,
    },
  );
  if (!response.ok()) {
    throw new Error(
      `login de ${person}: HTTP ${response.status()} (rodou o bun run visual:people?)`,
    );
  }
}

/**
 * @param {Browser} browser
 * @param {number} width
 * @param {"reduce" | "no-preference" | undefined} reducedMotion
 */
function newContext(browser, width, reducedMotion) {
  return browser.newContext({
    viewport: { width, height: minHeight(width) },
    deviceScaleFactor: 1,
    reducedMotion: reducedMotion ?? "reduce",
  });
}

/**
 * Espera as fontes, as animações pararem (até 3 s; uma infinita não trava) e mais 300 ms.
 * @param {Page} page
 */
export async function settle(page) {
  await page.evaluate(async () => {
    await document.fonts.ready;
  });
  await page
    .waitForFunction(
      () => document.getAnimations().every((a) => a.playState !== "running"),
      null,
      { timeout: ANIMATIONS_TIMEOUT_MS, polling: 100 },
    )
    .catch(() => {
      // Animação infinita (ou que não terminou em 3 s): a captura segue assim mesmo.
    });
  await page.waitForTimeout(SETTLE_MS);
}

/**
 * A altura do conteúdo: no app, a do documento; no protótipo, a do <main> que rola por dentro da
 * moldura de 100vh (no mínimo a janela).
 * @param {Page} page
 * @param {"app" | "proto"} kind
 * @returns {Promise<number>}
 */
export async function naturalHeight(page, kind) {
  return page.evaluate((side) => {
    if (side === "proto") {
      const main = document.querySelector("main");
      return Math.max(main ? main.scrollHeight : 0, window.innerHeight);
    }
    return document.documentElement.scrollHeight;
  }, kind);
}

/**
 * Abre o app logado, no tema, e espera o seletor `ready`.
 * @param {Browser} browser
 * @param {{ path: string, width: number, theme: "dark" | "light", person: PersonKey | null, ready: string, css?: string, reducedMotion?: "reduce" | "no-preference" }} opts
 * @returns {Promise<{ context: BrowserContext, page: Page, height: number }>}
 */
export async function openApp(browser, opts) {
  const { path, width, theme, person, ready, css = "", reducedMotion } = opts;
  if (!path.startsWith("/"))
    throw new Error(`caminho do app começa com /: ${path}`);
  const context = await newContext(browser, width, reducedMotion);
  try {
    if (person) await loginAs(context, person);
    await context.addInitScript(
      ({ key, value }) => {
        try {
          localStorage.setItem(key, value);
        } catch {
          // Storage bloqueado: a página fica no tema padrão (escuro).
        }
      },
      { key: THEME_STORAGE_KEY, value: theme },
    );
    const page = await context.newPage();
    await page.goto(new URL(path, BASE).href, {
      waitUntil: "load",
      timeout: LOAD_TIMEOUT_MS,
    });
    await page.addStyleTag({ content: HIDE_DEV_CSS + css });
    await page
      .locator(ready)
      .first()
      .waitFor({ state: "attached", timeout: LOAD_TIMEOUT_MS });
    await settle(page);
    return { context, page, height: await naturalHeight(page, "app") };
  } catch (error) {
    await context.close();
    throw error;
  }
}

/**
 * Abre a cópia do protótipo (um arquivo dentro de .git/sdd).
 * @param {Browser} browser
 * @param {{ file: string, width: number, reducedMotion?: "reduce" | "no-preference" }} opts
 * @returns {Promise<{ context: BrowserContext, page: Page, height: number }>}
 */
export async function openProto(browser, opts) {
  const { file, width, reducedMotion } = opts;
  const target = assertInsideSdd(file);
  const context = await newContext(browser, width, reducedMotion);
  try {
    const page = await context.newPage();
    await page.goto(pathToFileURL(target).href, {
      waitUntil: "networkidle",
      timeout: PROTO_TIMEOUT_MS,
    });
    await page
      .locator("main")
      .first()
      .waitFor({ state: "attached", timeout: PROTO_TIMEOUT_MS });
    await settle(page);
    return { context, page, height: await naturalHeight(page, "proto") };
  } catch (error) {
    await context.close();
    throw error;
  }
}

/**
 * Abre o estado de uma tela: o app (logado, no tema, com o `css` do estado) e, se `out` vier e o
 * estado tiver cópia, o protótipo; copia o `patch` do app para o protótipo; com `viewportOnly`,
 * põe a janela na altura mínima; e roda os passos dos dois lados. Quem chama fecha com closeState.
 * @param {Browser} browser
 * @param {{ screen: ScreenConfig, state: StateConfig, path: string, width: number, out?: string }} opts
 * @returns {Promise<{ app: Opened, proto: Opened | null, logs: { app: StepLog, proto: StepLog | null } }>}
 */
export async function openState(browser, opts) {
  const { screen, state, path, width, out } = opts;
  const app = await openApp(browser, {
    path,
    width,
    theme: state.theme,
    person: state.person,
    ready: screen.ready ?? "body",
    css: state.css,
    reducedMotion: "reduce",
  });
  /** @type {Opened | null} */
  let proto = null;
  try {
    if (out !== undefined && state.proto) {
      proto = await openProto(browser, {
        file: protoFile(out, screen, state.proto),
        width,
        reducedMotion: "reduce",
      });
      if (screen.patch) {
        const value = await app.page.evaluate(screen.patch.read);
        await proto.page.evaluate(
          `(${screen.patch.write})(${JSON.stringify(value)})`,
        );
      }
    }
    if (state.viewportOnly) {
      const height = minHeight(width);
      await app.page.setViewportSize({ width, height });
      if (proto) await proto.page.setViewportSize({ width, height });
    }
    const appLog = await runSteps(app.page, state.steps?.app ?? []);
    const protoLog = proto
      ? await runSteps(proto.page, state.steps?.proto ?? [])
      : null;
    return { app, proto, logs: { app: appLog, proto: protoLog } };
  } catch (error) {
    await closeState({ app, proto });
    throw error;
  }
}

/**
 * Fecha o que o openState abriu.
 * @param {{ app: Opened, proto: Opened | null }} opened
 */
export async function closeState(opened) {
  await opened.app.context.close();
  if (opened.proto) await opened.proto.context.close();
}

/**
 * A altura comum da captura: com `viewportOnly`, a mínima; senão, a maior das alturas naturais
 * (depois dos passos), no mínimo a mínima.
 * @param {{ app: Opened, proto: Opened | null }} opened
 * @param {Pick<StateConfig, "viewportOnly">} state
 * @param {number} width
 * @returns {Promise<{ height: number, natural: { app: number, proto: number | null } }>}
 */
export async function commonHeight(opened, state, width) {
  const natural = {
    app: await naturalHeight(opened.app.page, "app"),
    proto: opened.proto
      ? await naturalHeight(opened.proto.page, "proto")
      : null,
  };
  const height = state.viewportOnly
    ? minHeight(width)
    : Math.max(natural.app, natural.proto ?? 0, minHeight(width));
  return { height, natural };
}

/**
 * Põe a janela no tamanho, espera assentar e grava o PNG (destino conferido por assertInsideSdd).
 * @param {Page} page
 * @param {{ width: number, height: number, out: string, clip?: { x: number, y: number, width: number, height: number } }} opts
 */
export async function shoot(page, opts) {
  const { width, height, out, clip } = opts;
  const target = assertInsideSdd(out);
  mkdirSync(dirname(target), { recursive: true });
  await page.setViewportSize({ width, height });
  await settle(page);
  await page.screenshot({ path: target, ...(clip ? { clip } : {}) });
}

/**
 * @param {string | undefined} value
 * @returns {{ width: number, height: number }}
 */
function parseSize(value) {
  const match = /^(\d+)x(\d+)$/.exec(value ?? "");
  if (!match)
    throw new Error(`tamanho no formato LxA: ${String(value)}\n${USAGE}`);
  const [width = 0] = parseSizes(match[1], []);
  const [height = 0] = parseSizes(match[2], []);
  return { width, height };
}

async function main() {
  const { flags, positional } = parseCliArgs(process.argv.slice(2));
  if (Object.keys(flags).length > 0) throw new Error(USAGE);
  const [kind, target, size, ...rest] = positional;
  const { width, height } = parseSize(size);
  if (kind === "app") {
    const [theme, out, person = "ana"] = rest;
    if (
      (theme !== "dark" && theme !== "light") ||
      !out ||
      !target ||
      rest.length > 3
    ) {
      throw new Error(USAGE);
    }
    if (!Object.hasOwn(VISUAL_PEOPLE, person))
      throw new Error(`pessoa desconhecida: ${person}`);
    const outFile = sddPath(out);
    const browser = await launchBrowser();
    try {
      const opened = await openApp(browser, {
        path: target,
        width,
        theme,
        person: /** @type {PersonKey} */ (person),
        ready: "body",
      });
      const finalHeight = Math.max(height, opened.height);
      await shoot(opened.page, { width, height: finalHeight, out: outFile });
      console.log(`gravado ${out} (${width}x${finalHeight})`);
    } finally {
      await browser.close();
    }
    return;
  }
  if (kind === "proto") {
    const [out] = rest;
    if (!out || !target || rest.length > 1) throw new Error(USAGE);
    const file = sddPath(target);
    const outFile = sddPath(out);
    const browser = await launchBrowser();
    try {
      const opened = await openProto(browser, { file, width });
      const finalHeight = Math.max(height, opened.height);
      await shoot(opened.page, { width, height: finalHeight, out: outFile });
      console.log(`gravado ${out} (${width}x${finalHeight})`);
    } finally {
      await browser.close();
    }
    return;
  }
  throw new Error(USAGE);
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  main().catch((error) => {
    console.error(
      `capture: ${error instanceof Error ? error.message : String(error)}`,
    );
    process.exitCode = 1;
  });
}
