"use client";

import Link from "next/link";
import { type FormEvent, useId, useState } from "react";

import { createInviteAction } from "@/app/(app)/admin/equipe/actions";
import { ChoiceGroup } from "@/components/admin/ChoiceGroup";
import { SelectField } from "@/components/admin/SelectField";
import { useAdminAction } from "@/components/admin/useAdminAction";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import type { FieldErrors } from "@/features/admin/result";
import { createInviteSchema, firstFieldErrors } from "@/features/admin/schemas";
import type { SectorChoice } from "@/features/admin/sectors";
import type { Role } from "@/lib/roles";
import { InviteLinkCard } from "./InviteLinkCard";
import { ROLE_OPTIONS } from "./roleOptions";

type CreatedInvite = { url: string; expiresAt: Date };

export function InviteForm({ sectors }: { sectors: readonly SectorChoice[] }) {
  const uid = useId();
  const { pending, run } = useAdminAction();
  // Nunca em branco: papel Operador (o mais comum) e o primeiro setor ativo.
  const [label, setLabel] = useState("");
  const [role, setRole] = useState<Role>("operator");
  const [sectorId, setSectorId] = useState(sectors[0]?.id ?? "");
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [created, setCreated] = useState<CreatedInvite | null>(null);

  const needsSector = role === "operator";
  const noSector = needsSector && sectors.length === 0;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending || noSector) return;
    setFormError(null);

    const values = {
      inviteeLabel: label,
      role,
      sectorId: needsSector && sectorId !== "" ? sectorId : null,
    };
    const parsed = createInviteSchema.safeParse(values);
    if (!parsed.success) {
      setFieldErrors(firstFieldErrors(parsed.error));
      return;
    }
    setFieldErrors({});

    const result = await run(() => createInviteAction(values), {
      success: "Convite gerado.",
      showError: false,
    });
    if (result.ok) {
      setCreated({ url: result.url, expiresAt: result.expiresAt });
      return;
    }
    setFieldErrors(result.fieldErrors ?? {});
    if (!result.fieldErrors || Object.keys(result.fieldErrors).length === 0) {
      setFormError(result.message);
    }
  }

  function handleReset() {
    setCreated(null);
    setLabel("");
    setFieldErrors({});
    setFormError(null);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Convidar pessoa</CardTitle>
      </CardHeader>
      <CardContent>
        {created ? (
          <InviteLinkCard
            url={created.url}
            expiresAt={created.expiresAt}
            onReset={handleReset}
          />
        ) : (
          <form onSubmit={handleSubmit} noValidate>
            <FieldGroup>
              <Field data-invalid={fieldErrors.inviteeLabel ? true : undefined}>
                <FieldLabel htmlFor={`${uid}-label`}>
                  Nome de referência (opcional)
                </FieldLabel>
                <Input
                  id={`${uid}-label`}
                  value={label}
                  disabled={pending}
                  autoComplete="off"
                  aria-invalid={fieldErrors.inviteeLabel ? true : undefined}
                  aria-describedby={
                    fieldErrors.inviteeLabel ? `${uid}-label-error` : undefined
                  }
                  onChange={(event) => setLabel(event.target.value)}
                />
                <FieldDescription>
                  Só para você reconhecer o convite na lista.
                </FieldDescription>
                {fieldErrors.inviteeLabel && (
                  <FieldError id={`${uid}-label-error`}>
                    {fieldErrors.inviteeLabel}
                  </FieldError>
                )}
              </Field>

              <ChoiceGroup
                legend="Papel"
                value={role}
                onValueChange={setRole}
                options={ROLE_OPTIONS}
                disabled={pending}
              />

              {needsSector && !noSector && (
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
              )}

              {noSector && (
                <div className="flex flex-col items-start gap-2">
                  <p className="text-sm text-muted-foreground">
                    Cadastre um setor antes de convidar um operador.
                  </p>
                  <Link
                    href="/admin/setores"
                    className={buttonVariants({ variant: "outline" })}
                  >
                    Ir para Setores
                  </Link>
                </div>
              )}

              {formError && <FieldError>{formError}</FieldError>}

              {!noSector && (
                <Button type="submit" size="lg" disabled={pending}>
                  Gerar convite
                </Button>
              )}
            </FieldGroup>
          </form>
        )}
      </CardContent>
    </Card>
  );
}
