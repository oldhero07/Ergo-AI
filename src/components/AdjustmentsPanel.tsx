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
        "flex w-full items-center justify-between gap-3 rounded-md border px-3 py-2 text-left text-sm transition-colors",
        checked ? "border-primary/40 bg-primary/5" : "border-border",
      )}
    >
      <span className="text-muted-foreground">{label}</span>
      <span className={cn("relative h-5 w-9 shrink-0 rounded-full transition-colors", checked ? "bg-primary" : "bg-muted")}>
        <span
          className={cn(
            "absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform",
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
    <div className="flex items-center justify-between gap-3 rounded-md border px-3 py-2 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <div className="flex gap-1">
        {steps.map((v) => (
          <button
            key={v}
            type="button"
            aria-pressed={value === v}
            onClick={() => onChange(v)}
            className={cn(
              "h-6 w-6 rounded-md text-xs font-medium tabular-nums transition-colors",
              value === v ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground hover:bg-secondary/80",
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
 * Collapsed-by-default panel for the factors a single 2D photo can't reliably
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
  const [open, setOpen] = useState(false);
  const set = <K extends keyof PostureInput>(key: K, value: PostureInput[K]) => onChange({ ...input, [key]: value });
  const isReba = methodId === "reba";

  return (
    <div className="border-t">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-center justify-between px-5 py-3 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
      >
        <span className="flex items-center gap-2">
          <SlidersHorizontal className="h-4 w-4" /> Adjust factors a photo can't see
        </span>
        <ChevronDown className={cn("h-4 w-4 transition-transform", open && "rotate-180")} />
      </button>

      {open && (
        <div className="grid gap-5 px-5 pb-5 sm:grid-cols-2">
          <div className="space-y-2">
            <h5 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {isReba ? "Group B · arm & wrist" : "Group A · arm & wrist"}
            </h5>
            <div className="rounded-md border px-3 py-2">
              <label className="mb-1 flex items-center justify-between text-xs text-muted-foreground">
                <span>Wrist flexion / extension</span>
                <span className="font-mono tabular-nums">{Math.round(input.wristAngle)}°</span>
              </label>
              <input
                type="range"
                min={-45}
                max={45}
                value={input.wristAngle}
                onChange={(e) => set("wristAngle", Number(e.target.value))}
                className="w-full accent-primary"
              />
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

          <div className="space-y-2">
            <h5 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {isReba ? "Group A · trunk, neck & legs" : "Group B · neck, trunk & legs"}
            </h5>
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
                <div className="rounded-md border px-3 py-2">
                  <label className="mb-1 flex items-center justify-between text-xs text-muted-foreground">
                    <span>Knee flexion</span>
                    <span className="font-mono tabular-nums">{Math.round(input.legAngle ?? 0)}°</span>
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
                <div className="pt-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Activity</div>
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
