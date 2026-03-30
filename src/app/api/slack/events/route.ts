import { createHandler } from "@vercel/slack-bolt";

import { app, receiver } from "@/lib/slack/app";

const handler = createHandler(app, receiver);

export async function POST(req: Request) {
  return handler(req);
}
