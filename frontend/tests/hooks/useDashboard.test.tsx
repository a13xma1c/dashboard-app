import { renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useDashboard } from "@/hooks/useDashboard";

describe("useDashboard", () => {
  it("throws outside the provider", () => {
    expect(() => renderHook(() => useDashboard())).toThrow(/inside <DashboardProvider>/);
  });
});
