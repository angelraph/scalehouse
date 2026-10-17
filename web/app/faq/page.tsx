import type { Metadata } from "next";
import Link from "next/link";
import { DocShell } from "@/components/Prose";
import { chain } from "@/lib/network";

export const metadata: Metadata = { title: "FAQ · Scalehouse", description: "Common questions about Scalehouse." };

const GROUPS: { title: string; items: [string, React.ReactNode][] }[] = [
  {
    title: "Before you use Scalehouse",
    items: [
      [
        "How is this different from a bank transfer or a card payment?",
        "Banks and cards mostly check that you are you and that you have the money. They don't check whether the payment itself is right: the correct person, the agreed amount, not paid already. Scalehouse checks the payment before it moves. The receiver's wallet is locked, the amount comes from the agreed price, a second check approves it, and it can only be paid once. If anything doesn't match, it freezes instead of sending. Banks fix mistakes after the fact; Scalehouse stops them before they happen.",
      ],
      [
        "Why not just send USDC from my wallet?",
        "You can, and for paying a friend once that's fine. But a wallet send has no record of what it was for, can be sent twice, and can be sent to a wrong or fake address. The moment staff or an AI agent pays for you, that's a real risk. Scalehouse is just as fast (about 30 seconds) but every payment is checked, explained and impossible to send twice.",
      ],
      [
        "Is my money safe? Who holds it?",
        "You do. Your USDC stays in your own wallet until the moment you pay someone, then it goes straight from you to them. Scalehouse never holds funds, and you set a daily budget so nothing can go out beyond it. We will never ask for your recovery phrase.",
      ],
      [
        "Is anyone actually using it?",
        <>
          Yes, real people are paid with real USDC on Arc mainnet, each in under 30 seconds. Every number is public and read straight from the chain on the{" "}
          <Link className="link" href="/traction">
            traction page
          </Link>
          , and every payment has a receipt anyone can open.
        </>,
      ],
      [
        "What if I make a mistake or something looks wrong?",
        "A payment that doesn't match what was recorded (wrong wallet, wrong amount, a short delivery or a reused invoice) freezes in public instead of going through, and you can review it on your house page. For bigger payments you can add a confirmer who has to tap Confirm first, and you can pause all payments at any time. Before you tap Pay, double-check the wallet address: once a correct payment is sent, like any USDC transfer, it can't be pulled back.",
      ],
      ["What does it cost?", "About a cent in network fees per transaction on Arc. Scalehouse itself charges nothing today."],
      [
        "Can I try it without real money?",
        <>
          Yes. Open the{" "}
          <a className="link" href="https://scalehouse-testnet.vercel.app">
            testnet version
          </a>
          , tap &ldquo;Get test USDC&rdquo; for free play money, and do everything exactly as you would for real.
        </>,
      ],
    ],
  },
  {
    title: "The basics",
    items: [
      ["What is Scalehouse?", "A way for businesses, builders and AI agents to pay anyone in USDC in about 30 seconds from one wallet, where every payment is checked before it moves. You record who you're paying and what for, a second check approves it (automatically for small amounts), an AI agent screens the wallet and pays, and a contract on Arc makes sure the amount and the wallet are right."],
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
      ["What do I need to start?", `A browser wallet on ${chain.name} (MetaMask, OKX Wallet or Rabby) with a little USDC. Opening a house takes two questions and one approval, and costs about a cent.`],
      ["Do the people I pay need anything?", `Only a wallet address on ${chain.name}. They don't need to sign anything or hold any gas.`],
      ["Do confirmers need a wallet or pay fees?", "No. A confirmer gets a private link and taps Confirm. Scalehouse gives them a Circle wallet behind the scenes and submits the confirmation for free."],
      ["Can I pay in euros?", "Yes. A house can pay in EURC instead of USDC."],
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
