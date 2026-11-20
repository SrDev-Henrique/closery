import { requireUser } from "@/lib/auth/session";

// Portão estrutural do grupo (app): o layout envolve {children} nele, dentro
// de um <Suspense>, então toda página do grupo exige sessão mesmo que esqueça
// de chamar requireUser. Redireciona para /entrar quando não há sessão.
export async function RequireUser({ children }: { children: React.ReactNode }) {
  await requireUser();
  return children;
}
