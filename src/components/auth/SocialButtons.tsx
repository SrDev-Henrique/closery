"use client";

import { Button } from "@/components/ui/button";
import { FieldSeparator } from "@/components/ui/field";
import type { SocialProvider } from "@/lib/auth/env";

const LABELS: Record<SocialProvider, string> = {
  google: "Continuar com Google",
  facebook: "Continuar com Facebook",
};

type SocialButtonsProps = {
  providers: readonly SocialProvider[];
  onSelect: (provider: SocialProvider) => void;
  disabled: boolean;
};

export function SocialButtons({
  providers,
  onSelect,
  disabled,
}: SocialButtonsProps) {
  if (providers.length === 0) return null;

  return (
    <div className="flex flex-col gap-4">
      <FieldSeparator>ou</FieldSeparator>
      <div className="flex flex-col gap-2">
        {providers.map((provider) => (
          <Button
            key={provider}
            type="button"
            variant="outline"
            size="lg"
            disabled={disabled}
            onClick={() => onSelect(provider)}
          >
            {LABELS[provider]}
          </Button>
        ))}
      </div>
    </div>
  );
}
