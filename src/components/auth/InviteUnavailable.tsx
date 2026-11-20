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
      <CardContent>
        <p className="text-sm text-muted-foreground">
          {INVITE_UNAVAILABLE_HINT}
        </p>
      </CardContent>
    </Card>
  );
}
