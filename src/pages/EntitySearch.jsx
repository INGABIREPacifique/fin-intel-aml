import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import { useRealtimeRefresh } from "../lib/useRealtimeRefresh";
import Sidebar from "../components/Sidebar";
import TopNavBar from "../components/TopNavBar";

export default function EntitySearch() {
  const navigate = useNavigate();
  const [entities, setEntities] = useState([]);
  const [query, setQuery] = useState("");
  const [watchlistOnly, setWatchlistOnly] = useState(false);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  const load = async () => {
    const { data, error } = await supabase.from("entities").select("*").order("entity_name");
    if (error) {
      setErrorMessage(error.message);
    } else {
      setEntities(data);
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  useRealtimeRefresh(["entities"], load);

  const toggleWatchlist = async (entity) => {
    setErrorMessage("");
    const { data, error } = await supabase
      .from("entities")
      .update({ watchlisted: !entity.watchlisted })
      .eq("id", entity.id)
      .select()
      .single();
    if (error) {
      setErrorMessage(`Couldn't update watchlist: ${error.message}`);
    } else {
      setEntities((prev) => prev.map((e) => (e.id === data.id ? data : e)));
    }
  };

  const filtered = entities.filter((e) => {
    const matchesQuery = e.entity_name.toLowerCase().includes(query.toLowerCase());
    const matchesWatchlist = !watchlistOnly || e.watchlisted;
    return matchesQuery && matchesWatchlist;
  });

  return (
    <div className="min-h-screen bg-background text-on-surface flex">
      <Sidebar />
      <div className="flex-1 flex flex-col">
        <TopNavBar />
        <main className="flex-1 p-4 md:p-8 overflow-x-hidden">
          <h1 className="font-headline-lg text-headline-lg text-on-surface mb-1">Entity Search &amp; Watchlists</h1>
          <p className="font-body-md text-body-md text-on-surface-variant mb-8">
            Search all known entities and manage your watchlist.
          </p>

          <div className="flex gap-4 mb-6">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search entity name..."
              className="flex-1 max-w-md bg-surface-container border border-surface-border text-on-surface px-4 py-2 rounded focus:outline-none focus:border-data-focus"
            />
            <label className="flex items-center gap-2 font-label-caps text-label-caps text-on-surface-variant">
              <input type="checkbox" checked={watchlistOnly} onChange={(e) => setWatchlistOnly(e.target.checked)} />
              Watchlist only
            </label>
          </div>

          {errorMessage && (
            <p className="font-data-tabular text-data-tabular text-status-critical mb-4">{errorMessage}</p>
          )}

          <div className="bg-surface-container border border-surface-border rounded divide-y divide-surface-border">
            {loading && (
              <p className="p-6 font-data-tabular text-data-tabular text-on-surface-variant">Loading...</p>
            )}
            {!loading && filtered.length === 0 && (
              <p className="p-6 font-data-tabular text-data-tabular text-on-surface-variant">No entities match.</p>
            )}
            {filtered.map((e) => (
              <div
                key={e.id}
                onClick={() => navigate(`/entities/${e.id}`)}
                className="p-4 flex items-center justify-between hover:bg-surface-container-high transition-colors cursor-pointer"
              >
                <div>
                  <p className="font-body-lg text-body-lg text-on-surface font-semibold">{e.entity_name}</p>
                  <p className="font-data-tabular text-data-tabular text-on-surface-variant">
                    {e.entity_type} · {e.jurisdiction ?? "—"} {e.tin_ein ? `· ${e.tin_ein}` : ""}
                  </p>
                </div>
                <button
                  onClick={(evt) => {
                    evt.stopPropagation();
                    toggleWatchlist(e);
                  }}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded font-label-caps text-label-caps border ${
                    e.watchlisted
                      ? "text-status-warning border-status-warning bg-status-warning/10"
                      : "text-on-surface-variant border-surface-border hover:text-on-surface"
                  }`}
                >
                  <span className="material-symbols-outlined text-[16px]">
                    {e.watchlisted ? "bookmark" : "bookmark_border"}
                  </span>
                  {e.watchlisted ? "Watchlisted" : "Add to Watchlist"}
                </button>
              </div>
            ))}
          </div>
        </main>
      </div>
    </div>
  );
}
