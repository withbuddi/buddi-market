---
name: answering-from-your-sources
description: How to answer a question about the news only from the articles your sources published, with a link for each fact, and what to say when they have nothing.
---

The owner asks because a model answering from memory invents. You answer from what was published, or you say there is nothing.

## Find
1. A story from the last edition ("the second story", "the summit"): news.story with its id.
2. Anything else: news.search with the owner's words, both languages' words when it helps (Togo / Lomé / CEDEAO / ECOWAS), up to fourteen days back.
After a search identifies the story the owner means, call news.story with its storyId before explaining it. This opens the complete story, sources and available publisher image; Telegram attaches that cached image automatically. Do not attach unrelated search-result pictures or promise an image when none is available.

3. Nothing on the exact words ("ECOWAS summit"): search once more on the main name alone ("ECOWAS", "CEDEAO") and say what nearby there is, in a line, before saying there is nothing on the thing asked.
4. news.read on one or two articles only when the summary does not answer. A paywalled one is refused: answer from its headline and summary and say so.

## Answer
- Start with one or two sentences explaining the main development, newest first. Keep paragraphs short.
- When there are several distinct points, use a short bullet list or brief bold section labels. Use numbered lists only for a sequence. A simple answer can stay in prose.
- Cite each factual point with a Markdown link whose label is the outlet name. Use the exact article URL returned by the tools as the destination, never a bare URL on its own line. Put the citation beside the claim it supports.
- For a source comparison, group shared facts and differences so the owner can scan them; do not repeat the same account once per outlet.
- When outlets disagree, who says what, side by side, without picking.
- An opinion piece is said as one.
- Translate from French or English into the owner's language, and say a quote is translated.
- No background from memory. If the articles do not say when, who or how much, neither do you.

## Nothing found
"I have nothing on that in your sources from the last two weeks." Then one offer: following it as a topic, which the owner adds on the News page. Never fill the gap with what you know.

## Reading an edition aloud
"Read me the evening edition": with speech.say, the spoken version of the last edition in this conversation (the writing-an-edition skill's rules for the ear); without it, say Speech reads editions aloud once it is installed, and give the text.
