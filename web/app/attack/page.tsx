import type { Metadata } from "next";
import { DocShell, Section } from "@/components/Prose";
import { AttackLab } from "@/components/AttackLab";
import { isMainnet } from "@/lib/network";

export const metadata: Metadata = {
  title: "Try to trick the agent · Scalehouse",
  description: "Six real attacks on an AI payment agent, run live on Arc testnet. Watch the contract stop each one.",
};

const TESTNET_SITE = "https://scalehouse-testnet.vercel.app/attack";

export default function Attack() {
  return (
    <DocShell
      eyebrow="Red team"
      title="Try to trick the agent"
      intro={
        <>
          Pick an attack. It runs for real on Arc testnet against a public demo house.{" "}
          <em>No mocks: what you see is what the contract did, with a link to every transaction.</em>
        </>
      }
    >
      <Section id="lab" title="Pick an attack">
        {isMainnet ? (
          <p>
            Attacks spend test money only, so they run on the testnet site.{" "}
            <a href={TESTNET_SITE} className="underline">
              Open the attack lab on testnet →
            </a>
          </p>
        ) : (
          <AttackLab />
        )}
      </Section>
      <Section id="why" title="Why this matters">
        <p>
          Spending limits only cap how much an agent can spend. Scalehouse caps <strong>who</strong> it can pay and{" "}
          <strong>how much each payment</strong> is: the payee is locked when the ticket is cut, a second person confirms the count,
          and the contract works out the amount itself. A hijacked agent, a poisoned invoice or a retry bug can&apos;t move money
          anywhere else. Refusals freeze the ticket in public instead of failing silently.
        </p>
      </Section>
    </DocShell>
  );
}
