import type { Metadata } from "next";
import Link from "next/link";
import { DocShell, Section, Steps } from "@/components/Prose";

export const metadata: Metadata = {
  title: "Get started · Scalehouse",
  description: "Get paid, or pay someone, with Scalehouse in five minutes.",
};

export default function Guide() {
  return (
    <DocShell
      eyebrow="Get started"
      title="Get paid, or pay someone, in 5 minutes"
      intro={
        <>
          An AI agent sends the money. <em>A contract makes sure it can only pay the right person, the right amount, once.</em>
        </>
      }
      nav={[
        { href: "#worker", label: "I'm getting paid" },
        { href: "#payer", label: "I'm paying" },
        { href: "#questions", label: "Questions" },
      ]}
    >
      <Section id="worker" title="If you're getting paid">
        <Steps
          items={[
            ["Get a wallet", "Install MetaMask, OKX Wallet or Rabby on your phone."],
            ["Copy your wallet address", "It starts with 0x. Send it to the person paying you, with what you did (e.g. “logo design”)."],
            ["That's it", "When they confirm the job, USDC lands in your wallet, usually within a minute. You never pay fees or sign anything to receive."],
          ]}
        />
      </Section>

      <Section id="payer" title="If you're paying someone">
        <p>
          You need a wallet with <strong>at least 2 USDC on Arc</strong>, and one other person to <strong>confirm</strong> the work
          (a friend, teammate or staff member; it&apos;s free for them).
        </p>
        <Steps
          items={[
            ["Open your house, once", <>Tap <strong>Connect</strong>, then <strong>Open a house</strong>. Answer three questions: your business name, who records (Me) and who confirms (paste their wallet), and what you pay for (e.g. “Logo design”, 1 USDC). Approve in your wallet; it costs a few cents.</>],
            ["Record the job", <>On your house page tap <strong>Cut a ticket</strong>. Tip: tap <strong>Take or choose photo</strong> and snap the invoice; the AI fills the form and warns you if anything looks wrong. Check the wallet you&apos;re paying, it gets locked.</>],
            ["Send it to your confirmer", <>On the ticket page tap <strong>Share on WhatsApp</strong>. They open it, connect their wallet, type what they checked and tap <strong>Sign my count</strong>.</>],
            ["Done", "The agent pays within about a minute. The ticket page shows Paid and why: send it to the worker as their receipt."],
          ]}
        />
        <div className="mt-6 flex flex-wrap gap-3">
          <Link href="/house/new" className="btn">
            Open a house →
          </Link>
          <Link href="/builders" className="btn btn-quiet">
            Paying testers? Use the preset
          </Link>
        </div>
      </Section>

      <Section id="questions" title="Questions">
        <ul className="list-disc space-y-2 pl-5">
          <li><strong>Can it pay the wrong person?</strong> No. The wallet is locked when the ticket is made. If anything tries to change it, the payment freezes in public.</li>
          <li><strong>Can it pay twice?</strong> No. Each ticket pays once, and the same invoice can&apos;t be used twice.</li>
          <li><strong>Where&apos;s my money until then?</strong> In your own wallet. Scalehouse never holds it.</li>
          <li><strong>Is it public?</strong> Yes, tickets are on a public board. Keep personal details out of notes and photos.</li>
          <li><strong>Need help?</strong> Message angelraph on the Canteen Discord or @RaphElevator on X.</li>
        </ul>
      </Section>
    </DocShell>
  );
}
