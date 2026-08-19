import WorkspacePanel from "./WorkspacePanel";

export default function WorkspaceDrawer({ caseCode, onClose }) {
  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative w-full max-w-[1100px] h-full bg-surface-container shadow-2xl border-l border-surface-border">
        <WorkspacePanel caseCode={caseCode} onClose={onClose} />
      </div>
    </div>
  );
}
