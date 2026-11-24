import { Lock } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

// Setor inativo é só leitura: quem abre o resumo (ou, na Fase 4, a solicitação)
// de um setor desativado lê tudo, mas nenhuma ação de escrita é oferecida.
export function ReadOnlySectorNotice() {
  return (
    <Alert>
      <Lock aria-hidden="true" />
      <AlertTitle>Setor inativo: só leitura.</AlertTitle>
      <AlertDescription>
        Peça a um administrador para reativá-lo.
      </AlertDescription>
    </Alert>
  );
}
