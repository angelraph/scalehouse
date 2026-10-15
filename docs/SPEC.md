# ScaleTicket: an evidence-locked payment primitive

ScaleTicket is a payment that settles once, and only when an independent witness agrees with the
claim. It is built for one problem that double-entry bookkeeping can't catch: **the person who
measures is the person who pays.** A ledger balances whether the supplier was short-weighed,
whether the invoice was paid twice, or whether the money went to the wrong wallet. ScaleTicket
makes each of those mistakes either impossible or public.

It is deliberately small (one contract, no proxy, no oracle) so that other builders can use it
for anything that is measured before it is paid: a weighbridge, proof of delivery, a timesheet,
a construction draw, a bounty.

## Roles

| Role | Who | Can | Cannot |
|---|---|---|---|
| **Owner** | The business. Its wallet pays. | Post prices, set limits, appoint clerks/witnesses/agent, pause, review frozen tickets | Change a cut ticket's payee, price or quantity |
| **Clerk** (issuer) | Whoever records the delivery or work | Cut a ticket | Witness their own ticket |
| **Witness** | A second person who counts | Confirm the quantity they observed (gasless via EIP-712) | Witness a ticket they cut or are paid by |
| **Agent** | Software (Scalehouse uses Claude) | Decide whether and when to release a confirmed ticket; lower a counterparty's cap; record decisions | Choose the amount or the payee; hold a clerk or witness role; raise any limit |
| **Protocol admin** | Deployer | Pause all releases in an emergency | Touch any house's funds, tickets or settings |

## Lifecycle

```
cut ──► Open ──confirm (within tolerance)──► Confirmed ──release (rule holds)──► Paid
          │                                      │
          └─confirm (outside tolerance)─► Frozen ◄┘ release with wrong payee or amount
                                           │
                       owner: reopen ──► Open      owner: void ──► Voided
```

1. **Cut.** `cut(houseId, payee, rateId, quantity, evidenceHash)`. The payee and the posted unit
   price are written into the ticket and never change. `evidenceHash` identifies the document
   (Scalehouse uses `keccak256(payee, normalized reference)`); one piece of evidence backs one live
   ticket per house, so a duplicate invoice is rejected at the door.
2. **Confirm.** The witness reports what *they* counted. Within the house's tolerance the ticket is
   confirmed at the **lower** of the two readings. Outside it, the ticket freezes with
   `QuantityMismatch`.
3. **Release.** The agent calls `release(ticketId, payee, amount, rationaleHash)`, naming the payee
   and amount it believes are right. The contract recomputes
   `confirmedQuantity × unitPrice / 1000`, compares, and only then moves funds from the owner's
   wallet straight to the payee (minus an optional levy).

## Refusals never revert

A rule violation during `release` doesn't revert. It emits an event and returns `(false, reason)`,
so every refusal is a permanent public record rather than a silent failed transaction.

| Reason | Effect | Meaning |
|---|---|---|
| `AlreadyPaid` | refuse | A retry or duplicate; the ticket pays once |
| `NotConfirmed` | refuse | No witness yet |
| `Paused` | refuse | House or protocol paused |
| `OverTicketCap` / `OverPayeeCap` / `OverDailyCap` | refuse | Exposure limits; payable later |
| `InsufficientFloat` | refuse | Owner's balance or allowance is short |
| `PayeeMismatch` | **freeze** | The agent named a different wallet than the ticket |
| `AmountMismatch` | **freeze** | The agent named a different amount than the rule |
| `QuantityMismatch` | **freeze** | The witness's count is outside tolerance |

Refusals leave the ticket payable. Freezes lock it until the owner reopens (fresh count) or voids it.

## Custody

The contract never holds funds. The owner approves an allowance; `release` transfers owner → payee
in the same call. House ownership moves in two steps (`offerHouse` / `acceptHouse`), so a house can
never be pointed at a wallet that didn't agree to pay for it.

## Risk-based limits instead of bans

`setPayeeCap` lets the agent **lower** the most a single ticket may pay one counterparty; only the
owner can raise it. A counterparty with repeated shortfalls gets smaller exposure, not a silent
refusal, and the change and its reason are on-chain.

## Audit trail

Every agent action carries a `rationaleHash`: the keccak256 of the agent's full reasoning stored
off-chain (canonical JSON with sorted keys). Anyone can fetch the reasoning, recompute the hash, and
check it against the event. `logDecision` records decisions that moved no money (defer, flag), so the
trail has no gaps.

## Using it for something else

| Use | Quantity | Rate | Witness |
|---|---|---|---|
| Produce buying floor | kg (3 decimals) | posted price per kg | supervisor or buyer assay |
| Shop deliveries | units | agreed price per unit | shop owner |
| Freelance milestones | 1 per milestone | agreed fee | client |
| Timesheets | hours | hourly rate | manager |
| Bounties | 1 per accepted submission | bounty amount | reviewer |
| Construction draws | % complete × 1000 | contract value / 100 | inspector |

## Verification

`contracts/test/ScaleTicket.t.sol`: 27 tests including fuzzing that the amount paid is always
exactly the rule's amount (never the agent's), paid at most once, and that the witness tolerance
boundary behaves exactly as specified.
