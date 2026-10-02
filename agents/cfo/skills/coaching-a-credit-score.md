---
name: coaching-a-credit-score
description: How to coach a credit score with the numbers this plugin holds: the levers in the order they actually move, what to ask the owner for once, and the one sentence to answer with. Read this before saying anything about a score, a card limit or utilization.
---

A credit score is coached with four levers, and they are not equal. Work them **in this order** and say only what the tools computed.

## Who does this
You do, as the CFO. It is not a separate agent and should not become one: coaching a score is reading the same cards, the same balances and the same cash flow you already read, and a second agent would need the same grant for no new reach.

## The levers, in order

1. **Utilization at reporting.** The only lever that moves inside one cycle, and the heaviest one the owner controls day to day. It is scored on the balance the issuer **reports at statement close**, not on the balance today and not on the balance at the due date. A payment made the day after the statement closes changes nothing until the next cycle. `finance.credit_overview` gives `reportedUtilizationEstimate` per card — the figure the bureaus are on course to see — plus the closing date, the days until it, and the payment that brings it to target. Quote those; never recompute them.
2. **On-time payments.** The heaviest factor overall, but it is a floor, not a lever: you cannot make it better this month, only worse. One missed minimum undoes a year of utilization work. `finance.payment_history` holds the record and `finance.minimum-due` watches the next three days.
3. **Age of accounts.** Moves only with time. Nothing to do about it except not damage it — see below.
4. **Mix.** The smallest factor by a wide margin. Never recommend opening a loan or a card "for the mix"; the hard inquiry and the lowered average age cost more than the mix gains.

## Ask once, then never again
A card's **limit**, its **statement closing day**, the day it **reports**, and its **utilization target** are facts only the owner has. They change almost never. `finance.credit_overview` lists everything missing under `askOnce`:

- ask for **all of it in one message** — a card's limit and its closing day together, every card at once;
- record the answer immediately with `finance.set_card_terms`;
- record a score the moment it is said, with `finance.record_credit_score` and the **bureau** it is for. A number mentioned in passing and not written down is gone with the conversation.

Then stop asking. An owner asked twice for the same limit stops answering.

## Never recommend closing an old card
Closing a card removes its limit from the total, which **raises** utilization overnight, and it starts the clock on losing the age of that account. An old card with no fee that the owner never uses is doing nothing but helping. If it carries a fee, the answer is asking the issuer to downgrade it to a no-fee product — the same account, the same age, the same limit — not closing it.

The same restraint applies to opening: no new card "to lower utilization". It lowers the ratio and costs an inquiry and average age, and the owner already has the cheaper move.

## How to say it
**One sentence, with a number in it.** The number is what makes it actionable; the sentence is what makes it heard.

> Amex closes Thursday at 42%; paying 400 by Wednesday brings it under 30%.

`finance.credit_overview` already carries that sentence per card, computed from the balance, the limit, the target and the closing date. Say it as written. Do not stack three cards, a score history and a lecture on mix into one message — the owner acts on one sentence and ignores five.

Before recommending a payment, check it against `finance.project_cashflow`: a payment that breaches the safety floor is not advice. If the money is not there, say what can be paid and what that lands at — a card at 34% is better than a card at 42% even when 30% was not reachable.

## What is never said
- A score you were not told. There is no way to compute one; `finance.credit_score_history` is the only source, and "no score recorded yet" is the honest answer.
- A comparison across bureaus or models. Experian and Equifax do not hold the same file; FICO 8 and VantageScore 3 do not score the same file the same way. A trend is only ever within one bureau.
- A promise of points. "Should help" is the strongest claim available; how much a score moves depends on the file, and the file is not visible here.
