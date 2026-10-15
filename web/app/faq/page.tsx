import type { Metadata } from "next";
import Link from "next/link";
import { DocShell } from "@/components/Prose";
import { chain } from "@/lib/network";

export const metadata: Metadata = { title: "FAQ · Scalehouse", description: "Common questions about Scalehouse." };

const GROUPS: { title: string; items: [string, React.ReactNode][] }[] = [
  {
    title: "The basics",
    items: [
      ["What is Scalehouse?", "A way for small businesses to pay people for goods delivered or work done, where the person who counts is never the only one deciding the payment. A clerk records it, a witness confirms it, an AI agent decides when to pay, and a contract on Arc makes sure the amount and the wallet are right."],
      ["Who is it for?", "Shops paying suppliers, teams paying freelancers, projects paying bounties, and buying floors paying farmers and haulers. Anyone who pays for something that is counted, weighed or checked."],
      ["Why is it called Scalehouse?", "A scalehouse was the public building where goods were weighed in front of everyone before anyone was paid. We do the same with money: everything is weighed in public, and every ticket is paid once."],
    ],
  },
  {
    title: "Money and safety",
    items: [
      ["Does Scalehouse hold my money?", "No. Your USDC stays in your wallet. You approve a budget, and each payment moves straight from your wallet to the person you owe in one transaction. The contract never has a balance."],
      ["Can the AI send money to the wrong person?", "No. The wallet is locked when the ticket is cut. If the agent names any other wallet, the contract freezes the ticket instead of paying, and the reason is public."],
      ["Can a ticket be paid twice?", "No. A ticket pays once. A retry is refused in public, and the same invoice or delivery note from the same payee can't be turned into a second ticket."],
      ["What if someone short-counts or over-claims?", "A second person counts. If the counts differ by more than the house allows, the ticket freezes for the owner. Within tolerance, the lower count is paid."],
      ["What limits can I set?", "The most one ticket can pay, the most paid per day, the total budget your wallet approves, and per-person caps. You can pause everything at any time."],
      ["What if the AI or the screening service is down?", "Nothing pays. Tickets wait. A screening outage is treated as do-not-pay, never as a reason to skip the check."],
    ],
  },
  {
    title: "Using it",
    items: [
      ["What do I need to start?", `A browser wallet on ${chain.name} (MetaMask, OKX Wallet or Rabby) with some USDC. Opening a house takes three confirmations and costs a few cents in network fees.`],
      ["Do the people I pay need anything?", `Only a wallet address on ${chain.name}. They don't need to sign anything or hold any gas.`],
      ["Do witnesses pay fees?", "No. Witnesses sign a message for free and Scalehouse submits it."],
      ["Can I pay in euros?", "Yes. A house can pay in EURC instead of USDC."],
      ["What does it cost?", "Network fees of about a cent per transaction. Scalehouse itself charges nothing today."],
    ],
  },
  {
    title: "Trust and transparency",
    items: [
      ["Why is everything public?", "Because the point is that nobody can quietly change a weight, a price or a payee. Public tickets protect the people being paid as much as the business."],
      ["How do I know what the AI decided and why?", "Every agent action stores its reasoning and puts a hash of it on-chain. Each ticket page shows the reasoning and checks the hash, so you can see it hasn't been edited."],
      ["Is the code open?", <>Yes. The contract, the agent and this site are on <a className="link" href="https://github.com/angelraph/scalehouse" target="_blank" rel="noreferrer">GitHub</a>.</>],
      ["Is this a bank?", "No. Scalehouse is software. It doesn't take deposits, hold funds or move money on anyone's behalf without the payer's own approval."],
    ],
  },
];

export default function Faq() {
  return (
    <DocShell
      eyebrow="FAQ"
      title="Questions"
      intro={
        <>
          Short answers. <em>For the full picture, read the <Link className="link" href="/docs">docs</Link>.</em>
        </>
      }
    >
      <div className="space-y-12">
        {GROUPS.map((g) => (
          <section key={g.title}>
            <h2 className="eyebrow mb-3">{g.title}</h2>
            <div className="card divide-y divide-rule">
              {g.items.map(([q, a]) => (
                <details key={q} className="group px-5 py-4 sm:px-6">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-semibold [&::-webkit-details-marker]:hidden">
                    {q}
                    <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-paper-2 text-ink transition-transform duration-300 group-open:rotate-45" aria-hidden>
                      +
                    </span>
                  </summary>
                  <div className="mt-3 max-w-2xl leading-relaxed text-muted">{a}</div>
                </details>
              ))}
            </div>
          </section>
        ))}
      </div>
    </DocShell>
  );
}
