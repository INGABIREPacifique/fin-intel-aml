import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import { useAuth } from "../lib/AuthContext";
import { useTheme } from "../lib/ThemeContext";
import { useMobileNav } from "../lib/MobileNavContext";

export default function TopNavBar() {
  const { profile } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { toggle } = useMobileNav();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const ref = useRef(null);

  const [query, setQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [searching, setSearching] = useState(false);
  const [entityResults, setEntityResults] = useState([]);
  const [caseResults, setCaseResults] = useState([]);
  const searchRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
      if (searchRef.current && !searchRef.current.contains(e.target)) setSearchOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (!query.trim()) {
      setEntityResults([]);
      setCaseResults([]);
      return;
    }
    const timeout = setTimeout(async () => {
      setSearching(true);
      const [{ data: entities }, { data: cases }] = await Promise.all([
        supabase.from("entities").select("id, entity_name, entity_type").ilike("entity_name", `%${query}%`).limit(5),
        supabase.from("cases").select("case_code, title").or(`title.ilike.%${query}%,case_code.ilike.%${query}%`).limit(5),
      ]);
      setEntityResults(entities ?? []);
      setCaseResults(cases ?? []);
      setSearching(false);
    }, 300);
    return () => clearTimeout(timeout);
  }, [query]);

  const toggleOpen = async () => {
    const next = !open;
    setOpen(next);
    if (next && !loaded) {
      const { data } = await supabase
        .from("audit_logs")
        .select("*, profiles(full_name)")
        .order("created_at", { ascending: false })
        .limit(5);
      setNotifications(data ?? []);
      setLoaded(true);
    }
  };

  const goToCase = (caseCode) => {
    navigate(`/cases/${caseCode}`);
    setSearchOpen(false);
    setQuery("");
  };

  const goToEntities = () => {
    navigate("/entities");
    setSearchOpen(false);
    setQuery("");
  };

  return (
    <header className="bg-background border-b border-surface-border h-16 flex items-center justify-between px-4 md:px-8 shrink-0">
      <div className="flex items-center gap-3">
        <button onClick={toggle} className="md:hidden p-2 -ml-2 rounded hover:bg-surface-container-high">
          <span className="material-symbols-outlined text-on-surface text-[22px]">menu</span>
        </button>
        <h1 className="hidden sm:block font-body-lg text-body-lg font-bold text-on-surface">FIN-INTELLIGENCE</h1>
      </div>
      <div className="flex-1 max-w-[448px] mx-2 sm:mx-8 relative" ref={searchRef}>
        <div className="relative">
          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-[16px]">
            search
          </span>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => setSearchOpen(true)}
            placeholder="Search..."
            className="w-full bg-primary-container border border-surface-border text-on-surface text-sm pl-9 pr-4 sm:pr-16 py-2 rounded focus:outline-none focus:border-data-focus"
          />
          <span className="hidden sm:block absolute right-3 top-1/2 -translate-y-1/2 bg-surface-container border border-surface-border text-on-surface-variant text-[10px] font-data-tabular px-2 py-0.5 rounded">
            CMD+K
          </span>
        </div>
        {searchOpen && query.trim() && (
          <div className="absolute left-0 top-11 w-full bg-surface-container border border-surface-border rounded shadow-xl z-50 max-h-[360px] overflow-auto">
            {searching && (
              <p className="p-3 font-data-tabular text-data-tabular text-on-surface-variant">Searching...</p>
            )}
            {!searching && entityResults.length === 0 && caseResults.length === 0 && (
              <p className="p-3 font-data-tabular text-data-tabular text-on-surface-variant">No results.</p>
            )}
            {entityResults.length > 0 && (
              <div>
                <p className="px-3 pt-3 font-label-caps text-label-caps text-on-surface-variant uppercase">Entities</p>
                {entityResults.map((e) => (
                  <button
                    key={e.id}
                    onClick={goToEntities}
                    className="w-full text-left px-3 py-2 hover:bg-surface-container-high transition-colors"
                  >
                    <p className="font-body-md text-body-md text-on-surface">{e.entity_name}</p>
                    <p className="font-data-tabular text-data-tabular text-on-surface-variant">{e.entity_type}</p>
                  </button>
                ))}
              </div>
            )}
            {caseResults.length > 0 && (
              <div>
                <p className="px-3 pt-3 font-label-caps text-label-caps text-on-surface-variant uppercase">Cases</p>
                {caseResults.map((c) => (
                  <button
                    key={c.case_code}
                    onClick={() => goToCase(c.case_code)}
                    className="w-full text-left px-3 py-2 hover:bg-surface-container-high transition-colors"
                  >
                    <p className="font-body-md text-body-md text-on-surface">{c.title}</p>
                    <p className="font-data-tabular text-data-tabular text-on-surface-variant">{c.case_code}</p>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
      <div className="flex items-center gap-4">
        <button
          onClick={toggleTheme}
          className="p-2 rounded-full hover:bg-surface-container-high transition-colors"
          title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
        >
          <span className="material-symbols-outlined text-on-surface-variant text-[20px]">
            {theme === "dark" ? "light_mode" : "dark_mode"}
          </span>
        </button>
        <div className="flex items-center gap-2 relative" ref={ref}>
          <button
            onClick={toggleOpen}
            className="p-2 rounded-full hover:bg-surface-container-high transition-colors"
          >
            <span className="material-symbols-outlined text-on-surface-variant text-[20px]">notifications</span>
          </button>
          {open && (
            <div className="absolute right-0 top-12 w-[340px] bg-surface-container border border-surface-border rounded shadow-xl z-50">
              <div className="px-4 py-3 border-b border-surface-border font-label-caps text-label-caps text-on-surface-variant uppercase">
                Recent Activity
              </div>
              <div className="max-h-[300px] overflow-auto divide-y divide-surface-border">
                {notifications.length === 0 && (
                  <p className="p-4 font-data-tabular text-data-tabular text-on-surface-variant">
                    No recent activity.
                  </p>
                )}
                {notifications.map((n) => (
                  <div key={n.id} className="p-3">
                    <p className="font-body-md text-body-md text-on-surface">
                      {n.action.replace(/_/g, " ")}
                    </p>
                    <p className="font-data-tabular text-data-tabular text-on-surface-variant">
                      {n.profiles?.full_name ?? "SYSTEM"} ·{" "}
                      {new Date(n.created_at).toISOString().slice(0, 16).replace("T", " ")}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
        {profile && (
          <button
            onClick={() => navigate("/settings")}
            className="w-8 h-8 rounded-full bg-surface-container-high border border-surface-border flex items-center justify-center"
            title={`${profile.full_name} — ${profile.role.replace("_", " ")}`}
          >
            <span className="font-label-caps text-label-caps text-data-focus">
              {profile.full_name.split(" ").map((n) => n[0]).slice(0, 2).join("")}
            </span>
          </button>
        )}
      </div>
    </header>
  );
}
