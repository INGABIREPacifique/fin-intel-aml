import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import Sidebar from "../components/Sidebar";
import TopNavBar from "../components/TopNavBar";

export default function InstitutionsList() {
  const navigate = useNavigate();
  const [institutions, setInstitutions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const { data, error } = await supabase.from("institutions").select("*").order("name");
      if (!error) setInstitutions(data);
      setLoading(false);
    }
    load();
  }, []);

  return (
    <div className="min-h-screen bg-background text-on-surface flex">
      <Sidebar />
      <div className="flex-1 flex flex-col">
        <TopNavBar />
        <main className="flex-1 p-8">
          <h1 className="font-headline-lg text-headline-lg text-on-surface mb-2">Institutions</h1>
          <p className="font-body-md text-body-md text-on-surface-variant mb-8">
            Partner reporting institutions and their compliance standing.
          </p>

          <div className="bg-surface-container border border-surface-border rounded divide-y divide-surface-border">
            {loading && (
              <p className="p-6 font-data-tabular text-data-tabular text-on-surface-variant">Loading...</p>
            )}
            {!loading && institutions.length === 0 && (
              <p className="p-6 font-data-tabular text-data-tabular text-on-surface-variant">
                No institutions yet. Run migration_005_institutions.sql to seed a demo institution.
              </p>
            )}
            {institutions.map((inst) => (
              <div
                key={inst.id}
                onClick={() => navigate(`/institutions/${inst.institution_code}`)}
                className="p-5 flex items-center justify-between hover:bg-surface-container-high transition-colors cursor-pointer"
              >
                <div>
                  <p className="font-data-tabular text-data-tabular text-on-surface-variant mb-1">
                    {inst.institution_code} {inst.is_demo && "· DEMO"}
                  </p>
                  <p className="font-body-lg text-body-lg text-on-surface font-semibold">{inst.name}</p>
                  <p className="font-body-md text-body-md text-on-surface-variant mt-1">
                    {inst.jurisdiction_code}
                  </p>
                </div>
                <span
                  className={`font-label-caps text-label-caps px-3 py-1 rounded-full border ${
                    inst.status === "active"
                      ? "text-status-success border-status-success bg-status-success/10"
                      : "text-status-critical border-status-critical bg-error-container/20"
                  }`}
                >
                  {inst.status.toUpperCase()}
                </span>
              </div>
            ))}
          </div>
        </main>
      </div>
    </div>
  );
}
