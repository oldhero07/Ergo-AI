import { describe, expect, it } from "vitest";
import { isVideoFile, validateVideoFile } from "@/lib/videoFile";
import { MAX_VIDEO_BYTES } from "@/lib/videoConfig";

/** Build a fake File of a given size without allocating the bytes. */
function fakeFile(name: string, type: string, size: number): File {
  const f = new File([], name, { type });
  Object.defineProperty(f, "size", { value: size });
  return f;
}

describe("isVideoFile", () => {
  it("matches by MIME type and by extension", () => {
    expect(isVideoFile(fakeFile("clip.mp4", "video/mp4", 10))).toBe(true);
    expect(isVideoFile(fakeFile("clip.MOV", "", 10))).toBe(true); // empty MIME, by ext
    expect(isVideoFile(fakeFile("clip.webm", "video/webm", 10))).toBe(true);
    expect(isVideoFile(fakeFile("photo.jpg", "image/jpeg", 10))).toBe(false);
    expect(isVideoFile(fakeFile("doc.pdf", "application/pdf", 10))).toBe(false);
  });
});

describe("validateVideoFile", () => {
  it("accepts a normal video under the cap", () => {
    expect(validateVideoFile(fakeFile("clip.mp4", "video/mp4", 50 * 1024 * 1024))).toEqual({ ok: true });
  });

  it("rejects a non-video file", () => {
    const r = validateVideoFile(fakeFile("photo.jpg", "image/jpeg", 10));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.message).toMatch(/isn't a video/i);
  });

  it("rejects a file over the size cap", () => {
    const r = validateVideoFile(fakeFile("huge.mp4", "video/mp4", MAX_VIDEO_BYTES + 1));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.message).toMatch(/limit is/i);
  });

  it("rejects an empty file", () => {
    const r = validateVideoFile(fakeFile("empty.mp4", "video/mp4", 0));
    expect(r.ok).toBe(false);
  });
});
