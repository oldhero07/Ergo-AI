import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PoseAnalysis } from "@/lib/analyze";
import type { PdfReportItem } from "@/lib/pdf";

// jsPDF touches canvas/image internals that don't exist in vitest's default
// node environment, so we mock the class entirely. We only need to assert
// that exportPdfReport drives it without throwing and calls `.save()` once.
const saveMock = vi.fn();
const addImageMock = vi.fn();
const addPageMock = vi.fn();
const textMock = vi.fn();
const rectMock = vi.fn();
const lineMock = vi.fn();
const splitTextToSizeMock = vi.fn((text: string) => [text]);

vi.mock("jspdf", () => {
  class FakeJsPDF {
    internal = {
      pageSize: {
        getWidth: () => 595,
        getHeight: () => 842,
      },
    };
    addImage = addImageMock;
    addPage = addPageMock;
    save = saveMock;
    text = textMock;
    rect = rectMock;
    line = lineMock;
    splitTextToSize = splitTextToSizeMock;
    setFont = vi.fn();
    setFontSize = vi.fn();
    setTextColor = vi.fn();
    setDrawColor = vi.fn();
    setFillColor = vi.fn();
    setLineWidth = vi.fn();
    getTextWidth = vi.fn(() => 80);
    getNumberOfPages = vi.fn(() => 1);
    setPage = vi.fn();
  }
  return { jsPDF: FakeJsPDF };
});

// toDataUrl() loads images via `new Image()` + canvas, neither of which exist
// in node. Stub the global Image constructor so it resolves immediately, and
// stub document.createElement("canvas") to return a minimal fake canvas.
class FakeImage {
  naturalWidth = 100;
  naturalHeight = 80;
  width = 100;
  height = 80;
  crossOrigin = "";
  private _src = "";
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  set src(value: string) {
    this._src = value;
    // Resolve on next microtask, like a real image load would (async).
    queueMicrotask(() => this.onload?.());
  }
  get src() {
    return this._src;
  }
}

beforeEach(() => {
  vi.stubGlobal("Image", FakeImage as unknown as typeof Image);
  vi.stubGlobal("document", {
    createElement: (tag: string) => {
      if (tag === "canvas") {
        return {
          width: 0,
          height: 0,
          getContext: () => ({
            drawImage: vi.fn(),
          }),
          toDataURL: () => "data:image/jpeg;base64,FAKE",
        };
      }
      throw new Error(`Unexpected createElement(${tag}) in test`);
    },
  });
  saveMock.mockClear();
  addImageMock.mockClear();
  addPageMock.mockClear();
});

function makeAnalysis(overrides: Partial<PoseAnalysis> = {}): PoseAnalysis {
  return {
    skeletonUrl: "data:image/png;base64,SKELETON",
    landmarks: [],
    worldLandmarks: [],
    width: 100,
    height: 80,
    detected: true,
    input: {
      upperArmAngle: 50,
      lowerArmAngle: 80,
      wristAngle: 0,
      neckAngle: 10,
      trunkAngle: 5,
      shoulderRaised: false,
      upperArmAbducted: false,
      armSupported: false,
      lowerArmCrossMidline: false,
      wristDeviated: false,
      wristTwistEnd: false,
      neckTwisted: false,
      neckSideBend: false,
      trunkTwisted: false,
      trunkSideBend: false,
      legsSupported: true,
      muscleUseA: false,
      forceA: 0,
      muscleUseB: false,
      forceB: 0,
      legsBilateral: true,
      load: 0,
      loadShock: false,
      coupling: 0,
      activityStatic: false,
      activityRepeated: false,
      activityUnstable: false,
    },
    assessment: {
      method: "RULA",
      grandScore: 4,
      maxScore: 7,
      riskBand: "medium",
      riskLabel: "Medium risk",
      actionLevel: "Further investigation, change may be needed",
      groups: [
        {
          name: "Group A",
          items: [{ label: "Upper arm", value: 3, note: "elevated" }],
          posture: 3,
          muscle: 1,
          force: 0,
          score: 4,
          scoreLabel: "Medium",
        },
        {
          name: "Group B",
          items: [{ label: "Neck", value: 2 }],
          posture: 2,
          muscle: 0,
          force: 0,
          score: 2,
          scoreLabel: "Low",
        },
      ],
      angles: { upperArm: 50, lowerArm: 80, neck: 10, trunk: 5 },
      notes: ["Lower-bound estimate."],
    },
    ...overrides,
  };
}

function makeItem(overrides: Partial<PdfReportItem> = {}): PdfReportItem {
  return {
    fileName: "weaver-01.jpg",
    originalUrl: "blob:http://localhost/abc-123",
    analysis: makeAnalysis(),
    ...overrides,
  };
}

describe("exportPdfReport", () => {
  it("resolves without throwing for a single item and saves once", async () => {
    const { exportPdfReport } = await import("@/lib/pdf");
    await expect(exportPdfReport([makeItem()])).resolves.toBeUndefined();
    expect(saveMock).toHaveBeenCalledTimes(1);
    expect(saveMock.mock.calls[0][0]).toMatch(/^ergo-ai-rula-report-\d{4}-\d{2}-\d{2}-\d{4}\.pdf$/);
  });

  it("resolves without throwing for multiple items (adds a summary page) and saves once", async () => {
    const { exportPdfReport } = await import("@/lib/pdf");
    const items = [
      makeItem({ fileName: "a.jpg" }),
      makeItem({ fileName: "b.jpg", analysis: makeAnalysis({ detected: false, assessment: undefined, input: undefined }) }),
      makeItem({ fileName: "c.jpg", originalUrl: "data:image/jpeg;base64,ALREADYDATAURL" }),
    ];
    await expect(exportPdfReport(items)).resolves.toBeUndefined();
    expect(saveMock).toHaveBeenCalledTimes(1);
  });

  it("handles an item with an explicit error and no detected pose", async () => {
    const { exportPdfReport } = await import("@/lib/pdf");
    const item = makeItem({
      analysis: makeAnalysis({ detected: false, error: "No landmarks found", assessment: undefined, input: undefined }),
    });
    await expect(exportPdfReport([item])).resolves.toBeUndefined();
    expect(saveMock).toHaveBeenCalledTimes(1);
  });
});

describe("prepareImage", () => {
  it("re-encodes a data: URL (e.g. the PNG skeleton) to a downscaled JPEG", async () => {
    const { prepareImage } = await import("@/lib/pdf");
    const out = await prepareImage("data:image/png;base64,ABC");
    expect(out.dataUrl).toBe("data:image/jpeg;base64,FAKE"); // canvas mock encodes as JPEG
    expect(out.width).toBe(100); // FakeImage natural size, within maxPx so unscaled
    expect(out.height).toBe(80);
  });

  it("converts a blob: URL via the Image/canvas pipeline", async () => {
    const { prepareImage } = await import("@/lib/pdf");
    const out = await prepareImage("blob:http://localhost/xyz");
    expect(out.dataUrl).toBe("data:image/jpeg;base64,FAKE");
  });
});
