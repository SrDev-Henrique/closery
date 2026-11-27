import { describe, expect, it } from "vitest";

import { buttonVariants } from "@/components/ui/button";
import {
  heightUnit,
  MIN_DESKTOP_UNIT,
  TOUCH_UNIT,
} from "../../../test/touchTargets";

const SIZES = [
  "default",
  "xs",
  "sm",
  "lg",
  "icon",
  "icon-xs",
  "icon-sm",
  "icon-lg",
  "pill",
  "icon-pill",
] as const;

// Estes já são 44px em qualquer tela; os demais ganham o modificador max-md.
const ALWAYS_TOUCH_SIZED = ["lg", "icon-lg", "icon-pill"] as const;
// O `pill` tem 48px em qualquer tela (acima do mínimo de toque).
const PILL_HEIGHT_UNIT = 12;
const FIXED_SIZES = [...ALWAYS_TOUCH_SIZED, "pill"] as readonly string[];
const SCALING_SIZES = SIZES.filter((size) => !FIXED_SIZES.includes(size));

describe("buttonVariants — alvos de toque (ui-rules §1.4)", () => {
  it.each(
    SIZES,
  )("size=%s tem pelo menos 36px (h-9 / size-9) no desktop", (size) => {
    const unit = heightUnit(buttonVariants({ size }), "");
    expect(unit).not.toBeNull();
    expect(unit).toBeGreaterThanOrEqual(MIN_DESKTOP_UNIT);
  });

  it.each(SCALING_SIZES)("size=%s sobe para 44px abaixo de md", (size) => {
    expect(heightUnit(buttonVariants({ size }), "max-md:")).toBe(TOUCH_UNIT);
  });

  it.each(ALWAYS_TOUCH_SIZED)("size=%s já é 44px em qualquer tela", (size) => {
    expect(heightUnit(buttonVariants({ size }), "")).toBe(TOUCH_UNIT);
  });

  it("size=pill tem 48px em qualquer tela e não precisa do modificador max-md", () => {
    const className = buttonVariants({ size: "pill" });
    expect(heightUnit(className, "")).toBe(PILL_HEIGHT_UNIT);
    expect(heightUnit(className, "max-md:")).toBeNull();
  });

  it("override de altura em className não remove o alvo de toque do celular", () => {
    const className = buttonVariants({ size: "default", className: "h-6" });
    expect(heightUnit(className, "max-md:")).toBe(TOUCH_UNIT);
  });
});
