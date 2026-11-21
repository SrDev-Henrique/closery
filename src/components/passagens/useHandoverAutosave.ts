"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import {
  type AdminResult,
  INTERNAL_ERROR_MESSAGE,
} from "@/features/admin/result";
import type { SavedField } from "@/features/handovers/draft";
import { AUTOSAVE_DEBOUNCE_MS } from "@/features/handovers/limits";
import type {
  FieldChange,
  HandoverRef,
  SavedMark,
  SaveFieldInput,
} from "@/features/handovers/types";

export type AutosaveStatus =
  | { kind: "idle" }
  | { kind: "saving" }
  | { kind: "saved"; at: Date }
  | { kind: "error"; message: string };

export type HandoverAutosave = {
  status: AutosaveStatus;
  lastSaved: SavedMark | null;
  hasUnsaved: boolean;
  change(change: FieldChange): void;
  commit(field: FieldChange): void;
  flush(): Promise<boolean>;
  retry(): void;
};

type View = {
  status: AutosaveStatus;
  lastSaved: SavedMark | null;
  hasUnsaved: boolean;
};

function keyOf(change: FieldChange): string {
  return change.field === "quantity" || change.field === "note"
    ? `${change.field}:${change.itemId}`
    : change.field;
}

// Estado mutável do motor, fora do ciclo de render (refs). Uma só requisição
// em voo por vez: duas Server Actions simultâneas não têm ordem garantida, e o
// valor velho poderia sobrescrever o novo.
function createCore(initial: SavedMark | null) {
  return {
    pending: new Map<string, FieldChange>(), // último valor de cada campo
    ready: new Set<string>(), // campos prontos para enviar (debounce vencido)
    timers: new Map<string, ReturnType<typeof setTimeout>>(),
    inFlight: null as string | null,
    running: false,
    stopped: false, // fila parada por falha, até retry()
    errorMessage: "",
    savedAt: null as Date | null,
    lastSaved: initial,
    waiters: [] as Array<() => void>,
    mounted: true,
  };
}

export function useHandoverAutosave(options: {
  ref: HandoverRef;
  save: (input: SaveFieldInput) => Promise<AdminResult<SavedField>>;
  initial: SavedMark | null;
  debounceMs?: number;
}): HandoverAutosave {
  const [core] = useState(() => createCore(options.initial));
  const [view, setView] = useState<View>({
    status: { kind: "idle" },
    lastSaved: options.initial,
    hasUnsaved: false,
  });

  // O motor lê sempre a versão mais recente das opções (a action é injetável).
  const optionsRef = useRef(options);
  useEffect(() => {
    optionsRef.current = options;
  });

  const api = useMemo(() => {
    function publish() {
      if (!core.mounted) return;
      const unsaved =
        core.pending.size > 0 || core.inFlight !== null || core.stopped;
      let status: AutosaveStatus = { kind: "idle" };
      if (core.stopped) status = { kind: "error", message: core.errorMessage };
      else if (unsaved) status = { kind: "saving" };
      else if (core.savedAt) status = { kind: "saved", at: core.savedAt };
      setView({ status, lastSaved: core.lastSaved, hasUnsaved: unsaved });
    }

    async function pump(): Promise<void> {
      if (core.running || core.stopped) return;
      core.running = true;
      try {
        for (;;) {
          const key = core.ready.values().next().value;
          if (key === undefined) break;
          core.ready.delete(key);
          const change = core.pending.get(key);
          if (change === undefined) continue;

          core.pending.delete(key);
          core.inFlight = key;
          publish();

          let failure: string | null = null;
          try {
            const { ref, save } = optionsRef.current;
            const result = await save({ ...ref, ...change });
            if (result.ok) {
              core.savedAt = result.savedAt;
              core.lastSaved = {
                at: result.savedAt,
                byName: result.savedByName,
              };
            } else {
              failure = result.message;
            }
          } catch {
            failure = INTERNAL_ERROR_MESSAGE;
          }
          core.inFlight = null;

          if (failure !== null) {
            // Mantém o digitado: um valor mais novo do campo vence o que falhou.
            if (!core.pending.has(key)) core.pending.set(key, change);
            core.ready.add(key);
            core.stopped = true;
            core.errorMessage = failure;
            break;
          }
        }
      } finally {
        core.running = false;
        publish();
        for (const resolve of core.waiters.splice(0)) resolve();
      }
    }

    function change(next: FieldChange) {
      const key = keyOf(next);
      core.pending.set(key, next);
      core.ready.delete(key);
      const old = core.timers.get(key);
      if (old) clearTimeout(old);
      core.timers.set(
        key,
        setTimeout(() => {
          core.timers.delete(key);
          core.ready.add(key);
          void pump();
        }, optionsRef.current.debounceMs ?? AUTOSAVE_DEBOUNCE_MS),
      );
      publish();
    }

    function commit(next: FieldChange) {
      const key = keyOf(next);
      const old = core.timers.get(key);
      if (old) clearTimeout(old);
      core.timers.delete(key);
      core.pending.set(key, next);
      core.ready.add(key);
      publish();
      void pump();
    }

    async function flush(): Promise<boolean> {
      for (const timer of core.timers.values()) clearTimeout(timer);
      core.timers.clear();
      for (const key of core.pending.keys()) core.ready.add(key);
      core.stopped = false;
      const done = new Promise<void>((resolve) => core.waiters.push(resolve));
      void pump();
      await done;
      return core.pending.size === 0 && core.inFlight === null && !core.stopped;
    }

    function retry() {
      void flush();
    }

    return { change, commit, flush, retry };
  }, [core]);

  // Reenvia o que falhou quando a rede volta.
  useEffect(() => {
    window.addEventListener("online", api.retry);
    return () => window.removeEventListener("online", api.retry);
  }, [api]);

  // Só avisa ao sair da página enquanto houver algo não salvo.
  useEffect(() => {
    if (!view.hasUnsaved) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [view.hasUnsaved]);

  // Ao desmontar (trocar de turno, navegar) envia o pendente sem esperar.
  useEffect(() => {
    core.mounted = true;
    return () => {
      core.mounted = false;
      void api.flush();
    };
  }, [core, api]);

  return { ...view, ...api };
}
