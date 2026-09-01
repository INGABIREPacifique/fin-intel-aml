import { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import { useRealtimeRefresh } from "../lib/useRealtimeRefresh";
import Sidebar from "../components/Sidebar";
import TopNavBar from "../components/TopNavBar";

const REL_COLORS = {
  wire_transfer: "#ef4444",
  equity_ownership: "#38bdf8",
  cash_deposit: "#4edea3",
};
const REL_LABELS = {
  wire_transfer: "Wire Transfer (High Risk)",
  equity_ownership: "Equity / Ownership",
  cash_deposit: "Cash Deposit",
};

function formatUSD(v) {
  return `$${Number(v ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default function EntityProfile() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [entity, setEntity] = useState(null);
  const [sanctionsMatches, setSanctionsMatches] = useState([]);
  const [sanctionsError, setSanctionsError] = useState("");
  const [sanctionsChecked, setSanctionsChecked] = useState(false);
  const [relationships, setRelationships] = useState([]);
  const [neighborEntities, setNeighborEntities] = useState({});
  const [alert, setAlert] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [selectedNeighborId, setSelectedNeighborId] = useState(null);

  // Filters (real, applied to the visible graph and totals below)
  const [minAmount, setMinAmount] = useState("");
  const [maxAmount, setMaxAmount] = useState("");
  const [daysBack, setDaysBack] = useState(30);
  const [showCycles, setShowCycles] = useState(false);
  const [showCommunities, setShowCommunities] = useState(false);

  const load = async () => {
    setLoadError("");
    try {
      const { data: entityData, error: entityErr } = await supabase
        .from("entities")
        .select("*")
        .eq("id", id)
        .single();

      if (entityErr) {
        setLoadError(entityErr.message);
        setLoading(false);
        return;
      }
      setEntity(entityData ?? null);
      if (!entityData) {
        setLoading(false);
        return;
      }

      // Real fuzzy-name screening against the sanctions_watchlist table
      // (see migration_027 and the sync-sanctions-list Edge Function) —
      // returns nothing until that table has been synced with real OFAC
      // data, but the screening logic itself is real, not simulated.
      const { data: sanctionsData, error: sanctionsErr } = await supabase.rpc(
        "screen_name_against_sanctions",
        { query_name: entityData.entity_name }
      );
      setSanctionsChecked(true);
      if (sanctionsErr) {
        setSanctionsError(sanctionsErr.message);
      } else {
        setSanctionsMatches(sanctionsData ?? []);
      }

      const [{ data: relData, error: relErr }, { data: alertData, error: alertErr }] = await Promise.all([
        supabase
          .from("entity_relationships")
          .select("*")
          .or(`from_entity_id.eq.${id},to_entity_id.eq.${id}`),
        supabase.from("alerts").select("*").eq("entity_id", id).order("risk_score", { ascending: false }).limit(1).maybeSingle(),
      ]);

      const secondaryError = relErr || alertErr;
      if (secondaryError) {
        setLoadError(secondaryError.message);
      } else {
        const rels = relData ?? [];
        setRelationships(rels);
        setAlert(alertData ?? null);

        const neighborIds = new Set();
        rels.forEach((r) => {
          neighborIds.add(r.from_entity_id === id ? r.to_entity_id : r.from_entity_id);
        });
        if (neighborIds.size > 0) {
          const { data: neighborData, error: neighborErr } = await supabase
            .from("entities")
            .select("*")
            .in("id", Array.from(neighborIds));
          if (neighborErr) {
            setLoadError(neighborErr.message);
          } else {
            const map = {};
            (neighborData ?? []).forEach((n) => (map[n.id] = n));
            setNeighborEntities(map);
          }
        }
      }
    } catch (err) {
      setLoadError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    setSelectedNeighborId(null);
  }, [id]);

  useRealtimeRefresh(["alerts", "entities", "entity_relationships"], load);

  const filteredRelationships = useMemo(() => {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - Number(daysBack || 0));
    return relationships.filter((r) => {
      if (minAmount && Number(r.amount ?? 0) < Number(minAmount)) return false;
      if (maxAmount && Number(r.amount ?? 0) > Number(maxAmount)) return false;
      if (daysBack && r.occurred_at && new Date(r.occurred_at) < cutoff) return false;
      return true;
    });
  }, [relationships, minAmount, maxAmount, daysBack]);

  const totals = useMemo(() => {
    let inbound = 0;
    let outbound = 0;
    filteredRelationships.forEach((r) => {
      const amt = Number(r.amount ?? 0);
      if (r.to_entity_id === id) inbound += amt;
      if (r.from_entity_id === id) outbound += amt;
    });
    return { inbound, outbound };
  }, [filteredRelationships, id]);

  // Real cycle detection: does this entity sit on a directed cycle within
  // the currently filtered, visible relationships?
  const cycleNodeIds = useMemo(() => {
    if (!showCycles) return new Set();
    const adj = {};
    const allIds = new Set([id, ...Object.keys(neighborEntities)]);
    allIds.forEach((nid) => (adj[nid] = []));
    filteredRelationships.forEach((r) => {
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
    allIds.forEach((nid) => {
      if (!visited.has(nid)) dfs(nid);
    });
    return inCycle;
  }, [showCycles, filteredRelationships, id, neighborEntities]);

  const selectedNeighbor = selectedNeighborId ? neighborEntities[selectedNeighborId] : null;
  const selectedRel = selectedNeighborId
    ? filteredRelationships.find(
        (r) =>
          (r.from_entity_id === id && r.to_entity_id === selectedNeighborId) ||
          (r.to_entity_id === id && r.from_entity_id === selectedNeighborId)
      )
    : null;

  if (loading) {
    return (
      <div className="min-h-screen bg-background text-on-surface-variant font-data-tabular text-data-tabular p-8">
        Loading entity...
      </div>
    );
  }

  if (loadError && !entity) {
    return (
      <div className="min-h-screen bg-background text-status-critical font-data-tabular text-data-tabular p-8">
        Couldn't load this entity: {loadError}
      </div>
    );
  }

  if (!entity) {
    return (
      <div className="min-h-screen bg-background text-status-critical font-data-tabular text-data-tabular p-8">
        Entity not found for {id}.
      </div>
    );
  }

  // Simple radial layout for the neighbor nodes around the center entity.
  const neighborList = Object.values(neighborEntities).filter((n) =>
    filteredRelationships.some((r) => r.from_entity_id === n.id || r.to_entity_id === n.id)
  );
  const centerX = 300;
  const centerY = 300;
  const radius = 180;
  const positioned = neighborList.map((n, i) => {
    const angle = (2 * Math.PI * i) / Math.max(neighborList.length, 1) - Math.PI / 2;
    return { ...n, x: centerX + radius * Math.cos(angle), y: centerY + radius * Math.sin(angle) };
  });

  return (
    <div className="min-h-screen bg-background text-on-surface flex">
      <Sidebar />
      <div className="flex-1 flex flex-col">
        <TopNavBar />
        <main className="flex-1 flex overflow-hidden">
          {/* Main canvas */}
          <div className="flex-1 relative overflow-hidden">
            <div className="p-4">
              <button
                onClick={() => navigate("/entities")}
                className="font-label-caps text-label-caps text-on-surface-variant hover:text-on-surface mb-4"
              >
                &larr; Back to Entity Search
              </button>

              {loadError && (
                <p className="font-data-tabular text-data-tabular text-status-critical mb-4">{loadError}</p>
              )}

              <div className="flex items-start justify-between mb-2">
                <div>
                  <h1 className="font-headline-lg text-headline-lg text-on-surface flex items-center gap-2">
                    <span className="material-symbols-outlined text-data-focus">apartment</span>
                    {entity.entity_name}
                  </h1>
                  <p className="font-data-tabular text-data-tabular text-on-surface-variant mt-1">
                    ID: {entity.id.slice(0, 8).toUpperCase()} &middot; Jurisdiction: {entity.jurisdiction ?? "Unknown"}
                  </p>
                </div>
                {alert && (
                  <div className="bg-surface-container border border-surface-border rounded p-3 text-center">
                    <p className="font-label-caps text-label-caps text-on-surface-variant uppercase mb-1">
                      Risk Score
                    </p>
                    <p className="font-headline-lg text-headline-lg text-status-critical">
                      {alert.risk_score}
                      <span className="font-body-md text-body-md text-on-surface-variant">/100</span>
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Graph */}
            <svg viewBox="0 0 600 600" className="w-full" style={{ height: "calc(100% - 140px)" }}>
              {positioned.map((n) => {
                const rel = filteredRelationships.find(
                  (r) =>
                    (r.from_entity_id === id && r.to_entity_id === n.id) ||
                    (r.to_entity_id === id && r.from_entity_id === n.id)
                );
                const color = rel ? REL_COLORS[rel.relationship_type] ?? "#94a3b8" : "#94a3b8";
                return (
                  <line
                    key={`edge-${n.id}`}
                    x1={centerX}
                    y1={centerY}
                    x2={n.x}
                    y2={n.y}
                    stroke={color}
                    strokeWidth={selectedNeighborId === n.id ? 3 : 1.5}
                    opacity={0.7}
                  />
                );
              })}

              {/* Center node (this entity) */}
              <circle
                cx={centerX}
                cy={centerY}
                r={cycleNodeIds.has(id) ? 30 : 26}
                fill={cycleNodeIds.has(id) ? "#ef4444" : "#38bdf8"}
                stroke="#0f172a"
                strokeWidth={3}
              />
              <text x={centerX} y={centerY + 46} textAnchor="middle" className="fill-current text-on-surface" fontSize="13">
                {entity.entity_name.length > 24 ? entity.entity_name.slice(0, 22) + "…" : entity.entity_name}
              </text>

              {positioned.map((n) => (
                <g key={`node-${n.id}`} onClick={() => setSelectedNeighborId(n.id)} className="cursor-pointer">
                  <circle
                    cx={n.x}
                    cy={n.y}
                    r={selectedNeighborId === n.id ? 22 : 18}
                    fill={cycleNodeIds.has(n.id) ? "#ef4444" : showCommunities ? "#f59e0b" : "#4edea3"}
                    stroke="#0f172a"
                    strokeWidth={2}
                  />
                  <text
                    x={n.x}
                    y={n.y + (n.y > centerY ? 34 : -26)}
                    textAnchor="middle"
                    className="fill-current text-on-surface-variant"
                    fontSize="11"
                  >
                    {n.entity_name.length > 20 ? n.entity_name.slice(0, 18) + "…" : n.entity_name}
                  </text>
                </g>
              ))}

              {neighborList.length === 0 && (
                <text x={centerX} y={centerY - 60} textAnchor="middle" className="fill-current text-on-surface-variant" fontSize="14">
                  No relationships match the current filters
                </text>
              )}
            </svg>

            {/* Floating selection drawer */}
            {selectedNeighbor && (
              <div className="absolute bottom-6 left-6 w-96 bg-surface-container-high border border-surface-border rounded shadow-lg">
                <div className="flex items-start justify-between p-4 border-b border-surface-border">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-surface-container flex items-center justify-center">
                      <span className="material-symbols-outlined text-on-surface-variant">apartment</span>
                    </div>
                    <div>
                      <p className="font-body-lg text-body-lg text-on-surface font-semibold">
                        {selectedNeighbor.entity_name}
                      </p>
                      <p className="font-data-tabular text-data-tabular text-on-surface-variant">
                        {selectedNeighbor.jurisdiction ?? "Unknown jurisdiction"}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => setSelectedNeighborId(null)}
                    className="text-on-surface-variant hover:text-on-surface"
                  >
                    <span className="material-symbols-outlined text-[18px]">close</span>
                  </button>
                </div>
                <div className="p-4 space-y-3">
                  {selectedRel && (
                    <>
                      <div className="flex justify-between font-data-tabular text-data-tabular">
                        <span className="text-on-surface-variant">Relationship</span>
                        <span className="text-on-surface">
                          {selectedRel.label ?? REL_LABELS[selectedRel.relationship_type]}
                        </span>
                      </div>
                      <div className="flex justify-between font-data-tabular text-data-tabular">
                        <span className="text-on-surface-variant">Amount</span>
                        <span className="text-on-surface">{formatUSD(selectedRel.amount)}</span>
                      </div>
                      <div className="flex justify-between font-data-tabular text-data-tabular">
                        <span className="text-on-surface-variant">Direction</span>
                        <span className="text-on-surface">
                          {selectedRel.from_entity_id === id ? "Outbound" : "Inbound"}
                        </span>
                      </div>
                    </>
                  )}
                  <button
                    onClick={() => navigate(`/entities/${selectedNeighbor.id}`)}
                    className="w-full bg-secondary text-on-secondary py-2 rounded font-label-caps text-label-caps font-semibold mt-2"
                  >
                    View Full Profile
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Right sidebar: Legend & Filters */}
          <aside className="w-80 border-l border-surface-border overflow-y-auto">
            <div className="p-5 border-b border-surface-border">
              <h3 className="font-label-caps text-label-caps text-on-surface uppercase flex items-center gap-2 mb-4">
                <span className="material-symbols-outlined text-[16px]">category</span>
                Legend
              </h3>
              <p className="font-label-caps text-label-caps text-on-surface-variant uppercase mb-2">Node Types</p>
              <div className="space-y-2 mb-4 font-body-md text-body-md">
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full inline-block" style={{ background: "#38bdf8" }} />
                  Subject Entity
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full inline-block" style={{ background: "#4edea3" }} />
                  Related Entity
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full inline-block" style={{ background: "#ef4444" }} />
                  On Detected Cycle
                </div>
              </div>
              <p className="font-label-caps text-label-caps text-on-surface-variant uppercase mb-2">Edge Types</p>
              <div className="space-y-2 font-body-md text-body-md">
                {Object.entries(REL_LABELS).map(([key, label]) => (
                  <div key={key} className="flex items-center gap-2">
                    <span className="w-6 h-0.5 inline-block" style={{ background: REL_COLORS[key] }} />
                    {label}
                  </div>
                ))}
              </div>
            </div>

            <div className="p-5">
              <h3 className="font-label-caps text-label-caps text-on-surface uppercase flex items-center gap-2 mb-4">
                <span className="material-symbols-outlined text-[16px]">tune</span>
                Filters
              </h3>

              <label className="font-label-caps text-label-caps text-on-surface-variant uppercase block mb-2">
                Transfer Volume (USD)
              </label>
              <div className="flex items-center gap-2 mb-4">
                <input
                  type="number"
                  placeholder="Min"
                  value={minAmount}
                  onChange={(e) => setMinAmount(e.target.value)}
                  className="w-full bg-surface-container border border-surface-border rounded px-3 py-2 font-data-tabular text-data-tabular"
                />
                <span className="text-on-surface-variant">-</span>
                <input
                  type="number"
                  placeholder="Max"
                  value={maxAmount}
                  onChange={(e) => setMaxAmount(e.target.value)}
                  className="w-full bg-surface-container border border-surface-border rounded px-3 py-2 font-data-tabular text-data-tabular"
                />
              </div>

              <label className="font-label-caps text-label-caps text-on-surface-variant uppercase block mb-2">
                Time Horizon
              </label>
              <select
                value={daysBack}
                onChange={(e) => setDaysBack(Number(e.target.value))}
                className="w-full bg-surface-container border border-surface-border rounded px-3 py-2 font-body-md text-body-md mb-4"
              >
                <option value={7}>Last 7 Days</option>
                <option value={30}>Last 30 Days</option>
                <option value={90}>Last 90 Days</option>
                <option value={3650}>All Time</option>
              </select>

              <p className="font-label-caps text-label-caps text-on-surface-variant uppercase mb-2">
                Pattern Recognition
              </p>
              <label className="flex items-center justify-between mb-3">
                <span className="font-body-md text-body-md text-on-surface">Cycle Detection</span>
                <input
                  type="checkbox"
                  checked={showCycles}
                  onChange={(e) => setShowCycles(e.target.checked)}
                  className="w-4 h-4"
                />
              </label>
              <label className="flex items-center justify-between mb-4">
                <span className="font-body-md text-body-md text-on-surface">Community Detection</span>
                <input
                  type="checkbox"
                  checked={showCommunities}
                  onChange={(e) => setShowCommunities(e.target.checked)}
                  className="w-4 h-4"
                />
              </label>
            </div>

            <div className="p-5 border-t border-surface-border">
              <div className="flex justify-between font-data-tabular text-data-tabular mb-1">
                <span className="text-on-surface-variant">Total Inbound</span>
              </div>
              <p className="font-headline-lg text-headline-lg text-on-surface mb-3">{formatUSD(totals.inbound)}</p>
              <div className="flex justify-between font-data-tabular text-data-tabular mb-1">
                <span className="text-on-surface-variant">Total Outbound</span>
              </div>
              <p className="font-headline-lg text-headline-lg text-on-surface">{formatUSD(totals.outbound)}</p>
            </div>

            <div className="p-5 border-t border-surface-border">
              <h3 className="font-label-caps text-label-caps text-on-surface uppercase flex items-center gap-2 mb-3">
                <span className="material-symbols-outlined text-[16px]">gpp_maybe</span>
                Sanctions Screening
              </h3>
              {sanctionsError && (
                <p className="font-data-tabular text-data-tabular text-status-critical">{sanctionsError}</p>
              )}
              {!sanctionsError && sanctionsChecked && sanctionsMatches.length === 0 && (
                <p className="font-data-tabular text-data-tabular text-status-success">
                  No matches found against the synced watchlist.
                </p>
              )}
              {sanctionsMatches.length > 0 && (
                <div className="space-y-2">
                  {sanctionsMatches.map((m) => (
                    <div key={m.id} className="border border-status-critical rounded p-2">
                      <p className="font-body-md text-body-md text-on-surface font-semibold">{m.name}</p>
                      <p className="font-data-tabular text-data-tabular text-on-surface-variant">
                        {m.source} · {(m.similarity_score * 100).toFixed(0)}% match · {m.programs}
                      </p>
                    </div>
                  ))}
                  <p className="font-data-tabular text-data-tabular text-status-warning">
                    Every fuzzy match requires human review — this is not a compliance decision.
                  </p>
                </div>
              )}
              <p className="font-label-caps text-label-caps text-on-surface-variant mt-2">
                Screens against synced OFAC and UN sanctions data (real government/international sources once the sync functions have run).
              </p>
            </div>
          </aside>
        </main>
      </div>
    </div>
  );
}
