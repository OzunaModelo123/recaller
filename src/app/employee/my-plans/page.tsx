import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function MyPlansPage() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>My Plans</CardTitle>
      </CardHeader>
      <CardContent className="text-sm text-zinc-600">
        Your assigned training plans will appear here in Phase 4.
      </CardContent>
    </Card>
  );
}
