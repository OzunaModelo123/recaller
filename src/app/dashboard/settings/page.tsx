import { Settings } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

export default function SettingsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold text-zinc-900">Settings</h1>
        <p className="text-sm text-zinc-500">
          Organization settings, integrations, and billing.
        </p>
      </div>

      <Card className="border-dashed">
        <CardContent className="flex flex-col items-center justify-center py-16 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-zinc-100">
            <Settings className="h-6 w-6 text-zinc-400" />
          </div>
          <h3 className="mt-4 text-sm font-semibold text-zinc-800">Settings coming soon</h3>
          <p className="mt-1 max-w-sm text-sm text-zinc-500">
            Manage your organization profile, Slack/Teams integrations, and billing details.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
