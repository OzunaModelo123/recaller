import { FileVideo, Upload } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function ContentPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold text-zinc-900">Content Library</h1>
        <p className="text-sm text-zinc-500">
          Upload training videos, documents, and articles for AI plan generation.
        </p>
      </div>

      <Card className="border-dashed">
        <CardContent className="flex flex-col items-center justify-center py-16 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-zinc-100">
            <FileVideo className="h-6 w-6 text-zinc-400" />
          </div>
          <h3 className="mt-4 text-sm font-semibold text-zinc-800">No content yet</h3>
          <p className="mt-1 max-w-sm text-sm text-zinc-500">
            Upload a YouTube link, PDF, or document to get started. AI will analyze the content and
            help you build actionable training plans.
          </p>
          <Button className="mt-5" disabled>
            <Upload className="mr-2 h-4 w-4" />
            Upload Content (Coming in Phase 2)
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
