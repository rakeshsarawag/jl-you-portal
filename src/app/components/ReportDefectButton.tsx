import { useState } from "react";
import { Bug, X } from "lucide-react";
import { supabase } from "../utils/constants";
import { t } from "../../i18n/index";

interface Props {
  appName: string;
  featureName?: string;
  description?: string;
  projectId?: string;
}

type Severity = "Very High" | "High" | "Medium" | "Low";

const SEVERITIES: Severity[] = ["Very High", "High", "Medium", "Low"];

export default function ReportDefectButton({ appName, featureName = "", description = "", projectId }: Props) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    appName,
    featureName,
    description,
    severity: "Medium" as Severity,
  });
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<"success" | "error" | null>(null);

  function handleOpen() {
    setForm({ appName, featureName, description, severity: "Medium" });
    setResult(null);
    setOpen(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setResult(null);

    const { data: lastDef } = await supabase.from("project_defects").select("defect_id").like("defect_id", "DEF%").order("defect_id", { ascending: false }).limit(1);
    let defNext = 1;
    if (lastDef?.length) { const m = String(lastDef[0].defect_id).match(/DEF(\d+)/); if (m) defNext = parseInt(m[1]) + 1; }
    const defectId = `DEF${String(defNext).padStart(4, "0")}`;
    const { error } = await supabase.from("project_defects").insert([{
      defect_id: defectId,
      project_name: form.appName,
      ...(projectId ? { project_id: projectId } : {}),
      title: `[${form.featureName || form.appName}] ${form.description.slice(0, 80)}`,
      description: form.description,
      severity: form.severity,
      priority: "P2",
      status: "Open",
      steps_to_reproduce: [],
      labels: ["reported-via-app"],
      created_at: new Date().toISOString(),
    }]);

    setSubmitting(false);
    if (error) {
      setResult("error");
    } else {
      setResult("success");
      setTimeout(() => setOpen(false), 1500);
    }
  }

  return (
    <>
      <button
        onClick={handleOpen}
        title={t("reportDefect.buttonLabel")}
        className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-red-600 bg-red-50 hover:bg-red-100 rounded border border-red-200 transition-colors"
      >
        <Bug className="h-3.5 w-3.5" />
        <span className="hidden sm:inline">{t("reportDefect.buttonLabel")}</span>
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between px-4 py-3 border-b">
              <div className="flex items-center gap-2 text-red-700">
                <Bug className="h-4 w-4" />
                <span className="font-semibold text-sm">{t("reportDefect.modalTitle")}</span>
              </div>
              <button onClick={() => setOpen(false)} className="text-gray-400 hover:text-gray-600">
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-4 space-y-3">
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">
                  {t("reportDefect.appName")}
                </label>
                <input
                  className="w-full border rounded px-2 py-1.5 text-sm"
                  value={form.appName}
                  onChange={e => setForm(f => ({ ...f, appName: e.target.value }))}
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">
                  {t("reportDefect.featureName")}
                </label>
                <input
                  className="w-full border rounded px-2 py-1.5 text-sm"
                  value={form.featureName}
                  onChange={e => setForm(f => ({ ...f, featureName: e.target.value }))}
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">
                  {t("reportDefect.severity")}
                </label>
                <select
                  className="w-full border rounded px-2 py-1.5 text-sm"
                  value={form.severity}
                  onChange={e => setForm(f => ({ ...f, severity: e.target.value as Severity }))}
                >
                  {SEVERITIES.map(s => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">
                  {t("reportDefect.description")} *
                </label>
                <textarea
                  className="w-full border rounded px-2 py-1.5 text-sm resize-none"
                  rows={4}
                  placeholder={t("reportDefect.descriptionPlaceholder")}
                  value={form.description}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  required
                />
              </div>

              {result === "success" && (
                <p className="text-green-600 text-xs font-medium">{t("reportDefect.success")}</p>
              )}
              {result === "error" && (
                <p className="text-red-600 text-xs font-medium">{t("reportDefect.error")}</p>
              )}

              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="px-3 py-1.5 text-sm border rounded hover:bg-gray-50"
                >
                  {t("common.cancel")}
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-3 py-1.5 text-sm bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50"
                >
                  {submitting ? t("reportDefect.submitting") : t("reportDefect.submit")}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
