import { describe, expect, it, vi, afterEach } from "vitest";

import { openSlackBotToken, sealSlackBotToken } from "./bot-token-crypto";

describe("bot-token-crypto", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env.SLACK_BOT_TOKEN_ENCRYPTION_KEY;
  });

  it("passes through when no encryption key", () => {
    const t = "xoxb-test-plain";
    expect(sealSlackBotToken(t)).toBe(t);
    expect(openSlackBotToken(t)).toBe(t);
  });

  it("round-trips when key is set", () => {
    process.env.SLACK_BOT_TOKEN_ENCRYPTION_KEY = "a".repeat(64);
    const t = "xoxb-secret-token";
    const sealed = sealSlackBotToken(t);
    expect(sealed).not.toBe(t);
    expect(sealed.startsWith("v1:")).toBe(true);
    expect(openSlackBotToken(sealed)).toBe(t);
  });
});
