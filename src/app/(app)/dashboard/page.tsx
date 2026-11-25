import type { Metadata } from "next";
import { Suspense } from "react";
import { DashboardSkeleton } from "@/components/dashboard/DashboardBlockSkeleton";
import { DashboardScreen } from "@/components/dashboard/DashboardScreen";
import type { SearchParams } from "@/lib/searchParams";

export const metadata: Metadata = { title: "Dashboard" };

// A leitura da sessão e do banco vive dentro do <Suspense> (Cache Components).
export default function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  return (
    <Suspense fallback={<DashboardSkeleton />}>
      <DashboardScreen searchParams={searchParams} />
    </Suspense>
  );
}
