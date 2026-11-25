import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";

// notFound() de uma página de (app) (inclusive o requireAdmin do operador)
// renderiza aqui, dentro do shell. O not-found da raiz já aparecia ali, mas com
// o <main> dele dentro do <main> do SidebarInset; este não tem <main>. URL sem
// rota continua no not-found da raiz, com status 404.
export default function AppNotFound() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 p-6 text-center">
      <h1 className="text-2xl font-semibold tracking-tight">
        Página não encontrada
      </h1>
      {/* buttonVariants em vez de Button render={<Link />}: o Button do Base UI
          põe role="button" no <a>, e navegação tem que continuar sendo link. */}
      <Link href="/" className={buttonVariants()}>
        Voltar ao início
      </Link>
    </div>
  );
}
