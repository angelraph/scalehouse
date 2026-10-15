# Scalehouse

**Weighed in public. Paid once.**

Scalehouse is a payment system for small businesses that pay people for goods delivered or work
done: a shop paying its suppliers, a team paying freelancers, a project paying bounties. An AI agent
decides *when* and *whether* to pay. A contract on Arc decides *what is owed and to whom*, and the
agent can't override it.

Built for the Tameion Agents Hackathon (Canteen × Circle). Settled in USDC (and EURC) on Arc.

## The problem

In most small businesses the person who counts the goods is the person who sends the money. That's
how suppliers get short-weighed, paid late or paid twice, and how money ends up in the wrong wallet.
Double-entry bookkeeping doesn't catch any of it: the books balance whether the right person was paid
or not.

Putting an AI agent in charge of payments makes this worse, not better, unless something the agent
can't talk its way past stands between its output and the money.

## How it works

1. **The owner opens a house** and posts prices ("Rice, 50kg bag: 2 USDC"). Their USDC stays in their
   own wallet; they approve a budget.
2. **A clerk cuts a ticket** when goods arrive or work is delivered: quantity, price, and the payee's
   wallet. The payee and price are **locked** from this moment.
3. **A witness counts** and signs what *they* counted (free, no gas). Too far off and the ticket freezes.
4. **The agent decides.** It reads the house's position, screens the payee, looks at the
   counterparty's history, chooses what to pay first when money or the daily limit is short, and
   writes down why.
5. **The contract checks** the agent's payee and amount against the ticket. If they match, the USDC
   goes straight from the owner's wallet to the payee. If not, the ticket freezes in public.

Every step is on the [public board](web/app/board/page.tsx); every agent decision links to its full
reasoning, checked against the hash the agent put on-chain.

## What the agent decides (and what it can't)

| The agent decides | The contract decides |
|---|---|
| Whether a confirmed ticket is paid now, later, or flagged | The amount: confirmed quantity × posted price |
| Pay order when the float or daily limit is short | The payee: locked when the ticket was cut |
| Lowering a risky counterparty's per-ticket cap | Once only: a ticket can't pay twice |
| What to flag for the owner, and why | Limits: per ticket, per day, per counterparty |

The agent is Claude (`claude-opus-5-5`) with eight tools (`web/lib/agent/tools.ts`). Code-level
guards sit on top of the contract: no release to a payee that wasn't screened in the same run, and a
screening outage means **do not pay**.

## Circle stack

| Piece | Used for |
|---|---|
| **Arc** | Settlement, ~0.5s finality, USDC gas |
| **USDC / EURC** | Houses pay in either; the contract is token-agnostic |
| **Circle Developer-Controlled Wallets** | The agent's wallet. It signs contract calls through Circle; no private key in the app |
| **USDC blocklist (on-chain)** | Every payee is screened against Circle's own blocklist on Arc before money moves |
| **Contracts** | `ScaleTicket.sol`: the rule the agent can't exceed |

## Repository

```
contracts/   ScaleTicket.sol + 27 Foundry tests (incl. fuzz)   → docs/SPEC.md
web/         Next.js app: board, houses, cut/witness flows, agent, API
supabase/    one migration: evidence, agent reasoning, event index
```

## Run it

```bash
cd contracts && forge test
cd web && cp .env.example .env.local   # fill in
npm install && npm run dev
```

Run `supabase/migrations/0001_scalehouse.sql` once in your Supabase SQL editor.

## Honesty notes

- Nothing on the site is simulated. Every number is read from the ScaleTicket contract or its events.
- Test runs on Arc testnet are labelled as testnet. Traction numbers come from mainnet only.
- Scalehouse never holds funds. It isn't a bank, an escrow or a money transmitter: money moves from
  the payer's wallet to the payee's wallet in one transaction.
