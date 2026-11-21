// "localhost:3000" é uma URL válida para o parser (esquema "localhost:"), mas
// sua origem é "null". Só http(s) serve de base de um link de convite.
export function isHttpUrl(value: string): boolean {
  try {
    const { protocol } = new URL(value);
    return protocol === "http:" || protocol === "https:";
  } catch {
    return false;
  }
}

// Usa só a origem: barra final ou caminho em baseURL não geram "//convite".
export function buildInviteUrl(baseURL: string, token: string): string {
  if (!isHttpUrl(baseURL)) {
    throw new Error(`URL base inválida para o convite: "${baseURL}".`);
  }
  return `${new URL(baseURL).origin}/convite/${token}`;
}
