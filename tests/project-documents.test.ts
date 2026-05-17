import { describe, expect, it, vi } from "vitest";
import { buildDocumentStoragePath, formatFileSize } from "../lib/documents/utils";

describe("project document utilities", () => {
  it("formats file sizes for document cards", () => {
    expect(formatFileSize(null)).toBe("غير محدد");
    expect(formatFileSize(512)).toBe("512 بايت");
    expect(formatFileSize(2048)).toBe("2 KB");
    expect(formatFileSize(1_572_864)).toBe("1.5 MB");
  });

  it("stores uploaded documents below their project folder", () => {
    vi.spyOn(crypto, "randomUUID").mockReturnValue("00000000-0000-4000-8000-000000000000");

    expect(buildDocumentStoragePath("project-1", "عقد استكتاب - صفية الجفري.pdf")).toBe(
      "projects/project-1/00000000-0000-4000-8000-000000000000-document.pdf"
    );
  });

  it("falls back to a safe extension for invalid file extensions", () => {
    vi.spyOn(crypto, "randomUUID").mockReturnValue("00000000-0000-4000-8000-000000000001");

    expect(buildDocumentStoragePath("project-1", "document.عقد")).toBe(
      "projects/project-1/00000000-0000-4000-8000-000000000001-document.file"
    );
  });
});
