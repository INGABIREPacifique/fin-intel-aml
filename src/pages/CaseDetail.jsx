import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";

export default function CaseDetail() {
  const { caseCode } = useParams();
  const navigate = useNavigate();
  const [alert, setAlert] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadAlert() {
      const { data, error } = await supabase
        .from("alerts")
        .select("*, entities(*)")
        .eq("case_code", caseCode)
        .single();
      if (!error) setAlert(data);
      setLoading(false);
    }
    loadAlert();
  }, [caseCode]);

  return (
    <div className="min-h-screen bg-background text-on-surface p-8">
      <button
        onClick={() => navigate("/dashboard")}
        className="flex items-center gap-2 text-on-surface-variant hover:text-on-surface mb-6 font-body-md text-body-md"
      >
        <span className="material-symbols-outlined text-[20px]">arrow_back</span>
        Back to Dashboard
      </button>

      {loading && <p className="font-data-tabular text-data-tabular text-on-surface-variant">Loading case...</p>}

      {!loading && !alert && (
        <p className="font-data-tabular text-data-tabular text-status-critical">Case not found.</p>
      )}

      {alert && (
        <div className="bg-surface-container border border-surface-border rounded p-8 max-w-2xl">
          <p className="font-data-tabular text-data-tabular text-on-surface-variant mb-2">
            {alert.case_code}
          </p>
          <h1 className="font-headline-lg text-headline-lg text-on-surface mb-4">
            {alert.entities?.entity_name}
          </h1>
          <div className="grid grid-cols-2 gap-6 mb-6">
            <div>
              <p className="font-label-caps text-label-caps text-on-surface-variant uppercase mb-1">
                Jurisdiction
              </p>
              <p className="font-body-lg text-body-lg">{alert.entities?.jurisdiction}</p>
            </div>
            <div>
              <p className="font-label-caps text-label-caps text-on-surface-variant uppercase mb-1">
                TIN / EIN
              </p>
              <p className="font-data-tabular text-data-tabular">{alert.entities?.tin_ein}</p>
            </div>
            <div>
              <p className="font-label-caps text-label-caps text-on-surface-variant uppercase mb-1">
                Pattern Detected
              </p>
              <p className="font-body-lg text-body-lg text-status-critical">{alert.pattern}</p>
            </div>
            <div>
              <p className="font-label-caps text-label-caps text-on-surface-variant uppercase mb-1">
                Risk Score
              </p>
              <p className="font-headline-sm text-headline-sm text-status-critical">
                {alert.risk_score}/100
              </p>
            </div>
          </div>
          <p className="font-body-md text-body-md text-on-surface-variant mb-6">
            Next build phase adds the full forensic network graph and evidence log for this case.
          </p>
          <button
            onClick={() => navigate(`/cases/${alert.case_code}/sar`)}
            className="px-6 py-3 rounded font-label-caps text-label-caps bg-status-success text-on-primary-fixed font-bold hover:opacity-90 transition-opacity"
          >
            Draft SAR for this Case
          </button>
        </div>
      )}
    </div>
  );
}
