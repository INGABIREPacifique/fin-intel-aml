import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import { useAuth } from "../lib/AuthContext";

export default function TopNavBar() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    function handleClickOutside(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

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

  return (
    <header className="bg-background border-b border-surface-border h-16 flex items-center justify-between px-8 shrink-0">
      <h1 className="font-body-lg text-body-lg font-bold text-on-surface">FIN-INTELLIGENCE</h1>
      <div className="flex-1 max-w-[448px] mx-8">
        <div className="relative">
          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-[16px]">
            search
          </span>
          <input
            type="text"
            readOnly
            placeholder="Search entities, transactions, or alerts..."
            className="w-full bg-primary-container border border-surface-border text-on-surface-variant text-sm pl-9 pr-16 py-2 rounded focus:outline-none"
          />
          <span className="absolute right-3 top-1/2 -translate-y-1/2 bg-surface-container border border-surface-border text-on-surface-variant text-[10px] font-data-tabular px-2 py-0.5 rounded">
            CMD+K
          </span>
        </div>
      </div>
      <div className="flex items-center gap-4">
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
          <div
            className="w-8 h-8 rounded-full bg-surface-container-high border border-surface-border flex items-center justify-center"
            title={`${profile.full_name} — ${profile.role.replace("_", " ")}`}
          >
            <span className="font-label-caps text-label-caps text-secondary">
              {profile.full_name.split(" ").map((n) => n[0]).slice(0, 2).join("")}
            </span>
          </div>
        )}
      </div>
    </header>
  );
}
