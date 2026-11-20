import { Suspense } from "react";

import { AuthedSidebar } from "@/components/app-shell/AuthedSidebar";
import { MenuToggle } from "@/components/app-shell/MenuToggle";
import { SidebarSkeleton } from "@/components/app-shell/SidebarSkeleton";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";

// Sem await aqui: a sessão é lida dentro do <Suspense> (Cache Components),
// então o esqueleto da página sai no primeiro byte.
export default function AppLayout({ children }: LayoutProps<"/">) {
  return (
    <SidebarProvider>
      <Suspense fallback={<SidebarSkeleton />}>
        <AuthedSidebar />
      </Suspense>
      <SidebarInset>
        <header className="flex h-12 shrink-0 items-center gap-2 border-b px-4 max-md:h-14">
          <MenuToggle />
        </header>
        <div className="flex flex-1 flex-col p-4 md:p-6">{children}</div>
      </SidebarInset>
    </SidebarProvider>
  );
}
