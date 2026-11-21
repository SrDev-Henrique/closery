import type { Role } from "@/lib/roles";

export const ROLE_LABELS: Readonly<Record<Role, string>> = {
  admin: "Administrador",
  operator: "Operador",
};

// Operador primeiro: é o papel mais comum (formulário nunca começa em branco).
export const ROLE_OPTIONS: readonly { value: Role; label: string }[] = [
  { value: "operator", label: ROLE_LABELS.operator },
  { value: "admin", label: ROLE_LABELS.admin },
];
