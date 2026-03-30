import { ClipboardList } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function AssignmentsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold text-zinc-900">Assignments</h1>
        <p className="text-sm text-zinc-500">
          Manage training plan assignments and track team progress.
        </p>
      </div>

      <Card className="border-dashed">
        <CardContent className="flex flex-col items-center justify-center py-16 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-zinc-100">
            <ClipboardList className="h-6 w-6 text-zinc-400" />
          </div>
          <h3 className="mt-4 text-sm font-semibold text-zinc-800">No assignments yet</h3>
          <p className="mt-1 max-w-sm text-sm text-zinc-500">
            Once you generate training plans from your content, you can assign them to team members
            and track their completion.
          </p>
          <Button className="mt-5" disabled>
            Create Assignment (Coming in Phase 5)
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
