import { describe, expect, it } from "vitest";
import {
  documentDownloadDisposition,
  isMembershipDocumentExpired,
  isSafeDocumentStorageKey,
  MEMBERSHIP_DOCUMENT_CLEANUP_CONFIRMATION,
  parseMembershipDocumentCleanupRequest,
  parseMembershipDocumentExpiry,
  sanitizeDocumentName,
  validateDocumentUpload
} from "@/lib/membership-documents";

describe("membership documents", () => {
  it("accepts a PDF whose name, MIME type, and signature agree", () => {
    const result = validateDocumentUpload("membership-record.pdf", "application/pdf", Buffer.from("%PDF-1.7\n"));
    expect(result).toMatchObject({
      originalName: "membership-record.pdf",
      mimeType: "application/pdf",
      storageExtension: ".pdf"
    });
  });

  it("rejects files whose content does not match the declared type", () => {
    expect(validateDocumentUpload("membership-record.pdf", "application/pdf", Buffer.from("not a pdf")))
      .toEqual({ error: "Documents must be PDF, JPG, PNG, or WebP files whose contents match their file type." });
  });

  it("removes path and control characters from displayed filenames", () => {
    expect(sanitizeDocumentName("../folder\\bad\r\nname.pdf")).toBe("badname.pdf");
  });

  it("only permits randomized storage keys", () => {
    expect(isSafeDocumentStorageKey("123e4567-e89b-42d3-a456-426614174000.pdf")).toBe(true);
    expect(isSafeDocumentStorageKey("../membership-record.pdf")).toBe(false);
  });

  it("builds a safe attachment disposition", () => {
    const disposition = documentDownloadDisposition('record "final".pdf');
    expect(disposition).toContain('filename="record _final_.pdf"');
    expect(disposition).toContain("filename*=UTF-8''record%20%22final%22.pdf");
    expect(disposition).not.toContain("\r");
  });

  it("keeps documents indefinitely by default", () => {
    expect(parseMembershipDocumentExpiry(null)).toEqual({ expiresAt: null });
    expect(isMembershipDocumentExpired(null, new Date("2026-09-09T12:00:00.000Z"))).toBe(false);
  });

  it("normalizes a date-only expiry to the end of that UTC day", () => {
    expect(parseMembershipDocumentExpiry("2026-09-09")).toEqual({
      expiresAt: new Date("2026-09-09T23:59:59.999Z")
    });
    expect(parseMembershipDocumentExpiry("2026-02-30")).toEqual({
      error: "Choose a valid expiry date or clear the expiry."
    });
  });

  it("only considers an expiry eligible once its cutoff has passed", () => {
    const cutoff = new Date("2026-09-09T12:00:00.000Z");
    expect(isMembershipDocumentExpired(new Date("2026-09-09T11:59:59.999Z"), cutoff)).toBe(true);
    expect(isMembershipDocumentExpired(new Date("2026-09-09T12:00:00.000Z"), cutoff)).toBe(true);
    expect(isMembershipDocumentExpired(new Date("2026-09-09T12:00:00.001Z"), cutoff)).toBe(false);
  });

  it("requires an explicit, recent preview before cleanup", () => {
    const now = new Date("2026-09-09T12:30:00.000Z");
    expect(parseMembershipDocumentCleanupRequest({ asOf: "2026-09-09T12:00:00.000Z" }, now)).toEqual({
      error: "Explicit cleanup confirmation is required."
    });
    expect(parseMembershipDocumentCleanupRequest({
      confirmation: MEMBERSHIP_DOCUMENT_CLEANUP_CONFIRMATION,
      asOf: "2026-09-09T10:00:00.000Z"
    }, now)).toEqual({
      error: "Preview expired documents again before running cleanup."
    });
    expect(parseMembershipDocumentCleanupRequest({
      confirmation: MEMBERSHIP_DOCUMENT_CLEANUP_CONFIRMATION,
      asOf: "2026-09-09T12:00:00.000Z"
    }, now)).toEqual({
      cutoff: new Date("2026-09-09T12:00:00.000Z")
    });
  });
});
