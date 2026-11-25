/**
 * Confere que o React Compiler compila cada arquivo dado (ele desiste do componente inteiro em
 * silêncio e o `bun run build` não avisa). Uso, da raiz do repositório:
 *   bun scripts/rc-check.mjs <arquivo.tsx> [<arquivo.tsx> ...]
 * Cada arquivo precisa de `compiled` >= 1 e nenhum evento além do sucesso; senão o código de saída é 1.
 */
import fs from "node:fs";

import { transformSync } from "@babel/core";

const files = process.argv.slice(2);

if (files.length === 0) {
  console.error("Uso: bun scripts/rc-check.mjs <arquivos>");
  process.exit(2);
}

let failed = false;

for (const file of files) {
  const events = [];
  transformSync(fs.readFileSync(file, "utf8"), {
    filename: file,
    presets: [
      ["@babel/preset-typescript", { isTSX: true, allExtensions: true }],
    ],
    plugins: [
      [
        "babel-plugin-react-compiler",
        { logger: { logEvent: (_filename, event) => events.push(event) } },
      ],
    ],
  });
  const compiled = events.filter((event) => event.kind === "CompileSuccess");
  const others = events.filter((event) => event.kind !== "CompileSuccess");
  console.log(
    file,
    "compiled:",
    compiled.length,
    "other events:",
    JSON.stringify(others).slice(0, 1500),
  );
  if (compiled.length === 0 || others.length > 0) {
    failed = true;
  }
}

process.exit(failed ? 1 : 0);
