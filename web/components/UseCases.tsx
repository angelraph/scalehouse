"use client";

import { useState } from "react";

const CASES = {
  shop: {
    label: "A shop",
    title: "Paying suppliers for what actually arrived",
    steps: [
      ["The owner posts prices", "Rice, 50kg bag. Palm oil, 25L. One price each, public."],
      ["The clerk cuts a ticket at the door", "Ten bags, from this supplier, to this wallet. Locked."],
      ["The owner counts", "Nine bags arrived? The ticket pays for nine, or freezes if the gap is too big."],
      ["The agent pays", "The same day, in order of who has waited longest."],
    ],
  },
  work: {
    label: "A team",
    title: "Paying freelancers when the work is done",
    steps: [
      ["Post the milestone price", "Landing page design: one milestone, one price."],
      ["The freelancer cuts the ticket", "To their own wallet, against the job reference."],
      ["The client confirms", "One signature, no gas. Nobody can confirm their own work."],
      ["The agent pays", "Within the day's budget, with the reason on record."],
    ],
  },
  bounty: {
    label: "A bounty",
    title: "Paying contributors without paying twice",
    steps: [
      ["Post the bounty", "Bug fix: a fixed amount."],
      ["Each accepted submission is a ticket", "The submission link is the reference, so it can't be claimed twice."],
      ["A reviewer witnesses", "The reviewer can't be the one getting paid."],
      ["The agent pays", "And lowers limits for anyone whose claims keep coming up short."],
    ],
  },
} as const;

type Key = keyof typeof CASES;

/** Wise's segmented toggle over Aesop's quiet numbered list. */
export function UseCases() {
  const [k, setK] = useState<Key>("shop");
  const c = CASES[k];
  return (
    <div>
      <div className="segmented" role="tablist">
        {(Object.keys(CASES) as Key[]).map((key) => (
          <button key={key} type="button" role="tab" aria-current={k === key} aria-selected={k === key} onClick={() => setK(key)}>
            {CASES[key].label}
          </button>
        ))}
      </div>
      <h3 className="display mt-8 text-4xl sm:text-5xl" key={`${k}-t`}>
        {c.title}
      </h3>
      <ol className="mt-8 grid gap-px overflow-hidden rounded-2xl bg-rule sm:grid-cols-2" key={k}>
        {c.steps.map(([t, d], i) => (
          <li key={t} className="bg-paper p-6 transition-opacity duration-500" style={{ animation: `fadein .6s ${i * 90}ms both` }}>
            <span className="figure text-sm text-bronze">0{i + 1}</span>
            <div className="mt-2 font-semibold">{t}</div>
            <p className="mt-1 text-muted">{d}</p>
          </li>
        ))}
      </ol>
      <style>{`@keyframes fadein{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}`}</style>
    </div>
  );
}
