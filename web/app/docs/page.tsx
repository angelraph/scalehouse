import type { Metadata } from "next";
import Link from "next/link";
import { Code, DocShell, NextLinks, Section, Steps, Table } from "@/components/Prose";
import { chain, explorerAddress, scaleTicketAddress } from "@/lib/network";

export const metadata: Metadata = { title: "Docs · Scalehouse", description: "How to run a house, cut and witness tickets, and how the agent and contract work." };

const NAV = [
  { href: "#overview", label: "Overview" },
  { href: "#owners", label: "For owners" },
  { href: "#clerks", label: "For clerks" },
  { href: "#witnesses", label: "For witnesses" },
  { href: "#payees", label: "For people being paid" },
  { href: "#agent", label: "The agent" },
  { href: "#contract", label: "The contract" },
  { href: "#refusals", label: "Refusals and freezes" },
  { href: "#custody", label: "Custody and safety" },
  { href: "#costs", label: "Costs" },
];

export default function Docs() {
  return (
    <DocShell
      eyebrow="Documentation"
      title="How Scalehouse works"
      intro={
        <>
          Everything you need to run a house. <em>Owners, clerks, witnesses and the people being paid each have one short job.</em>
        </>
      }
      nav={NAV}
    >
      <Section id="overview" title="Overview">
        <p>
          A <strong>house</strong> is a business that pays people through Scalehouse. Each payment is a <strong>ticket</strong>: a
          record of goods delivered or work done, the posted price, and the wallet that gets paid. A ticket pays once, only after a
          second person has confirmed the quantity, and only if the agent&apos;s request matches the ticket exactly.
        </p>
        <Table
          head={["Role", "Who", "What they do"]}
          rows={[
            ["Owner", "The business", "Opens the house, posts prices, sets limits, approves a budget, reviews frozen tickets"],
            ["Clerk", "Whoever receives goods or records work", "Cuts tickets"],
            ["Witness", "A second person", "Counts again and confirms (free to sign)"],
            ["Agent", "Scalehouse's AI", "Decides when and whether to pay, and explains why"],
            ["Contract", "ScaleTicket on Arc", "Checks the agent against the ticket, then pays or freezes"],
          ]}
        />
      </Section>

      <Section id="owners" title="For owners">
        <Steps
          items={[
            ["Connect the wallet you pay from", "Any browser wallet that supports Arc: MetaMask, OKX Wallet, Rabby. Your money stays in this wallet."],
            ["Open a house", "Name it, choose USDC or EURC, and set three limits: the most one ticket can pay, the most paid per day, and how far a witness's count may differ before a ticket freezes."],
            ["Appoint the agent and approve a budget", "The agent can only call the contract. The budget is a token approval: the total Scalehouse may move from your wallet. Raise, lower or revoke it any time."],
            ["Post prices", "One price per thing you pay for: a bag, a kilo, an hour, a milestone. Tickets lock the price at the moment they're cut."],
            ["Add your team", "Give clerks and witnesses their roles. Nobody can witness a ticket they cut or are paid by."],
            ["Review what freezes", "A frozen ticket waits for you. Reopen it for a fresh count, or void it."],
          ]}
        />
        <NextLinks links={[["Open a house", "/house/new"]]} />
      </Section>

      <Section id="clerks" title="For clerks">
        <p>Cut a ticket when goods arrive or work is delivered. From your house page, choose <em>Cut a ticket</em>.</p>
        <Steps
          items={[
            ["Pick the posted price", "What was delivered."],
            ["Enter the quantity you counted", "Decimals are fine: 2.5 kg, 1.25 hours."],
            ["Paste the payee's wallet", "Check it twice. It is locked onto the ticket and nobody can change it later."],
            ["Add the reference", "An invoice, delivery note or job number. The same reference from the same payee can only be ticketed once."],
            ["Optionally add a note and a photo", "Photos are public on the board; leave out faces and personal details."],
          ]}
        />
      </Section>

      <Section id="witnesses" title="For witnesses">
        <p>
          Open the ticket, count for yourself, and enter what <em>you</em> counted. Signing is free: your wallet signs a message and
          Scalehouse submits it. If your count is within the house&apos;s tolerance, the ticket is confirmed at the lower of the two
          counts. If not, it freezes so the owner can look.
        </p>
      </Section>

      <Section id="payees" title="For people being paid">
        <p>
          You need a wallet address on {chain.name}. The money arrives directly from the business&apos;s wallet, usually seconds after
          your ticket is confirmed and the agent releases it. Every ticket has a public page you can share as a receipt.
        </p>
      </Section>

      <Section id="agent" title="The agent">
        <p>
          The agent runs whenever a ticket is confirmed, once a day on a schedule, and whenever an owner asks. It reads the house&apos;s
          position, lists payable tickets, screens each payee, reads a counterparty&apos;s history when something stands out, and then
          decides what to pay first.
        </p>
        <Table
          head={["Tool", "What it does"]}
          rows={[
            ["get_position", "Balance, approved budget, paid today, daily limit, spendable now"],
            ["list_payable_tickets", "Confirmed, waiting and frozen tickets with their amounts"],
            ["get_counterparty", "A wallet's history: paid, frozen, witness shortfalls, current cap"],
            ["screen_counterparty", "Circle's USDC blocklist on Arc, plus a sanctions list when configured"],
            ["release_ticket", "Asks the contract to pay, naming the payee and amount it expects"],
            ["defer_ticket", "Records a decision not to pay yet, and why"],
            ["flag_ticket", "Records that a ticket needs the owner"],
            ["lower_payee_cap", "Lowers one counterparty's per-ticket limit (never raises it)"],
          ]}
        />
        <p>
          Every action stores the agent&apos;s full reasoning, including the balance it saw, and puts a hash of that reasoning on-chain.
          Ticket pages show the reasoning and check the hash. Code-level guards sit on top of the contract: no payment to a payee not
          screened in the same run, and a screening outage means <strong>do not pay</strong>.
        </p>
      </Section>

      <Section id="contract" title="The contract">
        <p>
          ScaleTicket is one small, non-upgradeable contract.{" "}
          {scaleTicketAddress && (
            <a className="link figure" href={explorerAddress(scaleTicketAddress)} target="_blank" rel="noreferrer">
              View it on the explorer
            </a>
          )}
          . The full specification is in{" "}
          <a className="link" href="https://github.com/angelraph/scalehouse/blob/main/docs/SPEC.md" target="_blank" rel="noreferrer">
            docs/SPEC.md
          </a>
          .
        </p>
        <Code>{`cut(houseId, payee, rateId, quantity, evidenceHash)      // clerk
confirm(ticketId, observedQuantity)                     // witness
confirmBySig(ticketId, observedQuantity, witness, deadline, sig)
release(ticketId, payee, amount, rationaleHash)         // agent
  → pays confirmedQuantity × unitPrice / 1000, once
  → or emits ReleaseRefused / TicketFrozen with a reason`}</Code>
        <p>Quantities use three decimals (1500 means 1.5). Amounts use the token&apos;s six decimals.</p>
      </Section>

      <Section id="refusals" title="Refusals and freezes">
        <Table
          head={["Reason", "Effect", "Meaning"]}
          rows={[
            ["AlreadyPaid", "Refused", "The ticket already paid. It pays once."],
            ["NotConfirmed", "Refused", "No witness yet."],
            ["OverDailyCap", "Refused", "Today's limit is used up; it can pay tomorrow."],
            ["OverPayeeCap", "Refused", "Above this counterparty's limit."],
            ["InsufficientFloat", "Refused", "The paying wallet's balance or budget is short."],
            ["Paused", "Refused", "The house or the protocol is paused."],
            ["PayeeMismatch", "Frozen", "The agent named a different wallet than the ticket."],
            ["AmountMismatch", "Frozen", "The agent named a different amount than the rule."],
            ["QuantityMismatch", "Frozen", "The witness's count was too far from the claim."],
          ]}
        />
        <p>Refusals leave a ticket payable later. Freezes wait for the owner. Both are public and permanent.</p>
      </Section>

      <Section id="custody" title="Custody and safety">
        <p>
          Scalehouse never holds money. The contract has no balance: a payment moves from the owner&apos;s wallet to the payee&apos;s in
          one transaction. The protocol admin can pause releases in an emergency and can do nothing else. House ownership moves in two
          steps, so a house can never be pointed at a wallet that didn&apos;t agree.
        </p>
      </Section>

      <Section id="costs" title="Costs">
        <p>
          Network fees on {chain.name} are paid in USDC and are around a cent per transaction. Scalehouse charges nothing today. A house
          can set an optional levy (up to 10%) that it sends to a wallet of its choice, for example a cooperative fund.
        </p>
        <p>
          Questions? See the <Link className="link" href="/faq">FAQ</Link>.
        </p>
      </Section>
    </DocShell>
  );
}
