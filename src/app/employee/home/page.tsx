import { redirect } from "next/navigation";

/** Canonical employee landing is `/employee`; keep `/employee/home` as a stable alias. */
export default function EmployeeHomeAliasPage() {
  redirect("/employee");
}
