import { CSV_FILENAME_SLUG_MAX } from "./limits";
import type { DateRange } from "./types";

export const CSV_BOM = "\u{feff}";
export const CSV_SEPARATOR = ";";
export const CSV_EOL = "\r\n";

// Primeiro caractere que o Excel e o Sheets leem como fórmula.
const FORMULA_START = /^[=+\-@\t\r]/;

/** Texto de pessoa que começa com = + - @ TAB ou CR ganha ' na frente (o meio não muda). */
export function neutralizeFormula(text: string): string {
  return FORMULA_START.test(text) ? `'${text}` : text;
}

// Aspas RFC 4180 para célula com ; " ou quebra de linha. A quebra interna vira \n.
function quoted(text: string): string {
  const normalized = text.replace(/\r\n?/g, "\n");
  return /[;"\n]/.test(normalized)
    ? `"${normalized.replaceAll('"', '""')}"`
    : normalized;
}

/** Texto de pessoa (nome, turno, setor, item, nota, ocorrência): neutraliza fórmula e protege com aspas. */
export function csvTextCell(text: string): string {
  return quoted(neutralizeFormula(text));
}

/** Valor gerado pelo sistema (data, situação, Sim/Não): sem neutralizar, mesmas aspas. */
export function csvPlainCell(text: string): string {
  return quoted(text);
}

/** Inteiro ≥ 0, sem separador. Decimal, negativo ou NaN lança RangeError. */
export function csvNumberCell(value: number): string {
  if (!Number.isInteger(value) || value < 0) {
    throw new RangeError(`Quantidade inválida para o CSV: ${value}`);
  }
  return String(value);
}

/** Uma linha com as células já formatadas; termina em CRLF. */
export function csvRow(cells: readonly string[]): string {
  return `${cells.join(CSV_SEPARATOR)}${CSV_EOL}`;
}

/** BOM + cabeçalho (texto de pessoa: nomes de item) + linhas; cada linha termina em CRLF. */
export function csvDocument(
  header: readonly string[],
  rows: readonly (readonly string[])[],
): string {
  return `${CSV_BOM}${csvRow(header.map(csvTextCell))}${rows.map(csvRow).join("")}`;
}

export type ExportFilename = { ascii: string; utf8: string };

const ALL_SECTORS_SLUG = "todos-os-setores";

function asciiSlug(name: string): string {
  const slug = name
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, CSV_FILENAME_SLUG_MAX)
    .replace(/-+$/g, "");
  return slug === "" ? "setor" : slug;
}

// Caracteres que nenhum sistema de arquivos aceita no nome.
// biome-ignore lint/suspicious/noControlCharactersInRegex: tira os caracteres de controle do nome do arquivo
const UNSAFE_FILENAME_CHARS = /[/\\:*?"<>|\u{0}-\u{1f}\u{7f}]/gu;

function utf8Name(name: string): string {
  const clean = name.replace(UNSAFE_FILENAME_CHARS, "-").trim();
  return clean === "" ? "setor" : clean;
}

/** `passagens-{setor}-{de}_a_{ate}.csv`: uma versão ASCII e uma com o nome real. */
export function exportFilename(
  sectorName: string | null,
  range: DateRange,
): ExportFilename {
  const tail = `${range.from}_a_${range.to}.csv`;
  return {
    ascii: `passagens-${sectorName === null ? ALL_SECTORS_SLUG : asciiSlug(sectorName)}-${tail}`,
    utf8: `passagens-${sectorName === null ? ALL_SECTORS_SLUG : utf8Name(sectorName)}-${tail}`,
  };
}

// RFC 5987: encodeURIComponent deixa passar ' ( ) *, que o atributo não aceita.
function encodeRfc5987(value: string): string {
  return encodeURIComponent(value).replace(
    /['()*]/g,
    (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`,
  );
}

export function contentDisposition(filename: ExportFilename): string {
  return `attachment; filename="${filename.ascii}"; filename*=UTF-8''${encodeRfc5987(filename.utf8)}`;
}

/** Cabeçalhos da resposta (todos aceitos por `new Headers()`: só ASCII). */
export function csvResponseHeaders(
  filename: ExportFilename,
): Record<string, string> {
  return {
    "Content-Type": "text/csv; charset=utf-8",
    "Content-Disposition": contentDisposition(filename),
    "Cache-Control": "private, no-store",
    "X-Content-Type-Options": "nosniff",
  };
}
