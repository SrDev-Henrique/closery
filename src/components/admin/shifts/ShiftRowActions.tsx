"use client";

import { toast } from "sonner";

import {
  moveShiftAction,
  setShiftActiveAction,
} from "@/app/(app)/admin/turnos/actions";
import { ActiveToggleButton } from "@/components/admin/ActiveToggleButton";
import { EditDialog } from "@/components/admin/EditDialog";
import { MoveButtons } from "@/components/admin/MoveButtons";
import { useAdminAction } from "@/components/admin/useAdminAction";
import { formatOverlapWarning } from "@/features/admin/shiftRules";
import type { ShiftRow } from "@/features/admin/shifts";

import { ShiftForm } from "./ShiftForm";

type ShiftRowActionsProps = { shift: ShiftRow };

export function ShiftRowActions({ shift }: ShiftRowActionsProps) {
  const { pending, run } = useAdminAction();

  return (
    <>
      <MoveButtons
        label={shift.name}
        canMoveUp={shift.canMoveUp}
        canMoveDown={shift.canMoveDown}
        pending={pending}
        onMove={(direction) =>
          run(() => moveShiftAction({ id: shift.id, direction }))
        }
      />
      <EditDialog title="Editar turno" name={shift.name}>
        {(close) => (
          <ShiftForm
            sectorId={shift.sectorId}
            initial={{
              id: shift.id,
              name: shift.name,
              startsAt: shift.startsAt,
              endsAt: shift.endsAt,
            }}
            submitLabel="Salvar alterações"
            onDone={close}
          />
        )}
      </EditDialog>
      <ActiveToggleButton
        entity="Turno"
        name={shift.name}
        active={shift.active}
        onToggle={async (nextActive) => {
          const result = await setShiftActiveAction({
            id: shift.id,
            active: nextActive,
          });
          if (result.ok) {
            for (const warning of result.warnings.slice(0, 3)) {
              toast.warning(formatOverlapWarning(warning));
            }
          }
          return result;
        }}
      />
    </>
  );
}
