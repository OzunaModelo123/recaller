import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { signEmployeeSetupToken, verifyEmployeeSetupToken } from "./employee-setup-token";

describe("employee-setup-token", () => {
  const prevSecret = process.env.EMPLOYEE_SETUP_TOKEN_SECRET;
  const prevSr = process.env.SUPABASE_SERVICE_ROLE_KEY;

  beforeEach(() => {
    delete process.env.EMPLOYEE_SETUP_TOKEN_SECRET;
    process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-role-key-for-hmac-only";
  });

  afterEach(() => {
    if (prevSecret === undefined) delete process.env.EMPLOYEE_SETUP_TOKEN_SECRET;
    else process.env.EMPLOYEE_SETUP_TOKEN_SECRET = prevSecret;
    if (prevSr === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    else process.env.SUPABASE_SERVICE_ROLE_KEY = prevSr;
  });

  it("round-trips user id", () => {
    const id = "11111111-1111-4111-8111-111111111111";
    const token = signEmployeeSetupToken(id);
    expect(verifyEmployeeSetupToken(token)).toBe(id);
  });

  it("rejects tampered token", () => {
    const id = "22222222-2222-4222-8222-222222222222";
    const token = signEmployeeSetupToken(id);
    const tampered = token.slice(0, -4) + "xxxx";
    expect(verifyEmployeeSetupToken(tampered)).toBeNull();
  });
});
