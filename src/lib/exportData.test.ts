import { describe, expect, it } from "vitest";
import { exportJson, photoCsv, videoCsv } from "@/lib/exportData";
import type { PhotoCsvItem } from "@/lib/exportData";
import type { PoseAnalysis, VideoAnalysis } from "@/lib/analyze";
import type { AssessmentResult, PostureInput } from "@/assessment/types";

function makeInput(overrides: Partial<PostureInput> = {}): PostureInput {
  return {
    upperArmAngle: 50,
    lowerArmAngle: 80,
    wristAngle: 3.456,
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
    ...overrides,
  };
}

function makeAssessment(overrides: Partial<AssessmentResult> = {}): AssessmentResult {
  return {
    method: "RULA",
    grandScore: 4,
    maxScore: 7,
    riskBand: "medium",
    riskLabel: "Medium risk",
    actionLevel: "Further investigation, change may be needed",
    groups: [
      {
        name: "Group A",
        items: [
          { label: "Upper arm", value: 3, note: "elevated" },
          { label: "Lower arm", value: 2 },
          { label: "Wrist", value: 1 },
          { label: "Wrist twist", value: 1 },
        ],
        posture: 3,
        muscle: 1,
        force: 0,
        score: 4,
        scoreLabel: "Medium",
      },
      {
        name: "Group B",
        items: [
          { label: "Neck", value: 2 },
          { label: "Trunk", value: 1 },
          { label: "Legs", value: 1 },
        ],
        posture: 2,
        muscle: 0,
        force: 0,
        score: 2,
        scoreLabel: "Low",
      },
    ],
    angles: { upperArm: 50, lowerArm: 80, neck: 10, trunk: 5 },
    notes: [],
    ...overrides,
  };
}

function makePoseAnalysis(overrides: Partial<PoseAnalysis> = {}): PoseAnalysis {
  return {
    skeletonUrl: "data:image/png;base64,SKELETON",
    landmarks: [],
    worldLandmarks: [],
    width: 100,
    height: 80,
    detected: true,
    angles: {
      upperArm: 50,
      lowerArm: 80,
      neck: 10,
      trunk: 5,
      side: "right",
      confidence: 0.91,
    },
    wristMeasured: true,
    input: makeInput(),
    assessment: makeAssessment(),
    ...overrides,
  };
}

describe("photoCsv", () => {
  it("aligns header and data-row column counts", () => {
    const items: PhotoCsvItem[] = [{ fileName: "weaver-01.jpg", analysis: makePoseAnalysis() }];
    const csv = photoCsv(items, "rula");
    const [header, row] = csv.split("\n");
    expect(header.split(",").length).toBe(row.split(",").length);
  });

  it("includes derived per-component score columns named from group-item labels", () => {
    const items: PhotoCsvItem[] = [{ fileName: "weaver-01.jpg", analysis: makePoseAnalysis() }];
    const csv = photoCsv(items, "rula");
    const [header] = csv.split("\n");
    for (const slug of [
      "upper_arm_score",
      "lower_arm_score",
      "wrist_score",
      "wrist_twist_score",
      "neck_score",
      "trunk_score",
      "legs_score",
    ]) {
      expect(header.split(",")).toContain(slug);
    }
  });

  it("escapes fields containing quotes, commas, or newlines", () => {
    const items: PhotoCsvItem[] = [
      { fileName: `photo, "A".jpg`, analysis: makePoseAnalysis() },
    ];
    const csv = photoCsv(items, "rula");
    const dataLine = csv.split("\n")[1];
    expect(dataLine.startsWith(`"photo, ""A"".jpg"`)).toBe(true);
  });

  it("fills file/method/detected/error and leaves the rest empty for an undetected photo", () => {
    const items: PhotoCsvItem[] = [
      {
        fileName: "no-pose.jpg",
        analysis: makePoseAnalysis({ detected: false, error: "No landmarks found", assessment: undefined, input: undefined, angles: undefined }),
      },
    ];
    const csv = photoCsv(items, "rula");
    const [header, row] = csv.split("\n");
    const headerCols = header.split(",");
    const rowCols = row.split(",");
    expect(rowCols.length).toBe(headerCols.length);

    const idx = (name: string) => headerCols.indexOf(name);
    expect(rowCols[idx("file")]).toBe("no-pose.jpg");
    expect(rowCols[idx("method")]).toBe("rula");
    expect(rowCols[idx("detected")]).toBe("false");
    expect(rowCols[idx("error")]).toBe("No landmarks found");
    expect(rowCols[idx("upper_arm_deg")]).toBe("");
    expect(rowCols[idx("grand_score")]).toBe("");
  });

  it("formats angles to 2 decimals and booleans as true/false", () => {
    const items: PhotoCsvItem[] = [{ fileName: "a.jpg", analysis: makePoseAnalysis() }];
    const csv = photoCsv(items, "rula");
    const [header, row] = csv.split("\n");
    const headerCols = header.split(",");
    const rowCols = row.split(",");
    const idx = (name: string) => headerCols.indexOf(name);
    expect(rowCols[idx("wrist_deg")]).toBe("3.46");
    expect(rowCols[idx("legs_bilateral")]).toBe("true");
    expect(rowCols[idx("wrist_measured")]).toBe("true");
  });
});

describe("videoCsv", () => {
  function makeVideoAnalysis(): VideoAnalysis {
    return {
      frames: [
        {
          timeSec: 0.5,
          angles: { upperArm: 40, lowerArm: 70, neck: 8, trunk: 4, side: "left", confidence: 0.8 },
          input: makeInput({ upperArmAngle: 40, lowerArmAngle: 70, neckAngle: 8, trunkAngle: 4 }),
          confidence: 0.8,
          thumbUrl: "data:image/jpeg;base64,THUMB",
        },
      ],
      skippedNoPose: 1,
      skippedLowConfidence: 2,
      unreadableFrames: 0,
      wristMeasured: true,
      sampledDurationSec: 5,
      fps: 4,
      temporal: { repeated: false, sustained: true },
    };
  }

  it("emits comment header lines followed by header row and one row per frame", () => {
    const csv = videoCsv(makeVideoAnalysis(), "rula", "clip.mp4");
    const lines = csv.split("\n");
    const commentLines = lines.filter((l) => l.startsWith("# "));
    expect(commentLines).toEqual([
      "# file: clip.mp4",
      "# method: rula",
      "# fps: 4",
      "# sampled_duration_sec: 5",
      "# skipped_no_pose: 1",
      "# skipped_low_confidence: 2",
      "# unreadable_frames: 0",
      "# temporal_repeated: false",
      "# temporal_sustained: true",
    ]);

    const headerIdx = commentLines.length;
    const header = lines[headerIdx];
    const dataRow = lines[headerIdx + 1];
    expect(header.split(",").length).toBe(dataRow.split(",").length);

    const headerCols = header.split(",");
    const rowCols = dataRow.split(",");
    const idx = (name: string) => headerCols.indexOf(name);
    expect(rowCols[idx("time_sec")]).toBe("0.50");
    expect(rowCols[idx("side")]).toBe("left");
    expect(rowCols[idx("upper_arm_deg")]).toBe("40.00");
  });
});

describe("exportJson", () => {
  it("round-trips arbitrary payloads", () => {
    const payload = { a: 1, b: [1, 2, 3], c: { nested: "value", flag: true }, d: null };
    const json = exportJson(payload);
    expect(JSON.parse(json)).toEqual(payload);
  });
});
