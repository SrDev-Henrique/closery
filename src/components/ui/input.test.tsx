import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Input } from "@/components/ui/input";
import {
  heightUnit,
  MIN_DESKTOP_UNIT,
  TOUCH_UNIT,
} from "../../../test/touchTargets";

function renderedClassName(): string {
  render(<Input aria-label="Campo" />);
  return screen.getByRole("textbox", { name: "Campo" }).className;
}

describe("Input — alvos de toque (ui-rules §1.4)", () => {
  it("tem pelo menos 36px (h-9) no desktop e 44px (h-11) abaixo de md", () => {
    const className = renderedClassName();
    expect(heightUnit(className, "")).toBeGreaterThanOrEqual(MIN_DESKTOP_UNIT);
    expect(heightUnit(className, "max-md:")).toBe(TOUCH_UNIT);
  });

  it("mantém o texto de 16px no celular (evita zoom do iOS)", () => {
    const classes = renderedClassName().split(" ");
    expect(classes).toContain("text-base");
    expect(classes).toContain("md:text-sm");
  });

  it("override de altura em className não remove o alvo de toque do celular", () => {
    render(<Input aria-label="Campo" className="h-6" />);
    const className = screen.getByRole("textbox", { name: "Campo" }).className;
    expect(heightUnit(className, "max-md:")).toBe(TOUCH_UNIT);
  });
});
