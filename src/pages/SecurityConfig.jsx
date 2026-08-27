import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { useAuth } from "../lib/AuthContext";
import AdminSidebar from "../components/AdminSidebar";

export default function SecurityConfig() {
  const { session } = useAuth();
  const [groups, setGroups] = useState([]);
  const [autoLogout, setAutoLogout] = useState(15);
  const [sessionLimit, setSessionLimit] = useState(1);
  const [loading, setLoading] = useState(true);
  const [saveMessage, setSaveMessage] = useState("");
  const [loadError, setLoadError] = useState("");

  const load = async () => {
    setLoadError("");
    try {
      const [{ data: groupData, error: groupErr }, { data: settingsData, error: settingsErr }] = await Promise.all([
        supabase.from("security_groups").select("*").order("sort_order"),
        supabase.from("system_settings").select("*"),
      ]);
      const firstError = groupErr || settingsErr;
      if (firstError) {
        setLoadError(firstError.message);
      } else {
        setGroups(groupData ?? []);
        const logoutSetting = settingsData?.find((s) => s.key === "auto_logout_minutes");
        const limitSetting = settingsData?.find((s) => s.key === "concurrent_session_limit");
        if (logoutSetting) setAutoLogout(Number(logoutSetting.value));
        if (limitSetting) setSessionLimit(Number(limitSetting.value));
      }
    } catch (err) {
      setLoadError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const handleToggle = async (group, field) => {
    setLoadError("");
    const { data, error } = await supabase
      .from("security_groups")
      .update({ [field]: !group[field] })
      .eq("id", group.id)
      .select()
      .single();
    if (error) {
      setLoadError(`Couldn't update ${group.name}: ${error.message}`);
      return;
    }
    setGroups((prev) => prev.map((g) => (g.id === data.id ? data : g)));
    const { error: logErr } = await supabase.from("audit_logs").insert({
      actor_id: session.user.id,
      action: "security_group_policy_changed",
      target_type: "security_group",
      target_label: group.name,
      details: { note: `${field} set to ${!group[field]}` },
    });
    if (logErr) setLoadError(`Updated, but audit log failed: ${logErr.message}`);
  };

  const handleSavePolicies = async () => {
    setSaveMessage("");
    const [{ error: logoutErr }, { error: limitErr }] = await Promise.all([
      supabase.from("system_settings").update({ value: String(autoLogout) }).eq("key", "auto_logout_minutes"),
      supabase.from("system_settings").update({ value: String(sessionLimit) }).eq("key", "concurrent_session_limit"),
    ]);
    const firstError = logoutErr || limitErr;
    if (firstError) {
      setSaveMessage(`Couldn't save policies: ${firstError.message}`);
      return;
    }
    const { error: logErr } = await supabase.from("audit_logs").insert({
      actor_id: session.user.id,
      action: "session_policies_updated",
      target_type: "system",
      target_label: "Session Governance",
      details: { note: `Auto-logout: ${autoLogout}min, Concurrent limit: ${sessionLimit}` },
    });
    setSaveMessage(logErr ? `Saved, but audit log failed: ${logErr.message}` : "Policies saved.");
  };

  return (
    <div className="min-h-screen bg-background text-on-surface flex">
      <AdminSidebar />
      <main className="flex-1 p-4 md:p-8 overflow-x-hidden">
        <h1 className="font-headline-lg text-headline-lg text-on-surface mb-2">Security Configuration</h1>
        <p className="font-body-md text-body-md text-on-surface-variant mb-8">
          Global parameters and access control management for FIN-INTEL AML instances.
        </p>

        {loadError && (
          <p className="font-data-tabular text-data-tabular text-status-critical mb-6">{loadError}</p>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <div className="bg-surface-container-high border border-surface-border rounded p-6 relative">
            <span className="absolute top-4 right-4 font-data-tabular text-data-tabular text-[9px] text-on-surface-variant border border-surface-border rounded px-1.5 py-0.5">DEMO</span>
            <p className="font-body-md text-body-md text-on-surface-variant mb-1">MFA Status</p>
            <p className="font-headline-sm text-headline-sm text-data-focus mb-1">Enforced Globally</p>
            <p className="font-data-tabular text-data-tabular text-on-surface-variant">Level 3+ Accounts</p>
          </div>
          <div className="bg-surface-container-high border border-surface-border rounded p-6 relative">
            <span className="absolute top-4 right-4 font-data-tabular text-data-tabular text-[9px] text-on-surface-variant border border-surface-border rounded px-1.5 py-0.5">DEMO</span>
            <p className="font-body-md text-body-md text-on-surface-variant mb-1">Data Encryption</p>
            <p className="font-headline-sm text-headline-sm text-data-focus mb-1">System-Wide Active</p>
            <p className="font-data-tabular text-data-tabular text-on-surface-variant">Key rotation: 14 days</p>
          </div>
          <div className="bg-surface-container-high border border-surface-border rounded p-6 relative">
            <span className="absolute top-4 right-4 font-data-tabular text-data-tabular text-[9px] text-on-surface-variant border border-surface-border rounded px-1.5 py-0.5">DEMO</span>
            <p className="font-body-md text-body-md text-on-surface-variant mb-1">Last System Backup</p>
            <p className="font-headline-sm text-headline-sm text-data-focus mb-1">2 hours ago</p>
            <p className="font-data-tabular text-data-tabular text-on-surface-variant">Location: US-East-Secure</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2 bg-surface-container-high border border-surface-border rounded overflow-hidden">
            <div className="bg-surface-container-low border-b border-surface-border px-6 py-4">
              <h2 className="font-headline-sm text-headline-sm text-data-focus">Access Control Management</h2>
            </div>
            <table className="w-full">
              <thead>
                <tr className="border-b border-surface-border">
                  <th className="text-left font-label-caps text-label-caps text-on-surface-variant uppercase px-4 py-3">Security Group</th>
                  <th className="text-left font-label-caps text-label-caps text-on-surface-variant uppercase px-4 py-3">Clearance</th>
                  <th className="text-center font-label-caps text-label-caps text-on-surface-variant uppercase px-4 py-3">Biometric MFA</th>
                  <th className="text-center font-label-caps text-label-caps text-on-surface-variant uppercase px-4 py-3">Physical Key</th>
                </tr>
              </thead>
              <tbody>
                {groups.map((g) => (
                  <tr key={g.id} className="border-b border-surface-border">
                    <td className="px-4 py-4 font-body-md text-body-md text-on-surface font-semibold">{g.name}</td>
                    <td className="px-4 py-4 font-data-tabular text-data-tabular text-on-surface-variant">Level {g.clearance_level}</td>
                    <td className="px-4 py-4 text-center">
                      <button
                        onClick={() => handleToggle(g, "biometric_mfa")}
                        className={`w-10 h-5 rounded-full relative transition-colors ${g.biometric_mfa ? "bg-status-success" : "bg-surface-border"}`}
                      >
                        <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all ${g.biometric_mfa ? "left-5" : "left-0.5"}`} />
                      </button>
                    </td>
                    <td className="px-4 py-4 text-center">
                      <button
                        onClick={() => handleToggle(g, "physical_key_required")}
                        className={`w-10 h-5 rounded-full relative transition-colors ${g.physical_key_required ? "bg-status-success" : "bg-surface-border"}`}
                      >
                        <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all ${g.physical_key_required ? "left-5" : "left-0.5"}`} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="bg-surface-container-high border border-surface-border rounded p-6">
            <h2 className="font-headline-sm text-headline-sm text-data-focus mb-6">Session Governance</h2>
            <div className="mb-6">
              <div className="flex justify-between mb-2">
                <label className="font-label-caps text-label-caps text-on-surface-variant uppercase">Auto-Logout Timer</label>
                <span className="font-data-tabular text-data-tabular text-data-focus">{autoLogout} Minutes</span>
              </div>
              <input type="range" min={5} max={60} step={5} value={autoLogout} onChange={(e) => setAutoLogout(Number(e.target.value))} className="w-full" />
            </div>
            <div className="mb-6">
              <label className="font-label-caps text-label-caps text-on-surface-variant uppercase block mb-2">Concurrent Session Limit</label>
              <div className="flex gap-2">
                {[1, 2, 3].map((n) => (
                  <button
                    key={n}
                    onClick={() => setSessionLimit(n)}
                    className={`flex-1 py-2 rounded font-label-caps text-label-caps border ${sessionLimit === n ? "border-2 border-primary text-primary" : "border-surface-border text-on-surface-variant"}`}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>
            {saveMessage && (
              <p className={`font-data-tabular text-data-tabular mb-3 ${saveMessage.startsWith("Couldn't") ? "text-status-critical" : "text-status-success"}`}>
                {saveMessage}
              </p>
            )}
            <button
              onClick={handleSavePolicies}
              className="w-full bg-primary text-on-primary py-3 rounded font-label-caps text-label-caps font-semibold"
            >
              SAVE POLICIES
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
