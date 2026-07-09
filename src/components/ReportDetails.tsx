import { Button } from "@/components/ui/button";
import { shrinkToDataUrl } from "@/lib/sessionStore";

export interface ReportMetaValues {
  assessor: string;
  organization: string;
  subject: string;
  logoDataUrl?: string;
}

/** Optional provenance for the PDF cover page (assessor, organization, subject/task, logo). */
export function ReportDetails({
  meta,
  onChange,
}: {
  meta: ReportMetaValues;
  onChange: (next: ReportMetaValues) => void;
}) {
  const set = (key: "assessor" | "organization" | "subject", value: string) => onChange({ ...meta, [key]: value });
  const fields: { key: "assessor" | "organization" | "subject"; label: string; placeholder: string }[] = [
    { key: "assessor", label: "Assessor", placeholder: "Your name" },
    { key: "organization", label: "Organization", placeholder: "Dept. / company" },
    { key: "subject", label: "Subject / task", placeholder: "e.g. Loin-loom weaving - beating" },
  ];

  const onLogo = async (file: File | undefined) => {
    if (!file) return;
    // Downscale to a small data URL - the PDF draws it at ~64pt, and a raw
    // camera-size logo would bloat both memory and the report.
    const url = URL.createObjectURL(file);
    try {
      const small = await shrinkToDataUrl(url, 256);
      if (small) onChange({ ...meta, logoDataUrl: small });
    } finally {
      URL.revokeObjectURL(url);
    }
  };

  return (
    <details className="mb-6 rounded-lg border bg-muted/20">
      <summary className="cursor-pointer px-4 py-3 text-sm font-medium text-muted-foreground">
        Report details (shown on the PDF cover page)
      </summary>
      <div className="grid gap-3 px-4 pb-4 sm:grid-cols-3">
        {fields.map((f) => (
          <label key={f.key} className="text-xs text-muted-foreground">
            {f.label}
            <input
              type="text"
              value={meta[f.key]}
              placeholder={f.placeholder}
              onChange={(e) => set(f.key, e.target.value)}
              className="mt-1 w-full rounded-md border bg-background px-2 py-1.5 text-sm text-foreground"
            />
          </label>
        ))}
        <div className="flex items-end gap-3 sm:col-span-3">
          <label className="text-xs text-muted-foreground">
            Logo (optional, drawn on the cover)
            <input
              type="file"
              accept="image/*"
              onChange={(e) => void onLogo(e.target.files?.[0])}
              className="mt-1 block w-full text-xs text-muted-foreground file:mr-3 file:rounded-md file:border file:border-border file:bg-background file:px-2.5 file:py-1.5 file:text-xs file:text-foreground"
            />
          </label>
          {meta.logoDataUrl && (
            <>
              <img src={meta.logoDataUrl} alt="report logo" className="h-10 w-10 rounded-md border object-contain" />
              <Button size="sm" variant="ghost" onClick={() => onChange({ ...meta, logoDataUrl: undefined })}>
                Remove
              </Button>
            </>
          )}
        </div>
      </div>
    </details>
  );
}
