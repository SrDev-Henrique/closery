import { formatEyebrowDateBR } from "@/features/handovers/saoPaulo";
import { requireUser } from "@/lib/auth/session";
import { greetingTitle } from "@/lib/names";

// Topo do hero do Início: eyebrow com a data e o título. O resto do hero (a
// linha do seletor/pílula e do dashboard) é do `HomeHandovers`, que é outra
// fronteira de <Suspense>. O espaçamento do protótipo (padding 28/40, gap 32)
// é repartido: o `pt-7` daqui, o `gap-3.5` entre eyebrow e título e o
// `pt-8`/`pb-10` da linha (ver `HomeHandovers`).
export async function Greeting() {
  const authz = await requireUser();
  // `new Date()` só depois do `requireUser` (dado de requisição), como pedem os
  // Cache Components; antes disso a rota não pré-renderiza.
  const eyebrow = formatEyebrowDateBR(new Date());

  return (
    <div className="flex flex-col gap-3.5 pt-7 max-md:pt-3">
      <p className="font-mono text-[13px] leading-none font-medium tracking-[0.06em] text-muted-foreground">
        {eyebrow}
      </p>
      <h1 className="font-heading text-[72px] leading-[0.95] font-black tracking-[-0.04em] break-words max-md:text-[44px] md:@max-[899px]/main:text-[60px]">
        {greetingTitle(authz.name)}
      </h1>
    </div>
  );
}
