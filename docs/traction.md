# Scalehouse traction (Arc mainnet, real USDC)

Every number below can be read from the ScaleTicket contract on Arc mainnet
(`0x8b5355CD5Ed88F6E70eA47C9dacC8bD2015A3BF7`) and on each public receipt page.

## Payments to outside wallets, 16 Oct 2026

| Ticket | Paid to | Amount | For | Time from "Pay" to paid | Receipt |
|---|---|---|---|---|---|
| #2 | 0x2cf2…928D | 0.25 USDC | bread | ~30 s after confirm | https://scalehouse-app.vercel.app/t/2 |
| #3 | 0xb5F0…fE9B | 0.10 USDC | peanut for chucks | 23 s after the check passed | https://scalehouse-app.vercel.app/t/3 |
| #4 | 0xf2f5…0C2c | 0.10 USDC | somtoo boy | 28 s after the check passed | https://scalehouse-app.vercel.app/t/4 |
| #5 | 0x1F8e…7A49 | 0.10 USDC | thank you chidi elect | ~30 s after the check passed | https://scalehouse-app.vercel.app/t/5 |

Tickets #3 to #5 used the one-wallet flow: the owner typed wallet, amount and reason and tapped Pay;
auto-approve checked the payment (Circle USDC blocklist screening, within the owner's limit); the AI agent
paid through its Circle Developer-Controlled Wallet. No second wallet, no switching.

## What they said (WhatsApp, 16 Oct 2026; quoted with permission)

- Recipient of ticket #3: "So fast and swift. I love the app, thank you for the money."
- dapope (ticket #4): "Bro you did great here, keep it up."
- Saint Bernard (ticket #5): "That was fast mehnn. I will surely recommend the app to my customer soon."

## Attack lab (Arc testnet, public)

Six live attacks on the agent, all stopped on-chain: poisoned-invoice prompt injection (the real GPT agent ignored it),
hijacked agent naming another wallet (frozen), 10x amount (frozen), pay twice (refused), same invoice twice (rejected),
short delivery (frozen). Anyone can run them: https://scalehouse-testnet.vercel.app/attack
