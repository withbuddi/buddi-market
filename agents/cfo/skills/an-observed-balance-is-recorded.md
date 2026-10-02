---
name: an-observed-balance-is-recorded
description: What to do the moment you read a real account balance — from the browser, a statement, or the owner. Read this before answering any question about how much money there is.
---

A balance you have **observed** is evidence that expires with the conversation. Record it before you answer.

## The rule
When you read an account balance from a live source — a bank or card page in the browser, a statement, a screenshot or PDF the owner sent, or the owner simply telling you what an account holds — call `finance.set_balance` **before** you give your answer, with:

- `balance`: the amount exactly as the source shows it;
- `account`: the account it belongs to;
- `asOf`: the date **the source itself** is from — the statement date, the "as of" line on the page, or today when you are looking at a live figure. Never a date you hope it means.

Then say so in your answer, in a clause: "…and I've recorded it as of the 21st." The owner should never have to wonder whether what you saw was kept.

## What is never recorded
A balance you **computed** is not an observation and never goes into `set_balance`:

- what `finance.project_cashflow` says the balance will be on Friday;
- a recorded balance minus the transactions you know about since;
- a total you added up across accounts;
- what would be left after a purchase you are being asked about.

Recording a computed figure quietly turns your arithmetic into the ledger's truth, and every projection afterwards starts from a guess. Record what you saw; explain what you worked out.

## Why it matters here
Driving the browser fills a transcript fast, so the conversation ends soon after a banking session and the next message starts a fresh one. What you saw on those pages does not come with it — only what you wrote down does. `finance.set_balance` is that writing down.

## A duplicate account is merged, never excluded
The same real account recorded twice — 'Checking' and 'Main Checking', one of them
carrying the history and the other the fresh balance — is fixed with
`finance.merge_accounts`, which moves the transactions, recurring items and
liabilities onto the account being kept, carries the newer balance over, and
deletes the duplicate. Never "fix" it by setting `includeInCashflow: false` on
one of them: that leaves two accounts, two balances and a projection quietly
missing money the owner has. Excluding an account says *this money cannot be
spent* — a 401k, a brokerage — and it never means *this row is wrong*.

An account recorded by mistake that holds nothing at all is deleted with
`finance.remove_account`; it refuses the moment anything points at it, and
then the answer is a merge. Both tools ask the owner first and show exactly
what will move and what will be deleted.

## Reading before answering
`finance.list_accounts` marks any balance older than a week with `stale: true` and its `balanceAgeDays`. A stale balance is not a wrong balance, but it is not an answer either:

- say the date you are quoting from, every time it is not today's;
- offer to go and read the real one, and record it when you do;
- `finance.project_cashflow` reports `oldestBalanceAsOf` — the oldest balance its answer rests on. When that is not today, name it in your reply.

## A goal on debt is a metric, a delta and a deadline
When the owner says they want their debt down by a number in a stretch of months, that is a **goal**, not a reminder and not a promise you make in a sentence. Propose it with `goal.set`, and propose it *once*, with:

- `title`: a short name the owner will recognise on a card months from now — "Debt down by 40k". It is **required**: a `goal.set` without one is refused before the owner ever sees the proposal;
- `metric`: `finance.total_debt` — the number buddi will measure, whoever is talking to it. `finance.card_balance` (with `params: { "account": "<the card>" }`) when the goal is about one card, `finance.cash_available` when it is about building cash up;
- `target`: `{ "kind": "delta", "value": -40000 }` — a **delta**, with its sign, because that is how the owner said it. An absolute target is for a number to land on;
- `deadline`: an ISO date you worked out yourself from today, never a phrase;
- `cadence`: `weekly` for debt. It moves with statements, not with hours;
- `milestones`: numbers **on the same scale as the target** — deltas when the target is a delta: `[-10000, -20000, -30000]`, never `[77400, 67400]`. Each fires once, ever.

The whole shape, as it plays out:

> "@cfo help me cut my debt by 40k in six months." The CFO reads the
> accounts, proposes: metric `finance.total_debt`, delta −40,000, deadline in
> 26 weeks, weekly cadence, milestones at −10k, −20k, −30k. The card says
> "From $87,400 today to $47,400 by 22 March: $1,540 a week, checked weekly,
> held by @cfo". The owner approves. Every week core measures; in week 6
> the projection lands short, the second miss wakes the CFO, which reads
> the cards and the statement dates, and answers with what changed and one
> recommendation, or proposes `goal.update`. At −10k the CFO says so, once.

You hold the goal, so you are the one woken about it: when a check wakes you, read `goal.status` before you say anything — the numbers there are measured, not remembered — then answer with what changed and **one** recommendation. You never move the line quietly: a target that is not going to work is a `goal.update` the owner sees, with the reason.
