import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ExportCsvLink } from "./ExportCsvLink";

describe("ExportCsvLink", () => {
  it("é um <a download> comum com o href recebido (nunca next/link)", () => {
    render(<ExportCsvLink href="/api/dashboard/export?periodo=30" />);

    const link = screen.getByRole("link", { name: "Exportar CSV" });
    expect(link).toHaveAttribute("href", "/api/dashboard/export?periodo=30");
    expect(link).toHaveAttribute("download");
    // Um <a> comum só tem estes atributos; o next/link acrescenta os dele.
    expect(link.getAttributeNames().sort()).toEqual([
      "class",
      "download",
      "href",
    ]);
  });

  it("o ícone é decorativo e o alvo tem 44px abaixo de md", () => {
    const { container } = render(<ExportCsvLink href="/x" />);

    expect(container.querySelector("svg")).toHaveAttribute(
      "aria-hidden",
      "true",
    );
    expect(screen.getByRole("link")).toHaveClass("max-md:h-11");
  });
});
