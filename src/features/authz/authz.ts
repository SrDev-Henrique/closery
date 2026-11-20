import { isRole, type Role } from "@/lib/roles";

export type Authz = {
  userId: string;
  name: string;
  email: string;
  role: Role;
  sectorId: string | null;
};

export type SessionUserLike = {
  id: string;
  name: string;
  email: string;
  role?: unknown;
  sectorId?: unknown;
  deactivatedAt?: unknown;
};

// Fail-closed: qualquer dúvida sobre quem é a pessoa vira `null` (sem acesso).
export function toAuthz(
  user: SessionUserLike | null | undefined,
): Authz | null {
  if (!user) return null;
  if (user.deactivatedAt !== null && user.deactivatedAt !== undefined) {
    return null;
  }
  if (!isRole(user.role)) return null;

  const base = { userId: user.id, name: user.name, email: user.email };

  // O admin não tem setor (vê todos), mesmo que o banco guarde um.
  if (user.role === "admin") return { ...base, role: "admin", sectorId: null };

  if (typeof user.sectorId !== "string" || user.sectorId === "") return null;
  return { ...base, role: "operator", sectorId: user.sectorId };
}

export function isAdmin(authz: Authz): boolean {
  return authz.role === "admin";
}

export function canAccessSector(authz: Authz, sectorId: string): boolean {
  if (isAdmin(authz)) return true;
  return authz.sectorId !== null && authz.sectorId === sectorId;
}
