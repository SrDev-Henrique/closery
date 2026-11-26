import type { Metadata } from "next";
import Link from "next/link";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  PRIVACY_DRAFT,
  PRIVACY_INTRO,
  PRIVACY_SECTIONS,
  PRIVACY_UPDATED_AT,
} from "@/features/privacy/privacyContent";

export const metadata: Metadata = { title: "Privacidade" };

// Página pública (fora de (app), liberada no proxy): quem ainda não entrou
// também precisa poder ler antes de aceitar um convite. Estática: sem sessão,
// sem banco.
export default function Page() {
  return (
    <main className="mx-auto flex min-h-svh w-full max-w-2xl flex-col gap-6 p-4 md:py-10">
      <p className="text-lg font-semibold">Closery</p>
      <h1 className="text-2xl font-semibold tracking-tight">
        Privacidade e seus dados
      </h1>

      {PRIVACY_DRAFT && (
        <Alert>
          <AlertTitle>Rascunho aguardando aprovação</AlertTitle>
          <AlertDescription>
            Este texto ainda não foi aprovado pelo dono do produto nem pela
            empresa.
          </AlertDescription>
        </Alert>
      )}

      <p className="text-muted-foreground">{PRIVACY_INTRO}</p>

      {PRIVACY_SECTIONS.map((section) => (
        <section
          key={section.id}
          aria-labelledby={`privacidade-${section.id}`}
          className="flex flex-col gap-2"
        >
          <h2
            id={`privacidade-${section.id}`}
            className="text-lg font-semibold"
          >
            {section.title}
          </h2>
          {section.paragraphs?.map((paragraph) => (
            <p key={paragraph}>{paragraph}</p>
          ))}
          {section.items && (
            <ul className="flex list-disc flex-col gap-1 pl-5">
              {section.items.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          )}
        </section>
      ))}

      <p className="text-sm text-muted-foreground">
        Última atualização: {PRIVACY_UPDATED_AT}.
      </p>
      <Link
        href="/entrar"
        className="w-fit text-sm underline underline-offset-4 max-md:inline-flex max-md:min-h-11 max-md:items-center"
      >
        Voltar para a entrada
      </Link>
    </main>
  );
}
