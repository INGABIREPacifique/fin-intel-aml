import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { useAuth } from "../lib/AuthContext";
import AdminSidebar from "../components/AdminSidebar";

const LEVELS = [1, 2, 3, 4, 5];
const LEVEL_LABELS = { 1: "Base", 2: "Analyst", 3: "Senior", 4: "Manager", 5: "Admin" };

export default function AccessPermissions() {
  const { session } = useAuth();
  const [permissions, setPermissions] = useState([]);
  const [accessMap, setAccessMap] = useState({}); // `${permId}-${level}` -> true
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  const load = async () => {
    setErrorMessage("");
    try {
      const [
        { data: permData, error: permErr },
        { data: accessData, error: accessErr },
        { data: requestData, error: requestErr },
      ] = await Promise.all([
        supabase.from("permission_domains").select("*").order("sort_order"),
        supabase.from("permission_access").select("*"),
        supabase.from("access_requests").select("*").order("id"),
      ]);
      const firstError = permErr || accessErr || requestErr;
      if (firstError) {
        setErrorMessage(firstError.message);
      } else {
        setPermissions(permData ?? []);
        const map = {};
        (accessData ?? []).forEach((a) => {
          map[`${a.permission_id}-${a.clearance_level}`] = true;
        });
        setAccessMap(map);
        setRequests(requestData ?? []);
      }
    } catch (err) {
      setErrorMessage(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const toggleCell = async (permId, level) => {
    const key = `${permId}-${level}`;
    const isGranted = accessMap[key];
    setErrorMessage("");

    const { error: writeErr } = isGranted
      ? await supabase.from("permission_access").delete().eq("permission_id", permId).eq("clearance_level", level)
      : await supabase.from("permission_access").insert({ permission_id: permId, clearance_level: level });

    if (writeErr) {
      setErrorMessage(`Couldn't update access: ${writeErr.message}`);
      return;
    }

    // Only reflect the change once the write is confirmed, so the matrix
    // never shows a permission state that isn't actually persisted.
    setAccessMap((prev) => ({ ...prev, [key]: !isGranted }));
    const { error: logErr } = await supabase.from("audit_logs").insert({
      actor_id: session.user.id,
      action: "permission_matrix_changed",
      target_type: "permission_domain",
      target_id: permId,
      details: { note: `Level ${level} access ${isGranted ? "revoked" : "granted"}` },
    });
    if (logErr) {
      setErrorMessage(`Access updated, but audit log failed: ${logErr.message}`);
    }
  };

  const handleDecision = async (request, status) => {
    setErrorMessage("");
    const { data, error } = await supabase.from("access_requests").update({ status }).eq("id", request.id).select().single();
    if (error) {
      setErrorMessage(`Couldn't ${status === "approved" ? "approve" : "deny"} request: ${error.message}`);
      return;
    }
    setRequests((prev) => prev.map((r) => (r.id === data.id ? data : r)));
    const { error: logErr } = await supabase.from("audit_logs").insert({
      actor_id: session.user.id,
      action: status === "approved" ? "access_request_approved" : "access_request_denied",
      target_type: "access_request",
      target_id: request.id,
      target_label: request.requester_name,
      details: { note: `Requested Level ${request.requested_level}` },
    });
    if (logErr) setErrorMessage(`Request ${status}, but audit log failed: ${logErr.message}`);
  };

  const pendingRequests = requests.filter((r) => r.status === "pending");

  return (
    <div className="min-h-screen bg-background text-on-surface flex">
      <AdminSidebar />
      <main className="flex-1 p-4 md:p-8 overflow-x-hidden">
        <div className="flex items-start justify-between border-b border-surface-border pb-6 mb-8">
          <div>
            <p className="font-label-caps text-label-caps text-data-focus uppercase mb-2">Security Hub</p>
            <h1 className="font-headline-lg text-headline-lg text-on-surface mb-2">Access &amp; Permissions Matrix</h1>
            <p className="font-body-md text-body-md text-on-surface-variant max-w-xl">
              Manage granular authorization levels and verify ongoing access requests across the intelligence platform.
            </p>
          </div>
        </div>

        {errorMessage && (
          <p className="font-data-tabular text-data-tabular text-status-critical mb-6">{errorMessage}</p>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2 bg-surface-container-high border border-surface-border rounded overflow-hidden">
            <div className="bg-surface-container-low border-b border-surface-border px-6 py-4 flex items-center justify-between">
              <h2 className="font-headline-sm text-headline-sm text-data-focus">Clearance Matrix</h2>
              <span className="font-data-tabular text-data-tabular text-on-surface-variant text-[11px]">Click a cell to grant/revoke</span>
            </div>
            <div className="overflow-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-surface-border bg-surface-container-low">
                    <th className="text-left font-label-caps text-label-caps text-on-surface-variant uppercase px-4 py-3">Permission Domain</th>
                    {LEVELS.map((lvl) => (
                      <th key={lvl} className="text-center font-label-caps text-label-caps text-on-surface-variant uppercase px-4 py-3">
                        L{lvl}<br /><span className="font-data-tabular text-data-tabular text-[10px] normal-case">{LEVEL_LABELS[lvl]}</span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {permissions.map((p) => (
                    <tr key={p.id} className="border-b border-surface-border">
                      <td className="px-4 py-4 font-body-md text-body-md text-on-surface">{p.name}</td>
                      {LEVELS.map((lvl) => {
                        const granted = accessMap[`${p.id}-${lvl}`];
                        return (
                          <td key={lvl} className="text-center px-4 py-4">
                            <button onClick={() => toggleCell(p.id, lvl)} className="mx-auto block">
                              {granted ? (
                                <span className="material-symbols-outlined text-status-success text-[20px]">check_circle</span>
                              ) : (
                                <span className="text-on-surface-variant">-</span>
                              )}
                            </button>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="bg-surface-container-high border border-surface-border rounded p-6">
            <div className="flex items-center justify-between border-b border-surface-border pb-4 mb-4">
              <h2 className="font-headline-sm text-headline-sm text-data-focus">Pending Requests</h2>
              {pendingRequests.length > 0 && (
                <span className="font-label-caps text-label-caps text-status-warning border border-status-warning bg-status-warning/10 rounded px-2 py-1">
                  {pendingRequests.length} Action Required
                </span>
              )}
            </div>
            <div className="space-y-4">
              {pendingRequests.length === 0 && (
                <p className="font-data-tabular text-data-tabular text-on-surface-variant">No pending requests.</p>
              )}
              {pendingRequests.map((r) => (
                <div key={r.id} className="bg-surface-container border border-surface-border rounded p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-surface-container-high border border-surface-border flex items-center justify-center">
                        <span className="font-body-md text-body-md text-on-surface">{r.initials}</span>
                      </div>
                      <div>
                        <p className="font-body-md text-body-md text-on-surface font-semibold">{r.requester_name}</p>
                        <p className="font-data-tabular text-data-tabular text-on-surface-variant">ID: {r.requester_id_label}</p>
                      </div>
                    </div>
                    <span className="font-label-caps text-label-caps text-secondary border border-secondary/40 bg-secondary/10 rounded px-2 py-1">
                      Req: L{r.requested_level}
                    </span>
                  </div>
                  <p className="font-body-md text-body-md text-on-surface-variant mb-4">{r.justification}</p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleDecision(r, "approved")}
                      className="flex-1 bg-status-success text-white py-2 rounded font-label-caps text-label-caps"
                    >
                      Approve
                    </button>
                    <button
                      onClick={() => handleDecision(r, "denied")}
                      className="flex-1 border border-surface-border text-on-surface py-2 rounded font-label-caps text-label-caps"
                    >
                      Deny
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
