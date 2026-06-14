import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { OnboardingForm } from "./OnboardingForm";

export default async function OnboardingPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: schools } = await supabase
    .from("schools")
    .select("id, name")
    .order("name");

  return (
    <main className="mx-auto max-w-2xl px-6 py-12">
      <h1 className="text-2xl font-bold text-brand">Build your Research Profile</h1>
      <p className="mt-2 text-sm text-slate-600">
        We reuse this profile in every PI Finder run. You can edit it anytime from your profile.
      </p>
      <div className="card mt-6">
        <OnboardingForm schools={schools ?? []} userId={user.id} />
      </div>
    </main>
  );
}
