import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  heightUnit,
  MIN_DESKTOP_UNIT,
  TOUCH_UNIT,
} from "../../../test/touchTargets";

describe("ToggleGroup — alvos de toque (ui-rules §1.4)", () => {
  it.each([
    "default",
    "sm",
    "lg",
  ] as const)("o item de tamanho %s tem pelo menos 36px no desktop e 44px abaixo de md", (size) => {
    render(
      <ToggleGroup defaultValue={["a"]} variant="outline" size={size}>
        <ToggleGroupItem value="a">Operador</ToggleGroupItem>
        <ToggleGroupItem value="b">Administrador</ToggleGroupItem>
      </ToggleGroup>,
    );

    for (const name of ["Operador", "Administrador"]) {
      const className = screen.getByRole("button", { name }).className;
      expect(heightUnit(className, "")).toBeGreaterThanOrEqual(
        MIN_DESKTOP_UNIT,
      );
      expect(heightUnit(className, "max-md:")).toBe(TOUCH_UNIT);
    }
  });

  it("marca o item escolhido com aria-pressed", () => {
    render(
      <ToggleGroup defaultValue={["b"]}>
        <ToggleGroupItem value="a">Operador</ToggleGroupItem>
        <ToggleGroupItem value="b">Administrador</ToggleGroupItem>
      </ToggleGroup>,
    );

    expect(
      screen.getByRole("button", { name: "Administrador" }),
    ).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Operador" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
  });
});

describe("NativeSelect — alvos de toque e texto de 16px", () => {
  it.each([
    "default",
    "sm",
  ] as const)("o select de tamanho %s tem 36px no desktop e 44px abaixo de md", (size) => {
    render(
      <NativeSelect aria-label="Unidade" size={size}>
        <NativeSelectOption value="unidade">Unidade</NativeSelectOption>
      </NativeSelect>,
    );

    const className = screen.getByRole("combobox", {
      name: "Unidade",
    }).className;
    expect(heightUnit(className, "")).toBeGreaterThanOrEqual(MIN_DESKTOP_UNIT);
    expect(heightUnit(className, "max-md:")).toBe(TOUCH_UNIT);
  });

  it("mantém o texto de 16px no celular (evita zoom do iOS)", () => {
    render(
      <NativeSelect aria-label="Unidade">
        <NativeSelectOption value="unidade">Unidade</NativeSelectOption>
      </NativeSelect>,
    );

    const classes = screen
      .getByRole("combobox", { name: "Unidade" })
      .className.split(" ");
    expect(classes).toContain("text-base");
    expect(classes).toContain("md:text-sm");
  });
});

describe("Dialog — botão de fechar", () => {
  it("tem 44px abaixo de md", () => {
    render(
      <Dialog open>
        <DialogContent>
          <DialogTitle>Título</DialogTitle>
          <DialogDescription>Descrição</DialogDescription>
        </DialogContent>
      </Dialog>,
    );

    const className = screen.getByRole("button", { name: "Fechar" }).className;
    expect(heightUnit(className, "")).toBeGreaterThanOrEqual(MIN_DESKTOP_UNIT);
    expect(heightUnit(className, "max-md:")).toBe(TOUCH_UNIT);
  });
});
