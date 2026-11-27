"use client";

import { X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import {
  adminNavItems,
  isNavItemActive,
  mainNavItems,
  type NavItem,
} from "@/components/app-shell/navItems";
import { UserAvatar } from "@/components/app-shell/UserAvatar";
import { Button } from "@/components/ui/button";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

type AppSidebarProps = {
  isAdmin: boolean;
  userName: string;
  userEmail: string;
  avatarSrc: string;
};

// Item da navegação: pílula de 48px (não encolhe no celular), Satoshi 16/700,
// ícone de 18px. O ativo é o botão primário; o hover é o `accent` em 150ms.
// As variantes `data-active:*` repetem hover e pressionado para o ativo não
// perder a cor quando o ponteiro passa por cima.
const NAV_ITEM_CLASS =
  "h-12 gap-3 rounded-full px-[18px] font-heading text-base font-bold transition-colors duration-150 motion-reduce:transition-none max-md:h-12 hover:bg-accent hover:text-foreground active:bg-accent active:text-foreground data-active:bg-primary data-active:font-bold data-active:text-primary-foreground data-active:hover:bg-primary data-active:hover:text-primary-foreground data-active:active:bg-primary data-active:active:text-primary-foreground [&_svg]:size-[18px]";

type NavGroupProps = {
  label: string;
  items: readonly NavItem[];
  pathname: string;
  onNavigate: () => void;
};

function NavGroup({ label, items, pathname, onNavigate }: NavGroupProps) {
  return (
    <nav aria-label={label} className="rounded-[28px] bg-card">
      <SidebarGroup>
        <SidebarGroupContent>
          <SidebarMenu className="gap-0.5">
            {items.map(({ href, label: itemLabel, icon: Icon }) => {
              const isActive = isNavItemActive(pathname, href);
              return (
                <SidebarMenuItem key={href}>
                  <SidebarMenuButton
                    className={NAV_ITEM_CLASS}
                    isActive={isActive}
                    render={
                      <Link
                        href={href}
                        aria-current={isActive ? "page" : undefined}
                        onClick={onNavigate}
                      />
                    }
                  >
                    <Icon strokeWidth={2.2} aria-hidden="true" />
                    <span>{itemLabel}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              );
            })}
          </SidebarMenu>
        </SidebarGroupContent>
      </SidebarGroup>
    </nav>
  );
}

export function AppSidebar({
  isAdmin,
  userName,
  userEmail,
  avatarSrc,
}: AppSidebarProps) {
  const pathname = usePathname();
  const { isMobile, setOpenMobile } = useSidebar();
  const closeDrawer = () => setOpenMobile(false);

  return (
    <Sidebar>
      <SidebarHeader className="flex-row items-center justify-between gap-3 px-6 pt-[22px] pb-0">
        <span className="font-heading text-[28px] leading-none font-black tracking-[-0.03em]">
          Closery
        </span>
        {isMobile ? (
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  type="button"
                  variant="surface"
                  size="icon-pill"
                  aria-label="Fechar menu"
                  onClick={closeDrawer}
                />
              }
            >
              <X strokeWidth={2.2} aria-hidden="true" className="size-[18px]" />
            </TooltipTrigger>
            <TooltipContent>Fechar menu</TooltipContent>
          </Tooltip>
        ) : null}
      </SidebarHeader>
      <SidebarContent className="gap-5 px-4 pt-5">
        <NavGroup
          label="Principal"
          items={mainNavItems}
          pathname={pathname}
          onNavigate={closeDrawer}
        />
        {isAdmin ? (
          <NavGroup
            label="Administração"
            items={adminNavItems}
            pathname={pathname}
            onNavigate={closeDrawer}
          />
        ) : null}
      </SidebarContent>
      <SidebarFooter className="px-4 pt-5 pb-4">
        <div className="flex items-center gap-3 rounded-[24px] bg-card p-3">
          <UserAvatar src={avatarSrc} size={44} tilt={-4} />
          <div className="flex min-w-0 flex-1 flex-col gap-0.5">
            <span className="truncate font-heading text-[15px] leading-[normal] font-bold">
              {userName}
            </span>
            <span className="truncate text-[12.5px] leading-[normal] text-muted-foreground">
              {userEmail}
            </span>
          </div>
          <span className="h-6 shrink-0 rounded-full bg-accent px-[9px] font-mono text-[11px] leading-6 font-medium tracking-[.02em]">
            {isAdmin ? "ADMIN" : "COLEGA"}
          </span>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
