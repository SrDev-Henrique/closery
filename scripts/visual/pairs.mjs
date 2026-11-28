// Os pares do pixel (spec §5.3 e §5.5): para cada estado, semeia o banco visual, abre o app e a cópia
// do protótipo na mesma largura, copia para o protótipo o que depende do relógio (patch), roda os
// passos dos dois lados, iguala a altura (a maior das duas, com o mínimo de 844/900), captura,
// mascara e mede a página inteira e cada região. Rodar com node; um navegador por estado.
//   node scripts/visual/pairs.mjs --screen=inicio --out=processo [estado …] [--sizes=1440,390] [--sufixo=-antes]
// Grava <out>/pares/<estado>-<largura><sufixo>-{proto,app,diff}.png, -<região>-{proto,app,diff}.png
// e mescla <out>/pares/results.json. --sizes vale para todos os estados escolhidos.
import { existsSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

import {
  closeState,
  commonHeight,
  launchBrowser,
  openState,
  shoot,
} from "./capture.mjs";
import { parseCliArgs, parseSizes } from "./config.mjs";
import { diffFiles, regionDiff, unionRect } from "./diff.mjs";
import { readPng, writePng } from "./image.mjs";
import { readJsonInsideSdd, sddPath, writeInsideSdd } from "./paths.mjs";
import {
  loadScreen,
  pickState,
  readState,
  resolvePath,
  runSeed,
} from "./screen.mjs";

/** @typedef {import("./screen.mjs").ScreenConfig} ScreenConfig */
/** @typedef {import("./screen.mjs").StateConfig} StateConfig */
/** @typedef {import("./image.mjs").Rect} Rect */
/** @typedef {import("@playwright/test").Page} Page */

const USAGE =
  "uso: node scripts/visual/pairs.mjs --screen=<nome> | --config=<relativo a .git/sdd> --out=<pasta em .git/sdd> [estado …] [--sizes=1440,390] [--sufixo=<texto>]";
const DEFAULT_SIZES = [1440, 390];
const KNOWN_FLAGS = ["screen", "config", "out", "sizes", "sufixo"];

/** @param {unknown} error */
function messageOf(error) {
  return error instanceof Error ? error.message : String(error);
}

/**
 * Os retângulos que a expressão de máscara devolve na página, arredondados.
 * @param {Page} page
 * @param {string | undefined} expr
 * @returns {Promise<Rect[]>}
 */
async function rectsOf(page, expr) {
  if (!expr) return [];
  const rects = await page.evaluate(expr);
  if (!Array.isArray(rects)) {
    throw new Error(
      "masks: a expressão não devolveu uma lista de [x, y, w, h]",
    );
  }
  return rects.map(
    (rect) => /** @type {Rect} */ (rect.map((v) => Math.round(v))),
  );
}

/**
 * @param {Page} page
 * @param {string} expr
 * @returns {Promise<Rect | null>}
 */
async function regionOf(page, expr) {
  const rect = await page.evaluate(expr);
  if (!Array.isArray(rect) || rect.length !== 4) return null;
  return /** @type {Rect} */ (rect.map((v) => Math.round(v)));
}

/**
 * Um par: as duas capturas, a diferença da página e a de cada região.
 * @param {import("@playwright/test").Browser} browser
 * @param {{ screen: ScreenConfig, state: StateConfig, out: string, path: string, width: number, tag: string, pairsDir: string }} job
 */
async function measurePair(browser, job) {
  const { screen, state, out, path, width, tag, pairsDir } = job;
  const opened = await openState(browser, { screen, state, path, width, out });
  try {
    const { app, proto } = opened;
    if (!proto)
      throw new Error(`o estado não tem cópia do protótipo: ${state.proto}`);
    const { height, natural } = await commonHeight(opened, state, width);
    const files = {
      proto: join(pairsDir, `${tag}-proto.png`),
      app: join(pairsDir, `${tag}-app.png`),
      diff: join(pairsDir, `${tag}-diff.png`),
    };
    await shoot(app.page, { width, height, out: files.app });
    await shoot(proto.page, { width, height, out: files.proto });
    const masks = [
      ...(await rectsOf(app.page, screen.masks)),
      ...(await rectsOf(proto.page, screen.masks)),
    ];
    const page = diffFiles(files.proto, files.app, files.diff, masks);

    /** @type {Record<string, number | null>} */
    const regions = {};
    for (const [region, expr] of Object.entries(state.regions ?? {})) {
      const inApp = await regionOf(app.page, expr);
      const inProto = await regionOf(proto.page, expr);
      if (!inApp || !inProto) {
        regions[region] = null;
        console.log(`${tag}: a região ${region} não apareceu nos dois lados`);
        continue;
      }
      const result = regionDiff(
        readPng(files.proto),
        readPng(files.app),
        unionRect(inProto, inApp),
        masks,
      );
      writePng(join(pairsDir, `${tag}-${region}-proto.png`), result.crops.a);
      writePng(join(pairsDir, `${tag}-${region}-app.png`), result.crops.b);
      writePng(join(pairsDir, `${tag}-${region}-diff.png`), result.crops.diff);
      regions[region] = Number(result.pct.toFixed(3));
    }
    return {
      pct: Number(page.pct.toFixed(3)),
      size: `${width}x${height}`,
      natural,
      masks,
      regions,
      failed: opened.logs.app.failed,
      at: new Date().toISOString(),
    };
  } finally {
    await closeState(opened);
  }
}

async function main() {
  const { flags, positional } = parseCliArgs(process.argv.slice(2));
  const unknown = Object.keys(flags).filter(
    (name) => !KNOWN_FLAGS.includes(name),
  );
  if (unknown.length > 0)
    throw new Error(`argumento desconhecido: --${unknown[0]}\n${USAGE}`);
  if (typeof flags.out !== "string" || flags.out === "")
    throw new Error(`falta --out\n${USAGE}`);
  const out = flags.out;
  const pairsDir = sddPath(out, "pares");
  const screen = await loadScreen({
    screen: /** @type {string | undefined} */ (flags.screen),
    config: /** @type {string | undefined} */ (flags.config),
  });
  const sizes =
    flags.sizes === undefined
      ? null
      : parseSizes(String(flags.sizes), DEFAULT_SIZES);
  if (flags.sufixo === true || !/^[a-z0-9-]*$/.test(flags.sufixo ?? "")) {
    throw new Error(
      "--sufixo: letras minúsculas, números e hífen (ex.: --sufixo=-antes)",
    );
  }
  const suffix = typeof flags.sufixo === "string" ? flags.sufixo : "";
  const names = positional.length > 0 ? positional : Object.keys(screen.states);
  for (const name of names) pickState(screen, name);

  const resultsFile = join(pairsDir, "results.json");
  /** @type {Record<string, unknown>} */
  const results = existsSync(resultsFile)
    ? /** @type {Record<string, unknown>} */ (readJsonInsideSdd(resultsFile))
    : {};
  let failures = 0;
  let seeded = "";
  for (const name of names) {
    const state = pickState(screen, name);
    if (state.proto === null) {
      console.log(
        `${name}: pulado (sem protótipo; use interact.mjs ou probe.mjs --app-only)`,
      );
      continue;
    }
    const seedKey = `${state.seed}|${state.sector ?? ""}`;
    if (seeded !== seedKey) {
      runSeed(state);
      seeded = seedKey;
    }
    const path = resolvePath(state.path, readState());
    const browser = await launchBrowser();
    try {
      for (const width of sizes ?? state.sizes ?? DEFAULT_SIZES) {
        const tag = `${name}-${width}${suffix}`;
        try {
          const result = await measurePair(browser, {
            screen,
            state,
            out,
            path,
            width,
            tag,
            pairsDir,
          });
          results[tag] = result;
          const regions = Object.entries(result.regions)
            .map(
              ([region, pct]) =>
                `  ${region} ${pct === null ? "-" : `${pct.toFixed(3)}%`}`,
            )
            .join("");
          console.log(
            `${tag}: ${result.pct.toFixed(3)}%${regions}  (${result.size}; app ${result.natural.app}px, proto ${result.natural.proto}px)`,
          );
        } catch (error) {
          failures += 1;
          console.log(`${tag}: ERRO ${messageOf(error)}`);
        }
      }
    } finally {
      await browser.close();
    }
    writeInsideSdd(resultsFile, `${JSON.stringify(results, null, 1)}\n`);
  }
  if (failures > 0) process.exitCode = 1;
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  main().catch((error) => {
    console.error(`visual:pairs: ${messageOf(error)}`);
    process.exitCode = 1;
  });
}
