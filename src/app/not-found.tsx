import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-4 p-6 text-center">
      <h1 className="text-2xl font-semibold tracking-tight">
        Página não encontrada
      </h1>
      {/* buttonVariants em vez de Button render={<Link />}: o Button do Base UI
          põe role="button" no <a>, e navegação tem que continuar sendo link. */}
      <Link href="/" className={buttonVariants()}>
        Voltar ao início
      </Link>
    </main>
  );
}
