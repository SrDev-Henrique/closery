import type { RequestCommentsPage } from "@/features/requests/types";
import { formatDateTimeBR } from "@/lib/dateTime";

import { CommentComposer } from "./CommentComposer";
import { DeleteCommentButton } from "./DeleteCommentButton";

// Comentários (mais antigo primeiro, os últimos N). O motivo de cancelamento
// aparece aqui também, com o rótulo e sem "Apagar". `earlierHref` é um <a>
// comum: a página completa mostra os anteriores.
export function RequestComments({
  requestId,
  comments,
  canComment,
  earlierHref,
  headingLevel = 2,
}: {
  requestId: string;
  comments: RequestCommentsPage;
  canComment: boolean;
  earlierHref: string | null;
  headingLevel?: 2 | 3;
}) {
  const Heading = headingLevel === 2 ? "h2" : "h3";
  return (
    <section className="flex flex-col gap-3">
      <Heading className="text-base font-medium tabular-nums">
        {comments.total > 0 ? `Comentários (${comments.total})` : "Comentários"}
      </Heading>
      {earlierHref && (
        <a
          href={earlierHref}
          className="w-fit text-sm underline underline-offset-4"
        >
          Ver comentários anteriores
        </a>
      )}
      {comments.rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Nenhum comentário ainda.
        </p>
      ) : (
        <ol className="flex flex-col gap-3">
          {comments.rows.map((comment) => (
            <li
              key={comment.id}
              className="flex flex-col gap-1 rounded-lg border p-3"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm">
                  <span className="font-medium">{comment.authorName}</span>
                  {" · "}
                  <time
                    dateTime={comment.createdAt.toISOString()}
                    className="text-muted-foreground tabular-nums"
                  >
                    {formatDateTimeBR(comment.createdAt)}
                  </time>
                </p>
                {comment.canDelete && (
                  <DeleteCommentButton
                    commentId={comment.id}
                    createdAt={comment.createdAt}
                  />
                )}
              </div>
              {comment.isCancelReason && (
                <p className="text-xs font-medium text-muted-foreground">
                  Motivo do cancelamento
                </p>
              )}
              <p className="text-sm whitespace-pre-wrap">{comment.body}</p>
            </li>
          ))}
        </ol>
      )}
      {canComment && <CommentComposer requestId={requestId} />}
    </section>
  );
}
