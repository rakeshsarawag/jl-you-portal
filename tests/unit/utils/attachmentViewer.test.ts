import { describe, expect, it } from "vitest";
import { getAttachmentViewerType } from "../../../src/app/components/shared/AttachmentViewer";

describe("attachment viewer type detection", () => {
  it("detects supported types from MIME values", () => {
    expect(getAttachmentViewerType("report", "application/pdf")).toBe("pdf");
    expect(getAttachmentViewerType("document", "application/vnd.openxmlformats-officedocument.wordprocessingml.document")).toBe("docx");
    expect(getAttachmentViewerType("screenshot", "image/png")).toBe("image");
    expect(getAttachmentViewerType("notes", "text/plain; charset=utf-8")).toBe("text");
    expect(getAttachmentViewerType("payload", "application/json")).toBe("text");
  });

  it("uses file extensions when uploaded MIME metadata is generic or missing", () => {
    expect(getAttachmentViewerType("screen.WEBP", "application/octet-stream")).toBe("image");
    expect(getAttachmentViewerType("server.log", "")).toBe("text");
    expect(getAttachmentViewerType("README.md", "application/octet-stream")).toBe("text");
    expect(getAttachmentViewerType("archive.zip", "application/octet-stream")).toBe("unsupported");
  });
});
