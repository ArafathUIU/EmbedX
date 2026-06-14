import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { Badge, StatusDot } from "@/components/ui/badge";

describe("Badge", () => {
  it("renders children", () => {
    render(<Badge>Active</Badge>);
    expect(screen.getByText("Active")).toBeInTheDocument();
  });

  it("applies mint variant classes", () => {
    const { container } = render(<Badge variant="mint">Mint</Badge>);
    expect(container.firstChild).toHaveClass("text-mint");
  });
});

describe("StatusDot", () => {
  it("renders healthy dot", () => {
    const { container } = render(<StatusDot status="healthy" />);
    expect(container.firstChild).toHaveClass("bg-mint");
  });

  it("renders error dot", () => {
    const { container } = render(<StatusDot status="error" />);
    expect(container.firstChild).toHaveClass("bg-heat");
  });
});
