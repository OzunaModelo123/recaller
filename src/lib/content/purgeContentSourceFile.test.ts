import { describe, expect, it, vi } from "vitest";
import { purgeContentSourceFile } from "./purgeContentSourceFile";

function mockSupabase(overrides: {
  file_path?: string | null;
  selectError?: boolean;
  removeError?: boolean;
  updateError?: boolean;
}) {
  const storageRemove = vi.fn().mockResolvedValue({
    error: overrides.removeError ? { message: "boom" } : null,
  });
  const supabase = {
    from: (table: string) => {
      if (table !== "content_items") throw new Error(`unexpected ${table}`);
      return {
        select: () => ({
          eq: () => ({
            maybeSingle: async () => ({
              data: overrides.selectError
                ? null
                : { file_path: overrides.file_path ?? null },
              error: overrides.selectError ? { message: "select err" } : null,
            }),
          }),
        }),
        update: () => ({
          eq: async () => ({
            error: overrides.updateError ? { message: "update err" } : null,
          }),
        }),
      };
    },
    storage: {
      from: () => ({ remove: storageRemove }),
    },
  };
  return { supabase, storageRemove };
}

describe("purgeContentSourceFile", () => {
  it("no-ops when file_path is null", async () => {
    const { supabase, storageRemove } = mockSupabase({ file_path: null });
    await purgeContentSourceFile(supabase as never, "id-1");
    expect(storageRemove).not.toHaveBeenCalled();
  });

  it("removes storage and clears file_path", async () => {
    const { supabase, storageRemove } = mockSupabase({ file_path: "org/x/file.mp4" });
    await purgeContentSourceFile(supabase as never, "id-1");
    expect(storageRemove).toHaveBeenCalledWith(["org/x/file.mp4"]);
  });
});
