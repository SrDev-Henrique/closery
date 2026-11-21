"use client";

import { useState } from "react";
import { toast } from "sonner";

import {
  type AdminResult,
  fail,
  INTERNAL_ERROR_MESSAGE,
} from "@/features/admin/result";

type RunOptions = {
  /** Toast de sucesso; sem texto, sucesso é silencioso. */
  success?: string;
  /** Padrão true: erro vira toast. Formulários passam false e mostram o erro no campo. */
  showError?: boolean;
};

// Envolve a chamada a uma Server Action: controla `pending`, converte exceção
// (rede, servidor) em falha INTERNAL e cuida dos toasts. Nunca lança.
export function useAdminAction() {
  const [pending, setPending] = useState(false);

  async function run<T extends object>(
    action: () => Promise<AdminResult<T>>,
    options: RunOptions = {},
  ): Promise<AdminResult<T>> {
    setPending(true);
    let result: AdminResult<T>;
    try {
      result = await action();
    } catch {
      result = fail("INTERNAL", INTERNAL_ERROR_MESSAGE);
    } finally {
      setPending(false);
    }

    if (result.ok) {
      if (options.success) toast.success(options.success);
    } else if (options.showError ?? true) {
      toast.error(result.message);
    }
    return result;
  }

  return { pending, run };
}
