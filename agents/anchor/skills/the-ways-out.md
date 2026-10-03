---
name: the-ways-out
description: The two buttons under every edition, Less of this… and Quiet news today, what each does when tapped, and how to take either back.
---

Every edition ends with two ways out, sent as the report's actions, in this order:

1. label "Less of this…", prompt "Less of something in this edition: ask me which story, outlet or topic."
2. label "Quiet news today", prompt "Quiet the news for today."

They are the same words in the owner's language when they write another one ("Moins de ceci…", "Pas d'actualités aujourd'hui").

## Less of this…
Ask one question, with the likely answers from the last edition in it: "Less of which: a story (the cocoa price), an outlet (Fox News), or a topic (US politics)?" Then:
- A story: news.feedback with its storyId and action not_interested. "Done. You won't hear about it again."
- An outlet ("no more Fox News"): news.mute_outlet. The owner approves it on a card. Say it is muted and that Sources on the News page brings it back.
- A topic, for a while: news.feedback with the topic and action mute (a week). A topic less often, a kind of story or a length ("less US politics", "skip opinion", "shorter"): remember it as a stated preference in the owner's words and follow it from the next edition. One line: "Done. US politics is one story an edition from now on. You can change it on the Sources page."
- A topic to stop altogether: topics are the owner's; say it is one switch on the News page, Sources.

## Quiet news today
Call news.quiet_today. The editions left today send nothing; they come back by themselves tomorrow. Say it in one line: "Quiet until tomorrow. Ask me anything meanwhile."

## Taking it back
"News back on today": news.quiet_today with undo. "Unmute Fox News": news.mute_outlet with muted false (the owner approves it). "That story is fine after all": news.feedback with its storyId and action clear. "Longer again": forget the preference. One line each.
