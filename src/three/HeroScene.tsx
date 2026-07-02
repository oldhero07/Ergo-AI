import { useMemo, useRef } from "react";
import type { RefObject } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Line } from "@react-three/drei";
import type { Group, Mesh, MeshStandardMaterial } from "three";
import { Color } from "three";
import type { Line2 } from "three-stdlib";
import type { RiskPalette } from "@/three/riskColors";
import { usePalette } from "@/three/usePalette";

/**
 * Purely decorative hero-slot scene: a primitive humanoid built from capsule
 * "bones" and small emissive joint spheres, slowly cycling through three
 * posture keyframes (neutral -> forward-bent lifting -> overhead reach) while
 * the whole rig orbits. No assessment data - just an ambient product motif.
 */

type JointName =
  | "head"
  | "neck"
  | "shoulderL"
  | "shoulderR"
  | "elbowL"
  | "elbowR"
  | "wristL"
  | "wristR"
  | "hipMid"
  | "hipL"
  | "hipR"
  | "kneeL"
  | "kneeR"
  | "ankleL"
  | "ankleR";

type Pose = Record<JointName, [number, number, number]>;

/** Roughly 1.7 scene-units tall humanoid, standing neutral. */
const NEUTRAL: Pose = {
  head: [0, 1.62, 0],
  neck: [0, 1.46, 0],
  shoulderL: [-0.19, 1.42, 0],
  shoulderR: [0.19, 1.42, 0],
  elbowL: [-0.24, 1.1, 0.02],
  elbowR: [0.24, 1.1, 0.02],
  wristL: [-0.27, 0.78, 0.04],
  wristR: [0.27, 0.78, 0.04],
  hipMid: [0, 0.9, 0],
  hipL: [-0.13, 0.9, 0],
  hipR: [0.13, 0.9, 0],
  kneeL: [-0.15, 0.48, 0.02],
  kneeR: [0.15, 0.48, 0.02],
  ankleL: [-0.16, 0.06, 0.04],
  ankleR: [0.16, 0.06, 0.04],
};

/** Forward-bent lifting: trunk pitched ~45 deg, arms reaching down-forward. */
const BENT: Pose = {
  head: [0.42, 1.16, 0.3],
  neck: [0.34, 1.06, 0.24],
  shoulderL: [0.18, 1.02, 0.24],
  shoulderR: [0.5, 1.02, 0.24],
  elbowL: [0.22, 0.68, 0.42],
  elbowR: [0.56, 0.68, 0.42],
  wristL: [0.26, 0.32, 0.56],
  wristR: [0.6, 0.32, 0.56],
  hipMid: [0, 0.9, 0],
  hipL: [-0.13, 0.9, 0],
  hipR: [0.13, 0.9, 0],
  kneeL: [-0.1, 0.48, 0.1],
  kneeR: [0.16, 0.48, 0.1],
  ankleL: [-0.12, 0.06, 0.1],
  ankleR: [0.18, 0.06, 0.1],
};

/** Overhead reach: arms raised ~150 deg from vertical-down. */
const OVERHEAD: Pose = {
  head: [0, 1.64, 0],
  neck: [0, 1.48, 0],
  shoulderL: [-0.19, 1.44, 0],
  shoulderR: [0.19, 1.44, 0],
  elbowL: [-0.32, 1.78, -0.06],
  elbowR: [0.32, 1.78, -0.06],
  wristL: [-0.4, 2.1, -0.1],
  wristR: [0.4, 2.1, -0.1],
  hipMid: [0, 0.9, 0],
  hipL: [-0.13, 0.9, 0],
  hipR: [0.13, 0.9, 0],
  kneeL: [-0.15, 0.48, 0.02],
  kneeR: [0.15, 0.48, 0.02],
  ankleL: [-0.16, 0.06, 0.04],
  ankleR: [0.16, 0.06, 0.04],
};

const KEYFRAMES: Pose[] = [NEUTRAL, BENT, OVERHEAD];

/** Bone list: pairs of joints to connect with a capsule-like line. */
const BONES: [JointName, JointName][] = [
  ["head", "neck"],
  ["neck", "shoulderL"],
  ["neck", "shoulderR"],
  ["shoulderL", "elbowL"],
  ["elbowL", "wristL"],
  ["shoulderR", "elbowR"],
  ["elbowR", "wristR"],
  ["neck", "hipMid"],
  ["hipMid", "hipL"],
  ["hipMid", "hipR"],
  ["hipL", "kneeL"],
  ["kneeL", "ankleL"],
  ["hipR", "kneeR"],
  ["kneeR", "ankleR"],
];

const JOINTS: JointName[] = [
  "head",
  "neck",
  "shoulderL",
  "shoulderR",
  "elbowL",
  "elbowR",
  "wristL",
  "wristR",
  "hipMid",
  "hipL",
  "hipR",
  "kneeL",
  "kneeR",
  "ankleL",
  "ankleR",
];

const smoothstep = (t: number): number => t * t * (3 - 2 * t);

const lerp3 = (
  a: [number, number, number],
  b: [number, number, number],
  t: number,
): [number, number, number] => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];

/** Blend a pose between the 3 keyframes given a 0..3 cycle position. */
function poseAt(cycle: number): { pose: Pose; severity: number } {
  const n = KEYFRAMES.length;
  const idx = Math.floor(cycle) % n;
  const next = (idx + 1) % n;
  const t = smoothstep(cycle - Math.floor(cycle));
  const a = KEYFRAMES[idx];
  const b = KEYFRAMES[next];
  const pose = {} as Pose;
  for (const j of JOINTS) pose[j] = lerp3(a[j], b[j], t);
  // Severity: neutral (idx 0 at t=0) is lowest risk; bent/overhead are worse.
  // Use the segment's own severity anchors so the color ramps smoothly.
  const sevAnchors = [0, 1, 0.6, 0]; // neutral -> bent -> overhead -> back to neutral
  const severity = sevAnchors[idx] + (sevAnchors[idx + 1] - sevAnchors[idx]) * t;
  return { pose, severity };
}

function colorForSeverity(sev: number, palette: RiskPalette): Color {
  const c = new Color();
  if (sev <= 0.5) {
    c.set(palette.low).lerp(new Color(palette.medium), sev / 0.5);
  } else {
    c.set(palette.medium).lerp(new Color(palette.high), (sev - 0.5) / 0.5);
  }
  return c;
}

function Humanoid({ reducedMotion }: { reducedMotion: boolean }) {
  const { palette, dark } = usePalette();
  // useFrame's closure runs outside the render cycle - keep the live palette
  // in a ref so a theme toggle recolors the next frame, not a stale one.
  const paletteRef = useRef(palette);
  paletteRef.current = palette;
  const group = useRef<Group>(null);
  const cycleRef = useRef(0);
  const initial = useMemo(() => poseAt(0), []);
  const boneRefs = useRef<RefObject<Line2>[]>(BONES.map(() => ({ current: null })));
  const jointRefs = useRef<RefObject<Mesh>[]>(JOINTS.map(() => ({ current: null })));

  useFrame((_, delta) => {
    if (reducedMotion) return;
    const group_ = group.current;
    if (group_) group_.rotation.y += delta * 0.25;

    // Full a->b->c->a cycle every ~10s => 3 segments => ~3.33s per segment.
    cycleRef.current = (cycleRef.current + delta / 3.333) % KEYFRAMES.length;
    const { pose, severity } = poseAt(cycleRef.current);
    const color = colorForSeverity(severity, paletteRef.current);

    BONES.forEach(([a, b], i) => {
      const line = boneRefs.current[i]?.current;
      if (!line) return;
      const pa = pose[a];
      const pb = pose[b];
      if (line.geometry?.setPositions) {
        line.geometry.setPositions([...pa, ...pb]);
      }
      if (line.material) {
        line.material.color.copy(color);
      }
    });

    JOINTS.forEach((j, i) => {
      const mesh = jointRefs.current[i]?.current;
      if (!mesh) return;
      mesh.position.set(...pose[j]);
      const material = mesh.material as MeshStandardMaterial;
      if (material) {
        material.color.copy(color);
        material.emissive.copy(color);
      }
    });
  });

  const staticColor = reducedMotion ? palette.primary : palette.low;
  // Neon emissive reads great on the dark theme but washes the figure into a
  // pale ghost on the light background - drop it low there and rely on the
  // (darker) light-mode token colors themselves for contrast.
  const emissiveIntensity = dark ? 0.6 : 0.12;

  return (
    <group ref={group}>
      {BONES.map(([a, b], i) => (
        <Line
          key={`${a}-${b}-${dark}`}
          ref={boneRefs.current[i]}
          points={[initial.pose[a], initial.pose[b]]}
          color={staticColor}
          lineWidth={dark ? 4 : 5}
          transparent
          opacity={dark ? 0.9 : 1}
        />
      ))}
      {JOINTS.map((j, i) => (
        <mesh key={`${j}-${dark}`} ref={jointRefs.current[i]} position={initial.pose[j]}>
          <sphereGeometry args={[j === "head" ? 0.09 : 0.045, 16, 16]} />
          <meshStandardMaterial color={staticColor} emissive={staticColor} emissiveIntensity={emissiveIntensity} />
        </mesh>
      ))}
    </group>
  );
}

function Scene({ reducedMotion }: { reducedMotion: boolean }) {
  // No ground grid here: the landing section already has its own subtle
  // grid-bg backdrop, and a second 3D grid plane reads as visual noise.
  return (
    <>
      <ambientLight intensity={0.65} />
      <directionalLight position={[2, 4, 3]} intensity={1.1} />
      <group position={[0, -0.9, 0]}>
        <Humanoid reducedMotion={reducedMotion} />
      </group>
    </>
  );
}

export interface HeroSceneProps {
  /** Called once the WebGL canvas has actually been created / mounted. */
  onReady?: () => void;
}

export default function HeroScene({ onReady }: HeroSceneProps) {
  const reducedMotion = useMemo(
    () => typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches,
    [],
  );

  return (
    <div className="h-[420px] w-full">
      <Canvas
        camera={{ position: [1.4, 1.1, 2.4], fov: 42 }}
        dpr={[1, 1.5]}
        gl={{ alpha: true }}
        onCreated={() => onReady?.()}
      >
        <Scene reducedMotion={!!reducedMotion} />
      </Canvas>
    </div>
  );
}
