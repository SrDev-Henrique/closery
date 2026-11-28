// Lado a lado com zoom (spec §5.3): recorta a mesma região do protótipo, do app e da diferença de
// um par e empilha (protótipo em cima, app no meio, diferença embaixo), ampliada sem suavizar.
//   node scripts/visual/sbs.mjs <tag> <x> <y> <w> <h> [zoom] --dir=<relativo a .git/sdd>
// Lê <dir>/<tag>-{proto,app,diff}.png e grava <dir>/<tag>-zoom.png.
import { join } from "node:path";
import { pathToFileURL } from "node:url";

import { parseCliArgs, parseSizes } from "./config.mjs";
import { parseRect, readPng, stackRegion, writePng } from "./image.mjs";
import { sddPath } from "./paths.mjs";

const USAGE =
  "uso: node scripts/visual/sbs.mjs <tag> <x> <y> <w> <h> [zoom] --dir=<relativo a .git/sdd>";
const NAME = /^[a-z0-9][a-z0-9-]*$/;

function main() {
  const { flags, positional } = parseCliArgs(process.argv.slice(2));
  const unknown = Object.keys(flags).filter((name) => name !== "dir");
  const [tag, ...numbers] = positional;
  if (
    unknown.length > 0 ||
    !tag ||
    !NAME.test(tag) ||
    numbers.length < 4 ||
    numbers.length > 5
  ) {
    throw new Error(USAGE);
  }
  if (typeof flags.dir !== "string" || flags.dir === "")
    throw new Error(`falta --dir\n${USAGE}`);
  const dir = sddPath(flags.dir);
  const rect = parseRect(numbers.slice(0, 4));
  const [zoom = 1] = parseSizes(numbers[4], [1]);
  const parts = ["proto", "app", "diff"].map((side) =>
    readPng(join(dir, `${tag}-${side}.png`)),
  );
  const target = join(dir, `${tag}-zoom.png`);
  writePng(target, stackRegion(parts, rect, zoom));
  console.log(`gravado ${flags.dir}/${tag}-zoom.png`);
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  try {
    main();
  } catch (error) {
    console.error(
      `sbs: ${error instanceof Error ? error.message : String(error)}`,
    );
    process.exitCode = 1;
  }
}
