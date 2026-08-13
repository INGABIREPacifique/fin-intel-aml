import { NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../lib/AuthContext";

const navItems = [
  { to: "/dashboard", label: "Overview", icon: "grid_view" },
  { to: "/alerts", label: "Alert Queue", icon: "list_alt" },
];

export default function Sidebar() {
  const { signOut, profile } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await signOut();
    navigate("/login");
  };

  return (
    <aside className="w-[240px] bg-surface-container-low border-r border-surface-border p-6 flex flex-col justify-between min-h-screen">
      <div>
        <h1 className="font-headline-md text-headline-md font-bold text-on-surface mb-1">
          AML <span className="text-secondary">Division</span>
        </h1>
        <p className="font-label-caps text-label-caps text-on-surface-variant uppercase mb-1">
          Institutional Vault
        </p>
        {profile && (
          <p className="font-data-tabular text-data-tabular text-secondary mb-8">
            {profile.full_name} · {profile.role.replace("_", " ").toUpperCase()}
          </p>
        )}
        <nav className="space-y-1">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2 rounded transition-colors ${
                  isActive
                    ? "bg-surface-container-high text-secondary"
                    : "text-on-surface-variant hover:text-on-surface"
                }`
              }
            >
              <span className="material-symbols-outlined text-[20px]">{item.icon}</span>
              <span className="font-body-md text-body-md">{item.label}</span>
            </NavLink>
          ))}
        </nav>
      </div>
      <button
        onClick={handleLogout}
        className="flex items-center gap-3 px-3 py-2 text-on-surface-variant hover:text-status-critical transition-colors rounded"
      >
        <span className="material-symbols-outlined text-[20px]">logout</span>
        <span className="font-body-md text-body-md">Logout</span>
      </button>
    </aside>
  );
}
