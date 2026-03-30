import { Settings, Blocks, CreditCard, Building2 } from "lucide-react";

export default function SettingsPage() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-stone-900">Settings</h1>
        <p className="mt-1 text-sm text-stone-400">
          Organization settings, integrations, and billing.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {[
          {
            icon: Building2,
            label: "Organization",
            desc: "Manage your org profile, name, and preferences.",
            color: "text-stone-600",
            bg: "bg-stone-50",
          },
          {
            icon: Blocks,
            label: "Integrations",
            desc: "Connect Slack, Microsoft Teams, and other tools.",
            color: "text-violet-600",
            bg: "bg-violet-50",
          },
          {
            icon: CreditCard,
            label: "Billing",
            desc: "Manage your subscription, seats, and invoices.",
            color: "text-amber-600",
            bg: "bg-amber-50",
          },
        ].map((item) => (
          <div
            key={item.label}
            className="rounded-2xl border border-stone-200 bg-white p-6 shadow-sm"
          >
            <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${item.bg}`}>
              <item.icon className={`h-5 w-5 ${item.color}`} />
            </div>
            <h3 className="mt-4 text-sm font-semibold text-stone-700">{item.label}</h3>
            <p className="mt-1.5 text-xs leading-relaxed text-stone-400">{item.desc}</p>
            <div className="mt-4 inline-flex rounded-lg bg-stone-50 px-3 py-1.5 text-[11px] font-medium text-stone-400">
              Coming soon
            </div>
          </div>
        ))}
      </div>

      <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-stone-200 bg-stone-50/50 py-14 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white shadow-sm">
          <Settings className="h-5 w-5 text-stone-300" />
        </div>
        <p className="mx-auto mt-4 max-w-sm text-sm text-stone-400">
          Full settings management will be available in a future update. Stay tuned.
        </p>
      </div>
    </div>
  );
}
