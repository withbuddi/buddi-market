---
name: writing-an-edition
description: How to write a morning, midday or evening edition from the material the run carries, record it, read it aloud when voice is on, and send it.
---

An edition is read on a phone in two minutes. It is the unit: the owner never has to clear anything.

## The material
The run's first message carries the edition material: candidate stories by topic, each with its articles (outlet, language, title, lead, link, opinion, and lean when known), whether it was told before (status new or update, and what is new since), the owner's topics in their order, the owner's language, whether voice is on (voice, and voiceOff saying why not), whether the owner asked for quiet news today (quietToday), and a note. If it is missing or says it failed, call news.edition_material with the edition's name first. Read nothing else: no search, no article reads. One pass.

quietToday true: call mission.silent with "quiet news today" and write nothing.

## Pick
- Five to eight stories, in rank order, at least one for each topic that has news, topics in the owner's order (the "For this owner" line first, when there is one).
- No two stories on the same event.
- News only: leave out shopping deals and price drops ("bons plans", "à -100 €"), product reviews and comparisons, buying guides, how-tos and tips, even when they rank high. This comes before covering every topic: a topic whose only candidates are these is left out of the edition.
- A story that does not belong to its topic (a ticketing piece filed under AI) is left out, not moved.
- A story with status update says only what is new (its update articles). The stories under alreadyTold are never told again; they are there so no line repeats their event.
- Skip what the owner asked to see less of (your stated preferences).
- Fewer than three new stories: a short edition that says so in its first line ("A quiet morning: two things since last night.").

## Write
Plain text, exactly this shape, in the owner's language:

    Morning edition · Sat 3 Oct
    Seven stories. West African leaders meet in Lomé today; Congress kept the government open overnight.

    TOGO & WEST AFRICA
    ECOWAS leaders open a two-day summit in Lomé
    Leaders from the fifteen member states open a two-day summit in Lomé today, with trade corridors and the regional currency on the agenda.
    RFI Afrique (fr) and 3 more · <the link>

    UPDATE · Ghana and Côte d'Ivoire raise the cocoa farm-gate price
    The higher farm-gate price you heard about last night takes effect on Monday.
    Reuters and 1 more · <the link>

    AI
    OPINION · We are measuring AI with the wrong rulers
    An Economist column argues benchmarks reward tests models have already seen.
    The Economist · <the link>

    — Anchor · next at 12:30

- First line: the edition's name, a middle dot, the short day and date in the owner's language ("Édition du matin · sam. 3 oct." for an owner writing French).
- Second line: how many stories, then the one or two that matter most, in one sentence.
- Each topic's name in capitals on its own line, a blank line before it.
- Each story: its headline in the owner's language; then one or two sentences that add to the headline, not repeat it; then the first outlet, "and N more" when others carry it, a middle dot, and that outlet's link copied from the material.
- UPDATE · leads a story told before; OPINION · leads an opinion piece. Nothing else gets a label.
- When outlets disagree, the sentence says who says what, side by side.
- In US politics only, an outlet's lean in brackets after its name, when the material gives it and the outlets differ.
- Last line: "— Anchor · next at <time>" when the material gives the next edition's time (next), else just "— Anchor".
- When the material gives voiceOff, or voice is on but you could not make it (no speech tool, or it failed), add one line before the last: "Voice was off today: <why, in a few words>", once a day.
- No markdown, no bullets, no bold, no emoji. Each link appears once, whole.
- Length: each story at most two sentences and about 35 words after its headline; the whole edition under 2,500 characters. The mission's own limit is 4,000, so ignore a shorter message limit the run mentions, but stay short by writing tighter, never by dropping a story that belongs. Say who reports what, not how they label it ("breaking").

## Record, speak, send
1. In one step: news.edition_save with the edition's name, storyIds (the ids of the stories you told) and the text; and, when the material says voice is on and you hold speech.say, speech.say with the spoken version.
2. Then mission.report: urgency normal, the text exactly as written, link set to the link edition_save returned and linkLabel "Open edition", audio set to the voice note's id when you made one, and the two actions from your the-ways-out skill.

The text is always sent; the voice note is extra.

## The spoken version
At most 220 words, about ninety seconds. Open with "Good morning, here is your news for Saturday" (good afternoon at midday, good evening in the evening), in the owner's language. No links, no "and 3 more", no labels read as words: "an opinion piece in The Economist argues", "an update on the cocoa price". Outlets said as names. Numbers and dates written for the ear. End with "That's the news. The next edition is at half past twelve."

## Never
- Never add a story, a fact or a link that is not in the material.
- Never repeat a story told before without an update.
- Never pad a quiet edition to reach five.
