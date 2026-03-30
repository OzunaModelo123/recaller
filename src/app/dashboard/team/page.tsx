import { Users } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

export default function TeamPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold text-zinc-900">Team</h1>
        <p className="text-sm text-zinc-500">Manage team members, roles, and groups.</p>
      </div>

      <Card className="border-dashed">
        <CardContent className="flex flex-col items-center justify-center py-16 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-zinc-100">
            <Users className="h-6 w-6 text-zinc-400" />
          </div>
          <h3 className="mt-4 text-sm font-semibold text-zinc-800">Team management coming soon</h3>
          <p className="mt-1 max-w-sm text-sm text-zinc-500">
            Invite team members, create groups, and manage roles here.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
