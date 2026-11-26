import type { Metadata } from "next";
import { ResetPasswordForm } from "@/components/auth/ResetPasswordForm";

export const metadata: Metadata = { title: "Redefinir senha" };

// Página estática: o token vem no fragmento da URL (#token=...), que só o
// navegador enxerga. Nada de searchParams aqui, então nada do token passa pelo
// servidor, por log ou por cache.
export default function Page() {
  return <ResetPasswordForm />;
}
