// Medida no DOM (spec §5.3): no mesmo estado e largura, para cada elemento folha de texto (pelo
// texto), a caixa, o controle em volta, a tipografia, a cor, o fundo, o raio, o padding, a rotação e
// o gap, no app e no protótipo, e lista só o que difere (tudo, com --all). --root=<css> limita a um
// trecho (ex.: o cartão). --so-proto mede só o protótipo, para extrair os px dele (Etapa 0.6). Rodar
// com node; semeia o estado antes de abrir o app.
//   node scripts/visual/measure.mjs --screen=inicio --state=admin-escuro --width=1440 --out=processo [--root=<css>] [--all]
//   node scripts/visual/measure.mjs --screen=inicio --state=admin-escuro --width=1440 --out=processo --so-proto
// Grava <out>/medidas/<estado>-<largura>.json.
import { join } from "node:path";
import { pathToFileURL } from "node:url";

import {
  closeState,
  commonHeight,
  launchBrowser,
  openProto,
  openState,
} from "./capture.mjs";
import { parseCliArgs, parseSizes } from "./config.mjs";
import { sddPath, writeInsideSdd } from "./paths.mjs";
import {
  loadScreen,
  pickState,
  protoFile,
  readState,
  resolvePath,
  runSeed,
} from "./screen.mjs";
import { runSteps } from "./steps.mjs";

const USAGE =
  "uso: node scripts/visual/measure.mjs --screen=<nome> | --config=<relativo> --state=<estado> --width=<px> --out=<pasta em .git/sdd> [--root=<css>] [--all] [--so-proto]";
const KNOWN_FLAGS = [
  "screen",
  "config",
  "state",
  "width",
  "out",
  "root",
  "all",
  "so-proto",
];
// Diferença de caixa abaixo disto é arredondamento.
const BOX_TOLERANCE_PX = 0.6;
const COMPARED = [
  "font",
  "color",
  "bg",
  "radius",
  "pad",
  "transform",
  "gap",
  "ctlBg",
  "ctlPad",
  "ctlRadius",
];

// Roda na página (page.evaluate com o argumento): não usa nada de fora dela.
function collectBoxes(root) {
  const scope = root ? document.querySelector(root) : document.body;
  if (!scope) return null;
  const round = (value) => Math.round(value * 10) / 10;
  const box = (rect) => [rect.x, rect.y, rect.width, rect.height].map(round);
  const info = (element) => {
    const style = getComputedStyle(element);
    const control = element.closest(
      "a,button,[role=radio],[role=switch],[role=tab],[role=checkbox]",
    );
    const controlStyle = control ? getComputedStyle(control) : null;
    return {
      tag: element.tagName.toLowerCase(),
      box: box(element.getBoundingClientRect()),
      ctl: control ? box(control.getBoundingClientRect()) : null,
      ctlBg: controlStyle ? controlStyle.backgroundColor : null,
      ctlPad: controlStyle ? controlStyle.padding : null,
      ctlRadius: controlStyle ? controlStyle.borderRadius : null,
      font: [
        style.fontFamily.split(",")[0].replace(/"/g, ""),
        style.fontSize,
        style.fontWeight,
        style.lineHeight,
        style.letterSpacing,
      ].join(" "),
      color: style.color,
      bg: style.backgroundColor,
      radius: style.borderRadius,
      pad: style.padding,
      transform: style.transform,
      gap: style.gap,
    };
  };
  const out = {};
  if (root) out["(raiz)"] = info(scope);
  for (const element of scope.querySelectorAll("*")) {
    if (["SCRIPT", "STYLE", "NEXTJS-PORTAL"].includes(element.tagName))
      continue;
    if (element instanceof SVGElement) continue;
    const rect = element.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) continue;
    if (element.closest("[aria-hidden=true],.sr-only")) continue;
    const style = getComputedStyle(element);
    if (style.visibility === "hidden" || style.display === "none") continue;
    const text = element.textContent.replace(/\s+/g, " ").trim();
    if (!text || text.length > 120) continue;
    // O mais interno com aquele texto.
    if (
      [...element.children].some(
        (child) => child.textContent.replace(/\s+/g, " ").trim() === text,
      )
    ) {
      continue;
    }
    const key = text.toLowerCase();
    if (!out[key]) out[key] = info(element);
  }
  for (const [index, image] of [...scope.querySelectorAll("img")].entries()) {
    out[`(img ${index})`] = info(image);
    if (image.parentElement)
      out[`(moldura ${index})`] = info(image.parentElement);
  }
  for (const [index, svg] of [...scope.querySelectorAll("svg")].entries()) {
    out[`(svg ${index})`] = info(svg);
  }
  return out;
}

/**
 * As linhas da comparação, protótipo → app.
 * @param {Record<string, any>} proto
 * @param {Record<string, any>} app
 * @param {boolean} all
 * @returns {string[]}
 */
function compare(proto, app, all) {
  const fmt = (box) => (box ? box.join(",") : "-");
  const near = (a, b) =>
    a.every((v, i) => Math.abs(v - b[i]) <= BOX_TOLERANCE_PX);
  const lines = [];
  for (const [key, p] of Object.entries(proto)) {
    const a = app[key];
    if (!a) {
      lines.push(`SÓ NO PROTÓTIPO  "${key}"  ${fmt(p.box)}`);
      continue;
    }
    const diffs = [];
    if (!near(p.box, a.box)) diffs.push(`box ${fmt(p.box)} -> ${fmt(a.box)}`);
    if (p.ctl && a.ctl && !near(p.ctl, a.ctl))
      diffs.push(`ctl ${fmt(p.ctl)} -> ${fmt(a.ctl)}`);
    for (const field of COMPARED) {
      // A família da fonte muda de nome entre o protótipo e o app (next/font); o resto conta.
      const left =
        field === "font" ? String(p.font).replace(/^\S+ /, "") : p[field];
      const right =
        field === "font" ? String(a.font).replace(/^\S+ /, "") : a[field];
      if (left !== right) diffs.push(`${field} ${p[field]} -> ${a[field]}`);
    }
    if (diffs.length > 0 || all) {
      lines.push(
        `"${key}" <${p.tag}/${a.tag}>\n   ${diffs.join("\n   ") || "igual"}`,
      );
    }
  }
  for (const [key, a] of Object.entries(app)) {
    if (!proto[key]) lines.push(`SÓ NO APP  "${key}"  ${fmt(a.box)}`);
  }
  return lines;
}

/**
 * @param {import("@playwright/test").Page} page
 * @param {string | null} root
 */
async function collect(page, root) {
  const found = await page.evaluate(collectBoxes, root);
  if (!found) throw new Error(`--root não achou nada: ${root}`);
  return found;
}

async function main() {
  const { flags, positional } = parseCliArgs(process.argv.slice(2));
  const unknown = Object.keys(flags).filter(
    (name) => !KNOWN_FLAGS.includes(name),
  );
  if (unknown.length > 0 || positional.length > 0) throw new Error(USAGE);
  if (typeof flags.out !== "string" || flags.out === "")
    throw new Error(`falta --out\n${USAGE}`);
  const out = flags.out;
  const screen = await loadScreen({
    screen: /** @type {string | undefined} */ (flags.screen),
    config: /** @type {string | undefined} */ (flags.config),
  });
  const stateName = String(flags.state ?? "");
  const state = pickState(screen, stateName);
  if (flags.width === undefined)
    throw new Error(`falta --width
${USAGE}`);
  const [width = 0] = parseSizes(String(flags.width), []);
  const root =
    typeof flags.root === "string" && flags.root !== "" ? flags.root : null;
  const file = join(sddPath(out, "medidas"), `${stateName}-${width}.json`);
  if (!state.proto)
    throw new Error(
      `o estado ${stateName} não tem cópia do protótipo para comparar`,
    );

  const browser = await launchBrowser();
  try {
    if (flags["so-proto"] === true) {
      const proto = await openProto(browser, {
        file: protoFile(out, screen, state.proto),
        width,
      });
      try {
        await runSteps(proto.page, state.steps?.proto ?? []);
        const found = await collect(proto.page, root);
        writeInsideSdd(file, `${JSON.stringify({ proto: found }, null, 1)}\n`);
        console.log(
          `gravado ${out}/medidas/${stateName}-${width}.json (${Object.keys(found).length} elementos do protótipo)`,
        );
      } finally {
        await proto.context.close();
      }
      return;
    }

    runSeed(state);
    const path = resolvePath(state.path, readState());
    const opened = await openState(browser, {
      screen,
      state,
      path,
      width,
      out,
    });
    try {
      const { height } = await commonHeight(opened, state, width);
      await opened.app.page.setViewportSize({ width, height });
      await opened.proto?.page.setViewportSize({ width, height });
      const app = await collect(opened.app.page, root);
      const proto = opened.proto ? await collect(opened.proto.page, root) : {};
      for (const line of compare(proto, app, flags.all === true))
        console.log(line);
      writeInsideSdd(file, `${JSON.stringify({ proto, app }, null, 1)}\n`);
      console.log(`gravado ${out}/medidas/${stateName}-${width}.json`);
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
      `measure: ${error instanceof Error ? error.message : String(error)}`,
    );
    process.exitCode = 1;
  });
}
