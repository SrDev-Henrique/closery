"use client";

import {
  moveItemAction,
  setItemActiveAction,
} from "@/app/(app)/admin/itens/actions";
import { ActiveToggleButton } from "@/components/admin/ActiveToggleButton";
import { EditDialog } from "@/components/admin/EditDialog";
import { MoveButtons } from "@/components/admin/MoveButtons";
import { useAdminAction } from "@/components/admin/useAdminAction";
import { splitUnit } from "@/features/admin/itemOptions";
import type { ItemRow } from "@/features/admin/items";

import { ItemForm } from "./ItemForm";

type ItemRowActionsProps = { item: ItemRow };

export function ItemRowActions({ item }: ItemRowActionsProps) {
  const { pending, run } = useAdminAction();
  const { choice, other } = splitUnit(item.unit);

  return (
    <>
      <MoveButtons
        label={item.name}
        canMoveUp={item.canMoveUp}
        canMoveDown={item.canMoveDown}
        pending={pending}
        onMove={(direction) =>
          run(() => moveItemAction({ id: item.id, direction }))
        }
      />
      <EditDialog title="Editar item" name={item.name}>
        {(close) => (
          <ItemForm
            sectorId={item.sectorId}
            initial={{
              id: item.id,
              name: item.name,
              unitChoice: choice,
              unitOther: other,
              kind: item.kind,
            }}
            submitLabel="Salvar alterações"
            onDone={close}
          />
        )}
      </EditDialog>
      <ActiveToggleButton
        entity="Item"
        name={item.name}
        active={item.active}
        onToggle={(nextActive) =>
          setItemActiveAction({ id: item.id, active: nextActive })
        }
      />
    </>
  );
}
