import type { AdminErrorCode } from "@/features/admin/result";

// Falhas em que a tela mostra um estado velho (alguém mexeu na solicitação
// antes): o runner não revalida em falha, então o cliente atualiza sozinho com
// router.refresh() depois de avisar (F4-20).
const STALE_SCREEN_CODES: ReadonlySet<AdminErrorCode> = new Set([
  "STATUS_CONFLICT",
  "NO_CHANGES",
  "NOT_FOUND",
]);

export function isStaleScreenCode(code: AdminErrorCode): boolean {
  return STALE_SCREEN_CODES.has(code);
}
