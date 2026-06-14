import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { Button } from "@/components/ui/button";

describe("Button", () => {
  it("renders children", () => {
    render(<Button>Click me</Button>);
    expect(screen.getByText("Click me")).toBeInTheDocument();
  });

  it("shows loading state", () => {
    render(<Button loading>Loading</Button>);
    expect(screen.getByText("Loading")).toBeInTheDocument();
  });

  it("applies variant classes", () => {
    const { container } = render(<Button variant="mint">Mint</Button>);
    expect(container.firstChild).toHaveClass("bg-mint");
  });

  it("applies size classes", () => {
    const { container } = render(<Button size="sm">Small</Button>);
    expect(container.firstChild).toHaveClass("text-xs");
  });

  it("disables when loading", () => {
    render(<Button loading>Busy</Button>);
    expect(screen.getByRole("button")).toBeDisabled();
  });
});
