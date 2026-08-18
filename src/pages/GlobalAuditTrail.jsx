import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { useAuth } from "../lib/AuthContext";
import Sidebar from "../components/Sidebar";
import TopNavBar from "../components/TopNavBar";

export default function GlobalAuditTrail() {
  const { session } = useAuth();
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionFilter, setActionFilter] = useState("all");
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    async function load() {
      const { data, error } = await supabase
        .from("audit_logs")
        .select("*, profiles(full_name)")
        .order("created_at", { ascending: false });
      if (!error) {
        setEntries(data);
        if (data.length > 0) setSelected(data[0]);
      }
      setLoading(false);
    }
    load();
  }, []);

  const actionTypes = ["all", ...new Set(entries.map((e) => e.action))];
  const filtered = actionFilter === "all" ? entries : entries.filter((e) => e.action === actionFilter);

  const handleFlag = async () => {
    if (!selected) return;
    const { data, error } = await supabase
      .from("audit_logs")
      .update({ status: "flagged" })
      .eq("id", selected.id)
      .select()
      .single();
    if (!error) {
      setSelected(data);
      setEntries((prev) => prev.map((e) => (e.id === data.id ? data : e)));
    }
  };

  const statusStyle = (status) => {
    if (status === "flagged") return "text-status-warning border-status-warning bg-status-warning/10";
    if (status === "error") return "text-status-critical border-status-critical bg-error-container/20";
    return "text-status-success border-status-success bg-status-success/10";
  };

  return (
    <div className="min-h-screen bg-background text-on-surface flex">
      <Sidebar />
      <div className="flex-1 flex flex-col">
        <TopNavBar />
        <main className="flex-1 p-8">
          <div className="flex items-center justify-between mb-2">
            <h1 className="font-headline-lg text-headline-lg text-on-surface">Global Audit Trail</h1>
          </div>
          <p className="font-body-md text-body-md text-on-surface-variant mb-6">
            Immutable system-wide log of every recorded action, for full explainability.
          </p>

          <div className="flex items-center gap-3 mb-4">
            <select
              value={actionFilter}
              onChange={(e) => setActionFilter(e.target.value)}
              className="bg-surface-container border border-surface-border text-on-surface font-label-caps text-label-caps px-4 py-2 rounded focus:outline-none focus:border-data-focus"
            >
              {actionTypes.map((a) => (
                <option key={a} value={a}>
                  {a === "all" ? "All Actions" : a.replace(/_/g, " ")}
                </option>
              ))}
            </select>
            <span className="font-data-tabular text-data-tabular text-on-surface-variant">
              {filtered.length} events
            </span>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="lg:col-span-2 bg-surface-container border border-surface-border rounded overflow-hidden">
              <div className="overflow-auto max-h-[600px]">
                <table className="w-full">
                  <thead className="sticky top-0 bg-surface-container-high z-10">
                    <tr>
                      <th className="text-left font-label-caps text-label-caps text-on-surface-variant uppercase px-4 py-3">
                        Timestamp (UTC)
                      </th>
                      <th className="text-left font-label-caps text-label-caps text-on-surface-variant uppercase px-4 py-3">
                        Action
                      </th>
                      <th className="text-left font-label-caps text-label-caps text-on-surface-variant uppercase px-4 py-3">
                        Operator
                      </th>
                      <th className="text-left font-label-caps text-label-caps text-on-surface-variant uppercase px-4 py-3">
                        Target
                      </th>
                      <th className="text-right font-label-caps text-label-caps text-on-surface-variant uppercase px-4 py-3">
                        Status
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {loading && (
                      <tr>
                        <td colSpan={5} className="p-6 font-data-tabular text-data-tabular text-on-surface-variant">
                          Loading...
                        </td>
                      </tr>
                    )}
                    {!loading && filtered.length === 0 && (
                      <tr>
                        <td colSpan={5} className="p-6 font-data-tabular text-data-tabular text-on-surface-variant">
                          No audit entries yet.
                        </td>
                      </tr>
                    )}
                    {filtered.map((e) => (
                      <tr
                        key={e.id}
                        onClick={() => setSelected(e)}
                        className={`border-t border-surface-border cursor-pointer hover:bg-surface-container-high transition-colors ${
                          selected?.id === e.id ? "bg-surface-container-highest border-l-2 border-l-secondary" : ""
                        }`}
                      >
                        <td className="px-4 py-3 font-data-tabular text-data-tabular text-on-surface-variant whitespace-nowrap">
                          {new Date(e.created_at).toISOString().slice(0, 16).replace("T", " ")}
                        </td>
                        <td className="px-4 py-3 font-data-tabular text-data-tabular text-on-surface">
                          {e.action.replace(/_/g, " ")}
                        </td>
                        <td className="px-4 py-3 font-data-tabular text-data-tabular text-secondary">
                          {e.profiles?.full_name ?? "SYSTEM"}
                        </td>
                        <td className="px-4 py-3 font-data-tabular text-data-tabular text-on-surface">
                          {e.target_label ?? e.target_type}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <span className={`font-label-caps text-label-caps px-2 py-0.5 rounded border ${statusStyle(e.status)}`}>
                            {e.status.toUpperCase()}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="bg-surface-container border border-surface-border rounded p-5">
              <h2 className="font-headline-sm text-headline-sm text-secondary mb-4">Event Inspector</h2>
              {!selected && (
                <p className="font-data-tabular text-data-tabular text-on-surface-variant">
                  Select an event from the table.
                </p>
              )}
              {selected && (
                <div className="space-y-4">
                  <p className="font-body-lg text-body-lg text-on-surface font-semibold">
                    {selected.action.replace(/_/g, " ")}
                  </p>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="font-label-caps text-label-caps text-on-surface-variant uppercase mb-1">
                        Timestamp
                      </p>
                      <p className="font-data-tabular text-data-tabular text-on-surface">
                        {new Date(selected.created_at).toISOString().slice(0, 19).replace("T", " ")}
                      </p>
                    </div>
                    <div>
                      <p className="font-label-caps text-label-caps text-on-surface-variant uppercase mb-1">
                        Operator
                      </p>
                      <p className="font-data-tabular text-data-tabular text-secondary">
                        {selected.profiles?.full_name ?? "SYSTEM"}
                      </p>
                    </div>
                    <div>
                      <p className="font-label-caps text-label-caps text-on-surface-variant uppercase mb-1">
                        Target Type
                      </p>
                      <p className="font-data-tabular text-data-tabular text-on-surface">{selected.target_type}</p>
                    </div>
                    <div>
                      <p className="font-label-caps text-label-caps text-on-surface-variant uppercase mb-1">
                        Target
                      </p>
                      <p className="font-data-tabular text-data-tabular text-on-surface">
                        {selected.target_label ?? "—"}
                      </p>
                    </div>
                  </div>

                  <div className="border-t border-surface-border pt-4">
                    <p className="font-label-caps text-label-caps text-on-surface-variant uppercase mb-2">
                      Configuration Change Diff
                    </p>
                    <p className="font-data-tabular text-data-tabular text-on-surface-variant bg-surface-container-low border border-surface-border rounded p-3">
                      No configuration diff recorded for this event type.
                    </p>
                  </div>

                  {selected.details?.note && (
                    <div className="bg-surface-container-low border border-surface-border rounded p-3">
                      <p className="font-label-caps text-label-caps text-on-surface-variant uppercase mb-1">
                        System Context
                      </p>
                      <p className="font-body-md text-body-md text-on-surface">{selected.details.note}</p>
                    </div>
                  )}

                  <button
                    onClick={handleFlag}
                    disabled={selected.status === "flagged"}
                    className="w-full border border-status-critical/50 text-status-critical py-2 rounded font-label-caps text-label-caps hover:bg-status-critical/10 transition-colors disabled:opacity-50"
                  >
                    {selected.status === "flagged" ? "Already Flagged" : "Flag for Review"}
                  </button>
                </div>
              )}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
