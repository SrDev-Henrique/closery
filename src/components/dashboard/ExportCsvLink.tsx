import { Download } from "lucide-react";

import { buttonVariants } from "@/components/ui/button";

// Download, não navegação: um <a download> comum (nunca next/link, que
// tentaria carregar o CSV como página e prefetch).
export function ExportCsvLink({ href }: { href: string }) {
  return (
    <a href={href} download className={buttonVariants({ variant: "outline" })}>
      <Download aria-hidden="true" />
      Exportar CSV
    </a>
  );
}
