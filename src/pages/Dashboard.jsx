import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import { useRealtimeRefresh } from "../lib/useRealtimeRefresh";
import Sidebar from "../components/Sidebar";
import TopNavBar from "../components/TopNavBar";
import JurisdictionMap from "../components/JurisdictionMap";
import { useAuth } from "../lib/AuthContext";

function PatternTrendChart({ trends }) {
  const width = 600;
  const height = 160;
  const padding = 20;
  const maxVal = Math.max(...trends.flatMap((t) => [t.structuring, t.circular_flow, t.pass_through]), 1);

  const toPoints = (key) =>
    trends
      .map((t, i) => {
        const x = padding + (i / (trends.length - 1)) * (width - padding * 2);
        const y = height - padding - (t[key] / maxVal) * (height - padding * 2);
        return `${x},${y}`;
      })
      .join(" ");

  const series = [
    { key: "structuring", color: "#ef4444", label: "Structuring" },
    { key: "circular_flow", color: "#f59e0b", label: "Circular" },
    { key: "pass_through", color: "#38bdf8", label: "Pass-Through" },
  ];

  return (
    <div>
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-[160px]">
        {[0.25, 0.5, 0.75].map((f) => (
          <line
            key={f}
            x1={padding}
            x2={width - padding}
            y1={padding + f * (height - padding * 2)}
            y2={padding + f * (height - padding * 2)}
            stroke="var(--color-surface-container-high)"
            strokeDasharray="4 4"
          />
        ))}
        {series.map((s) => (
          <polyline
            key={s.key}
            points={toPoints(s.key)}
            fill="none"
            stroke={s.color}
            strokeWidth="2"
          />
        ))}
      </svg>
      <div className="flex justify-between mt-2">
        {trends.map((t) => (
          <span key={t.week_label} className="font-data-tabular text-data-tabular text-on-surface-variant text-[10px]">
            {t.week_label}
          </span>
        ))}
      </div>
      <div className="flex gap-4 mt-3">
        {series.map((s) => (
          <div key={s.key} className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: s.color }} />
            <span className="font-data-tabular text-data-tabular text-on-surface text-[10px]">{s.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function Dashboard() {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  const firstName = profile?.full_name?.split(" ")[0] ?? "";
  const [alerts, setAlerts] = useState([]);
  const [resolvedCount, setResolvedCount] = useState(0);
  const [demoMetric, setDemoMetric] = useState(null);
  const [demoTrends, setDemoTrends] = useState([]);
  const [activeInstitutions, setActiveInstitutions] = useState(0);
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    const [
      { data: alertData, error: alertErr },
      { count: resolvedCountResult },
      { data: metricData },
      { data: trendData },
      { count: activeInstitutionCount, error: instErr },
    ] = await Promise.all([
      supabase.from("alerts").select("*, entities(entity_name, jurisdiction)").order("risk_score", { ascending: false }),
      supabase.from("cases").select("*", { count: "exact", head: true }).eq("status", "resolved"),
      supabase.from("demo_metrics").select("*").eq("key", "false_positive_rate").maybeSingle(),
      supabase.from("demo_pattern_trends").select("*").order("week_order", { ascending: true }),
      supabase.from("institutions").select("*", { count: "exact", head: true }).eq("status", "active"),
    ]);
    if (!alertErr) setAlerts(alertData);
    setResolvedCount(resolvedCountResult ?? 0);
    setDemoMetric(metricData);
    setDemoTrends(trendData ?? []);
    if (!instErr) setActiveInstitutions(activeInstitutionCount ?? 0);
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  useRealtimeRefresh(["alerts", "cases", "institutions"], loadData);

  const highRiskCount = alerts.filter((a) => a.risk_score >= 90).length;
  const totalVolumeProcessed = alerts.reduce((sum, a) => sum + Number(a.volume ?? 0), 0);
  const formatVolume = (v) => {
    if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`;
    if (v >= 1_000) return `$${(v / 1_000).toFixed(1)}K`;
    return `$${v.toLocaleString()}`;
  };

  // Real jurisdictional risk ranking, computed live from actual alert data.
  // Normalizes casing/aliases (e.g. "CAYMAN"/"cayman"/"Cayman Islands") so the
  // same real-world jurisdiction doesn't fragment into duplicate entries.
  const JURISDICTION_ALIASES = {
    cayman: "Cayman Islands",
    "cayman islands": "Cayman Islands",
    bvi: "British Virgin Islands",
    "british virgin islands": "British Virgin Islands",
  };
  const normalizeJurisdiction = (raw) => {
    if (!raw) return null;
    const key = raw.trim().toLowerCase();
    return JURISDICTION_ALIASES[key] || raw.trim();
  };
  const jurisdictionMap = {};
  alerts.forEach((a) => {
    const j = normalizeJurisdiction(a.entities?.jurisdiction);
    if (!j) return;
    if (!jurisdictionMap[j]) jurisdictionMap[j] = { count: 0, totalRisk: 0, volume: 0 };
    jurisdictionMap[j].count += 1;
    jurisdictionMap[j].totalRisk += a.risk_score;
    jurisdictionMap[j].volume += Number(a.volume ?? 0);
  });
  const jurisdictionRisk = Object.entries(jurisdictionMap)
    .map(([name, d]) => ({ name, count: d.count, avgRisk: Math.round(d.totalRisk / d.count), volume: d.volume }))
    .sort((a, b) => b.avgRisk - a.avgRisk);
  const maxJurisdictionRisk = Math.max(1, ...jurisdictionRisk.map((j) => j.avgRisk));
  const activeCount = alerts.filter((a) => a.status !== "closed").length;

  const bands = [
    { label: "CRIT", min: 90, max: 100, color: "#ef4444" },
    { label: "HIGH", min: 70, max: 89, color: "#f59e0b" },
    { label: "MED", min: 50, max: 69, color: "#4edea3" },
    { label: "LOW", min: 0, max: 49, color: "#334155" },
  ];
  const bandCounts = bands.map((b) => ({
    ...b,
    count: alerts.filter((a) => a.risk_score >= b.min && a.risk_score <= b.max).length,
  }));
  const maxBandCount = Math.max(1, ...bandCounts.map((b) => b.count));

  return (
    <div className="min-h-screen bg-background text-on-surface flex">
      <Sidebar />

      <div className="flex-1 flex flex-col">
        <TopNavBar />
        <main className="flex-1 p-4 md:p-8 overflow-x-hidden">
        <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-[#1e3a8a] to-[#0f172a] p-8 mb-8">
          <div className="absolute -right-10 -top-10 w-56 h-56 rounded-full bg-white/5" />
          <div className="absolute right-16 bottom-0 w-32 h-32 rounded-full bg-white/5" />
          <div className="relative z-10 max-w-xl">
            {profile && (
              <span className="inline-block bg-white/10 border border-white/20 text-white font-label-caps text-label-caps px-3 py-1 rounded-full mb-4">
                {profile.role.replace("_", " ").toUpperCase()} · {activeCount} Active Cases
              </span>
            )}
            <h1 className="font-headline-lg text-headline-lg text-white mb-2">
              {greeting}, {firstName || "there"}!
            </h1>
            <p className="font-body-lg text-body-lg text-white/70">
              {highRiskCount > 0
                ? `${highRiskCount} high-risk ${highRiskCount === 1 ? "flag needs" : "flags need"} your attention today.`
                : "No high-risk flags right now — good time to review open cases."}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-surface-container border border-surface-border p-4 rounded">
            <div className="flex items-start justify-between mb-3">
              <p className="font-label-caps text-label-caps text-on-surface-variant uppercase">
                Total Volume Processed
              </p>
              <span className="material-symbols-outlined text-on-surface-variant text-[18px]">database</span>
            </div>
            <p className="font-headline-lg text-headline-lg text-on-surface">
              {loading ? "…" : formatVolume(totalVolumeProcessed)}
            </p>
          </div>
          <div className="bg-surface-container border border-surface-border p-4 rounded">
            <div className="flex items-start justify-between mb-3">
              <p className="font-label-caps text-label-caps text-on-surface-variant uppercase">
                Active Institutions
              </p>
              <span className="material-symbols-outlined text-on-surface-variant text-[18px]">account_balance</span>
            </div>
            <p className="font-headline-lg text-headline-lg text-on-surface">
              {loading ? "…" : activeInstitutions}
            </p>
          </div>
          <div className="bg-surface-container border border-status-critical/30 p-4 rounded shadow-[0_0_15px_0_rgba(239,68,68,0.1)]">
            <div className="flex items-start justify-between mb-3">
              <p className="font-label-caps text-label-caps text-status-critical uppercase">
                High-Risk Flags
              </p>
              <span className="material-symbols-outlined text-status-critical text-[18px]">warning</span>
            </div>
            <p className="font-headline-lg text-headline-lg text-status-critical">
              {loading ? "…" : highRiskCount}
            </p>
          </div>
          <div className="bg-surface-container border border-surface-border p-4 rounded">
            <div className="flex items-start justify-between mb-3">
              <p className="font-label-caps text-label-caps text-on-surface-variant uppercase">
                False Positive Rate
              </p>
              <div className="flex items-center gap-1.5">
                <span className="font-data-tabular text-data-tabular text-[9px] text-on-surface-variant border border-surface-border rounded px-1.5 py-0.5">
                  DEMO
                </span>
                <span className="material-symbols-outlined text-on-surface-variant text-[18px]">query_stats</span>
              </div>
            </div>
            <p className="font-headline-lg text-headline-lg text-on-surface">
              {loading || !demoMetric ? "…" : `${demoMetric.value}%`}
            </p>
            {demoMetric?.trend_note && (
              <p className="font-data-tabular text-data-tabular text-status-success mt-1">
                {demoMetric.trend_note}
              </p>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <div className="bg-surface-container border border-surface-border rounded p-5 md:col-span-1">
            <h3 className="font-headline-sm text-headline-sm text-data-focus mb-1">Risk Distribution</h3>
            <p className="font-data-tabular text-data-tabular text-on-surface-variant mb-6">
              Distribution of flags by severity
            </p>
            <div className="flex items-end justify-center gap-4 h-[140px] border-b border-surface-border pb-2">
              {bandCounts.map((b) => (
                <div key={b.label} className="flex flex-col items-center gap-2">
                  <div
                    onClick={() => navigate(`/alerts?risk=${b.label.toLowerCase()}`)}
                    className="w-10 rounded-t cursor-pointer hover:opacity-100 transition-opacity"
                    style={{
                      height: `${Math.max(4, (b.count / maxBandCount) * 120)}px`,
                      backgroundColor: b.color,
                      opacity: 0.8,
                    }}
                    title={`${b.count} alerts — click to view`}
                  />
                </div>
              ))}
            </div>
            <div className="flex justify-center gap-4 mt-2">
              {bandCounts.map((b) => (
                <span key={b.label} className="w-10 text-center font-data-tabular text-data-tabular text-on-surface-variant text-[10px]">
                  {b.label}
                </span>
              ))}
            </div>
          </div>
          <div className="bg-surface-container border border-surface-border rounded p-5 md:col-span-2 relative">
            <span className="absolute top-5 right-5 font-data-tabular text-data-tabular text-[9px] text-on-surface-variant border border-surface-border rounded px-1.5 py-0.5">
              DEMO DATA
            </span>
            <h3 className="font-headline-sm text-headline-sm text-data-focus mb-1">Laundering Pattern Detection</h3>
            <p className="font-data-tabular text-data-tabular text-on-surface-variant mb-4">
              Structuring, Circular Flows, and Rapid Pass-Through trends
            </p>
            {demoTrends.length > 0 && (
              <PatternTrendChart trends={demoTrends} />
            )}
          </div>
        </div>

        {jurisdictionRisk.length > 0 && (
          <div className="bg-surface-container border border-surface-border rounded p-6 mb-8">
            <h3 className="font-headline-sm text-headline-sm text-data-focus mb-1">Global Jurisdictional Risk</h3>
            <p className="font-body-md text-body-md text-on-surface-variant mb-4">
              Real-time fund flow risk by entity jurisdiction — marker size reflects alert volume, color reflects average risk.
            </p>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2">
                <JurisdictionMap jurisdictionRisk={jurisdictionRisk} />
              </div>
              <div className="space-y-3">
                {jurisdictionRisk.map((j) => (
                  <div key={j.name} className="flex items-center justify-between">
                    <span className="font-data-tabular text-data-tabular text-on-surface truncate">{j.name}</span>
                    <span
                      className={`font-label-caps text-label-caps px-2 py-0.5 rounded border shrink-0 ${
                        j.avgRisk >= 90
                          ? "text-status-critical border-status-critical bg-status-critical/10"
                          : j.avgRisk >= 70
                          ? "text-status-warning border-status-warning bg-status-warning/10"
                          : "text-status-success border-status-success bg-status-success/10"
                      }`}
                    >
                      {j.avgRisk}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        <h3 className="font-headline-sm text-headline-sm text-data-focus mb-4">Alert Queue</h3>
        <div className="bg-surface-container border border-surface-border rounded divide-y divide-surface-border">
          {loading && (
            <p className="p-6 font-data-tabular text-data-tabular text-on-surface-variant">
              Loading live data...
            </p>
          )}
          {!loading && alerts.length === 0 && (
            <p className="p-6 font-data-tabular text-data-tabular text-on-surface-variant">
              No alerts found. Run the seed data in docs/schema.sql if this is unexpected.
            </p>
          )}
          {alerts.map((alert) => (
            <div
              key={alert.id}
              className="p-5 flex items-center justify-between hover:bg-surface-container-high transition-colors cursor-pointer"
              onClick={() => navigate(`/cases/${alert.case_code}`)}
            >
              <div>
                <p className="font-data-tabular text-data-tabular text-data-focus mb-1">
                  {alert.case_code}
                </p>
                <p className="font-body-lg text-body-lg text-on-surface font-semibold">
                  {alert.entities?.entity_name ?? "Unknown entity"}
                </p>
                <p className="font-body-md text-body-md text-on-surface-variant mt-1">
                  {alert.pattern} · ${Number(alert.volume).toLocaleString()} ({alert.window_label})
                </p>
              </div>
              <span
                className={`font-label-caps text-label-caps px-3 py-1 rounded-full border ${
                  alert.risk_score >= 90
                    ? "text-status-critical border-status-critical bg-error-container/20"
                    : "text-status-warning border-status-warning bg-status-warning/10"
                }`}
              >
                {alert.risk_score} RISK
              </span>
            </div>
          ))}
        </div>
      </main>
      </div>
    </div>
  );
}
