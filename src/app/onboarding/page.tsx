import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { loadResearchProfile } from "@/lib/profile";
import { OnboardingForm } from "./OnboardingForm";

export default async function OnboardingPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [{ data: schools }, rp] = await Promise.all([
    supabase.from("schools").select("id, name").order("name"),
    loadResearchProfile(user.id),
  ]);

  // Pre-fill from the existing saved profile so editing doesn't restart onboarding.
  const initial = rp
    ? {
        major1: rp.majors[0] ?? "MSE",
        major2: rp.majors[1] ?? "",
        targetDegree: rp.targetDegree,
        interests: [rp.interests[0] ?? "", rp.interests[1] ?? "", rp.interests[2] ?? ""],
        method: rp.methodPreference,
        applicationArea: rp.applicationArea ?? "",
        projectSummary: rp.projectSummary ?? "",
        tierMap: Object.fromEntries(rp.targetSchools.map((s) => [s.schoolName, s.tier])),
      }
    : null;
  const isEdit = Boolean(rp);

  return (
    <main className="mx-auto max-w-2xl px-6 py-12">
      <h1 className="text-2xl font-bold text-brand">
        {isEdit ? "Edit your Research Profile" : "Build your Research Profile"}
      </h1>
      <p className="mt-2 text-sm text-slate-600">
        {isEdit
          ? "Your saved values are pre-filled — change only what you need and save."
          : "We reuse this profile in every PI Finder run. You can edit it anytime from your profile."}
      </p>
      <div className="card mt-6">
        <OnboardingForm schools={schools ?? []} userId={user.id} initial={initial} isEdit={isEdit} />
      </div>
    </main>
  );
}
