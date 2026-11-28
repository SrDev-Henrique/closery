// Folha de contato (spec §5.3): junta lado a lado as capturas de uma tela (escuro e claro, em cada
// largura), reduzidas, para olhar tudo de uma vez. Lê e grava só dentro de .git/sdd.
//   node scripts/visual/sheet.mjs <prefixo> --dir=<relativo a .git/sdd> [--scale=0.5] [--max=1800] [--widths=1440,820,390]
// Lê <dir>/<prefixo>-{escuro,claro}-<largura>.png e grava <dir>/_sheet-<prefixo>.png.
import { existsSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

import { parseCliArgs, parseSizes } from "./config.mjs";
import { contactSheet, readPng, writePng } from "./image.mjs";
import { sddPath } from "./paths.mjs";

const USAGE =
  "uso: node scripts/visual/sheet.mjs <prefixo> --dir=<relativo a .git/sdd> [--scale=0.5] [--max=1800] [--widths=1440,820,390]";
const KNOWN_FLAGS = ["dir", "scale", "max", "widths"];
const NAME = /^[a-z0-9][a-z0-9-]*$/;

function main() {
  const { flags, positional } = parseCliArgs(process.argv.slice(2));
  const unknown = Object.keys(flags).filter(
    (name) => !KNOWN_FLAGS.includes(name),
  );
  const [prefix] = positional;
  if (
    unknown.length > 0 ||
    positional.length !== 1 ||
    !prefix ||
    !NAME.test(prefix)
  ) {
    throw new Error(USAGE);
  }
  if (typeof flags.dir !== "string" || flags.dir === "")
    throw new Error(`falta --dir\n${USAGE}`);
  const dir = sddPath(flags.dir);
  const scale = flags.scale === undefined ? 0.5 : Number(flags.scale);
  const max = flags.max === undefined ? 1800 : Number(flags.max);
  if (!Number.isInteger(max) || max < 1)
    throw new Error(`--max inválido: ${String(flags.max)}`);
  const widths = parseSizes(
    flags.widths === undefined ? undefined : String(flags.widths),
    [1440, 820, 390],
  );
  const files = [];
  for (const width of widths) {
    for (const theme of ["escuro", "claro"]) {
      const name = `${prefix}-${theme}-${width}.png`;
      if (existsSync(join(dir, name))) files.push(name);
    }
  }
  if (files.length === 0) {
    throw new Error(
      `nenhuma captura ${prefix}-{escuro,claro}-<largura>.png em ${flags.dir}`,
    );
  }
  const sheet = contactSheet(
    files.map((name) => readPng(join(dir, name))),
    scale,
    max,
  );
  const target = join(dir, `_sheet-${prefix}.png`);
  writePng(target, sheet);
  console.log(`gravado ${flags.dir}/_sheet-${prefix}.png (${files.join(" ")})`);
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  try {
    main();
  } catch (error) {
    console.error(
      `sheet: ${error instanceof Error ? error.message : String(error)}`,
    );
    process.exitCode = 1;
  }
}
