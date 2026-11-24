import {
  ClipboardList,
  House,
  type LucideIcon,
  ShieldCheck,
  UserRound,
} from "lucide-react";

export type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  adminOnly: boolean;
};

export const NAV_ITEMS: readonly NavItem[] = [
  { href: "/", label: "Início", icon: House, adminOnly: false },
  {
    href: "/passagens",
    label: "Passagens",
    icon: ClipboardList,
    adminOnly: false,
  },
  { href: "/conta", label: "Conta", icon: UserRound, adminOnly: false },
  {
    href: "/admin",
    label: "Administração",
    icon: ShieldCheck,
    adminOnly: true,
  },
];

export function visibleNavItems(isAdmin: boolean): NavItem[] {
  return NAV_ITEMS.filter((item) => isAdmin || !item.adminOnly);
}

/** "/" só é ativo na raiz; as demais valem para a rota e suas subrotas. */
export function isNavItemActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}
