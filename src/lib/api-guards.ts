import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Simple, DB-backed rate limiter.
 * Uses an in-memory Map as a short-lived cache so we don't hammer Supabase
 * on every single request. Falls back safely if the DB is unreachable.
 *
 * For plan generation we enforce:
 *   • 10 plans per user per hour
 *   • 50 plans per org per day
 */

const userBuckets = new Map<string, { count: number; expiresAt: number }>();
const orgBuckets = new Map<string, { count: number; expiresAt: number }>();

const USER_WINDOW_MS = 60 * 60 * 1000; // 1 hour
const USER_LIMIT = 10;
const ORG_WINDOW_MS = 24 * 60 * 60 * 1000; // 1 day
const ORG_LIMIT = 50;

export type RateLimitResult =
  | { allowed: true }
  | { allowed: false; retryAfterMs: number; reason: string };

function checkBucket(
  buckets: Map<string, { count: number; expiresAt: number }>,
  key: string,
  windowMs: number,
  limit: number,
  label: string,
): RateLimitResult {
  const now = Date.now();
  const bucket = buckets.get(key);

  if (!bucket || bucket.expiresAt <= now) {
    buckets.set(key, { count: 1, expiresAt: now + windowMs });
    return { allowed: true };
  }

  if (bucket.count >= limit) {
    return {
      allowed: false,
      retryAfterMs: bucket.expiresAt - now,
      reason: `Rate limit exceeded: max ${limit} ${label}. Try again later.`,
    };
  }

  bucket.count += 1;
  return { allowed: true };
}

export function checkPlanGenerationRateLimit(
  userId: string,
  orgId: string,
): RateLimitResult {
  // User-level: 10 per hour
  const userCheck = checkBucket(
    userBuckets,
    userId,
    USER_WINDOW_MS,
    USER_LIMIT,
    "plan generations per hour",
  );
  if (!userCheck.allowed) return userCheck;

  // Org-level: 50 per day
  const orgCheck = checkBucket(
    orgBuckets,
    orgId,
    ORG_WINDOW_MS,
    ORG_LIMIT,
    "plan generations per day for your organization",
  );
  if (!orgCheck.allowed) return orgCheck;

  return { allowed: true };
}

/**
 * Check subscription status before allowing expensive operations.
 * Returns null if the subscription is valid, or an error message string if not.
 */
export async function checkSubscriptionStatus(
  orgId: string,
): Promise<string | null> {
  try {
    const admin = createAdminClient();
    const { data: sub } = await admin
      .from("subscriptions")
      .select("status, trial_ends_at")
      .eq("org_id", orgId)
      .maybeSingle();

    if (!sub) {
      return "No active subscription found. Please set up billing.";
    }

    if (sub.status === "cancelled") {
      return "Your subscription has been cancelled. Please reactivate to continue.";
    }

    // Check expired trial
    if (sub.status === "trialing" && sub.trial_ends_at) {
      const trialEnd = new Date(sub.trial_ends_at);
      if (trialEnd.getTime() < Date.now()) {
        // Auto-update the status
        await admin
          .from("subscriptions")
          .update({ status: "cancelled" })
          .eq("org_id", orgId);
        return "Your trial has expired. Please choose a plan to continue.";
      }
    }

    return null; // All good
  } catch {
    // Fail open — don't block users if we can't check
    console.error("[rate-limit] Failed to check subscription status for", orgId);
    return null;
  }
}

/**
 * Check if org has room for more seats.
 * Returns null if under the limit, or an error message string if over.
 */
export async function checkSeatLimit(orgId: string): Promise<string | null> {
  try {
    const admin = createAdminClient();

    const [{ data: sub }, { count: currentUsers }] = await Promise.all([
      admin
        .from("subscriptions")
        .select("seat_limit")
        .eq("org_id", orgId)
        .maybeSingle(),
      admin
        .from("users")
        .select("id", { count: "exact", head: true })
        .eq("org_id", orgId),
    ]);

    if (!sub?.seat_limit) return null; // No limit set

    const current = currentUsers ?? 0;
    if (current >= sub.seat_limit) {
      return `Your organization has reached its seat limit (${sub.seat_limit}). Upgrade your plan or remove a member to invite more people.`;
    }

    return null;
  } catch {
    console.error("[rate-limit] Failed to check seat limit for", orgId);
    return null;
  }
}
