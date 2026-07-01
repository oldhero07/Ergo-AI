import { useState } from "react";
import { ChevronDown, SlidersHorizontal } from "lucide-react";
import type { PostureInput } from "@/assessment/types";
import { cn } from "@/lib/utils";

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={cn(
        "flex w-full items-center justify-between gap-3 rounded-xl border px-3.5 py-2.5 text-left text-sm transition-all duration-200",
        checked
          ? "border-primary/40 bg-primary/8 shadow-sm"
          : "border-border bg-card/50 hover:border-border/80 hover:bg-card",
      )}
    >
      <span className={cn("transition-colors", checked ? "text-foreground font-medium" : "text-muted-foreground")}>
        {label}
      </span>
      <span
        className={cn(
          "relative h-5 w-9 shrink-0 rounded-full transition-colors duration-200",
          checked ? "bg-primary" : "bg-muted",
        )}
      >
        <span
          className={cn(
            "absolute top-0.5 h-4 w-4 rounded-full bg-white shadow-sm transition-transform duration-200",
            checked ? "translate-x-[18px]" : "translate-x-0.5",
          )}
        />
      </span>
    </button>
  );
}

function ForceControl({
  label,
  value,
  onChange,
  steps = [0, 1, 2, 3],
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  steps?: number[];
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-border bg-card/50 px-3.5 py-2.5 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <div className="flex gap-1">
        {steps.map((v) => (
          <button
            key={v}
            type="button"
            aria-pressed={value === v}
            onClick={() => onChange(v)}
            className={cn(
              "h-7 w-7 rounded-lg text-xs font-bold tabular-nums transition-all duration-150",
              value === v
                ? "bg-primary text-primary-foreground shadow-sm"
                : "bg-secondary text-secondary-foreground hover:bg-secondary/80",
            )}
          >
            {v}
          </button>
        ))}
      </div>
    </div>
  );
}

/**
 * Collapsed-by-default panel for the factors a single camera view cannot reliably
 * see (wrist flex/twist, support, muscle use, force/load). Edits call `onChange`
 * with a full updated PostureInput; the caller recomputes the assessment live.
 */
export function AdjustmentsPanel({
  input,
  methodId,
  onChange,
}: {
  input: PostureInput;
  methodId: string;
  onChange: (next: PostureInput) => void;
}) {
  const [open, setOpen] = useState(true);
  const set = <K extends keyof PostureInput>(key: K, value: PostureInput[K]) => onChange({ ...input, [key]: value });
  const isReba = methodId === "reba";

  return (
    <div className="border-t">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-center justify-between px-5 py-3.5 text-sm font-medium transition-colors hover:bg-muted/30"
      >
        <span className="flex items-center gap-2.5">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <SlidersHorizontal className="h-3.5 w-3.5" />
          </span>
          <span>Adjust factors a photo can&apos;t see</span>
          {!open && (
            <span className="ml-1 rounded-full bg-amber-500 px-2 py-0.5 text-[10px] font-bold text-white">
              ⚠ score may be incomplete
            </span>
          )}
        </span>
        <ChevronDown className={cn("h-4 w-4 text-muted-foreground transition-transform duration-200", open && "rotate-180")} />
      </button>

      {open && (
        <div className="grid gap-6 px-5 pb-6 pt-1 sm:grid-cols-2">
          {/* Group A */}
          <div className="space-y-2.5">
            <div className="flex items-center gap-2 pb-1">
              <span className="h-px flex-1 bg-border" />
              <h5 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                {isReba ? "Group B · Arm & wrist" : "Group A · Arm & wrist"}
              </h5>
              <span className="h-px flex-1 bg-border" />
            </div>
            <div className="rounded-xl border border-border bg-card/50 px-3.5 py-2.5">
              <label className="mb-2 flex items-center justify-between text-xs text-muted-foreground">
                <span>Wrist flexion / extension</span>
                <span className="rounded-md bg-secondary px-1.5 py-0.5 font-mono font-medium tabular-nums">
                  {Math.round(input.wristAngle)}°
                </span>
              </label>
              <input
                type="range"
                min={-45}
                max={45}
                value={input.wristAngle}
                onChange={(e) => set("wristAngle", Number(e.target.value))}
                className="w-full accent-primary"
              />
              <div className="mt-1 flex justify-between text-[10px] text-muted-foreground/60">
                <span>-45°</span>
                <span>0°</span>
                <span>+45°</span>
              </div>
            </div>
            <Toggle
              label={isReba ? "Wrist deviated or twisted" : "Wrist deviated (ulnar/radial)"}
              checked={input.wristDeviated}
              onChange={(v) => set("wristDeviated", v)}
            />
            {!isReba && (
              <Toggle label="Wrist twisted near end of range" checked={input.wristTwistEnd} onChange={(v) => set("wristTwistEnd", v)} />
            )}
            <Toggle label="Arm supported / leaning" checked={input.armSupported} onChange={(v) => set("armSupported", v)} />
            <Toggle label="Shoulder raised" checked={input.shoulderRaised} onChange={(v) => set("shoulderRaised", v)} />
            <Toggle
              label="Upper arm abducted (out to the side)"
              checked={input.upperArmAbducted}
              onChange={(v) => set("upperArmAbducted", v)}
            />
            {isReba ? (
              <ForceControl
                label="Coupling (0 good · 3 unacceptable)"
                value={input.coupling}
                onChange={(v) => set("coupling", v)}
              />
            ) : (
              <>
                <Toggle
                  label="Lower arm crosses midline"
                  checked={input.lowerArmCrossMidline}
                  onChange={(v) => set("lowerArmCrossMidline", v)}
                />
                <Toggle
                  label="Held static over a minute, or repeated 4+ times a minute"
                  checked={input.muscleUseA}
                  onChange={(v) => set("muscleUseA", v)}
                />
                <ForceControl label="Force / load" value={input.forceA} onChange={(v) => set("forceA", v)} />
              </>
            )}
          </div>

          {/* Group B */}
          <div className="space-y-2.5">
            <div className="flex items-center gap-2 pb-1">
              <span className="h-px flex-1 bg-border" />
              <h5 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                {isReba ? "Group A · Trunk, neck & legs" : "Group B · Neck, trunk & legs"}
              </h5>
              <span className="h-px flex-1 bg-border" />
            </div>
            <Toggle label="Neck twisted" checked={input.neckTwisted} onChange={(v) => set("neckTwisted", v)} />
            <Toggle label="Neck side-bent" checked={input.neckSideBend} onChange={(v) => set("neckSideBend", v)} />
            <Toggle label="Trunk twisted" checked={input.trunkTwisted} onChange={(v) => set("trunkTwisted", v)} />
            <Toggle label="Trunk side-bent" checked={input.trunkSideBend} onChange={(v) => set("trunkSideBend", v)} />
            <Toggle label="Legs & feet supported / seated" checked={input.legsSupported} onChange={(v) => set("legsSupported", v)} />
            {isReba ? (
              <>
                <Toggle
                  label="Bilateral weight-bearing / stable base"
                  checked={input.legsBilateral}
                  onChange={(v) => set("legsBilateral", v)}
                />
                <div className="rounded-xl border border-border bg-card/50 px-3.5 py-2.5">
                  <label className="mb-2 flex items-center justify-between text-xs text-muted-foreground">
                    <span>Knee flexion</span>
                    <span className="rounded-md bg-secondary px-1.5 py-0.5 font-mono font-medium tabular-nums">
                      {Math.round(input.legAngle ?? 0)}°
                    </span>
                  </label>
                  <input
                    type="range"
                    min={0}
                    max={150}
                    value={input.legAngle ?? 0}
                    onChange={(e) => set("legAngle", Number(e.target.value))}
                    className="w-full accent-primary"
                  />
                </div>
                <ForceControl label="Load (0 <5kg · 1 5-10 · 2 >10)" value={input.load} onChange={(v) => set("load", v)} steps={[0, 1, 2]} />
                <Toggle label="Shock / rapid force build-up" checked={input.loadShock} onChange={(v) => set("loadShock", v)} />
                <div className="flex items-center gap-2 pt-1">
                  <span className="h-px flex-1 bg-border" />
                  <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Activity</span>
                  <span className="h-px flex-1 bg-border" />
                </div>
                <Toggle label="Body part held static >1 min" checked={input.activityStatic} onChange={(v) => set("activityStatic", v)} />
                <Toggle label="Small actions repeated >4x/min" checked={input.activityRepeated} onChange={(v) => set("activityRepeated", v)} />
                <Toggle label="Rapid large changes / unstable base" checked={input.activityUnstable} onChange={(v) => set("activityUnstable", v)} />
              </>
            ) : (
              <>
                <Toggle
                  label="Held static over a minute, or repeated 4+ times a minute"
                  checked={input.muscleUseB}
                  onChange={(v) => set("muscleUseB", v)}
                />
                <ForceControl label="Force / load" value={input.forceB} onChange={(v) => set("forceB", v)} />
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
