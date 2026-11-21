import { requireUser } from "@/lib/auth/session";
import { greetingTitle } from "@/lib/names";

export async function Greeting() {
  const authz = await requireUser();

  return (
    <div className="flex flex-col gap-2">
      <h1 className="text-2xl font-semibold tracking-tight">
        {greetingTitle(authz.name)}
      </h1>
      <p className="text-muted-foreground">
        Em breve: solicitações e dashboard.
      </p>
    </div>
  );
}
