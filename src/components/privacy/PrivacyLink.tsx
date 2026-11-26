import Link from "next/link";

import { cn } from "@/lib/utils";

// Link para a página pública de privacidade. Sozinho numa linha, então ganha
// o alvo de toque de 44px abaixo de md (ui-rules §1.4).
export function PrivacyLink({ className }: { className?: string }) {
  return (
    <Link
      href="/privacidade"
      className={cn(
        "w-fit text-sm text-muted-foreground underline underline-offset-4 hover:text-foreground max-md:inline-flex max-md:min-h-11 max-md:items-center",
        className,
      )}
    >
      Privacidade e seus dados
    </Link>
  );
}
