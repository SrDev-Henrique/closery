import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { SectorColorChoice } from "@/components/admin/sectors/SectorColorChoice";
import { SECTOR_COLORS } from "@/features/sectors/colors";

describe("SectorColorChoice", () => {
  it("é um grupo de escolha 'Cor' com as cinco opções, cada uma com o nome escrito", () => {
    render(<SectorColorChoice defaultValue="lilac" />);

    const group = screen.getByRole("radiogroup", { name: "Cor" });
    const radios = screen.getAllByRole("radio");
    expect(radios).toHaveLength(SECTOR_COLORS.length);
    expect(radios.map((radio) => radio.textContent)).toEqual([
      "Lilás",
      "Pêssego",
      "Azul",
      "Verde",
      "Rosa",
    ]);
    for (const radio of radios) expect(group).toContainElement(radio);
  });

  it("cada opção mostra uma amostra de 16px com a classe da cor, e a amostra não é lida", () => {
    render(<SectorColorChoice defaultValue="lilac" />);

    const expected = [
      ["Lilás", "bg-sector-lilac"],
      ["Pêssego", "bg-sector-peach"],
      ["Azul", "bg-sector-sky"],
      ["Verde", "bg-sector-green"],
      ["Rosa", "bg-sector-pink"],
    ] as const;
    for (const [label, bg] of expected) {
      const swatch = screen
        .getByRole("radio", { name: label })
        .querySelector("[data-slot='sector-color-swatch']");
      expect(swatch, label).not.toBeNull();
      expect(swatch).toHaveClass(bg, "size-4");
      expect(swatch).toHaveAttribute("aria-hidden", "true");
    }
  });

  it("começa com a cor do defaultValue marcada, e só ela", () => {
    render(<SectorColorChoice defaultValue="sky" />);

    expect(screen.getByRole("radio", { name: "Azul" })).toBeChecked();
    for (const label of ["Lilás", "Pêssego", "Verde", "Rosa"]) {
      expect(screen.getByRole("radio", { name: label })).not.toBeChecked();
    }
  });

  it("clicar em outra cor marca ela, desmarca a anterior e avisa com a chave", async () => {
    const onValueChange = vi.fn();
    render(
      <SectorColorChoice defaultValue="lilac" onValueChange={onValueChange} />,
    );

    await userEvent.click(screen.getByRole("radio", { name: "Rosa" }));

    expect(screen.getByRole("radio", { name: "Rosa" })).toBeChecked();
    expect(screen.getByRole("radio", { name: "Lilás" })).not.toBeChecked();
    expect(onValueChange).toHaveBeenCalledTimes(1);
    expect(onValueChange).toHaveBeenCalledWith("pink");
  });

  it("clicar na cor já marcada não desmarca (nunca fica sem cor)", async () => {
    const onValueChange = vi.fn();
    render(
      <SectorColorChoice defaultValue="green" onValueChange={onValueChange} />,
    );

    await userEvent.click(screen.getByRole("radio", { name: "Verde" }));

    expect(screen.getByRole("radio", { name: "Verde" })).toBeChecked();
    expect(onValueChange).not.toHaveBeenCalled();
  });

  it("desabilitado: nada muda ao clicar", async () => {
    const onValueChange = vi.fn();
    render(
      <SectorColorChoice
        defaultValue="lilac"
        disabled
        onValueChange={onValueChange}
      />,
    );

    await userEvent.click(screen.getByRole("radio", { name: "Azul" }));

    expect(screen.getByRole("radio", { name: "Lilás" })).toBeChecked();
    expect(onValueChange).not.toHaveBeenCalled();
  });

  it("a legenda pode ser trocada", () => {
    render(<SectorColorChoice defaultValue="lilac" legend="Cor do setor" />);

    expect(
      screen.getByRole("radiogroup", { name: "Cor do setor" }),
    ).toBeInTheDocument();
  });
});
