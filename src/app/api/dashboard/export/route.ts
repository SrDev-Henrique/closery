import { db } from "@/db";
import { csvResponseHeaders } from "@/features/dashboard/csv";
import {
  buildPassagesCsv,
  CSV_NO_SECTOR_MESSAGE,
  CSV_TOO_LARGE_MESSAGE,
} from "@/features/dashboard/exportCsv";
import { resolveDashboardScope } from "@/features/dashboard/scope";
import { requireUser } from "@/lib/auth/session";
import { queryRecord } from "@/lib/searchParams";

const TEXT_HEADERS = {
  "Content-Type": "text/plain; charset=utf-8",
  "Cache-Control": "private, no-store",
};

export async function GET(request: Request): Promise<Response> {
  const actor = await requireUser();
  const params = queryRecord(new URL(request.url).search);
  const now = new Date();

  const resolved = await resolveDashboardScope(db, actor, params, now);
  if (resolved.kind !== "ok") {
    return new Response(CSV_NO_SECTOR_MESSAGE, {
      status: 404,
      headers: TEXT_HEADERS,
    });
  }

  const csv = await buildPassagesCsv(db, actor, resolved.scope, now);
  if (!csv.ok) {
    return new Response(CSV_TOO_LARGE_MESSAGE, {
      status: 413,
      headers: TEXT_HEADERS,
    });
  }
  return new Response(csv.body, {
    status: 200,
    headers: csvResponseHeaders(csv.filename),
  });
}
