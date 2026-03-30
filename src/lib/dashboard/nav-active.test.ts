import { describe, expect, it } from "vitest";
import { isDashboardNavActive, normalizePathname } from "./nav-active";

describe("isDashboardNavActive", () => {
  it("Overview is only exact /dashboard", () => {
    expect(isDashboardNavActive("/dashboard", "/dashboard")).toBe(true);
    expect(isDashboardNavActive("/dashboard/", "/dashboard")).toBe(true);
    expect(isDashboardNavActive("/dashboard/content", "/dashboard")).toBe(false);
    expect(isDashboardNavActive("/dashboard/settings", "/dashboard")).toBe(false);
  });

  it("Content matches segment and children", () => {
    expect(isDashboardNavActive("/dashboard/content", "/dashboard/content")).toBe(
      true,
    );
    expect(
      isDashboardNavActive("/dashboard/content/upload", "/dashboard/content"),
    ).toBe(true);
    expect(isDashboardNavActive("/dashboard/plans", "/dashboard/content")).toBe(
      false,
    );
  });

  it("Settings does not match Overview", () => {
    expect(
      isDashboardNavActive("/dashboard/settings", "/dashboard/settings"),
    ).toBe(true);
    expect(isDashboardNavActive("/dashboard/settings", "/dashboard")).toBe(false);
  });
});

describe("normalizePathname", () => {
  it("strips trailing slash except root", () => {
    expect(normalizePathname("/dashboard/")).toBe("/dashboard");
    expect(normalizePathname("/")).toBe("/");
  });
});
