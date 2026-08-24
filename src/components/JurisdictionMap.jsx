import { useEffect, useMemo, useState } from "react";
import { geoNaturalEarth1, geoPath } from "d3-geo";
import { feature } from "topojson-client";
import worldTopo from "world-atlas/countries-110m.json";
import { supabase } from "../lib/supabaseClient";

const width = 760;
const height = 380;

// Same normalization used in Dashboard so map keys match aggregation keys
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

      // Real cross-jurisdiction links: only where an actual relationship
      // connects two entities whose jurisdictions differ.
      const jurisdictionByEntity = Object.fromEntries(
        (entityData ?? []).map((e) => [e.id, normalizeJurisdiction(e.jurisdiction)])
      );
      const crossLinks = (relData ?? [])
        .map((r) => ({
          from: jurisdictionByEntity[r.from_entity_id],
          to: jurisdictionByEntity[r.to_entity_id],
        }))
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

  const colorFor = (avgRisk) =>
    avgRisk >= 90 ? "#ef4444" : avgRisk >= 70 ? "#f59e0b" : "#10b981";

  return (
    <div className="relative">
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto rounded overflow-hidden">
        <rect width={width} height={height} fill="var(--color-map-ocean)" />
        {countries.map((c, i) => (
          <path
            key={i}
            d={path(c)}
            fill="var(--color-map-land)"
            stroke="var(--color-map-border)"
            strokeWidth="0.4"
          />
        ))}

        {links.map((l, i) => {
          const from = pointByName[l.from];
          const to = pointByName[l.to];
          if (!from || !to) return null;
          const midX = (from.x + to.x) / 2;
          const midY = Math.min(from.y, to.y) - 30;
          return (
            <path
              key={i}
              d={`M ${from.x} ${from.y} Q ${midX} ${midY} ${to.x} ${to.y}`}
              fill="none"
              stroke="#38bdf8"
              strokeWidth="1.5"
              strokeDasharray="4 3"
              opacity="0.8"
            />
          );
        })}

        {points.map((p) => (
          <g
            key={p.jurisdiction}
            transform={`translate(${p.x},${p.y})`}
            onMouseEnter={() => setHovered(p)}
            onMouseLeave={() => setHovered(null)}
            className="cursor-pointer"
          >
            <circle r={Math.max(6, Math.min(18, p.count * 3))} fill={colorFor(p.avgRisk)} opacity="0.25" />
            <circle r={Math.max(4, Math.min(10, p.count * 2))} fill={colorFor(p.avgRisk)} opacity="0.95" stroke="white" strokeWidth="1.5" />
            <text
              x="10"
              y="4"
              fontSize="11"
              fontWeight="600"
              fill="var(--color-on-surface)"
              stroke="var(--color-surface)"
              strokeWidth="3"
              paintOrder="stroke"
            >
              {p.jurisdiction}
            </text>
          </g>
        ))}
      </svg>
      {hovered && (
        <div
          className="absolute bg-surface-container border border-surface-border rounded shadow-xl p-3 pointer-events-none z-10"
          style={{ left: `${(hovered.x / width) * 100}%`, top: `${(hovered.y / height) * 100}%`, transform: "translate(-50%, -130%)" }}
        >
          <p className="font-body-lg text-body-lg text-on-surface font-semibold">{hovered.jurisdiction}</p>
          <p className="font-data-tabular text-data-tabular text-on-surface-variant">
            {hovered.count} alerts · {hovered.avgRisk} avg risk
          </p>
        </div>
      )}
    </div>
  );
}
