export const NAME_MAX_LENGTH = 60;

/** NFC + espaços colapsados + trim: o nome que vai para o banco. */
export function normalizeName(raw: string): string {
  return raw.normalize("NFC").replace(/\s+/g, " ").trim();
}

export function validateName(
  raw: string,
): { ok: true; name: string } | { ok: false; message: string } {
  const name = normalizeName(raw);
  if (name === "") return { ok: false, message: "Informe o nome." };
  // Conta pontos de código, não unidades UTF-16: um emoji vale 1.
  if ([...name].length > NAME_MAX_LENGTH) {
    return {
      ok: false,
      message: `O nome pode ter no máximo ${NAME_MAX_LENGTH} caracteres.`,
    };
  }
  return { ok: true, name };
}
