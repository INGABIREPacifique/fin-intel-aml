import Sidebar from "../components/Sidebar";
import TopNavBar from "../components/TopNavBar";

export default function ComingSoon({ title }) {
  return (
    <div className="min-h-screen bg-background text-on-surface flex">
      <Sidebar />
      <main className="flex-1 flex flex-col">
        <TopNavBar />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <h1 className="font-headline-lg text-headline-lg text-on-surface mb-2">{title}</h1>
            <p className="font-body-md text-body-md text-on-surface-variant">
              This screen is designed and mapped, not yet built. It's next in the build queue.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
