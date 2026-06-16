"use client";

import { useEffect, useState } from "react";

/**
 * Rotating "did you know" cards shown while a PI Finder run is computing (it can
 * take up to a minute). Static, curated content — reliable and zero-cost (no web
 * crawling). Rotates every 15 seconds.
 */
const FACTS: string[] = [
  "A US PhD usually takes 5–6 years — the first year or two are coursework + lab rotations before you commit to a thesis.",
  "Your Statement of Purpose often matters more than your GPA at top programs — fit with a specific advisor is what gets you in.",
  "Most STEM PhD students in the US are fully funded (tuition + stipend). You generally shouldn't pay for a STEM PhD.",
  "Graphene was first isolated with ordinary sticky tape — and won Geim & Novoselov the 2010 Nobel Prize in Physics.",
  "Lithium-ion battery pioneers Goodenough, Whittingham & Yoshino shared the 2019 Nobel Prize in Chemistry.",
  "CRISPR gene-editing earned Doudna & Charpentier the 2020 Nobel Prize in Chemistry.",
  "The h-index captures productivity and impact at once: h = 40 means 40 papers each cited at least 40 times.",
  "Moore's Law — transistor counts roughly doubling every two years — has held for about 50 years.",
  "Many US engineering programs have made the GRE optional or dropped it — always check each department.",
  "Lab rotations let first-year PhD students 'try out' 2–3 groups before choosing an advisor.",
  "AlphaFold's protein-structure predictions reshaped structural biology almost overnight — AI-for-science is booming.",
  "Perovskite solar cells leapt from ~4% to over 25% efficiency in roughly a decade — one of the fastest-improving materials ever.",
  "Solid-state batteries — swapping liquid electrolytes for solids — are a leading bet for safer, longer-range EVs.",
  "A great research fit usually beats a famous name: a supportive advisor in your exact area often matters more than rankings.",
  "Most US PhD applications are due in December for the following fall — start your SOP months ahead.",
  "The transistor (Bell Labs, 1947) won the 1956 Nobel Prize and launched the entire digital age.",
  "Cold-emailing professors before you apply — short, specific, and genuine — can meaningfully improve your odds.",
  "Quantum error-correction is a hot frontier: recent results show error rates dropping as qubit counts grow.",
];

export function FunFacts() {
  const [i, setI] = useState(() => Math.floor(Math.random() * FACTS.length));
  useEffect(() => {
    const t = setInterval(() => setI((x) => (x + 1) % FACTS.length), 15000);
    return () => clearInterval(t);
  }, []);
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 text-sm text-slate-700 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-wide text-brand-accent">Did you know?</p>
      <p className="mt-1 leading-relaxed">{FACTS[i]}</p>
    </div>
  );
}
