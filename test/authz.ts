import type { Authz } from "@/features/authz/authz";
import type { Role } from "@/lib/roles";

const DEFAULT_OPERATOR_SECTOR_ID = "00000000-0000-4000-8000-0000000000a1";

// Quem está logado, para testes de domínio e de action. Admin sempre sai sem
// setor (como o toAuthz de verdade); operador sem setor não existe: lança.
export function authzOf(input: {
  role: Role;
  userId?: string;
  sectorId?: string | null;
  name?: string;
  email?: string;
}): Authz {
  const userId = input.userId ?? `user-${input.role}`;
  const base = {
    userId,
    name: input.name ?? "Pessoa Teste",
    email: input.email ?? `${userId}@example.test`,
  };

  if (input.role === "admin") return { ...base, role: "admin", sectorId: null };

  const sectorId =
    input.sectorId === undefined ? DEFAULT_OPERATOR_SECTOR_ID : input.sectorId;
  if (sectorId === null) {
    throw new Error(
      "authzOf: operador exige um setor (sectorId não pode ser null)",
    );
  }
  return { ...base, role: "operator", sectorId };
}
