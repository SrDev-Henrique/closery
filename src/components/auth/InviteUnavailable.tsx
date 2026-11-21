import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  INVITE_UNAVAILABLE_HINT,
  INVITE_UNAVAILABLE_TITLE,
  type InviteUnavailableReason,
  inviteUnavailableMessage,
} from "@/features/invites/inviteMessages";

export function InviteUnavailable({
  reason,
}: {
  reason: InviteUnavailableReason;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle role="heading" aria-level={1}>
          {INVITE_UNAVAILABLE_TITLE}
        </CardTitle>
        <CardDescription>{inviteUnavailableMessage(reason)}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <p className="text-sm text-muted-foreground">
          {INVITE_UNAVAILABLE_HINT}
        </p>
        <p className="text-sm text-muted-foreground">Já tem conta?</p>
        <Link
          href="/entrar"
          className={buttonVariants({ variant: "outline", size: "lg" })}
        >
          Entrar
        </Link>
      </CardContent>
    </Card>
  );
}
