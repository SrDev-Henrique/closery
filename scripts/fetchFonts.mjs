// Baixa a fonte Satoshi (Fontshare) para src/fonts/satoshi/, pasta FORA do git (licença ITF FFL: o
// arquivo não pode ficar num repositório público). Roda sozinho no `predev` e no `prebuild`
// (`bun run fonts`). Pula o download quando os 3 arquivos já estão lá com o SHA-256 certo; baixa o que
// faltar, confere o hash e só então grava (nada é gravado se algum peso reprovar). Qualquer erro sai
// com código 1 e uma mensagem que diz o que fazer. Só built-ins do Node/Bun: Windows e Linux (CI, Vercel).
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  FONTSHARE_CSS_URL,
  isSatoshiFileValid,
  parseFontshareCss,
  SATOSHI_SHA256,
  SATOSHI_WEIGHTS,
  satoshiPath,
  sha256Hex,
} from "./fontsCheck.mjs";

const TIMEOUT_MS = 30_000;

/** O arquivo no disco, resolvido a partir deste script (sem depender do diretório de onde roda). */
function fileOf(weight) {
  return fileURLToPath(new URL(`../${satoshiPath(weight)}`, import.meta.url));
}

function isMissingFile(error) {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "ENOENT"
  );
}

function describeError(error) {
  return error instanceof Error ? error.message : String(error);
}

/**
 * @typedef {{
 *   read(weight: number): Promise<Uint8Array | null>,
 *   write(weight: number, bytes: Uint8Array): Promise<void>,
 * }} FontIo
 */

/** @type {FontIo} */
export const diskIo = {
  async read(weight) {
    try {
      return await readFile(fileOf(weight));
    } catch (error) {
      if (isMissingFile(error)) return null;
      throw error;
    }
  },
  async write(weight, bytes) {
    const file = fileOf(weight);
    await mkdir(dirname(file), { recursive: true });
    await writeFile(file, bytes);
  },
};

async function request(fetchImpl, url) {
  let response;
  try {
    response = await fetchImpl(url, {
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: { "user-agent": "closery-fonts" },
    });
  } catch (error) {
    throw new Error(`sem resposta de ${url} (${describeError(error)})`);
  }
  if (!response.ok) {
    throw new Error(`${url} respondeu ${response.status}`);
  }
  return response;
}

/**
 * Garante os 3 arquivos da Satoshi. Devolve os pesos que foram baixados (vazio = já estava tudo certo).
 * @param {{
 *   fetchImpl?: typeof fetch,
 *   io?: FontIo,
 *   expected?: Readonly<Record<500 | 700 | 900, string>>,
 *   log?: (line: string) => void,
 * }} [options]
 * @returns {Promise<number[]>}
 */
export async function ensureSatoshi({
  fetchImpl = fetch,
  io = diskIo,
  expected = SATOSHI_SHA256,
  log = console.log,
} = {}) {
  /** @type {number[]} */
  const stale = [];
  for (const weight of SATOSHI_WEIGHTS) {
    const bytes = await io.read(weight);
    if (bytes === null || !isSatoshiFileValid(weight, bytes, expected)) {
      stale.push(weight);
    }
  }
  if (stale.length === 0) {
    log(
      "Satoshi: os 3 arquivos já estão em src/fonts/satoshi, com o SHA-256 certo.",
    );
    return [];
  }

  log(`Satoshi: baixando o peso ${stale.join(", ")} da Fontshare...`);
  const css = await (await request(fetchImpl, FONTSHARE_CSS_URL)).text();
  const urls = parseFontshareCss(css);

  /** @type {[number, Uint8Array][]} */
  const verified = [];
  for (const weight of stale) {
    const url = urls.get(weight);
    if (!url) throw new Error(`a Fontshare não devolveu o peso ${weight}`);
    const response = await request(fetchImpl, url);
    const bytes = new Uint8Array(await response.arrayBuffer());
    if (!isSatoshiFileValid(weight, bytes, expected)) {
      throw new Error(
        `o arquivo do peso ${weight} veio com SHA-256 ${sha256Hex(bytes)} e o esperado é ${expected[weight]}. A Fontshare pode ter trocado o arquivo`,
      );
    }
    verified.push([weight, bytes]);
  }

  // Só grava depois de conferir os três: nunca fica meia fonte no disco.
  for (const [weight, bytes] of verified) {
    await io.write(weight, bytes);
  }
  log(
    `Satoshi: ${verified.length} arquivo(s) gravado(s) em src/fonts/satoshi.`,
  );
  return stale;
}

async function main() {
  try {
    await ensureSatoshi();
  } catch (error) {
    console.error(
      `Não consegui preparar a fonte Satoshi: ${describeError(error)}.`,
    );
    console.error(
      "O que fazer: confira a conexão e rode `bun run fonts` de novo (sem a fonte, `bun run dev` e `bun run build` não funcionam). " +
        "Se o erro for de SHA-256, NÃO aceite o arquivo: veja a seção Satoshi de .context/library-docs.md antes de mexer em scripts/fontsCheck.mjs.",
    );
    process.exitCode = 1;
  }
}

/**
 * Só roda como script (`bun scripts/fetchFonts.mjs` ou `node scripts/fetchFonts.mjs`); importado pelo
 * teste, não faz nada. `import.meta.main` é do Bun (no Node 22 é `undefined`, e o script sairia 0 sem
 * baixar nada), então sem ele compara o arquivo de entrada com o deste módulo.
 */
export function isMainModule(meta, argv1) {
  if (meta.main !== undefined) return meta.main;
  if (!argv1) return false;
  return resolve(argv1) === resolve(fileURLToPath(meta.url));
}

if (isMainModule(import.meta, process.argv[1])) await main();
