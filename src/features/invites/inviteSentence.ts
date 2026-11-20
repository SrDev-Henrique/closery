import type { InviteDetails } from "./inviteQueries";

const ROLE_LABEL = { admin: "Administrador", operator: "Operador" } as const;

export function inviteSentence(
  details: Pick<InviteDetails, "role" | "sectorName" | "inviterName">,
): string {
  const role = ROLE_LABEL[details.role];
  // Só operador pertence a um setor; para administrador o setor é ignorado.
  const sector =
    details.role === "operator" && details.sectorName
      ? ` para o setor ${details.sectorName}`
      : "";
  if (details.inviterName) {
    return `${details.inviterName} te convidou${sector} como ${role}.`;
  }
  return `Você foi convidado${sector} como ${role}.`;
}
