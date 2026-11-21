import { ChevronLeft } from "lucide-react";
import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function AdminPageHeader({
  title,
  description,
  backHref,
}: {
  title: string;
  description: string;
  backHref?: "/admin";
}) {
  return (
    <header className="flex flex-col gap-2">
      {backHref && (
        <Link
          href={backHref}
          className={cn(
            buttonVariants({ variant: "ghost", size: "sm" }),
            "-ml-2.5 w-fit",
          )}
        >
          <ChevronLeft aria-hidden="true" />
          Voltar para Administração
        </Link>
      )}
      <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
      <p className="text-muted-foreground">{description}</p>
    </header>
  );
}
