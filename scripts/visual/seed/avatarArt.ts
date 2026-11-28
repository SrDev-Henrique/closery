// A arte dos avatares para as cópias do protótipo (spec §5.3): a mesma do app (src/lib/avatar.ts),
// para a mesma semente (o id do usuário). O src/lib/avatar.ts é server-only e não roda no bun, então
// o mesmo DiceBear é montado aqui; test/visual/avatarArt.test.ts prova que as duas dão o mesmo data URI.
import { Avatar, Style } from "@dicebear/core";
import notionists from "@dicebear/styles/notionists.json" with { type: "json" };

// Iguais a AVATAR_BACKGROUNDS de src/lib/avatar.ts (dados da arte, não tokens de interface).
const BACKGROUNDS = ["#b6e3f4", "#ffdfbf", "#ffd5dc", "#d1d4f9"] as const;

const style = new Style(notionists);

export function visualAvatarUri(seed: string): string {
  if (seed.trim() === "") {
    throw new Error("visualAvatarUri: a semente não pode ser vazia");
  }
  return new Avatar(style, {
    seed,
    backgroundColor: [...BACKGROUNDS],
  }).toDataUri();
}
