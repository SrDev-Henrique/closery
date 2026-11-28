// Sonda (spec §5.3): avalia uma expressão nas duas páginas do estado (ou só no app, com --app-only)
// depois do patch e dos passos, e imprime lado a lado. É a prova por estilo computado (foco,
// contraste, tamanho, hover): nunca só a string da classe. Rodar com node; semeia o estado antes.
//   node scripts/visual/probe.mjs --screen=inicio --state=admin-escuro --width=1440 --out=processo "<expressão>"
//   node scripts/visual/probe.mjs --screen=provas --state=hover-statlink --width=1440 --app-only "<expressão>"
// Imprime "PROTO <json>" e "APP <json>". O --out (onde estão as cópias) só é exigido sem --app-only.
import { pathToFileURL } from "node:url";

import { closeState, launchBrowser, openState } from "./capture.mjs";
import { parseCliArgs, parseSizes } from "./config.mjs";
import {
  loadScreen,
  pickState,
  readState,
  resolvePath,
  runSeed,
} from "./screen.mjs";

const USAGE =
  'uso: node scripts/visual/probe.mjs --screen=<nome> | --config=<relativo> --state=<estado> --width=<px> [--out=<pasta em .git/sdd>] [--app-only] "<expressão>"';
const KNOWN_FLAGS = ["screen", "config", "state", "width", "out", "app-only"];

async function main() {
  const { flags, positional } = parseCliArgs(process.argv.slice(2));
  const unknown = Object.keys(flags).filter(
    (name) => !KNOWN_FLAGS.includes(name),
  );
  const [expression] = positional;
  if (unknown.length > 0 || positional.length !== 1 || !expression)
    throw new Error(USAGE);
  const appOnly = flags["app-only"] === true;
  const out =
    typeof flags.out === "string" && flags.out !== "" ? flags.out : undefined;
  if (!appOnly && out === undefined)
    throw new Error(`falta --out (ou use --app-only)\n${USAGE}`);
  const screen = await loadScreen({
    screen: /** @type {string | undefined} */ (flags.screen),
    config: /** @type {string | undefined} */ (flags.config),
  });
  const stateName = String(flags.state ?? "");
  const state = pickState(screen, stateName);
  if (!appOnly && !state.proto) {
    throw new Error(
      `o estado ${stateName} não tem cópia do protótipo: use --app-only`,
    );
  }
  if (flags.width === undefined) throw new Error(`falta --width\n${USAGE}`);
  const [width = 0] = parseSizes(String(flags.width), []);

  runSeed(state);
  const path = resolvePath(state.path, readState());
  const browser = await launchBrowser();
  try {
    const opened = await openState(browser, {
      screen,
      state,
      path,
      width,
      out: appOnly ? undefined : out,
    });
    try {
      if (opened.proto) {
        console.log(
          `PROTO ${JSON.stringify(await opened.proto.page.evaluate(expression))}`,
        );
      }
      console.log(
        `APP ${JSON.stringify(await opened.app.page.evaluate(expression))}`,
      );
    } finally {
      await closeState(opened);
    }
  } finally {
    await browser.close();
  }
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  main().catch((error) => {
    console.error(
      `probe: ${error instanceof Error ? error.message : String(error)}`,
    );
    process.exitCode = 1;
  });
}
