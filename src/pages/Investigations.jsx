import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import Sidebar from "../components/Sidebar";
import TopNavBar from "../components/TopNavBar";

export default function Investigations() {
  const navigate = useNavigate();
  const [cases, setCases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("all");

  useEffect(() => {
    async function load() {
      const { data, error } = await supabase
        .from("cases")
        .select("*, entities(entity_name, jurisdiction)")
        .order("created_at", { ascending: false });
      if (!error) setCases(data);
      setLoading(false);
    }
    load();
  }, []);

  const filtered = cases.filter((c) => statusFilter === "all" || c.status === statusFilter);

  const riskColors = {
    critical: "text-status-critical border-status-critical bg-error-container/20",
    high: "text-status-warning border-status-warning bg-status-warning/10",
    medium: "text-secondary border-secondary bg-secondary/10",
    low: "text-on-surface-variant border-surface-border bg-surface-container-high",
  };

  return (
    <div className="min-h-screen bg-background text-on-surface flex">
      <Sidebar />
      <div className="flex-1 flex flex-col">
        <TopNavBar />
        <main className="flex-1 p-8">
          <h1 className="font-headline-lg text-headline-lg text-on-surface mb-2">Investigations</h1>
          <p className="font-body-md text-body-md text-on-surface-variant mb-8">
            Open and resolved cases across the institution.
          </p>

          <div className="flex gap-4 mb-6">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-surface-container border border-surface-border text-on-surface font-label-caps text-label-caps px-4 py-2 rounded focus:outline-none focus:border-data-focus"
            >
              <option value="all">All Statuses</option>
              <option value="active">Active</option>
              <option value="resolved">Resolved</option>
            </select>
          </div>

          <div className="bg-surface-container border border-surface-border rounded divide-y divide-surface-border">
            {loading && (
              <p className="p-6 font-data-tabular text-data-tabular text-on-surface-variant">Loading cases...</p>
            )}
            {!loading && filtered.length === 0 && (
              <p className="p-6 font-data-tabular text-data-tabular text-on-surface-variant">
                No cases match this filter.
              </p>
            )}
            {filtered.map((c) => (
              <div
                key={c.id}
                onClick={() => navigate(`/cases/${c.case_code}`)}
                className="p-5 flex items-center justify-between hover:bg-surface-container-high transition-colors cursor-pointer"
              >
                <div>
                  <p className="font-data-tabular text-data-tabular text-data-focus mb-1">
                    {c.case_code} · {c.entities?.jurisdiction}
                  </p>
                  <p className="font-body-lg text-body-lg text-on-surface font-semibold">{c.title}</p>
                  <p className="font-body-md text-body-md text-on-surface-variant mt-1">
                    {c.entities?.entity_name}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span
                    className={`font-label-caps text-label-caps px-3 py-1 rounded-full border ${
                      riskColors[c.risk_level] ?? riskColors.low
                    }`}
                  >
                    {c.risk_level.toUpperCase()}
                  </span>
                  <span
                    className={`font-label-caps text-label-caps px-3 py-1 rounded-full border ${
                      c.status === "resolved"
                        ? "text-status-success border-status-success bg-status-success/10"
                        : "text-on-surface-variant border-surface-border"
                    }`}
                  >
                    {c.status.toUpperCase()}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </main>
      </div>
    </div>
  );
}
