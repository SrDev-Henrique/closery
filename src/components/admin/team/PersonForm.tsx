"use client";

import { type FormEvent, useState } from "react";

import { updatePersonAction } from "@/app/(app)/admin/equipe/actions";
import { ChoiceGroup } from "@/components/admin/ChoiceGroup";
import { SelectField } from "@/components/admin/SelectField";
import { useAdminAction } from "@/components/admin/useAdminAction";
import { Button } from "@/components/ui/button";
import { FieldError, FieldGroup } from "@/components/ui/field";
import type { PersonRow } from "@/features/admin/people";
import type { FieldErrors } from "@/features/admin/result";
import { firstFieldErrors, updatePersonSchema } from "@/features/admin/schemas";
import type { SectorChoice } from "@/features/admin/sectors";
import type { Role } from "@/lib/roles";
import { ROLE_OPTIONS } from "./roleOptions";

export function PersonForm({
  person,
  sectors,
  onDone,
}: {
  person: PersonRow;
  sectors: readonly SectorChoice[];
  onDone: () => void;
}) {
  const { pending, run } = useAdminAction();
  // Nunca em branco: quem já tem setor ativo o mantém; senão, o primeiro da lista.
  const [role, setRole] = useState<Role>(person.role);
  const [sectorId, setSectorId] = useState(
    sectors.some((sector) => sector.id === person.sectorId)
      ? (person.sectorId ?? "")
      : (sectors[0]?.id ?? ""),
  );
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    setFormError(null);

    const values = {
      userId: person.id,
      role,
      sectorId: role === "operator" && sectorId !== "" ? sectorId : null,
    };
    const parsed = updatePersonSchema.safeParse(values);
    if (!parsed.success) {
      setFieldErrors(firstFieldErrors(parsed.error));
      return;
    }
    setFieldErrors({});

    const result = await run(() => updatePersonAction(values), {
      success: "Alterações salvas.",
      showError: false,
    });
    if (result.ok) {
      onDone();
      return;
    }
    setFieldErrors(result.fieldErrors ?? {});
    // Erro de um campo já aparece no campo; o resto vai no pé do formulário.
    if (!result.fieldErrors?.sectorId) {
      setFormError(result.message);
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate>
      <FieldGroup>
        <ChoiceGroup
          legend="Papel"
          value={role}
          onValueChange={setRole}
          options={ROLE_OPTIONS}
          disabled={pending}
        />

        {role === "operator" ? (
          <SelectField
            label="Setor"
            value={sectorId}
            onValueChange={setSectorId}
            options={sectors.map((sector) => ({
              value: sector.id,
              label: sector.name,
            }))}
            error={fieldErrors.sectorId}
            disabled={pending}
          />
        ) : (
          <p className="text-sm text-muted-foreground">
            Administradores veem todos os setores.
          </p>
        )}

        {formError && <FieldError>{formError}</FieldError>}

        <Button type="submit" size="lg" disabled={pending}>
          Salvar alterações
        </Button>
      </FieldGroup>
    </form>
  );
}
