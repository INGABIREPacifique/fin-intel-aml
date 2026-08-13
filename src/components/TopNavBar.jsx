export default function TopNavBar() {
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
        <div className="flex items-center gap-2">
          <button className="p-2 rounded-full hover:bg-surface-container-high transition-colors">
            <span className="material-symbols-outlined text-on-surface-variant text-[20px]">notifications</span>
          </button>
          <button className="p-2 rounded-full hover:bg-surface-container-high transition-colors">
            <span className="material-symbols-outlined text-on-surface-variant text-[20px]">settings</span>
          </button>
          <button className="p-2 rounded-full hover:bg-surface-container-high transition-colors">
            <span className="material-symbols-outlined text-on-surface-variant text-[20px]">help</span>
          </button>
        </div>
        <span className="font-label-caps text-label-caps text-on-surface-variant">Support</span>
        <div className="w-8 h-8 rounded-full bg-surface-container-high border border-surface-border flex items-center justify-center">
          <span className="material-symbols-outlined text-on-surface-variant text-[18px]">person</span>
        </div>
      </div>
    </header>
  );
}
