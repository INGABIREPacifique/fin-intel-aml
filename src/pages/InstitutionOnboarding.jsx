import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import { useAuth } from "../lib/AuthContext";

const STEPS = [
  { n: 1, title: "Partner Identity", subtitle: "Profile & Jurisdiction setup" },
  { n: 2, title: "Technical Config", subtitle: "Endpoints & Schemas" },
  { n: 3, title: "Legal Status", subtitle: "Compliance & MOUs" },
];

const ZONES = ["North America", "EMEA", "APAC", "LATAM"];

export default function InstitutionOnboarding() {
  const navigate = useNavigate();
  const { session } = useAuth();
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [name, setName] = useState("");
  const [license, setLicense] = useState("");
  const [lei, setLei] = useState("");
  const [authority, setAuthority] = useState("");
  const [zones, setZones] = useState({ "North America": true, EMEA: true, APAC: false, LATAM: false });
  const [environment, setEnvironment] = useState("production");
  const [apiVersion, setApiVersion] = useState("v1.0.0");

  const toggleZone = (z) => setZones({ ...zones, [z]: !zones[z] });

  const handleFinish = async () => {
    setSaving(true);
    setError("");
    const activeZones = Object.entries(zones).filter(([, v]) => v).map(([k]) => k);
    const code = `${name.slice(0, 3).toUpperCase() || "NEW"}-${Date.now().toString().slice(-3)}-${authority.slice(0, 2).toUpperCase() || "XX"}`;

    const { data, error: err } = await supabase
      .from("institutions")
      .insert({
        institution_code: code,
        name,
        jurisdiction_code: authority,
        banking_license_number: license,
        lei_code: lei,
        operational_zones: activeZones,
        environment,
        api_version: apiVersion,
        latency_ms: null,
        status: "active",
        onboarding_status: "active",
        sar_filing_accuracy: 0,
        ctr_pass_rate: 0,
        schema_validation_rate: 0,
        sync_status: "live",
        is_demo: false,
      })
      .select()
      .single();

    if (err) {
      setError(err.message);
      setSaving(false);
      return;
    }

    await supabase.from("audit_logs").insert({
      actor_id: session.user.id,
      action: "institution_onboarded",
      target_type: "institution",
      target_id: data.id,
      target_label: data.name,
      details: { note: `New institution onboarded: ${data.name}` },
    });

    navigate(`/institutions/${data.institution_code}`);
  };

  return (
    <div className="min-h-screen bg-primary-container text-on-surface flex flex-col">
      <header className="bg-surface-container-highest border-b border-surface-border h-16 flex items-center justify-between px-8 shrink-0">
        <div className="flex items-center gap-4">
          <span className="font-headline-sm text-headline-sm font-bold text-secondary">FIN-INTEL AML</span>
          <span className="border-l border-surface-border pl-4 font-label-caps text-label-caps text-on-surface-variant uppercase">
            Institution Onboarding
          </span>
        </div>
        <button onClick={() => navigate("/institutions")} className="text-on-surface-variant hover:text-on-surface">
          <span className="material-symbols-outlined">close</span>
        </button>
      </header>

      <div className="flex gap-4 p-8 max-w-[1200px] mx-auto w-full">
        <aside className="w-[304px] shrink-0">
          <div className="bg-surface-container border border-surface-border rounded p-6">
            <h2 className="font-headline-sm text-headline-sm text-on-surface mb-6">Onboarding Sequence</h2>
            <div className="space-y-6 relative">
              <div className="absolute left-3 top-0 bottom-0 w-px bg-surface-border" />
              {STEPS.map((s) => (
                <div key={s.n} className={`flex gap-4 relative ${step < s.n ? "opacity-60" : ""}`}>
                  <div
                    className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 z-10 font-label-caps text-label-caps ${
                      step >= s.n ? "bg-secondary text-on-secondary" : "bg-surface-container-high border border-surface-border text-on-surface-variant"
                    }`}
                  >
                    {s.n}
                  </div>
                  <div>
                    <p className={`font-body-lg text-body-lg ${step === s.n ? "text-secondary font-semibold" : "text-on-surface"}`}>{s.title}</p>
                    <p className="font-body-md text-body-md text-on-surface-variant">{s.subtitle}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </aside>

        <section className="flex-1">
          <h1 className="font-headline-lg text-headline-lg text-on-surface mb-1">{STEPS[step - 1].title} &amp; Profile</h1>
          <p className="font-body-md text-body-md text-on-surface-variant mb-6">
            Establish foundational institutional records for AML intelligence sharing.
          </p>

          <div className="bg-surface-container-low border border-surface-border rounded flex flex-col">
            <div className="p-8 space-y-8">
              {step === 1 && (
                <>
                  <div>
                    <p className="font-label-caps text-label-caps text-secondary uppercase border-b border-surface-border pb-2 mb-4">
                      Institution Core Registry
                    </p>
                    <div className="grid grid-cols-1 gap-4 mb-4">
                      <div>
                        <label className="font-body-md text-body-md text-on-surface-variant block mb-2">Registered Institutional Name</label>
                        <input
                          value={name}
                          onChange={(e) => setName(e.target.value)}
                          className="w-full bg-white text-surface-container-lowest border border-outline rounded p-3 text-sm"
                          placeholder="e.g. Nexus Financial Group"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="font-body-md text-body-md text-on-surface-variant block mb-2">Banking License Number</label>
                        <input
                          value={license}
                          onChange={(e) => setLicense(e.target.value)}
                          className="w-full bg-white text-surface-container-lowest border border-outline rounded p-3 text-sm"
                          placeholder="Alpha-numeric identifier"
                        />
                      </div>
                      <div>
                        <label className="font-body-md text-body-md text-on-surface-variant block mb-2">Legal Entity Identifier (LEI)</label>
                        <input
                          value={lei}
                          onChange={(e) => setLei(e.target.value)}
                          className="w-full bg-white text-surface-container-lowest border border-outline rounded p-3 text-sm"
                          placeholder="20-character code"
                        />
                      </div>
                    </div>
                  </div>
                  <div>
                    <p className="font-label-caps text-label-caps text-secondary uppercase border-b border-surface-border pb-2 mb-4">
                      Jurisdictional Operations
                    </p>
                    <label className="font-body-md text-body-md text-on-surface-variant block mb-2">Primary Regulatory Authority</label>
                    <input
                      value={authority}
                      onChange={(e) => setAuthority(e.target.value)}
                      className="w-full bg-primary-container border border-surface-border rounded p-3 text-sm mb-4"
                      placeholder="e.g. UK - FCA"
                    />
                    <label className="font-body-md text-body-md text-on-surface-variant block mb-2">Active Operational Zones</label>
                    <div className="grid grid-cols-4 gap-3">
                      {ZONES.map((z) => (
                        <label key={z} className={`border rounded p-3 flex items-center gap-2 cursor-pointer ${zones[z] ? "border-secondary bg-secondary/10" : "border-surface-border"}`}>
                          <input type="checkbox" checked={zones[z]} onChange={() => toggleZone(z)} />
                          <span className="text-sm">{z}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                </>
              )}

              {step === 2 && (
                <div>
                  <p className="font-label-caps text-label-caps text-secondary uppercase border-b border-surface-border pb-2 mb-4">
                    Technical Configuration
                  </p>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="font-body-md text-body-md text-on-surface-variant block mb-2">Environment</label>
                      <select
                        value={environment}
                        onChange={(e) => setEnvironment(e.target.value)}
                        className="w-full bg-primary-container border border-surface-border rounded p-3 text-sm"
                      >
                        <option value="production">Production</option>
                        <option value="uat">UAT</option>
                        <option value="sandbox">Sandbox</option>
                      </select>
                    </div>
                    <div>
                      <label className="font-body-md text-body-md text-on-surface-variant block mb-2">API Version</label>
                      <input
                        value={apiVersion}
                        onChange={(e) => setApiVersion(e.target.value)}
                        className="w-full bg-primary-container border border-surface-border rounded p-3 text-sm"
                      />
                    </div>
                  </div>
                </div>
              )}

              {step === 3 && (
                <div>
                  <p className="font-label-caps text-label-caps text-secondary uppercase border-b border-surface-border pb-2 mb-4">
                    Review &amp; Confirm
                  </p>
                  <div className="grid grid-cols-2 gap-4 font-data-tabular text-data-tabular">
                    <p><span className="text-on-surface-variant">Name: </span>{name || "—"}</p>
                    <p><span className="text-on-surface-variant">Authority: </span>{authority || "—"}</p>
                    <p><span className="text-on-surface-variant">License: </span>{license || "—"}</p>
                    <p><span className="text-on-surface-variant">LEI: </span>{lei || "—"}</p>
                    <p><span className="text-on-surface-variant">Environment: </span>{environment}</p>
                    <p><span className="text-on-surface-variant">Zones: </span>{Object.entries(zones).filter(([, v]) => v).map(([k]) => k).join(", ") || "—"}</p>
                  </div>
                  {error && <p className="text-status-critical font-data-tabular text-data-tabular mt-4">{error}</p>}
                </div>
              )}
            </div>

            <div className="border-t border-surface-border bg-surface-container-lowest p-6 flex justify-end gap-3">
              {step > 1 && (
                <button onClick={() => setStep(step - 1)} className="border border-outline text-on-surface px-6 py-2 rounded font-label-caps text-label-caps">
                  Back
                </button>
              )}
              {step < 3 ? (
                <button
                  onClick={() => setStep(step + 1)}
                  disabled={step === 1 && !name}
                  className="bg-secondary text-on-secondary px-6 py-2 rounded font-label-caps text-label-caps font-semibold disabled:opacity-50"
                >
                  Save &amp; Continue
                </button>
              ) : (
                <button
                  onClick={handleFinish}
                  disabled={saving}
                  className="bg-secondary text-on-secondary px-6 py-2 rounded font-label-caps text-label-caps font-semibold disabled:opacity-60"
                >
                  {saving ? "Creating..." : "Complete Onboarding"}
                </button>
              )}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
