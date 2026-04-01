import Link from "next/link";
import { BookOpen, Plug, UserCircle } from "lucide-react";

import { Button } from "@/components/ui/button";

export function EmployeeTopBar({ orgName }: { orgName: string }) {
  return (
    <header className="hidden border-b border-border bg-card/60 backdrop-blur-sm md:flex md:items-center md:justify-between md:px-8 md:py-3">
      <p className="text-sm text-muted-foreground">
        <span className="font-medium text-foreground/90">{orgName}</span>
        <span className="mx-2 text-border">·</span>
        Employee home
      </p>
      <div className="flex flex-wrap items-center justify-end gap-2">
        <Button variant="outline" size="sm" className="h-8 rounded-lg text-xs" asChild>
          <Link href="/employee/my-plans">
            <BookOpen className="mr-1 h-3.5 w-3.5" aria-hidden />
            My Plans
          </Link>
        </Button>
        <Button variant="outline" size="sm" className="h-8 rounded-lg text-xs" asChild>
          <Link href="/employee/profile">
            <UserCircle className="mr-1 h-3.5 w-3.5" aria-hidden />
            Profile
          </Link>
        </Button>
        <Button variant="outline" size="sm" className="h-8 rounded-lg text-xs" asChild>
          <Link href="/employee/integrations">
            <Plug className="mr-1 h-3.5 w-3.5" aria-hidden />
            Integrations
          </Link>
        </Button>
      </div>
    </header>
  );
}
