import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Table, TableBody, TableCell, TableFooter, TableRow } from "./table";

describe("Table — fundos de estado em accent (P83)", () => {
  function renderTable() {
    render(
      <Table>
        <TableBody>
          <TableRow>
            <TableCell>Corpo</TableCell>
          </TableRow>
        </TableBody>
        <TableFooter>
          <TableRow>
            <TableCell>Total</TableCell>
          </TableRow>
        </TableFooter>
      </Table>,
    );
  }

  it("linha: hover, aberta e selecionada em accent", () => {
    renderTable();
    const row = screen.getByText("Corpo").closest("tr");
    expect(row).toHaveClass(
      "hover:bg-accent/50",
      "has-aria-expanded:bg-accent/50",
      "data-[state=selected]:bg-accent",
    );
    expect(row?.className).not.toMatch(/bg-muted/);
  });

  it("rodapé em bg-accent/50", () => {
    renderTable();
    const footer = screen.getByText("Total").closest("tfoot");
    expect(footer).toHaveClass("bg-accent/50");
    expect(footer?.className).not.toMatch(/bg-muted/);
  });
});
