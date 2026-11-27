import { Suspense } from "react";

import { AppHeader } from "@/components/app-shell/AppHeader";
import { AuthedSidebar } from "@/components/app-shell/AuthedSidebar";
import { SessionKeepAlive } from "@/components/app-shell/SessionKeepAlive";
import { SidebarSkeleton } from "@/components/app-shell/SidebarSkeleton";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";

// Sem await aqui: a sessão é lida dentro do <Suspense> (Cache Components).
// O layout não protege as páginas: cada página chama requireUser/requireAdmin
// (guardado por src/app/appPagesAuth.test.ts). O slot `detalhe` abre o detalhe
// da solicitação num Sheet por cima da tela atual (rota interceptada); fica
// fora de qualquer <Suspense> daqui e fora do contêiner do conteúdo: o
// Suspense vive na página interceptada.
// O contêiner `@container/main` é o que as telas usam nas container queries
// (`@min-[1040px]/main:` etc.): os cortes são da área útil, a tela menos a
// sidebar (o `mainW` do protótipo), por isso ele fica num invólucro SEM padding
// na largura toda do SidebarInset; o div de dentro é que centra em 1240px e
// leva o padding de 40px (16px no celular).
export default function AppLayout({ children, detalhe }: LayoutProps<"/">) {
  return (
    <SidebarProvider>
      <SessionKeepAlive />
      <Suspense fallback={<SidebarSkeleton />}>
        <AuthedSidebar />
      </Suspense>
      <SidebarInset className="min-w-0">
        <div className="@container/main flex w-full flex-1 flex-col">
          <div className="mx-auto flex w-full max-w-[1240px] flex-1 flex-col px-10 pb-12 max-md:px-4">
            <AppHeader />
            {children}
          </div>
        </div>
        {detalhe}
      </SidebarInset>
    </SidebarProvider>
  );
}
