import { z } from "zod";

import { INVALID_INPUT_MESSAGE } from "@/features/admin/result";
import { idSchema } from "@/features/admin/schemas";
import { codePointLength } from "@/features/handovers/fieldRules";
import { MAX_QUANTITY } from "@/features/handovers/limits";
import { DUPLICATE_ITEM_MESSAGE } from "@/features/handovers/messages";
import { handoverRefSchema } from "@/features/handovers/schemas";
import type { HandoverRef } from "@/features/handovers/types";
import { REQUEST_STATUSES } from "@/lib/requestStatuses";

import {
  CANCEL_REASON_MAX_LENGTH,
  COMMENT_MAX_LENGTH,
  DESCRIPTION_MAX_LENGTH,
  DESTINATION_OTHER_MAX_LENGTH,
  REQUEST_ITEMS_MAX,
} from "./limits";
import {
  CANCEL_NEEDS_REASON_MESSAGE,
  CANCEL_REASON_REQUIRED_MESSAGE,
  CANCEL_REASON_TOO_LONG_MESSAGE,
  COMMENT_REQUIRED_MESSAGE,
  COMMENT_TOO_LONG_MESSAGE,
  DESCRIPTION_REQUIRED_MESSAGE,
  DESCRIPTION_TOO_LONG_MESSAGE,
  DESTINATION_OTHER_REQUIRED_MESSAGE,
  DESTINATION_OTHER_TOO_LONG_MESSAGE,
  INVALID_STATUS_MESSAGE,
  ITEM_QUANTITY_MESSAGE,
  ORIGIN_SECTOR_MISMATCH_MESSAGE,
  TOO_MANY_ITEMS_MESSAGE,
} from "./messages";
import { isBoardStatus } from "./status";
import { normalizeDestinationOther, normalizeRequestText } from "./text";
import type { RequestDestinationInput, RequestItemInput } from "./types";

// Todo campo e todo z.object têm mensagem em pt-BR própria: o runner devolve a
// mensagem de qualquer issue com path não vazio, e o texto padrão do Zod
// ("Invalid input: expected string…") nunca pode chegar à tela. Os limites
// contam pontos de código (um emoji conta 1).
const textSchema = z.string({ error: INVALID_INPUT_MESSAGE });

export const requestStatusSchema = z.enum(REQUEST_STATUSES, {
  error: INVALID_STATUS_MESSAGE,
});

export const requestItemInputSchema = z.object(
  {
    itemId: idSchema,
    quantity: z
      .number({ error: ITEM_QUANTITY_MESSAGE })
      .int({ error: ITEM_QUANTITY_MESSAGE })
      .min(1, { error: ITEM_QUANTITY_MESSAGE })
      .max(MAX_QUANTITY, { error: ITEM_QUANTITY_MESSAGE }),
  },
  { error: INVALID_INPUT_MESSAGE },
);

export type CreateRequestInput = {
  sectorId: string;
  destination: RequestDestinationInput;
  description: string;
  items: RequestItemInput[];
  originRef: HandoverRef | null;
};

// Todas as validações de texto ficam no superRefine, sobre o texto cru: o
// formulário recebe os erros de todos os campos de uma vez (um campo com
// transform própria esconderia os outros até ser corrigido).
export const createRequestSchema = z
  .object(
    {
      sectorId: idSchema,
      destinationId: idSchema.nullable(), // null = "Outro"
      destinationOther: textSchema, // só vale com destinationId null
      description: textSchema,
      items: z
        .array(requestItemInputSchema, { error: INVALID_INPUT_MESSAGE })
        .max(REQUEST_ITEMS_MAX, { error: TOO_MANY_ITEMS_MESSAGE }),
      originRef: z
        .object(handoverRefSchema.shape, { error: INVALID_INPUT_MESSAGE })
        .nullable(),
    },
    { error: INVALID_INPUT_MESSAGE },
  )
  .superRefine((value, ctx) => {
    if (
      value.originRef !== null &&
      value.originRef.sectorId !== value.sectorId
    ) {
      ctx.addIssue({
        code: "custom",
        message: ORIGIN_SECTOR_MISMATCH_MESSAGE,
        path: ["sectorId"],
      });
    }
    if (value.destinationId === null) {
      const other = normalizeDestinationOther(value.destinationOther);
      if (other === "") {
        ctx.addIssue({
          code: "custom",
          message: DESTINATION_OTHER_REQUIRED_MESSAGE,
          path: ["destinationOther"],
        });
      } else if (codePointLength(other) > DESTINATION_OTHER_MAX_LENGTH) {
        ctx.addIssue({
          code: "custom",
          message: DESTINATION_OTHER_TOO_LONG_MESSAGE,
          path: ["destinationOther"],
        });
      }
    }
    const description = normalizeRequestText(value.description);
    if (description === "") {
      ctx.addIssue({
        code: "custom",
        message: DESCRIPTION_REQUIRED_MESSAGE,
        path: ["description"],
      });
    } else if (codePointLength(description) > DESCRIPTION_MAX_LENGTH) {
      ctx.addIssue({
        code: "custom",
        message: DESCRIPTION_TOO_LONG_MESSAGE,
        path: ["description"],
      });
    }
    const itemIds = value.items.map((line) => line.itemId);
    if (new Set(itemIds).size !== itemIds.length) {
      ctx.addIssue({
        code: "custom",
        message: DUPLICATE_ITEM_MESSAGE,
        path: ["items"],
      });
    }
  })
  .transform(
    (value): CreateRequestInput => ({
      sectorId: value.sectorId,
      destination:
        value.destinationId === null
          ? {
              kind: "other",
              text: normalizeDestinationOther(value.destinationOther),
            }
          : { kind: "list", destinationId: value.destinationId },
      description: normalizeRequestText(value.description),
      items: value.items,
      originRef: value.originRef,
    }),
  );

/** O que o RequestForm envia (antes da normalização). */
export type CreateRequestFormInput = z.input<typeof createRequestSchema>;

// Mover para Cancelada não passa por aqui: cancelar tem motivo obrigatório.
export const moveRequestSchema = z
  .object(
    { id: idSchema, from: requestStatusSchema, to: requestStatusSchema },
    { error: INVALID_INPUT_MESSAGE },
  )
  .transform((value, ctx) => {
    if (!isBoardStatus(value.to)) {
      ctx.addIssue({
        code: "custom",
        message: CANCEL_NEEDS_REASON_MESSAGE,
        path: ["to"],
      });
      return z.NEVER;
    }
    return { id: value.id, from: value.from, to: value.to };
  });
export type MoveRequestInput = z.output<typeof moveRequestSchema>;

export const cancelRequestSchema = z.object(
  {
    id: idSchema,
    from: requestStatusSchema,
    reason: textSchema.transform((raw, ctx) => {
      const reason = normalizeRequestText(raw);
      if (reason === "") {
        ctx.addIssue({
          code: "custom",
          message: CANCEL_REASON_REQUIRED_MESSAGE,
        });
        return z.NEVER;
      }
      if (codePointLength(reason) > CANCEL_REASON_MAX_LENGTH) {
        ctx.addIssue({
          code: "custom",
          message: CANCEL_REASON_TOO_LONG_MESSAGE,
        });
        return z.NEVER;
      }
      return reason;
    }),
  },
  { error: INVALID_INPUT_MESSAGE },
);
export type CancelRequestInput = z.output<typeof cancelRequestSchema>;

export const addCommentSchema = z.object(
  {
    requestId: idSchema,
    body: textSchema.transform((raw, ctx) => {
      const body = normalizeRequestText(raw);
      if (body === "") {
        ctx.addIssue({ code: "custom", message: COMMENT_REQUIRED_MESSAGE });
        return z.NEVER;
      }
      if (codePointLength(body) > COMMENT_MAX_LENGTH) {
        ctx.addIssue({ code: "custom", message: COMMENT_TOO_LONG_MESSAGE });
        return z.NEVER;
      }
      return body;
    }),
  },
  { error: INVALID_INPUT_MESSAGE },
);
export type AddCommentInput = z.output<typeof addCommentSchema>;

export const deleteCommentSchema = z.object(
  { id: idSchema },
  { error: INVALID_INPUT_MESSAGE },
);
export type DeleteCommentInput = z.output<typeof deleteCommentSchema>;
