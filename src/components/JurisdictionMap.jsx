import { useEffect, useMemo, useState } from "react";
import { geoNaturalEarth1, geoPath } from "d3-geo";
import { feature } from "topojson-client";
import worldTopo from "world-atlas/countries-110m.json";
import { supabase } from "../lib/supabaseClient";

const width = 760;
const height = 380;

const JURISDICTION_ALIASES = {
  cayman: "Cayman Islands",
  "cayman islands": "Cayman Islands",
  bvi: "British Virgin Islands",
  "british virgin islands": "British Virgin Islands",
};
function normalizeJurisdiction(raw) {
  if (!raw) return null;
  const key = raw.trim().toLowerCase();
  return JURISDICTION_ALIASES[key] || raw.trim();
}

export default function JurisdictionMap({ jurisdictionRisk }) {
  const [coords, setCoords] = useState([]);
  const [links, setLinks] = useState([]);
  const [hovered, setHovered] = useState(null);

  useEffect(() => {
    async function load() {
      const [{ data: coordData }, { data: relData }, { data: entityData }] = await Promise.all([
        supabase.from("jurisdiction_coordinates").select("*"),
        supabase.from("entity_relationships").select("*"),
        supabase.from("entities").select("id, jurisdiction"),
      ]);
      setCoords(coordData ?? []);
      const jurisdictionByEntity = Object.fromEntries(
        (entityData ?? []).map((e) => [e.id, normalizeJurisdiction(e.jurisdiction)])
      );
      const crossLinks = (relData ?? [])
        .map((r) => ({ from: jurisdictionByEntity[r.from_entity_id], to: jurisdictionByEntity[r.to_entity_id] }))
        .filter((l) => l.from && l.to && l.from !== l.to);
      setLinks(crossLinks);
    }
    load();
  }, []);

  const { countries, projection, path } = useMemo(() => {
    const proj = geoNaturalEarth1().scale(120).translate([width / 2, height / 2]);
    const pathGen = geoPath(proj);
    const geoData = feature(worldTopo, worldTopo.objects.countries);
    return { countries: geoData.features, projection: proj, path: pathGen };
  }, []);

  const riskByJurisdiction = Object.fromEntries(jurisdictionRisk.map((j) => [j.name, j]));
  const points = coords
    .map((c) => {
      const risk = riskByJurisdiction[c.jurisdiction];
      if (!risk) return null;
      const projected = projection([c.lng, c.lat]);
      if (!projected) return null;
      return { ...c, ...risk, x: projected[0], y: projected[1] };
    })
    .filter(Boolean);
  const pointByName = Object.fromEntries(points.map((p) => [p.jurisdiction, p]));

  const colorFor = (avgRisk) => (avgRisk >= 90 ? "#ef4444" : avgRisk >= 70 ? "#f59e0b" : "#10b981");
  const iconFor = (avgRisk) => (avgRisk >= 90 ? "warning" : avgRisk >= 70 ? "flag" : "account_balance");

  const center = [width / 2, height / 2 - 10];
  const ringRadii = [100, 150, 190];

  return (
    <div className="relative rounded-lg overflow-hidden" style={{ background: "radial-gradient(ellipse at center, #10203f 0%, #060b1a 100%)" }}>
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto">
        <defs>
          <filter id="glow" x="-100%" y="-100%" width="300%" height="300%">
            <feGaussianBlur stdDeviation="4" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <filter id="lineGlow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="2.5" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* decorative graticule rings, like the reference's orbit lines */}
        {ringRadii.map((r) => (
          <circle key={r} cx={center[0]} cy={center[1]} r={r} fill="none" stroke="#2563eb" strokeOpacity="0.15" strokeDasharray="2 4" />
        ))}

        {countries.map((c, i) => (
          <path key={i} d={path(c)} fill="#152a52" stroke="#2c4a85" strokeWidth="0.4" />
        ))}

        {links.map((l, i) => {
          const from = pointByName[l.from];
          const to = pointByName[l.to];
          if (!from || !to) return null;
          const midX = (from.x + to.x) / 2;
          const midY = Math.min(from.y, to.y) - 35;
          return (
            <path
              key={i}
              d={`M ${from.x} ${from.y} Q ${midX} ${midY} ${to.x} ${to.y}`}
              fill="none"
              stroke="#38bdf8"
              strokeWidth="1.5"
              strokeDasharray="1 5"
              strokeLinecap="round"
              opacity="0.9"
              filter="url(#lineGlow)"
            />
          );
        })}

        {points.map((p) => {
          const r = Math.max(5, Math.min(11, p.count * 2));
          const color = colorFor(p.avgRisk);
          return (
            <g
              key={p.jurisdiction}
              transform={`translate(${p.x},${p.y})`}
              onMouseEnter={() => setHovered(p)}
              onMouseLeave={() => setHovered(null)}
              className="cursor-pointer"
            >
              <circle r={r + 8} fill={color} opacity="0.15" />
              <circle r={r} fill={color} filter="url(#glow)" stroke="#ffffff" strokeWidth="1.5" />
              <foreignObject x={-6} y={-6} width="12" height="12">
                <span className="material-symbols-outlined text-white" style={{ fontSize: "10px" }}>
                  {iconFor(p.avgRisk)}
                </span>
              </foreignObject>
              <text x={r + 6} y="4" fontSize="11" fontWeight="600" fill="#e2e8f0">
                {p.jurisdiction}
              </text>
            </g>
          );
        })}
      </svg>
      {hovered && (
        <div
          className="absolute bg-[#0f172a] border border-[#2c4a85] rounded shadow-xl p-3 pointer-events-none z-10"
          style={{ left: `${(hovered.x / width) * 100}%`, top: `${(hovered.y / height) * 100}%`, transform: "translate(-50%, -130%)" }}
        >
          <p className="font-body-lg text-body-lg text-white font-semibold">{hovered.jurisdiction}</p>
          <p className="font-data-tabular text-data-tabular text-slate-300">
            {hovered.count} alerts · {hovered.avgRisk} avg risk
          </p>
        </div>
      )}
    </div>
  );
}
