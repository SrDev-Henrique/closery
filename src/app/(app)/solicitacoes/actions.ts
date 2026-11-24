"use server";

import type { AdminResult } from "@/features/admin/result";
import { runAction } from "@/features/admin/runAction";
import {
  type AddedComment,
  addComment,
  deleteComment,
} from "@/features/requests/comments";
import { type CreatedRequest, createRequest } from "@/features/requests/create";
import {
  cancelRequest,
  type MovedRequest,
  moveRequest,
} from "@/features/requests/move";
import {
  addCommentSchema,
  cancelRequestSchema,
  createRequestSchema,
  deleteCommentSchema,
  moveRequestSchema,
} from "@/features/requests/schemas";
import { requireUser } from "@/lib/auth/session";

export async function createRequestAction(
  input: unknown,
): Promise<AdminResult<CreatedRequest>> {
  const actor = await requireUser();
  return runAction({
    actor,
    schema: createRequestSchema,
    input,
    revalidate: "/(app)",
    run: ({ db, now, actor: who, input: data }) =>
      createRequest(db, who, data, now),
  });
}

export async function moveRequestAction(
  input: unknown,
): Promise<AdminResult<MovedRequest>> {
  const actor = await requireUser();
  return runAction({
    actor,
    schema: moveRequestSchema,
    input,
    revalidate: "/(app)",
    run: ({ db, now, actor: who, input: data }) =>
      moveRequest(db, who, data, now),
  });
}

export async function cancelRequestAction(
  input: unknown,
): Promise<AdminResult<MovedRequest>> {
  const actor = await requireUser();
  return runAction({
    actor,
    schema: cancelRequestSchema,
    input,
    revalidate: "/(app)",
    run: ({ db, now, actor: who, input: data }) =>
      cancelRequest(db, who, data, now),
  });
}

export async function addCommentAction(
  input: unknown,
): Promise<AdminResult<AddedComment>> {
  const actor = await requireUser();
  return runAction({
    actor,
    schema: addCommentSchema,
    input,
    revalidate: "/(app)",
    run: ({ db, now, actor: who, input: data }) =>
      addComment(db, who, data, now),
  });
}

export async function deleteCommentAction(
  input: unknown,
): Promise<AdminResult> {
  const actor = await requireUser();
  return runAction({
    actor,
    schema: deleteCommentSchema,
    input,
    revalidate: "/(app)",
    run: ({ db, now, actor: who, input: data }) =>
      deleteComment(db, who, data, now),
  });
}
