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
          You need one wallet with <strong>at least 2 USDC on Arc</strong>, and one other person to <strong>confirm</strong> each payment
          (a friend, teammate or staff member). They don&apos;t need a wallet app, and it&apos;s free for them.
        </p>
        <Steps
          items={[
            ["Open your house, once", <>Tap <strong>Connect</strong>, then <strong>Open a house</strong>. Give it a name, set a daily budget, and approve in your wallet. It costs a few cents.</>],
            ["Add your confirmer, once", <>On your house page, under <strong>Confirmers</strong>, type their name and tap <strong>Add confirmer</strong>. Then tap <strong>Send link on WhatsApp</strong>. That private link is all they ever need.</>],
            ["Pay someone", <>In <strong>Pay someone</strong>, paste their wallet, type the amount and what it&apos;s for, and tap <strong>Pay</strong>. Their wallet gets locked to the payment.</>],
            ["Your confirmer taps Confirm", <>Tap <strong>Ask them to confirm</strong>. They open their link, check it&apos;s real, and tap <strong>Confirm</strong>. The agent pays within about a minute, and the payment page is the receipt.</>],
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
