// Recorte em tamanho real (spec §5.3) de uma captura, cortado nas bordas.
//   node scripts/visual/crop.mjs <arquivo> <x> <y> <w> <h> [saída] --dir=<relativo a .git/sdd>
// Lê <dir>/<arquivo> e grava <dir>/<saída> (padrão: <arquivo sem .png>-recorte.png).
import { join } from "node:path";
import { pathToFileURL } from "node:url";

import { parseCliArgs } from "./config.mjs";
import { cropRect, parseRect, readPng, writePng } from "./image.mjs";
import { sddPath } from "./paths.mjs";

const USAGE =
  "uso: node scripts/visual/crop.mjs <arquivo.png> <x> <y> <w> <h> [saída.png] --dir=<relativo a .git/sdd>";
const PNG_NAME = /^[^/\\]+\.png$/;

function main() {
  const { flags, positional } = parseCliArgs(process.argv.slice(2));
  const unknown = Object.keys(flags).filter((name) => name !== "dir");
  const [file, x, y, w, h, output] = positional;
  if (unknown.length > 0 || positional.length < 5 || positional.length > 6)
    throw new Error(USAGE);
  if (
    !file ||
    !PNG_NAME.test(file) ||
    (output !== undefined && !PNG_NAME.test(output))
  ) {
    throw new Error(`arquivo e saída são nomes .png dentro do --dir\n${USAGE}`);
  }
  if (typeof flags.dir !== "string" || flags.dir === "")
    throw new Error(`falta --dir\n${USAGE}`);
  const dir = sddPath(flags.dir);
  const cropped = cropRect(readPng(join(dir, file)), parseRect([x, y, w, h]));
  const name = output ?? file.replace(/\.png$/, "-recorte.png");
  writePng(join(dir, name), cropped);
  console.log(
    `gravado ${flags.dir}/${name} (${cropped.width}x${cropped.height})`,
  );
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  try {
    main();
  } catch (error) {
    console.error(
      `crop: ${error instanceof Error ? error.message : String(error)}`,
    );
    process.exitCode = 1;
  }
}
