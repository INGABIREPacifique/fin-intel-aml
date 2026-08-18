import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { useAuth } from "../lib/AuthContext";
import Sidebar from "../components/Sidebar";
import TopNavBar from "../components/TopNavBar";

const REL_COLORS = {
  wire_transfer: "#ef4444",
  equity_ownership: "#38bdf8",
  cash_deposit: "#4edea3",
};
const COMMUNITY_PALETTE = ["#4edea3", "#38bdf8", "#f59e0b", "#c084fc", "#f472b6"];

// Real DFS-based cycle detection over the currently visible directed graph.
function detectCycleNodes(entityIds, relationships) {
  const adj = {};
  entityIds.forEach((id) => (adj[id] = []));
  relationships.forEach((r) => {
    if (adj[r.from_entity_id]) adj[r.from_entity_id].push(r.to_entity_id);
  });
  const inCycle = new Set();
  const visited = new Set();
  const stack = [];
  const stackSet = new Set();

  function dfs(node) {
    visited.add(node);
    stack.push(node);
    stackSet.add(node);
    for (const next of adj[node] ?? []) {
      if (stackSet.has(next)) {
        const idx = stack.indexOf(next);
        stack.slice(idx).forEach((n) => inCycle.add(n));
      } else if (!visited.has(next)) {
        dfs(next);
      }
    }
    stack.pop();
    stackSet.delete(node);
  }

  entityIds.forEach((id) => {
    if (!visited.has(id)) dfs(id);
  });
  return inCycle;
}

// Real connected-components (union-find) over the visible undirected graph.
function detectCommunities(entityIds, relationships) {
  const parent = {};
  entityIds.forEach((id) => (parent[id] = id));
  function find(x) {
    while (parent[x] !== x) {
      parent[x] = parent[parent[x]];
      x = parent[x];
    }
    return x;
  }
  function union(a, b) {
    const ra = find(a);
    const rb = find(b);
    if (ra !== rb) parent[ra] = rb;
  }
  relationships.forEach((r) => {
    if (parent[r.from_entity_id] !== undefined && parent[r.to_entity_id] !== undefined) {
      union(r.from_entity_id, r.to_entity_id);
    }
  });
  const rootToColor = {};
  let nextColor = 0;
  const community = {};
  entityIds.forEach((id) => {
    const root = find(id);
    if (rootToColor[root] === undefined) {
      rootToColor[root] = COMMUNITY_PALETTE[nextColor % COMMUNITY_PALETTE.length];
      nextColor++;
    }
    community[id] = rootToColor[root];
  });
  return community;
}

export default function GraphExplorer() {
  const { profile } = useAuth();
  const isAdvanced = profile?.role === "compliance_officer" || profile?.role === "admin";

  const [entities, setEntities] = useState([]);
  const [relationships, setRelationships] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);

  // Officer/Admin tier controls
  const [search, setSearch] = useState("");
  const [riskThreshold, setRiskThreshold] = useState(0);

  // Investigator tier controls
  const [volumeMin, setVolumeMin] = useState(0);
  const [timeHorizonDays, setTimeHorizonDays] = useState(90);
  const [cycleDetection, setCycleDetection] = useState(false);
  const [communityDetection, setCommunityDetection] = useState(false);

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

  // Relationship-level filters differ by tier, then entities visible are
  // whichever still appear in at least one surviving relationship (or all,
  // for the officer/admin search-driven view).
  const relFilteredByTier = relationships.filter((r) => {
    if (!isAdvanced) {
      const withinVolume = (r.amount ?? 0) >= volumeMin;
      const cutoff = Date.now() - timeHorizonDays * 24 * 60 * 60 * 1000;
      const withinTime = new Date(r.occurred_at).getTime() >= cutoff;
      return withinVolume && withinTime;
    }
    return true;
  });

  const filteredEntities = entities.filter((e) => {
    if (isAdvanced) {
      const matchesSearch = e.entity_name.toLowerCase().includes(search.toLowerCase());
      const risk = riskByEntity[e.id]?.risk_score ?? 0;
      return matchesSearch && risk >= riskThreshold;
    }
    return relFilteredByTier.some((r) => r.from_entity_id === e.id || r.to_entity_id === e.id);
  });

  const visibleIds = new Set(filteredEntities.map((e) => e.id));
  const visibleRelationships = (isAdvanced ? relationships : relFilteredByTier).filter(
    (r) => visibleIds.has(r.from_entity_id) && visibleIds.has(r.to_entity_id)
  );

  const cycleNodes = useMemo(
    () => (cycleDetection ? detectCycleNodes([...visibleIds], visibleRelationships) : new Set()),
    [cycleDetection, visibleRelationships, filteredEntities]
  );
  const communityColors = useMemo(
    () => (communityDetection ? detectCommunities([...visibleIds], visibleRelationships) : {}),
    [communityDetection, visibleRelationships, filteredEntities]
  );

  const radius = 220;
  const center = 280;
  const positions = {};
  filteredEntities.forEach((e, i) => {
    const angle = (i / Math.max(1, filteredEntities.length)) * 2 * Math.PI;
    positions[e.id] = { x: center + radius * Math.cos(angle), y: center + radius * Math.sin(angle) };
  });

  // Real inbound/outbound totals for the simple investigator-tier inspector
  const inboundOutbound = (entityId) => {
    const inbound = relationships.filter((r) => r.to_entity_id === entityId).reduce((s, r) => s + Number(r.amount ?? 0), 0);
    const outbound = relationships.filter((r) => r.from_entity_id === entityId).reduce((s, r) => s + Number(r.amount ?? 0), 0);
    return { inbound, outbound };
  };

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
            {!isAdvanced && " (Investigator view — real cycle & community detection, volume/time filters.)"}
          </p>

          <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
            <div className="lg:col-span-3 bg-surface-container border border-surface-border rounded p-6 relative">
              {loading && <p className="font-data-tabular text-data-tabular text-on-surface-variant">Loading graph...</p>}
              {!loading && (
                <svg viewBox="0 0 560 560" className="w-full h-[560px]">
                  {visibleRelationships.map((r) => {
                    const from = positions[r.from_entity_id];
                    const to = positions[r.to_entity_id];
                    if (!from || !to) return null;
                    const highlighted = cycleDetection && cycleNodes.has(r.from_entity_id) && cycleNodes.has(r.to_entity_id);
                    return (
                      <line
                        key={r.id}
                        x1={from.x}
                        y1={from.y}
                        x2={to.x}
                        y2={to.y}
                        stroke={highlighted ? "#ef4444" : REL_COLORS[r.relationship_type] ?? "#909097"}
                        strokeWidth={highlighted ? "3" : "1.5"}
                        opacity={highlighted ? "0.95" : "0.6"}
                      />
                    );
                  })}
                  {filteredEntities.map((e) => {
                    const pos = positions[e.id];
                    const risk = riskByEntity[e.id]?.risk_score;
                    let color = risk >= 90 ? "#ef4444" : risk >= 70 ? "#f59e0b" : e.watchlisted ? "#f59e0b" : "#4edea3";
                    if (communityDetection && communityColors[e.id]) color = communityColors[e.id];
                    const inCycle = cycleDetection && cycleNodes.has(e.id);
                    return (
                      <g key={e.id} transform={`translate(${pos.x},${pos.y})`} onClick={() => setSelected(e)} className="cursor-pointer">
                        {inCycle && <circle r="20" fill="none" stroke="#ef4444" strokeWidth="1.5" strokeDasharray="3 2" />}
                        <circle
                          r={selected?.id === e.id ? 16 : 12}
                          fill={color}
                          opacity={selected?.id === e.id ? 1 : 0.85}
                          stroke={selected?.id === e.id ? "#ffffff" : "none"}
                          strokeWidth="2"
                        />
                        <text y="28" textAnchor="middle" fontSize="10" fill="var(--color-on-surface-variant)">
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
                {isAdvanced ? (
                  <>
                    <label className="font-label-caps text-label-caps text-on-surface-variant uppercase block mb-2">Search</label>
                    <input
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      placeholder="Entity name..."
                      className="w-full bg-primary-container border border-surface-border text-on-surface px-3 py-2 rounded text-sm focus:outline-none focus:border-data-focus mb-4"
                    />
                    <label className="font-label-caps text-label-caps text-on-surface-variant uppercase block mb-2">
                      Risk Threshold: {riskThreshold}
                    </label>
                    <input type="range" min={0} max={100} value={riskThreshold} onChange={(e) => setRiskThreshold(Number(e.target.value))} className="w-full" />
                  </>
                ) : (
                  <>
                    <label className="font-label-caps text-label-caps text-on-surface-variant uppercase block mb-2">
                      Min Transfer Volume: ${volumeMin.toLocaleString()}
                    </label>
                    <input type="range" min={0} max={5000000} step={50000} value={volumeMin} onChange={(e) => setVolumeMin(Number(e.target.value))} className="w-full mb-4" />
                    <label className="font-label-caps text-label-caps text-on-surface-variant uppercase block mb-2">Time Horizon</label>
                    <select
                      value={timeHorizonDays}
                      onChange={(e) => setTimeHorizonDays(Number(e.target.value))}
                      className="w-full bg-primary-container border border-surface-border text-on-surface px-3 py-2 rounded text-sm mb-4"
                    >
                      <option value={30}>Last 30 Days</option>
                      <option value={90}>Last 90 Days</option>
                      <option value={365}>Last Year</option>
                    </select>
                    <label className="flex items-center gap-2 font-data-tabular text-data-tabular text-on-surface-variant mb-2">
                      <input type="checkbox" checked={cycleDetection} onChange={(e) => setCycleDetection(e.target.checked)} />
                      Cycle Detection (real DFS)
                    </label>
                    <label className="flex items-center gap-2 font-data-tabular text-data-tabular text-on-surface-variant">
                      <input type="checkbox" checked={communityDetection} onChange={(e) => setCommunityDetection(e.target.checked)} />
                      Community Detection (real)
                    </label>
                  </>
                )}
              </div>

              <div className="bg-surface-container border border-surface-border rounded p-5">
                <h2 className="font-headline-sm text-headline-sm text-secondary mb-3">
                  {isAdvanced ? "Entity Inspector" : "Entity Details"}
                </h2>
                {!selected && <p className="font-data-tabular text-data-tabular text-on-surface-variant">Click a node to inspect.</p>}
                {selected && !isAdvanced && (
                  <div className="space-y-3">
                    <p className="font-body-lg text-body-lg text-on-surface font-semibold">{selected.entity_name}</p>
                    <p className="font-data-tabular text-data-tabular text-on-surface-variant">
                      {selected.entity_type} · {selected.jurisdiction ?? "—"}
                    </p>
                    {selected.watchlisted && (
                      <span className="inline-block font-label-caps text-label-caps text-status-warning border border-status-warning px-2 py-0.5 rounded">
                        WATCHLISTED
                      </span>
                    )}
                    <div className="border-t border-surface-border pt-3 grid grid-cols-2 gap-3">
                      <div>
                        <p className="font-label-caps text-label-caps text-on-surface-variant uppercase">Inbound</p>
                        <p className="font-data-tabular text-data-tabular text-status-success">
                          ${inboundOutbound(selected.id).inbound.toLocaleString()}
                        </p>
                      </div>
                      <div>
                        <p className="font-label-caps text-label-caps text-on-surface-variant uppercase">Outbound</p>
                        <p className="font-data-tabular text-data-tabular text-status-critical">
                          ${inboundOutbound(selected.id).outbound.toLocaleString()}
                        </p>
                      </div>
                    </div>
                  </div>
                )}
                {selected && isAdvanced && (
                  <div className="space-y-3">
                    <p className="font-body-lg text-body-lg text-on-surface font-semibold">{selected.entity_name}</p>
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
                      <p className="font-label-caps text-label-caps text-on-surface-variant uppercase mb-2">Suspicious Links</p>
                      {selectedRelationships.length === 0 && <p className="font-data-tabular text-data-tabular text-on-surface-variant">None found.</p>}
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
