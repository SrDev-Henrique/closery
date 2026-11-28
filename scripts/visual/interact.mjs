// Interação (spec §5.3 e §6): roda os passos de um estado no app (e no protótipo, se houver cópia),
// registra o que aconteceu (requisições falhadas, amostras, notas) e captura os dois lados. Código 1
// se o `expect.failedRequests` do estado não foi atingido. Rodar com node; semeia o estado antes.
//   node scripts/visual/interact.mjs --screen=provas --state=falha-de-rede --out=processo [--width=1440]
// Grava <out>/interacoes/<estado>-<largura>-{app,proto}.png e <estado>-<largura>.json.
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
import { sddPath, writeInsideSdd } from "./paths.mjs";
import {
  loadScreen,
  pickState,
  readState,
  resolvePath,
  runSeed,
} from "./screen.mjs";

const USAGE =
  "uso: node scripts/visual/interact.mjs --screen=<nome> | --config=<relativo> --state=<estado> --out=<pasta em .git/sdd> [--width=1440]";
const KNOWN_FLAGS = ["screen", "config", "state", "out", "width"];

async function main() {
  const { flags, positional } = parseCliArgs(process.argv.slice(2));
  const unknown = Object.keys(flags).filter(
    (name) => !KNOWN_FLAGS.includes(name),
  );
  if (unknown.length > 0 || positional.length > 0) throw new Error(USAGE);
  if (typeof flags.out !== "string" || flags.out === "")
    throw new Error(`falta --out\n${USAGE}`);
  const out = flags.out;
  const dir = sddPath(out, "interacoes");
  const screen = await loadScreen({
    screen: /** @type {string | undefined} */ (flags.screen),
    config: /** @type {string | undefined} */ (flags.config),
  });
  const stateName = String(flags.state ?? "");
  const state = pickState(screen, stateName);
  const [width = 1440] = parseSizes(
    flags.width === undefined ? undefined : String(flags.width),
    [1440],
  );
  const tag = `${stateName}-${width}`;

  runSeed(state);
  const path = resolvePath(state.path, readState());
  const browser = await launchBrowser();
  let failedCount = 0;
  try {
    const opened = await openState(browser, {
      screen,
      state,
      path,
      width,
      out,
    });
    try {
      const { height } = await commonHeight(opened, state, width);
      await shoot(opened.app.page, {
        width,
        height,
        out: join(dir, `${tag}-app.png`),
      });
      if (opened.proto) {
        await shoot(opened.proto.page, {
          width,
          height,
          out: join(dir, `${tag}-proto.png`),
        });
      }
      failedCount = opened.logs.app.failed.length;
      writeInsideSdd(
        join(dir, `${tag}.json`),
        `${JSON.stringify({ state: stateName, width, expect: state.expect ?? null, app: opened.logs.app, proto: opened.logs.proto, at: new Date().toISOString() }, null, 1)}\n`,
      );
      for (const failure of opened.logs.app.failed) {
        console.log(
          `falhou: ${failure.method} ${failure.url} (${failure.error})`,
        );
      }
      for (const sample of opened.logs.app.samples)
        console.log(`amostra ${sample.at}ms: ${sample.value}`);
      console.log(
        `gravado ${out}/interacoes/${tag}-app.png${opened.proto ? " e -proto.png" : ""} e ${tag}.json`,
      );
    } finally {
      await closeState(opened);
    }
  } finally {
    await browser.close();
  }

  const wanted = state.expect?.failedRequests;
  if (wanted !== undefined) {
    if (failedCount < wanted) {
      console.error(
        `esperava ao menos ${wanted} requisição(ões) falhada(s); houve ${failedCount}`,
      );
      process.exitCode = 1;
    } else {
      console.log(
        `requisições falhadas: ${failedCount} (esperado ao menos ${wanted})`,
      );
    }
  }
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  main().catch((error) => {
    console.error(
      `interact: ${error instanceof Error ? error.message : String(error)}`,
    );
    process.exitCode = 1;
  });
}
