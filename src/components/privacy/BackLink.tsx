"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";

// "Voltar" da página de privacidade: leva para onde a pessoa estava (o convite,
// a entrada, /conta). Quem abriu a página direto, sem histórico, cai em /entrar.
// O href existe sempre (funciona sem JavaScript); com histórico, o clique
// volta uma página em vez de seguir o link. Sozinho numa linha, então ganha o
// alvo de toque de 44px abaixo de md (ui-rules §1.4).
export function BackLink() {
  const router = useRouter();
  return (
    <Link
      href="/entrar"
      onClick={(event) => {
        if (window.history.length > 1) {
          event.preventDefault();
          router.back();
        }
      }}
      className="w-fit text-sm underline underline-offset-4 max-md:inline-flex max-md:min-h-11 max-md:min-w-11 max-md:items-center"
    >
      Voltar
    </Link>
  );
}
