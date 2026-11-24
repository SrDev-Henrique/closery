import { Suspense } from "react";

import { AuthedSidebar } from "@/components/app-shell/AuthedSidebar";
import { MenuToggle } from "@/components/app-shell/MenuToggle";
import { SessionKeepAlive } from "@/components/app-shell/SessionKeepAlive";
import { SidebarSkeleton } from "@/components/app-shell/SidebarSkeleton";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";

// Sem await aqui: a sessão é lida dentro do <Suspense> (Cache Components).
// O layout não protege as páginas: cada página chama requireUser/requireAdmin
// (guardado por src/app/appPagesAuth.test.ts). O slot `detalhe` abre o detalhe
// da solicitação num Sheet por cima da tela atual (rota interceptada); fica
// fora de qualquer <Suspense> daqui: o Suspense vive na página interceptada.
export default function AppLayout({ children, detalhe }: LayoutProps<"/">) {
  return (
    <SidebarProvider>
      <SessionKeepAlive />
      <Suspense fallback={<SidebarSkeleton />}>
        <AuthedSidebar />
      </Suspense>
      <SidebarInset>
        <header className="flex h-12 shrink-0 items-center gap-2 border-b px-4 max-md:h-14">
          <MenuToggle />
        </header>
        <div className="flex flex-1 flex-col p-4 md:p-6">{children}</div>
        {detalhe}
      </SidebarInset>
    </SidebarProvider>
  );
}
