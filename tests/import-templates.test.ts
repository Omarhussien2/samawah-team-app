import { describe, expect, it } from "vitest";
import { getImportTemplateConfig } from "../lib/import/template-config";

describe("import templates", () => {
  it("uses a single-project task template without Project_ID", () => {
    const config = getImportTemplateConfig("tasks-existing");

    expect(config.columns).toContain("Task_ID");
    expect(config.columns).toContain("Task");
    expect(config.columns).not.toContain("Project_ID");
  });

  it("uses a multi-project task template with Project_ID", () => {
    const config = getImportTemplateConfig("tasks-multi");

    expect(config.columns).toContain("Task_ID");
    expect(config.columns).toContain("Project_ID");
    expect(config.columns).toContain("Task");
  });

  it("falls back to the projects template for unknown template types", () => {
    const config = getImportTemplateConfig("unknown");

    expect(config.type).toBe("projects");
    expect(config.columns).toContain("Project_ID");
    expect(config.columns).toContain("Name");
  });
});
