import { AppSidebar } from "@/components/app-shell/AppSidebar";
import { requireUser } from "@/lib/auth/session";
import { avatarDataUri } from "@/lib/avatar";

// Lê a sessão no servidor, por isso vive atrás de <Suspense> no layout.
// O avatar nasce aqui (o gerador é server-only) e desce como data URI pronto
// para o AppSidebar, que é client. A semente é o id: o avatar não muda se a
// pessoa trocar de nome.
export async function AuthedSidebar() {
  const authz = await requireUser();

  return (
    <AppSidebar
      isAdmin={authz.role === "admin"}
      userName={authz.name}
      userEmail={authz.email}
      avatarSrc={avatarDataUri(authz.userId)}
    />
  );
}
