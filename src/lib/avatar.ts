import "server-only";

import { Avatar, Style } from "@dicebear/core";
import notionists from "@dicebear/styles/notionists.json" with { type: "json" };

// Fundos da arte do avatar: dados do DiceBear, não tokens de interface. É a
// única exceção de cor crua do projeto (ui-tokens.md), e este arquivo é .ts,
// fora do guarda de cor crua dos .tsx.
export const AVATAR_BACKGROUNDS = [
  "#b6e3f4",
  "#ffdfbf",
  "#ffd5dc",
  "#d1d4f9",
] as const;

const style = new Style(notionists);

// ~26 KB por avatar: o cache evita regerar o mesmo SVG a cada render no servidor.
const cache = new Map<string, string>();

/**
 * Avatar `notionists` do DiceBear como data URI (sem requisição a terceiros).
 * A semente é o id do usuário, para o avatar não mudar quando o nome muda.
 */
export function avatarDataUri(seed: string): string {
  if (seed.trim() === "") {
    throw new Error("avatarDataUri: a semente não pode ser vazia");
  }
  const cached = cache.get(seed);
  if (cached !== undefined) return cached;
  const uri = new Avatar(style, {
    seed,
    backgroundColor: [...AVATAR_BACKGROUNDS],
  }).toDataUri();
  cache.set(seed, uri);
  return uri;
}
