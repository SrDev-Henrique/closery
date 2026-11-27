import {
  ChartColumn,
  ClipboardList,
  House,
  type LucideIcon,
  PackageOpen,
  ShieldCheck,
  UserRound,
} from "lucide-react";

export type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  adminOnly: boolean;
};

export const mainNavItems: readonly NavItem[] = [
  { href: "/", label: "Início", icon: House, adminOnly: false },
  {
    href: "/passagens",
    label: "Passagens",
    icon: ClipboardList,
    adminOnly: false,
  },
  {
    href: "/solicitacoes",
    label: "Solicitações",
    icon: PackageOpen,
    adminOnly: false,
  },
  {
    href: "/dashboard",
    label: "Dashboard",
    icon: ChartColumn,
    adminOnly: false,
  },
  { href: "/conta", label: "Conta", icon: UserRound, adminOnly: false },
];

export const adminNavItems: readonly NavItem[] = [
  {
    href: "/admin",
    label: "Administração",
    icon: ShieldCheck,
    adminOnly: true,
  },
];

export const NAV_ITEMS: readonly NavItem[] = [
  ...mainNavItems,
  ...adminNavItems,
];

export function visibleNavItems(isAdmin: boolean): NavItem[] {
  return NAV_ITEMS.filter((item) => isAdmin || !item.adminOnly);
}

/** "/" só é ativo na raiz; as demais valem para a rota e suas subrotas. */
export function isNavItemActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}
