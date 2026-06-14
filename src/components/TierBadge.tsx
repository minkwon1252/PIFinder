/** Reach / Target / Foundation tier badge (user-facing terminology only). */
export function TierBadge({ tier }: { tier: "reach" | "target" | "foundation" }) {
  const map = {
    reach: "bg-reach/10 text-reach border-reach/30",
    target: "bg-target/10 text-target border-target/30",
    foundation: "bg-foundation/10 text-foundation border-foundation/30",
  } as const;
  const label = { reach: "Reach", target: "Target", foundation: "Foundation" }[tier];
  return (
    <span className={`rounded-full border px-2 py-0.5 text-xs font-medium ${map[tier]}`}>
      {label}
    </span>
  );
}
