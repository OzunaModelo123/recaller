import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

const PREFIX = "v1:";
const ALGO = "aes-256-gcm";
const IV_LEN = 12;
const TAG_LEN = 16;

function getKeyBuffer(): Buffer | null {
  const hex = process.env.SLACK_BOT_TOKEN_ENCRYPTION_KEY?.trim();
  if (!hex || hex.length < 64) return null;
  if (!/^[0-9a-fA-F]{64}$/.test(hex)) return null;
  return Buffer.from(hex, "hex");
}

/**
 * Store-safe encoding of the Slack bot token.
 * If `SLACK_BOT_TOKEN_ENCRYPTION_KEY` (64 hex chars = 32 bytes) is unset, returns plaintext for local/dev compatibility.
 */
export function sealSlackBotToken(plain: string): string {
  const key = getKeyBuffer();
  if (!key) return plain;

  const iv = randomBytes(IV_LEN);
  const cipher = createCipheriv(ALGO, key, iv);
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  const payload = Buffer.concat([iv, tag, enc]);
  return `${PREFIX}${payload.toString("base64url")}`;
}

/**
 * Returns the raw `xoxb-...` token for Slack API calls.
 * Supports legacy plaintext rows when encryption key is absent.
 */
export function openSlackBotToken(stored: string): string {
  if (!stored.startsWith(PREFIX)) {
    return stored;
  }
  const key = getKeyBuffer();
  if (!key) {
    throw new Error(
      "SLACK_BOT_TOKEN_ENCRYPTION_KEY is required to decrypt stored Slack bot tokens",
    );
  }
  const raw = Buffer.from(stored.slice(PREFIX.length), "base64url");
  if (raw.length < IV_LEN + TAG_LEN) {
    throw new Error("Invalid encrypted Slack token payload");
  }
  const iv = raw.subarray(0, IV_LEN);
  const tag = raw.subarray(IV_LEN, IV_LEN + TAG_LEN);
  const enc = raw.subarray(IV_LEN + TAG_LEN);
  const decipher = createDecipheriv(ALGO, key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(enc), decipher.final()]).toString("utf8");
}
