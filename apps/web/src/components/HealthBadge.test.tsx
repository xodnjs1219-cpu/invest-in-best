// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { HealthBadge } from "./HealthBadge";

describe("HealthBadge", () => {
  it("renders 정상 when status is ok", () => {
    render(<HealthBadge status="ok" />);
    expect(screen.getByTestId("health-badge")).toHaveTextContent("정상");
  });
});
