import { useParams, useNavigate } from "react-router-dom";
import Sidebar from "../components/Sidebar";
import TopNavBar from "../components/TopNavBar";
import WorkspacePanel from "../components/WorkspacePanel";

export default function CaseWorkspace() {
  const { caseCode } = useParams();
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background text-on-surface flex">
      <Sidebar />
      <div className="flex-1 flex flex-col">
        <TopNavBar />
        <div className="flex-1 overflow-hidden">
          <WorkspacePanel caseCode={caseCode} onClose={() => navigate(`/cases/${caseCode}`)} />
        </div>
      </div>
    </div>
  );
}
