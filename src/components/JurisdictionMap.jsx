import { useEffect, useMemo, useState } from "react";
import { geoNaturalEarth1, geoPath } from "d3-geo";
import { feature } from "topojson-client";
import worldTopo from "world-atlas/countries-110m.json";
import { supabase } from "../lib/supabaseClient";

const width = 760;
const height = 380;

export default function JurisdictionMap({ jurisdictionRisk }) {
  const [coords, setCoords] = useState([]);
  const [hovered, setHovered] = useState(null);

  useEffect(() => {
    async function load() {
      const { data } = await supabase.from("jurisdiction_coordinates").select("*");
      setCoords(data ?? []);
    }
    load();
  }, []);

  const { countries, projection, path } = useMemo(() => {
    const proj = geoNaturalEarth1().scale(120).translate([width / 2, height / 2]);
    const pathGen = geoPath(proj);
    const geoData = feature(worldTopo, worldTopo.objects.countries);
    return { countries: geoData.features, projection: proj, path: pathGen };
  }, []);

  const riskByJurisdiction = Object.fromEntries(
    jurisdictionRisk.map((j) => [j.name, j])
  );

  const points = coords
    .map((c) => {
      const risk = riskByJurisdiction[c.jurisdiction];
      if (!risk) return null;
      const projected = projection([c.lng, c.lat]);
      if (!projected) return null;
      return { ...c, ...risk, x: projected[0], y: projected[1] };
    })
    .filter(Boolean);

  const colorFor = (avgRisk) =>
    avgRisk >= 90 ? "#ef4444" : avgRisk >= 70 ? "#f59e0b" : "#10b981";

  return (
    <div className="relative">
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto">
        <rect width={width} height={height} fill="var(--color-surface-container-low)" />
        {countries.map((c, i) => (
          <path
            key={i}
            d={path(c)}
            fill="var(--color-surface-container-high)"
            stroke="var(--color-surface-border)"
            strokeWidth="0.4"
          />
        ))}
        {points.map((p) => (
          <g
            key={p.jurisdiction}
            transform={`translate(${p.x},${p.y})`}
            onMouseEnter={() => setHovered(p)}
            onMouseLeave={() => setHovered(null)}
            className="cursor-pointer"
          >
            <circle r={Math.max(6, Math.min(18, p.count * 3))} fill={colorFor(p.avgRisk)} opacity="0.25" />
            <circle r={Math.max(4, Math.min(10, p.count * 2))} fill={colorFor(p.avgRisk)} opacity="0.9" stroke="white" strokeWidth="1" />
          </g>
        ))}
      </svg>
      {hovered && (
        <div
          className="absolute bg-surface-container border border-surface-border rounded shadow-xl p-3 pointer-events-none z-10"
          style={{ left: `${(hovered.x / width) * 100}%`, top: `${(hovered.y / height) * 100}%`, transform: "translate(-50%, -120%)" }}
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
