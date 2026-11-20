/** Primeira palavra do nome; vazio se o nome for vazio ou só espaços. */
export function firstName(fullName: string): string {
  return fullName.trim().split(/\s+/)[0] ?? "";
}

/** Título do Início: "Olá, Maria"; sem nome, "Olá" (nunca "Olá, "). */
export function greetingTitle(fullName: string): string {
  const name = firstName(fullName);
  return name ? `Olá, ${name}` : "Olá";
}
