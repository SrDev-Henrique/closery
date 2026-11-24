import { z } from "zod";

import { CHOICE_LIST_LIMIT } from "@/features/admin/pagination";
import { INVALID_INPUT_MESSAGE } from "@/features/admin/result";
import { idSchema } from "@/features/admin/schemas";

import {
  codePointLength,
  normalizeFreeText,
  normalizeItemNote,
  normalizeOptionalText,
  normalizeReason,
  validateFieldChange,
} from "./fieldRules";
import {
  ALL_SECTORS,
  CONFIRMATION_NOTE_MAX_LENGTH,
  ITEM_NOTE_MAX_LENGTH,
  MAX_QUANTITY,
  REASON_MAX_LENGTH,
  TEXT_MAX_LENGTH,
} from "./limits";
import {
  CONFIRMATION_NOTE_TOO_LONG_MESSAGE,
  DUPLICATE_ITEM_MESSAGE,
  INVALID_DATE_MESSAGE,
  NOTE_TOO_LONG_MESSAGE,
  QUANTITY_MESSAGE,
  REASON_REQUIRED_MESSAGE,
  REASON_TOO_LONG_MESSAGE,
  TEXT_TOO_LONG_MESSAGE,
} from "./messages";
import { isIsoDate } from "./saoPaulo";
import { SECTOR_PICKER_PATHS } from "./urls";

// Todo campo tem mensagem em pt-BR própria: o texto padrão do Zod é inglês e
// nunca pode chegar à tela.
const textSchema = z.string({ error: INVALID_INPUT_MESSAGE });

export const isoDateSchema = z
  .string({ error: INVALID_DATE_MESSAGE })
  .refine(isIsoDate, { error: INVALID_DATE_MESSAGE });

export const handoverRefSchema = z.object({
  sectorId: idSchema,
  shiftId: idSchema,
  operationalDate: isoDateSchema,
});

export const saveFieldSchema = z
  .discriminatedUnion(
    "field",
    [
      handoverRefSchema.extend({
        field: z.literal("occurrences"),
        value: textSchema,
      }),
      handoverRefSchema.extend({
        field: z.literal("nextShift"),
        value: textSchema,
      }),
      handoverRefSchema.extend({
        field: z.literal("quantity"),
        itemId: idSchema,
        value: z.number({ error: QUANTITY_MESSAGE }),
      }),
      handoverRefSchema.extend({
        field: z.literal("note"),
        itemId: idSchema,
        value: textSchema,
      }),
    ],
    { error: INVALID_INPUT_MESSAGE },
  )
  .transform((input, ctx) => {
    const validated = validateFieldChange(input);
    if (!validated.ok) {
      ctx.addIssue({
        code: "custom",
        message: validated.message,
        path: ["value"],
      });
      return z.NEVER;
    }
    return {
      sectorId: input.sectorId,
      shiftId: input.shiftId,
      operationalDate: input.operationalDate,
      ...validated.change,
    };
  });

export const deliverHandoverSchema = handoverRefSchema;

export const confirmHandoverSchema = z.object({
  id: idSchema,
  note: textSchema.transform((raw, ctx) => {
    const note = normalizeOptionalText(raw);
    if (note !== null && codePointLength(note) > CONFIRMATION_NOTE_MAX_LENGTH) {
      ctx.addIssue({
        code: "custom",
        message: CONFIRMATION_NOTE_TOO_LONG_MESSAGE,
      });
      return z.NEVER;
    }
    return note;
  }),
});

const reasonSchema = textSchema.transform((raw, ctx) => {
  const reason = normalizeReason(raw);
  if (reason === "") {
    ctx.addIssue({ code: "custom", message: REASON_REQUIRED_MESSAGE });
    return z.NEVER;
  }
  if (codePointLength(reason) > REASON_MAX_LENGTH) {
    ctx.addIssue({ code: "custom", message: REASON_TOO_LONG_MESSAGE });
    return z.NEVER;
  }
  return reason;
});

const longTextSchema = textSchema.transform((raw, ctx) => {
  const text = normalizeFreeText(raw);
  if (codePointLength(text) > TEXT_MAX_LENGTH) {
    ctx.addIssue({ code: "custom", message: TEXT_TOO_LONG_MESSAGE });
    return z.NEVER;
  }
  return text;
});

const correctionItemSchema = z.object(
  {
    itemId: idSchema,
    quantity: z
      .number({ error: QUANTITY_MESSAGE })
      .int({ error: QUANTITY_MESSAGE })
      .min(0, { error: QUANTITY_MESSAGE })
      .max(MAX_QUANTITY, { error: QUANTITY_MESSAGE }),
    note: textSchema.transform((raw, ctx) => {
      const note = normalizeItemNote(raw) ?? "";
      if (codePointLength(note) > ITEM_NOTE_MAX_LENGTH) {
        ctx.addIssue({ code: "custom", message: NOTE_TOO_LONG_MESSAGE });
        return z.NEVER;
      }
      return note;
    }),
  },
  { error: INVALID_INPUT_MESSAGE },
);

export const correctHandoverSchema = z.object({
  id: idSchema,
  reason: reasonSchema,
  occurrencesText: longTextSchema,
  nextShiftText: longTextSchema,
  items: z
    .array(correctionItemSchema, { error: INVALID_INPUT_MESSAGE })
    .max(CHOICE_LIST_LIMIT, { error: INVALID_INPUT_MESSAGE })
    .refine(
      (items) =>
        new Set(items.map((line) => line.itemId)).size === items.length,
      { error: DUPLICATE_ITEM_MESSAGE },
    ),
});

export const chooseSectorSchema = z.object({
  sectorId: z.union([idSchema, z.literal(ALL_SECTORS)], {
    error: INVALID_INPUT_MESSAGE,
  }),
  path: z.enum(SECTOR_PICKER_PATHS, { error: INVALID_INPUT_MESSAGE }),
});

export type SaveFieldInputParsed = z.infer<typeof saveFieldSchema>;
export type DeliverHandoverInput = z.infer<typeof deliverHandoverSchema>;
export type ConfirmHandoverInput = z.infer<typeof confirmHandoverSchema>;
export type CorrectHandoverInput = z.infer<typeof correctHandoverSchema>;
export type ChooseSectorInput = z.infer<typeof chooseSectorSchema>;
