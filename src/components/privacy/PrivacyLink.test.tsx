import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { PrivacyLink } from "./PrivacyLink";

describe("PrivacyLink", () => {
  it("aponta para /privacidade", () => {
    render(<PrivacyLink />);
    expect(
      screen.getByRole("link", { name: "Privacidade e seus dados" }),
    ).toHaveAttribute("href", "/privacidade");
  });

  it("tem 44px de altura mínima abaixo de md (ui-rules §1.4)", () => {
    render(<PrivacyLink />);
    const classes = screen
      .getByRole("link", { name: "Privacidade e seus dados" })
      .className.split(" ");
    expect(classes).toContain("max-md:min-h-11");
    expect(classes).toContain("max-md:inline-flex");
  });
});
