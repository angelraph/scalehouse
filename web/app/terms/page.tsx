import type { Metadata } from "next";
import { DocShell, Section } from "@/components/Prose";

export const metadata: Metadata = { title: "Terms · Scalehouse" };

export default function Terms() {
  return (
    <DocShell eyebrow="Terms" title="Terms of use" intro={<>Plain terms for early software. <em>Last updated 15 October 2026.</em></>}>
      <Section id="what" title="What Scalehouse is">
        <p>
          Scalehouse is open-source software: a smart contract on Arc and an app and agent that use it. It is not a bank, an escrow
          service or a money transmitter. Payments move directly from the payer&apos;s wallet to the payee&apos;s wallet, under limits
          the payer sets and approves.
        </p>
      </Section>
      <Section id="early" title="Early software">
        <p>
          Scalehouse is new. Use small amounts, keep your limits low, and keep your budget approval no larger than you need. The
          software is provided as-is, without warranties.
        </p>
      </Section>
      <Section id="responsibility" title="Your responsibilities">
        <ul className="list-disc space-y-1 pl-5">
          <li>Check payee wallets before cutting tickets. A cut ticket can&apos;t be redirected.</li>
          <li>Keep your wallet secure. Anyone who controls the owner wallet controls the house.</li>
          <li>Follow the laws that apply to you and the people you pay.</li>
          <li>Don&apos;t upload personal information or anything you don&apos;t have the right to share.</li>
        </ul>
      </Section>
      <Section id="agent" title="The agent">
        <p>
          The agent makes payment decisions within the rules the contract enforces. It can be wrong about timing or priority; it
          can&apos;t pay an amount or a wallet other than what the ticket states. You can pause your house at any time.
        </p>
      </Section>
    </DocShell>
  );
}
