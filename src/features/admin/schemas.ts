import { z } from "zod";

import { SECTOR_COLORS } from "@/features/sectors/colors";
import { ITEM_KINDS } from "@/lib/itemKinds";
import { ROLES } from "@/lib/roles";

import { resolveUnit } from "./itemOptions";
import {
  INVITE_LABEL_TOO_LONG_MESSAGE,
  SECTOR_COLOR_INVALID_MESSAGE,
  SECTOR_REQUIRED_MESSAGE,
} from "./messages";
import { normalizeName, validateName } from "./names";
import { type FieldErrors, INVALID_INPUT_MESSAGE } from "./result";
import { TIME_INPUT_PATTERN } from "./timeOfDay";

// Sem importar de features/invites (arrastaria o banco para o cliente); o teste
// confere que este valor é o mesmo de ADMIN_INVITE_LABEL_MAX_LENGTH.
export const INVITE_LABEL_MAX_LENGTH = 80;

const INVALID_ID_MESSAGE = "Registro inválido. Atualize a página.";
const INVALID_TIME_MESSAGE = "Informe um horário válido, como 06:00.";
const SAME_TIME_MESSAGE = "O início e o fim não podem ser iguais.";

// Todo campo tem mensagem em pt-BR própria: o texto padrão do Zod é inglês e
// nunca pode chegar à tela.
export const idSchema = z.uuid({ error: INVALID_ID_MESSAGE });

export const nameSchema = z
  .string({ error: "Informe o nome." })
  .transform((raw, ctx) => {
    const result = validateName(raw);
    if (!result.ok) {
      ctx.addIssue({ code: "custom", message: result.message });
      return z.NEVER;
    }
    return result.name;
  });

export const timeSchema = z
  .string({ error: INVALID_TIME_MESSAGE })
  .regex(TIME_INPUT_PATTERN, { error: INVALID_TIME_MESSAGE });

const userIdSchema = z
  .string({ error: INVALID_INPUT_MESSAGE })
  .min(1, { error: INVALID_INPUT_MESSAGE });
const activeSchema = z.boolean({ error: INVALID_INPUT_MESSAGE });
const roleSchema = z.enum(ROLES, { error: "Escolha o papel." });
const kindSchema = z.enum(ITEM_KINDS, { error: "Escolha o tipo do item." });
const textSchema = z.string({ error: INVALID_INPUT_MESSAGE });

// Só as chaves da paleta (D-V3). Mensagem própria em português para qualquer valor fora dela
// (ausente, tipo errado ou outra cor): a tela só oferece as cinco, então isso é defesa.
const sectorColorSchema = z.enum(SECTOR_COLORS, {
  error: SECTOR_COLOR_INVALID_MESSAGE,
});

export const createSectorSchema = z.object({
  name: nameSchema,
  color: sectorColorSchema,
});
export const renameSectorSchema = z.object({
  id: idSchema,
  name: nameSchema,
  color: sectorColorSchema,
});
export const createDestinationSchema = z.object({ name: nameSchema });
export const renameDestinationSchema = z.object({
  id: idSchema,
  name: nameSchema,
});
export const setActiveSchema = z.object({ id: idSchema, active: activeSchema });
export const moveSchema = z.object({
  id: idSchema,
  direction: z.enum(["up", "down"], { error: INVALID_INPUT_MESSAGE }),
});

export const createShiftSchema = z
  .object({
    sectorId: idSchema,
    name: nameSchema,
    startsAt: timeSchema,
    endsAt: timeSchema,
  })
  .refine((value) => value.startsAt !== value.endsAt, {
    error: SAME_TIME_MESSAGE,
    path: ["endsAt"],
  });

export const updateShiftSchema = z
  .object({
    id: idSchema,
    name: nameSchema,
    startsAt: timeSchema,
    endsAt: timeSchema,
  })
  .refine((value) => value.startsAt !== value.endsAt, {
    error: SAME_TIME_MESSAGE,
    path: ["endsAt"],
  });

function refineUnit(
  value: { unitChoice: string; unitOther: string },
  ctx: z.RefinementCtx,
): void {
  const unit = resolveUnit(value.unitChoice, value.unitOther);
  if (!unit.ok) {
    ctx.addIssue({ code: "custom", message: unit.message, path: [unit.field] });
  }
}

export const createItemSchema = z
  .object({
    sectorId: idSchema,
    name: nameSchema,
    unitChoice: textSchema,
    unitOther: textSchema,
    kind: kindSchema,
  })
  .superRefine(refineUnit);

export const updateItemSchema = z
  .object({
    id: idSchema,
    name: nameSchema,
    unitChoice: textSchema,
    unitOther: textSchema,
    kind: kindSchema,
  })
  .superRefine(refineUnit);

export const updatePersonSchema = z
  .object({
    userId: userIdSchema,
    role: roleSchema,
    sectorId: idSchema.nullable(),
  })
  .refine((value) => value.role !== "operator" || value.sectorId !== null, {
    error: SECTOR_REQUIRED_MESSAGE,
    path: ["sectorId"],
  });

// `user.id` é text, não uuid.
export const setPersonActiveSchema = z.object({
  userId: userIdSchema,
  active: activeSchema,
});

export const createPasswordResetLinkSchema = z.object({ userId: userIdSchema });

const inviteeLabelSchema = z
  .string({ error: INVALID_INPUT_MESSAGE })
  .transform((raw, ctx) => {
    const label = normalizeName(raw);
    if ([...label].length > INVITE_LABEL_MAX_LENGTH) {
      ctx.addIssue({
        code: "custom",
        message: INVITE_LABEL_TOO_LONG_MESSAGE,
      });
      return z.NEVER;
    }
    // Vazio continua "": é o domínio que o transforma em null.
    return label;
  });

export const createInviteSchema = z.object({
  inviteeLabel: inviteeLabelSchema,
  role: roleSchema,
  sectorId: idSchema.nullable(),
});

export const cancelInviteSchema = z.object({ id: idSchema });

export type CreateSectorInput = z.infer<typeof createSectorSchema>;
export type RenameSectorInput = z.infer<typeof renameSectorSchema>;
export type CreateDestinationInput = z.infer<typeof createDestinationSchema>;
export type RenameDestinationInput = z.infer<typeof renameDestinationSchema>;
export type SetActiveInput = z.infer<typeof setActiveSchema>;
export type MoveInput = z.infer<typeof moveSchema>;
export type CreateShiftInput = z.infer<typeof createShiftSchema>;
export type UpdateShiftInput = z.infer<typeof updateShiftSchema>;
export type CreateItemInput = z.infer<typeof createItemSchema>;
export type UpdateItemInput = z.infer<typeof updateItemSchema>;
export type UpdatePersonInput = z.infer<typeof updatePersonSchema>;
export type SetPersonActiveInput = z.infer<typeof setPersonActiveSchema>;
export type CreatePasswordResetLinkInput = z.infer<
  typeof createPasswordResetLinkSchema
>;
export type CreateInviteInput = z.infer<typeof createInviteSchema>;
export type CancelInviteInput = z.infer<typeof cancelInviteSchema>;

/**
 * Primeira mensagem de cada campo (o primeiro segmento do caminho do problema);
 * problemas sem campo (raiz) ficam de fora. Não usa z.flattenError: com
 * `z.ZodError` sem tipo de entrada, o fieldErrors dele sai tipado como `{}`.
 */
export function firstFieldErrors(error: z.ZodError): FieldErrors {
  const result: FieldErrors = {};
  for (const issue of error.issues) {
    const field = issue.path[0];
    if (field === undefined) continue;
    const key = String(field);
    if (result[key] === undefined) result[key] = issue.message;
  }
  return result;
}
