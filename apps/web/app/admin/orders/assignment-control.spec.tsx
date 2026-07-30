import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { AssignmentControl } from "./assignment-control";

describe("AssignmentControl", () => {
  it("offers claim when the operation has no responsible attendant", () => {
    const html = renderToStaticMarkup(
      <AssignmentControl
        assignment={null}
        onChanged={vi.fn()}
        target="orders"
        targetId="order-1"
        version={0}
      />,
    );
    expect(html).toContain("Sem responsavel");
    expect(html).toContain(">Assumir</button>");
  });

  it("shows the responsible attendant and requires an explicit transfer action", () => {
    const html = renderToStaticMarkup(
      <AssignmentControl
        assignment={{
          userId: "user-2",
          userName: "Bruno",
          assignedAt: "2026-07-24T12:00:00.000Z",
        }}
        onChanged={vi.fn()}
        target="tabs"
        targetId="tab-1"
        version={3}
      />,
    );
    expect(html).toContain("Responsavel: Bruno");
    expect(html).toContain(">Transferir</button>");
    expect(html).not.toContain(">Assumir</button>");
  });
});
