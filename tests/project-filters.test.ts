import { describe, expect, it } from "vitest";
import {
  coerceProjectFiltersSnapshot,
  hasProjectFilterParams,
  isDefaultProjectFilters,
  projectFiltersToParams,
  readProjectFiltersFromParams,
  type ProjectFilters,
} from "../lib/projects/project-filters";

describe("project filter state", () => {
  it("serializes only non-default project filters to query params", () => {
    const filters: ProjectFilters = {
      search: "  العقود  ",
      status: "active",
      type: "external",
      manager: "manager-1",
      view: "list",
    };

    expect(projectFiltersToParams(filters).toString()).toBe(
      "q=%D8%A7%D9%84%D8%B9%D9%82%D9%88%D8%AF&status=active&type=external&manager=manager-1&view=list"
    );
  });

  it("reads valid filter params and ignores invalid values", () => {
    const params = new URLSearchParams("q=test&status=unknown&type=external&manager=manager-1&view=grid");

    expect(readProjectFiltersFromParams(params)).toEqual({
      search: "test",
      status: "",
      type: "external",
      manager: "manager-1",
      view: "card",
    });
  });

  it("coerces stored filter snapshots to safe defaults", () => {
    expect(coerceProjectFiltersSnapshot({ status: "paused", type: "bad", view: "timeline", manager: 7 })).toEqual({
      search: "",
      status: "paused",
      type: "",
      manager: "",
      view: "timeline",
    });
  });

  it("detects default and non-default filter state", () => {
    expect(
      isDefaultProjectFilters({
        search: "",
        status: "",
        type: "",
        manager: "",
        view: "card",
      })
    ).toBe(true);

    expect(hasProjectFilterParams(new URLSearchParams("status=active"))).toBe(true);
    expect(hasProjectFilterParams(new URLSearchParams("page=2"))).toBe(false);
  });
});
