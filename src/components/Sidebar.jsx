import { NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../lib/AuthContext";

const navItems = [
  { to: "/dashboard", label: "Overview", icon: "grid_view", roles: ["investigator", "compliance_officer", "admin"] },
  { to: "/alerts", label: "Alert Queue", icon: "list_alt", roles: ["investigator", "compliance_officer", "admin"] },
  { to: "/investigations", label: "Investigations", icon: "person_search", roles: ["investigator", "compliance_officer", "admin"] },
  { to: "/network-graph", label: "Network Graph", icon: "hub", roles: ["investigator", "compliance_officer", "admin"] },
  { to: "/graph-explorer", label: "Graph Explorer", icon: "share", roles: ["investigator", "compliance_officer", "admin"] },
  { to: "/entities", label: "Entity Search", icon: "person_search", roles: ["investigator", "compliance_officer", "admin"] },
  { to: "/institutions", label: "Institutions", icon: "account_balance", roles: ["compliance_officer", "admin"] },
  { to: "/audit-trail", label: "Audit Logs", icon: "manage_search", roles: ["compliance_officer", "admin"] },
  { to: "/data-health", label: "Data Health", icon: "database", roles: ["compliance_officer", "admin"] },
  { to: "/risk-engine", label: "Risk Engine", icon: "tune", roles: ["admin"] },
  { to: "/admin/security", label: "System Config", icon: "admin_panel_settings", roles: ["admin"] },
];

export default function Sidebar() {
  const { signOut, profile } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await signOut();
    navigate("/login");
  };

  const visibleItems = profile ? navItems.filter((item) => item.roles.includes(profile.role)) : [];

  return (
    <aside className="w-[240px] bg-gradient-to-b from-[#1e3a8a] to-[#0f172a] p-4 flex flex-col gap-4 min-h-screen shrink-0">
      <div className="flex items-center gap-3 px-2 pb-6">
        <div className="w-9 h-10 bg-white/10 border border-white/20 rounded flex items-center justify-center shrink-0">
          <span className="material-symbols-outlined text-white text-[20px]">shield_locked</span>
        </div>
        <div>
          <h1 className="font-headline-md text-headline-md font-bold text-white leading-tight">
            AML Division
          </h1>
          <p className="font-data-tabular text-data-tabular text-white/75 leading-tight">
            Institutional Vault
          </p>
        </div>
      </div>

      {profile && (
        <p className="font-data-tabular text-data-tabular font-semibold text-white px-2 -mt-2">
          {profile.full_name} · {profile.role.replace("_", " ").toUpperCase()}
        </p>
      )}

      <button
        onClick={() => navigate("/investigations/new")}
        className="w-full bg-secondary text-on-secondary font-label-caps text-label-caps font-semibold py-3 rounded flex items-center justify-center gap-2 hover:opacity-90 transition-opacity"
      >
        <span className="material-symbols-outlined text-[16px]">add</span>
        NEW INVESTIGATION
      </button>

      <nav className="flex-1 space-y-1">
        {visibleItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2 rounded transition-colors ${
                isActive
                  ? "bg-white/15 border-r-2 border-white text-white font-bold"
                  : "text-white/85 font-semibold hover:text-white hover:bg-white/5"
              }`
            }
          >
            <span className="material-symbols-outlined text-[18px]">{item.icon}</span>
            <span className="font-label-caps text-label-caps">{item.label}</span>
          </NavLink>
        ))}
      </nav>

      <div className="border-t border-white/15 pt-4 space-y-1">
        <button
          onClick={() => navigate("/settings")}
          className="w-full flex items-center gap-3 px-3 py-2 text-white/60 hover:text-white rounded transition-colors"
        >
          <span className="material-symbols-outlined text-[18px]">settings</span>
          <span className="font-label-caps text-label-caps">Settings</span>
        </button>
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-3 py-2 text-white/60 hover:text-red-300 rounded transition-colors"
        >
          <span className="material-symbols-outlined text-[18px]">logout</span>
          <span className="font-label-caps text-label-caps">Logout</span>
        </button>
      </div>
    </aside>
  );
}
