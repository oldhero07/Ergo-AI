import { useMemo, useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Html, Line, OrbitControls } from "@react-three/drei";
import type { Group } from "three";
import type { Landmark } from "@mediapipe/tasks-vision";
import type { AssessmentResult } from "@/assessment/types";
import type { AngleSet } from "@/lib/angles";
import {
  BONES,
  JOINT_IDS,
  buildSkeleton,
  jointComponent,
  resolvePoint,
  type SkeletonPoints,
  type Vec3,
} from "@/three/skeleton";
import { componentSeverities, readPalette, severityColor } from "@/three/riskColors";

/**
 * Interactive 3D viewer of the ACTUAL detected pose: MediaPipe's metric world
 * landmarks rendered as a risk-colored skeleton with orbit controls. Loaded
 * lazily (three.js never blocks the analysis path) and mounted on demand.
 */
export interface PoseViewer3DProps {
  worldLandmarks: Landmark[];
  result: AssessmentResult;
  angles?: AngleSet;
}

function SkeletonScene({ worldLandmarks, result, angles }: PoseViewer3DProps) {
  const palette = useMemo(readPalette, []);
  const sk = useMemo(() => buildSkeleton(worldLandmarks), [worldLandmarks]);
  const severities = useMemo(() => componentSeverities(result), [result]);
  const [showLabels, setShowLabels] = useState(true);
  const group = useRef<Group>(null);
  const interacted = useRef(false);

  // Slow auto-rotate until the user grabs the controls.
  useFrame((_, delta) => {
    if (!interacted.current && group.current) group.current.rotation.y += delta * 0.35;
  });

  if (!sk) return null;

  const colorFor = (component: ReturnType<typeof jointComponent>): string =>
    component === "frame" ? palette.frame : severityColor(severities[component], palette);

  return (
    <>
      <ambientLight intensity={0.7} />
      <directionalLight position={[2, 4, 3]} intensity={1.1} />
      <group ref={group} position={[0, -sk.floorY - 0.9, 0]}>
        <group position={[0, 0.9 + sk.floorY, 0]}>
          {/* Bones */}
          {BONES.map((bone, i) => {
            const a = resolvePoint(sk, bone.a);
            const b = resolvePoint(sk, bone.b);
            const color = colorFor(bone.component);
            return <Line key={i} points={[a, b]} color={color} lineWidth={3.5} transparent opacity={0.95} />;
          })}
          {/* Joints */}
          {JOINT_IDS.map((id) => {
            const p = sk.points[id];
            const color = colorFor(jointComponent(id));
            return (
              <mesh key={id} position={p}>
                <sphereGeometry args={[id === 0 ? 0.055 : 0.032, 20, 20]} />
                <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.55} />
              </mesh>
            );
          })}
          {/* Angle labels at the joints the score derives from */}
          {showLabels && angles && (
            <>
              <AngleLabel at={anchorFor(sk, angles.side, "elbow")} text={`arm ${Math.round(angles.upperArm)}°`} />
              <AngleLabel at={sk.headRef} text={`neck ${Math.round(angles.neck)}°`} />
              <AngleLabel at={sk.hipMid} text={`trunk ${Math.round(angles.trunk)}°`} />
              {angles.legAngle !== undefined && (
                <AngleLabel at={anchorFor(sk, angles.side, "knee")} text={`knee ${Math.round(angles.legAngle)}°`} />
              )}
            </>
          )}
        </group>
      </group>
      {/* Ground grid at foot level */}
      <gridHelper args={[4, 16, palette.primary, palette.frame]} position={[0, -0.9, 0]}>
        <meshBasicMaterial transparent opacity={0.25} />
      </gridHelper>
      <OrbitControls
        enableDamping
        dampingFactor={0.08}
        minDistance={0.8}
        maxDistance={5}
        onStart={() => {
          interacted.current = true;
        }}
      />
      {/* Labels toggle rendered inside the canvas overlay */}
      <Html fullscreen zIndexRange={[10, 0]} style={{ pointerEvents: "none" }}>
        <div style={{ position: "absolute", right: 10, top: 10, pointerEvents: "auto" }}>
          <button
            type="button"
            onClick={() => setShowLabels((s) => !s)}
            className="hud-readout rounded-md border border-border bg-background/70 px-2 py-1 text-[10px] text-muted-foreground backdrop-blur hover:text-foreground"
          >
            {showLabels ? "hide angles" : "show angles"}
          </button>
        </div>
      </Html>
    </>
  );
}

function anchorFor(sk: SkeletonPoints, side: "left" | "right", joint: "elbow" | "knee"): Vec3 {
  const idx = joint === "elbow" ? (side === "left" ? 13 : 14) : side === "left" ? 25 : 26;
  return sk.points[idx];
}

function AngleLabel({ at, text }: { at: Vec3; text: string }) {
  return (
    <Html position={at} center distanceFactor={2.2} style={{ pointerEvents: "none" }}>
      <span className="hud-readout whitespace-nowrap rounded-md border border-border bg-background/75 px-1.5 py-0.5 text-[10px] text-foreground backdrop-blur">
        {text}
      </span>
    </Html>
  );
}

export default function PoseViewer3D(props: PoseViewer3DProps) {
  return (
    <div className="h-[380px] w-full overflow-hidden rounded-xl border bg-background/60">
      <Canvas camera={{ position: [1.6, 0.4, 2.2], fov: 45 }} dpr={[1, 2]}>
        <SkeletonScene {...props} />
      </Canvas>
      <p className="sr-only">Interactive 3D skeleton of the detected pose, joints colored by risk contribution.</p>
    </div>
  );
}
