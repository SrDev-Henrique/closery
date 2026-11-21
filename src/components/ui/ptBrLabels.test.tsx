import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  SidebarProvider,
  SidebarRail,
  SidebarTrigger,
} from "@/components/ui/sidebar";

// Os primitivos do shadcn vêm em inglês; o que o leitor de tela lê tem que ser pt-BR.
describe("rótulos acessíveis dos primitivos em pt-BR", () => {
  it("SidebarTrigger e SidebarRail se chamam 'Alternar menu'", () => {
    render(
      <SidebarProvider>
        <SidebarTrigger />
        <SidebarRail />
      </SidebarProvider>,
    );

    expect(
      screen.getAllByRole("button", { name: "Alternar menu" }),
    ).toHaveLength(2);
    expect(screen.queryByText("Toggle Sidebar")).not.toBeInTheDocument();
  });

  it("o botão de fechar do Sheet se chama 'Fechar'", () => {
    render(
      <Sheet open>
        <SheetContent>
          <SheetTitle>Título</SheetTitle>
          <SheetDescription>Descrição</SheetDescription>
        </SheetContent>
      </Sheet>,
    );

    expect(screen.getByRole("button", { name: "Fechar" })).toBeInTheDocument();
    expect(screen.queryByText("Close")).not.toBeInTheDocument();
  });
});
