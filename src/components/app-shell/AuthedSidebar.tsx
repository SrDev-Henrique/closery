import { AppSidebar } from "@/components/app-shell/AppSidebar";
import { requireUser } from "@/lib/auth/session";

// Lê a sessão no servidor, por isso vive atrás de <Suspense> no layout.
export async function AuthedSidebar() {
  const authz = await requireUser();

  return (
    <AppSidebar
      isAdmin={authz.role === "admin"}
      userName={authz.name}
      userEmail={authz.email}
    />
  );
}
