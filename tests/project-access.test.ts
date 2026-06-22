import { describe, expect, it } from "vitest";
import {
  canViewAllProjects,
  dedupeProjectsById,
  isProjectInUserWorkspace,
  normalizeProjectListScope,
  uniqueProjectIds,
} from "../lib/projects/project-access";
import { canEditProject } from "../lib/projects/project-permissions";

describe("project access helpers", () => {
  it("keeps all-project scope admin-only", () => {
    expect(canViewAllProjects({ role: "admin" })).toBe(true);
    expect(normalizeProjectListScope("all", { role: "admin" })).toBe("all");
    expect(normalizeProjectListScope("all", { role: "project_manager" })).toBe("mine");
    expect(normalizeProjectListScope("mine", { role: "admin" })).toBe("mine");
  });

  it("treats managed, forms-owned, and member projects as the user's workspace", () => {
    expect(isProjectInUserWorkspace({ id: "p1", manager_id: "omar", forms_owner_id: null }, "omar")).toBe(true);
    expect(isProjectInUserWorkspace({ id: "p2", manager_id: null, forms_owner_id: "omar" }, "omar")).toBe(true);
    expect(isProjectInUserWorkspace({ id: "p3", manager_id: null, forms_owner_id: null }, "omar", ["p3"])).toBe(true);
    expect(isProjectInUserWorkspace({ id: "p4", manager_id: "other", forms_owner_id: null }, "omar", ["p3"])).toBe(false);
  });

  it("dedupes project ids and project rows", () => {
    expect(uniqueProjectIds(["p1", null, "p1", undefined, "p2"])).toEqual(["p1", "p2"]);

    expect(
      dedupeProjectsById([
        { id: "old", created_at: "2026-01-01T00:00:00.000Z" },
        { id: "new", created_at: "2026-02-01T00:00:00.000Z" },
        { id: "old", created_at: "2026-01-01T00:00:00.000Z" },
      ]).map((project) => project.id)
    ).toEqual(["new", "old"]);
  });

  it("can sort deduped project rows by updated date", () => {
    expect(
      dedupeProjectsById(
        [
          { id: "recently-updated", created_at: "2026-01-01T00:00:00.000Z", updated_at: "2026-03-01T00:00:00.000Z" },
          { id: "newly-created", created_at: "2026-02-01T00:00:00.000Z", updated_at: "2026-02-01T00:00:00.000Z" },
        ],
        "updated_at"
      ).map((project) => project.id)
    ).toEqual(["recently-updated", "newly-created"]);
  });

  it("allows project managers to edit project manager assignments", () => {
    const project = { manager_id: "bashayer" };

    expect(canEditProject({ id: "admin", role: "admin" }, project)).toBe(true);
    expect(canEditProject({ id: "tarneem", role: "project_manager" }, project)).toBe(true);
    expect(canEditProject({ id: "bashayer", role: "member" }, project)).toBe(true);
    expect(canEditProject({ id: "member", role: "member" }, project)).toBe(false);
  });
});
