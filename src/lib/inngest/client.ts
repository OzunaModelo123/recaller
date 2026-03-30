import { Inngest } from "inngest";

export const inngest = new Inngest({
  id: "recaller",
  eventKey: process.env.INNGEST_EVENT_KEY,
});
