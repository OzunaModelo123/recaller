"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function updateProfileAction(data: {
  fullName: string;
  title: string;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  await supabase
    .from("users")
    .update({ full_name: data.fullName || null, title: data.title || null })
    .eq("id", user.id);

  revalidatePath("/employee/profile");
  revalidatePath("/employee");
}
