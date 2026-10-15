import type { Metadata } from "next";
import Link from "next/link";
import { DocShell, Section, Steps } from "@/components/Prose";
import { chain } from "@/lib/network";

export const metadata: Metadata = {
  title: "Pay your testers · Scalehouse",
  description: "Pay hackathon testers and contributors with a locked payee, a second check and a public receipt.",
};

export default function Builders() {
  return (
    <DocShell
      eyebrow="For builders"
      title="Pay your testers through Scalehouse"
      intro={
        <>
          You owe people for testing, bug reports and content. <em>Pay each one with a locked wallet, a second check and a public receipt, in about a minute.</em>
        </>
      }
    >
      <Section id="why" title="Why not just send USDC?">
        <p>
          You can. But a plain send leaves no record of what it was for, nothing stops paying the same report twice, and the
          moment an AI agent is the one sending, you&apos;re trusting it with the wallet. On Scalehouse every payment is a ticket:
          the tester&apos;s wallet is locked when it&apos;s created, someone else confirms the work, and the receipt is public on
          the board with the agent&apos;s reasoning attached.
        </p>
      </Section>

      <Section id="how" title="Set it up once (two minutes)">
        <Steps
          items={[
            ["Open a house", <>Name it after your project. Choose who records (you) and who confirms (a teammate or a friend who checks the work). Post one price, such as &ldquo;Tester task, 1 USDC&rdquo;.</>],
            ["Keep the limits small", "For example 2 USDC per ticket and 10 per day. Your USDC stays in your wallet; you approve one day's limit."],
          ]}
        />
        <div className="mt-6">
          <Link href="/house/new?preset=testers" className="btn">
            Open a house for testers →
          </Link>
        </div>
      </Section>

      <Section id="pay" title="Each time someone helps you">
        <Steps
          items={[
            ["Cut a ticket", "Pick the price, paste the tester's wallet, and use their report or post link as the reference. The same link can't be paid twice."],
            ["Send the confirm link", "Tap Share on WhatsApp (or copy the link) and send it to your confirmer. They check the work and tap once. It's free."],
            ["The agent pays", `Usually within a minute, in USDC on ${chain.name}. The ticket page is the receipt: share it with the tester.`],
          ]}
        />
      </Section>

      <Section id="traction" title="It counts for both of us">
        <p>
          Every ticket is a real payment to a real person, readable on-chain. That&apos;s traction for your project (you paid your
          testers) and for Scalehouse. If you try it, tell us in the Canteen Discord and we&apos;ll help you set it up.
        </p>
      </Section>
    </DocShell>
  );
}
