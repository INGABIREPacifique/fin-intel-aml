import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { useAuth } from "../lib/AuthContext";
import AdminSidebar from "../components/AdminSidebar";
import TopNavBar from "../components/TopNavBar";

const DEMO_WEBHOOK_LOG = [
  { time: "14:02:11.452", code: "200 OK", color: "text-status-success", method: "POST /v2/aml/scan", body: '{"req_id": "8f9a-2b1c", "entity": "Global Bank", "status": "processed"}' },
  { time: "14:02:08.119", code: "429 TL", color: "text-status-warning", method: "GET /v3/kyc/status", body: '{"req_id": "77bc-99d4", "error": "rate_limit_exceeded"}' },
  { time: "14:01:55.002", code: "201 CR", color: "text-status-success", method: "POST /v2/webhooks/register", body: '{"req_id": "11a2-b44c", "endpoint": "https://api.euroclear.com/cb"}' },
  { time: "14:01:20.334", code: "500 SE", color: "text-status-critical", method: "POST /v2/tx/validate", body: '{"req_id": "fatal-err", "msg": "DB connection lost during validation"}' },
];

function randomKey() {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  return Array.from({ length: 24 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
}

export default function ApiGateway() {
  const { session } = useAuth();
  const [institutions, setInstitutions] = useState([]);
  const [apiKeys, setApiKeys] = useState([]);
  const [loading, setLoading] = useState(true);
  const [alias, setAlias] = useState("");
  const [expiryDays, setExpiryDays] = useState(90);
  const [scopes, setScopes] = useState({ "read:aml": true, "write:aml": false, "read:kyc": false, "admin:keys": false });
  const [newKeyRevealed, setNewKeyRevealed] = useState(null);

  const load = async () => {
    const [{ data: instData }, { data: keyData }] = await Promise.all([
      supabase.from("institutions").select("*").order("name"),
      supabase.from("api_keys").select("*").eq("revoked", false).order("created_at", { ascending: false }),
    ]);
    setInstitutions(instData ?? []);
    setApiKeys(keyData ?? []);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const handleGenerateKey = async () => {
    if (!alias.trim()) return;
    const fullKey = `${alias.slice(0, 4).toLowerCase()}_${randomKey()}`;
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + Number(expiryDays));

    const activeScopes = Object.entries(scopes).filter(([, v]) => v).map(([k]) => k);

    const { data, error } = await supabase
      .from("api_keys")
      .insert({
        key_alias: alias,
        key_prefix: fullKey.slice(0, 8) + "***",
        full_key: fullKey,
        scopes: activeScopes,
        expires_at: expiresAt.toISOString().slice(0, 10),
        created_by: session.user.id,
      })
      .select()
      .single();

    if (!error) {
      setNewKeyRevealed(data);
      setAlias("");
      await supabase.from("audit_logs").insert({
        actor_id: session.user.id,
        action: "api_key_generated",
        target_type: "api_key",
        target_label: data.key_alias,
        details: { note: `Scopes: ${activeScopes.join(", ")}` },
      });
      load();
    }
  };

  const handleRevoke = async (key) => {
    await supabase.from("api_keys").update({ revoked: true }).eq("id", key.id);
    await supabase.from("audit_logs").insert({
      actor_id: session.user.id,
      action: "api_key_revoked",
      target_type: "api_key",
      target_label: key.key_alias,
      details: {},
    });
    load();
  };

  return (
    <div className="min-h-screen bg-background text-on-surface flex">
      <AdminSidebar />
      <div className="flex-1 flex flex-col">
        <TopNavBar />
        <main className="flex-1 p-8">
          <div className="flex items-end justify-between mb-6">
            <div>
              <h1 className="font-headline-lg text-headline-lg text-on-surface mb-1">API Gateway &amp; Integrations</h1>
              <p className="font-body-md text-body-md text-on-surface-variant">
                Manage external institutional connections and webhook traffic.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="lg:col-span-2 flex flex-col gap-4">
              <div className="bg-surface-container border border-surface-border rounded p-6">
                <h2 className="font-headline-sm text-headline-sm text-on-surface mb-4">Active Institutional Partners</h2>
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-surface-border">
                      <th className="text-left font-label-caps text-label-caps text-on-surface-variant uppercase px-3 py-2">Institution</th>
                      <th className="text-left font-label-caps text-label-caps text-on-surface-variant uppercase px-3 py-2">Environment</th>
                      <th className="text-left font-label-caps text-label-caps text-on-surface-variant uppercase px-3 py-2">Status</th>
                      <th className="text-left font-label-caps text-label-caps text-on-surface-variant uppercase px-3 py-2">Version</th>
                      <th className="text-right font-label-caps text-label-caps text-on-surface-variant uppercase px-3 py-2">Latency</th>
                    </tr>
                  </thead>
                  <tbody>
                    {institutions.map((inst) => (
                      <tr key={inst.id} className="border-b border-surface-border">
                        <td className="px-3 py-3 font-body-md text-body-md text-on-surface">{inst.name}</td>
                        <td className="px-3 py-3 font-data-tabular text-data-tabular text-on-surface-variant">{inst.environment}</td>
                        <td className="px-3 py-3">
                          <span className={`font-data-tabular text-data-tabular px-2 py-0.5 rounded border ${inst.sync_status === "live" ? "text-status-success border-status-success bg-status-success/10" : "text-status-warning border-status-warning bg-status-warning/10"}`}>
                            {inst.sync_status === "live" ? "Healthy" : "Degraded"}
                          </span>
                        </td>
                        <td className="px-3 py-3 font-data-tabular text-data-tabular text-on-surface">{inst.api_version}</td>
                        <td className={`px-3 py-3 text-right font-data-tabular text-data-tabular ${inst.latency_ms > 200 ? "text-status-warning" : "text-on-surface-variant"}`}>
                          {inst.latency_ms}ms
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="bg-surface-container border border-surface-border rounded p-6 relative">
                <span className="absolute top-6 right-6 font-data-tabular text-data-tabular text-[9px] text-on-surface-variant border border-surface-border rounded px-1.5 py-0.5">
                  ILLUSTRATIVE — NO REAL WEBHOOK INFRASTRUCTURE YET
                </span>
                <div className="flex items-center gap-2 mb-4">
                  <h2 className="font-headline-sm text-headline-sm text-on-surface">Real-time Webhook Stream</h2>
                  <span className="w-2 h-2 rounded-full bg-status-success" />
                  <span className="font-data-tabular text-data-tabular text-on-surface-variant">Listening</span>
                </div>
                <div className="bg-background border border-surface-border rounded p-4 space-y-2 font-data-tabular text-data-tabular">
                  {DEMO_WEBHOOK_LOG.map((row, i) => (
                    <div key={i} className="flex gap-4 opacity-80">
                      <span className="text-on-surface-variant shrink-0">{row.time}</span>
                      <span className={`${row.color} shrink-0`}>[{row.code}]</span>
                      <span className="text-data-focus shrink-0">{row.method}</span>
                      <span className="text-on-surface truncate">{row.body}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="bg-surface-container border border-surface-border rounded p-6">
              <h2 className="font-headline-sm text-headline-sm text-on-surface mb-4">API Key Management</h2>

              <div className="bg-surface-container-low border border-surface-border rounded p-4 mb-6">
                <p className="font-label-caps text-label-caps text-on-surface-variant uppercase mb-3 border-b border-surface-border pb-2">
                  Generate System Key
                </p>
                <div className="space-y-3">
                  <div>
                    <label className="font-label-caps text-label-caps text-on-surface block mb-1">Key Alias</label>
                    <input
                      value={alias}
                      onChange={(e) => setAlias(e.target.value)}
                      placeholder="e.g. prod_txn_service"
                      className="w-full bg-background border border-surface-border text-on-surface text-sm px-3 py-2 rounded focus:outline-none focus:border-data-focus"
                    />
                  </div>
                  <div>
                    <label className="font-label-caps text-label-caps text-on-surface block mb-1">Expiry</label>
                    <select
                      value={expiryDays}
                      onChange={(e) => setExpiryDays(e.target.value)}
                      className="w-full bg-background border border-surface-border text-on-surface text-sm px-3 py-2 rounded focus:outline-none"
                    >
                      <option value={30}>30 Days</option>
                      <option value={90}>90 Days</option>
                      <option value={365}>1 Year</option>
                    </select>
                  </div>
                  <div>
                    <label className="font-label-caps text-label-caps text-on-surface block mb-2">Scopes</label>
                    <div className="grid grid-cols-2 gap-2">
                      {Object.keys(scopes).map((s) => (
                        <label key={s} className="flex items-center gap-2 font-data-tabular text-data-tabular text-on-surface-variant">
                          <input
                            type="checkbox"
                            checked={scopes[s]}
                            onChange={(e) => setScopes({ ...scopes, [s]: e.target.checked })}
                          />
                          {s}
                        </label>
                      ))}
                    </div>
                  </div>
                  <button
                    onClick={handleGenerateKey}
                    className="w-full border border-secondary text-secondary py-2 rounded font-label-caps text-label-caps"
                  >
                    Generate Token
                  </button>
                </div>
              </div>

              {newKeyRevealed && (
                <div className="bg-status-success/10 border border-status-success rounded p-3 mb-4">
                  <p className="font-label-caps text-label-caps text-status-success uppercase mb-1">Copy this now — shown once</p>
                  <p className="font-data-tabular text-data-tabular text-on-surface break-all">{newKeyRevealed.full_key}</p>
                </div>
              )}

              <p className="font-label-caps text-label-caps text-on-surface-variant uppercase border-b border-surface-border pb-2 mb-3">Active Keys</p>
              <div className="space-y-3">
                {apiKeys.length === 0 && (
                  <p className="font-data-tabular text-data-tabular text-on-surface-variant">No active keys.</p>
                )}
                {apiKeys.map((k) => (
                  <div key={k.id} className="bg-background border border-surface-border rounded p-3 flex items-start justify-between">
                    <div>
                      <p className="font-data-tabular text-data-tabular text-on-surface">{k.key_alias}</p>
                      <p className="font-data-tabular text-data-tabular text-on-surface-variant text-[11px]">Prefix: {k.key_prefix}</p>
                      <p className="font-data-tabular text-data-tabular text-on-surface-variant text-[11px]">Expires: {k.expires_at}</p>
                    </div>
                    <button onClick={() => handleRevoke(k)} className="text-status-critical text-[11px] font-label-caps text-label-caps">
                      Revoke
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
