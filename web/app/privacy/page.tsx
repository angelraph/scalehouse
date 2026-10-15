import type { Metadata } from "next";
import { DocShell, Section } from "@/components/Prose";

export const metadata: Metadata = { title: "Privacy · Scalehouse" };

export default function Privacy() {
  return (
    <DocShell eyebrow="Privacy" title="Privacy" intro={<>What we keep, and what is public by design. <em>Last updated 15 October 2026.</em></>}>
      <Section id="public" title="Public by design">
        <p>
          Tickets live on a public blockchain. Wallet addresses, quantities, prices, amounts, statuses and timestamps are visible to
          anyone, permanently. That is the point of Scalehouse: nobody can quietly change them.
        </p>
      </Section>
      <Section id="stored" title="What we store">
        <p>Alongside the chain we keep, in our database:</p>
        <ul className="list-disc space-y-1 pl-5">
          <li>Evidence for each ticket: the reference, the note and any photo the clerk added. These are shown on the ticket page.</li>
          <li>The agent&apos;s reasoning for each decision, and the screening results it used.</li>
          <li>Names a house owner gives to wallets, shown inside that house.</li>
        </ul>
        <p>We don&apos;t ask for names, emails or phone numbers, and we don&apos;t use tracking or advertising cookies.</p>
      </Section>
      <Section id="processors" title="Services we use">
        <p>
          Hosting (Vercel), database (Neon), the AI model provider that runs the agent (OpenAI), wallet infrastructure (Circle) and
          the {"Arc"} network. Ticket data sent to the AI provider is limited to what the agent needs to decide a payment.
        </p>
      </Section>
      <Section id="your-choices" title="Your choices">
        <p>
          Don&apos;t put personal information in notes or photos. Off-chain records (notes, photos, labels) can be removed on request
          through GitHub. On-chain records can&apos;t be removed by anyone.
        </p>
      </Section>
    </DocShell>
  );
}
