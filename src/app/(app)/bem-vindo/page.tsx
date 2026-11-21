import type { Metadata } from "next";
import { Suspense } from "react";
import { PasskeyOffer } from "@/components/auth/PasskeyOffer";
import { Skeleton } from "@/components/ui/skeleton";
import { requireUser } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Bem-vindo" };

export default function Page() {
  return (
    <div className="mx-auto w-full max-w-md">
      <Suspense fallback={<Skeleton className="h-40 w-full" />}>
        <WelcomeContent />
      </Suspense>
    </div>
  );
}

// A sessão é dado de requisição: só pode ser lida dentro do <Suspense>.
async function WelcomeContent() {
  await requireUser();
  return <PasskeyOffer />;
}
