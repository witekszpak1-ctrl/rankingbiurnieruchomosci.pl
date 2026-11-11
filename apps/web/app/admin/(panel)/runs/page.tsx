import { ActivityFeed } from "@/components/admin";
import { listRuns } from "@/lib/admin-data";

export default async function RunsPage() {
  const runs = await listRuns(100);
  return (
    <>
      <div className="page-head">
        <div>
          <h1>Automat</h1>
          <p className="page-sub">Co system zrobił sam: szukanie biur, sprawdzanie stron, opisy, oferty.</p>
        </div>
      </div>
      <ActivityFeed runs={runs} />
    </>
  );
}
