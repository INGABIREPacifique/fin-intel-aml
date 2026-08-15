import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import Sidebar from "../components/Sidebar";
import TopNavBar from "../components/TopNavBar";

const REL_COLORS = {
  wire_transfer: "#ef4444",
  equity_ownership: "#38bdf8",
  cash_deposit: "#4edea3",
};

export default function GraphExplorer() {
  const [entities, setEntities] = useState([]);
  const [relationships, setRelationships] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [riskThreshold, setRiskThreshold] = useState(0);
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    async function load() {
      const [{ data: entityData }, { data: relData }, { data: alertData }] = await Promise.all([
        supabase.from("entities").select("*"),
        supabase.from("entity_relationships").select("*"),
        supabase.from("alerts").select("entity_id, risk_score, pattern"),
      ]);
      setEntities(entityData ?? []);
      setRelationships(relData ?? []);
      setAlerts(alertData ?? []);
      setLoading(false);
    }
    load();
  }, []);

  const riskByEntity = useMemo(() => {
    const map = {};
    alerts.forEach((a) => {
      if (!map[a.entity_id] || a.risk_score > map[a.entity_id].risk_score) map[a.entity_id] = a;
    });
    return map;
  }, [alerts]);

  const filteredEntities = entities.filter((e) => {
    const matchesSearch = e.entity_name.toLowerCase().includes(search.toLowerCase());
    const risk = riskByEntity[e.id]?.risk_score ?? 0;
    const matchesRisk = risk >= riskThreshold;
    return matchesSearch && matchesRisk;
  });

  const visibleIds = new Set(filteredEntities.map((e) => e.id));
  const visibleRelationships = relationships.filter(
    (r) => visibleIds.has(r.from_entity_id) && visibleIds.has(r.to_entity_id)
  );

  // Simple circular layout — real data positions, not a physics-simulated
  // force-directed graph (that would need a real graph-layout engine).
  const radius = 220;
  const center = 280;
  const positions = {};
  filteredEntities.forEach((e, i) => {
    const angle = (i / Math.max(1, filteredEntities.length)) * 2 * Math.PI;
    positions[e.id] = {
      x: center + radius * Math.cos(angle),
      y: center + radius * Math.sin(angle),
    };
  });

  const selectedRelationships = selected
    ? relationships.filter((r) => r.from_entity_id === selected.id || r.to_entity_id === selected.id)
    : [];

  return (
    <div className="min-h-screen bg-background text-on-surface flex">
      <Sidebar />
      <div className="flex-1 flex flex-col">
        <TopNavBar />
        <main className="flex-1 p-8">
          <h1 className="font-headline-lg text-headline-lg text-on-surface mb-1">Graph Explorer</h1>
          <p className="font-body-md text-body-md text-on-surface-variant mb-6">
            Browse all entities as a network — not tied to a single case.
          </p>

          <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
            <div className="lg:col-span-3 bg-surface-container border border-surface-border rounded p-6 relative">
              {loading && (
                <p className="font-data-tabular text-data-tabular text-on-surface-variant">Loading graph...</p>
              )}
              {!loading && (
                <svg viewBox="0 0 560 560" className="w-full h-[560px]">
                  {visibleRelationships.map((r) => {
                    const from = positions[r.from_entity_id];
                    const to = positions[r.to_entity_id];
                    if (!from || !to) return null;
                    return (
                      <line
                        key={r.id}
                        x1={from.x}
                        y1={from.y}
                        x2={to.x}
                        y2={to.y}
                        stroke={REL_COLORS[r.relationship_type] ?? "#909097"}
                        strokeWidth="1.5"
                        opacity="0.6"
                      />
                    );
                  })}
                  {filteredEntities.map((e) => {
                    const pos = positions[e.id];
                    const risk = riskByEntity[e.id]?.risk_score;
                    const color = risk >= 90 ? "#ef4444" : risk >= 70 ? "#f59e0b" : e.watchlisted ? "#f59e0b" : "#4edea3";
                    return (
                      <g
                        key={e.id}
                        transform={`translate(${pos.x},${pos.y})`}
                        onClick={() => setSelected(e)}
                        className="cursor-pointer"
                      >
                        <circle
                          r={selected?.id === e.id ? 16 : 12}
                          fill={color}
                          opacity={selected?.id === e.id ? 1 : 0.85}
                          stroke={selected?.id === e.id ? "#ffffff" : "none"}
                          strokeWidth="2"
                        />
                        <text y="28" textAnchor="middle" fontSize="10" fill="#c6c6cd">
                          {e.entity_name.length > 18 ? e.entity_name.slice(0, 16) + "…" : e.entity_name}
                        </text>
                      </g>
                    );
                  })}
                </svg>
              )}
            </div>

            <div className="flex flex-col gap-4">
              <div className="bg-surface-container border border-surface-border rounded p-5">
                <label className="font-label-caps text-label-caps text-on-surface-variant uppercase block mb-2">
                  Search
                </label>
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Entity name..."
                  className="w-full bg-primary-container border border-surface-border text-on-surface px-3 py-2 rounded text-sm focus:outline-none focus:border-data-focus mb-4"
                />
                <label className="font-label-caps text-label-caps text-on-surface-variant uppercase block mb-2">
                  Risk Threshold: {riskThreshold}
                </label>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={riskThreshold}
                  onChange={(e) => setRiskThreshold(Number(e.target.value))}
                  className="w-full"
                />
              </div>

              <div className="bg-surface-container border border-surface-border rounded p-5">
                <h2 className="font-headline-sm text-headline-sm text-on-surface mb-3">Entity Inspector</h2>
                {!selected && (
                  <p className="font-data-tabular text-data-tabular text-on-surface-variant">
                    Click a node to inspect.
                  </p>
                )}
                {selected && (
                  <div className="space-y-3">
                    <p className="font-body-lg text-body-lg text-on-surface font-semibold">
                      {selected.entity_name}
                    </p>
                    <p className="font-data-tabular text-data-tabular text-on-surface-variant">
                      {selected.entity_type} · {selected.jurisdiction ?? "—"}
                    </p>
                    {selected.watchlisted && (
                      <span className="inline-block font-label-caps text-label-caps text-status-warning border border-status-warning px-2 py-0.5 rounded">
                        WATCHLISTED
                      </span>
                    )}
                    {riskByEntity[selected.id] && (
                      <p className="font-data-tabular text-data-tabular text-status-critical">
                        Risk: {riskByEntity[selected.id].risk_score} ({riskByEntity[selected.id].pattern})
                      </p>
                    )}
                    <div className="border-t border-surface-border pt-3">
                      <p className="font-label-caps text-label-caps text-on-surface-variant uppercase mb-2">
                        Suspicious Links
                      </p>
                      {selectedRelationships.length === 0 && (
                        <p className="font-data-tabular text-data-tabular text-on-surface-variant">None found.</p>
                      )}
                      {selectedRelationships.map((r) => {
                        const otherId = r.from_entity_id === selected.id ? r.to_entity_id : r.from_entity_id;
                        const other = entities.find((e) => e.id === otherId);
                        return (
                          <div key={r.id} className="mb-2">
                            <p className="font-data-tabular text-data-tabular text-on-surface">{other?.entity_name}</p>
                            <p className="font-data-tabular text-data-tabular text-on-surface-variant text-[11px]">{r.label}</p>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
