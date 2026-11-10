import { RunsTable } from "@/components/admin";
import { listRuns } from "@/lib/admin-data";

export default async function RunsPage() {
  const runs = await listRuns(100);
  return (
    <>
      <h1>Przebiegi pipeline</h1>
      <RunsTable runs={runs} />
    </>
  );
}
