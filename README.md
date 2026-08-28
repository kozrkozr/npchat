# NPChat

A room where several AI characters hold a group chat with each other. You don't
participate — you watch, and you control start/pause.

## Run

```bash
npm install
npm run dev
```

Open the app, paste an Anthropic API key into **Connection** in the sidebar, and
press **Start**.

If the key is a personal or service-account key that is *not* scoped to a single
workspace, the API also requires the workspace it acts in — paste that into
**Workspace ID** (`wrkspc_…`, from Console → Settings → Workspaces). A key scoped
to one workspace at creation time needs nothing here. The room comes pre-filled with three characters arguing about
Mars colonisation.

The key lives in React state for the tab only. It is never written to
`localStorage` and never committed. Nothing else is persisted either — reloading
the page gives you a clean room.

## Language

The dialogue works in any language Claude speaks, Ukrainian included. Two ways
in:

- **Just write the topic in that language.** With the **Language** field empty,
  every character is told to *"write in the same language as the discussion
  topic"*, so a Ukrainian topic produces a Ukrainian conversation with no other
  configuration.
- **Set the Language field** ("Ukrainian", "українська", "Polish", …) when you
  want the language pinned regardless — e.g. an English topic and bios but a
  Ukrainian conversation. That becomes a hard rule in each system prompt.

Bios, traits and the opening message can be written in the target language too,
and generally give better voices when they are. The UI faces (IBM Plex Sans and
Mono) both cover Cyrillic, so nameplates and avatar initials render in the same
typeface as everything else.

## Generating a scene

**Generate scene** in the sidebar invents a random topic and an opening line —
no input needed. Press it again ("Another scene") for a different one.

Asked cold, models converge on the same handful of topics, so each request is
seeded client-side with a random corner of life (a small-business decision, a
hobby community with factions, an etiquette question with no settled answer, and
so on — 16 in all), never repeating the previous one, and previously generated
topics are sent along to be avoided. The topic is required to be something
people genuinely disagree on, and the opening line to be a pointed opinion
rather than a greeting.

It clears the transcript, and respects the **Language** field. Generate a party
afterwards so the cast matches the new topic.

## Generating a party

**Generate party** in the sidebar writes a whole cast from the topic in one API
call, then you edit whatever you like — the generated characters are ordinary
characters, with the same name/bio/traits/verbosity editor as the preset ones.
Press it again ("Regenerate party") for a different cast; previously generated
names are sent along so the next attempt goes somewhere else rather than
producing near-duplicates.

It generates as many characters as the party currently holds, and clears the
transcript, since the old messages belong to people who are no longer in the
room. It respects the **Language** field, so a Ukrainian room gets Ukrainian
names and bios.

The prompt is tuned for the same thing the whole prototype is for: the cast is
told to hold *incompatible* priorities rather than different shades of one
opinion, to vary verbosity, and to avoid stock panel-show casting. A failed or
unparseable response leaves the existing party untouched and reports why.

## Wrapping up

A round-robin chat has no ending — it just hits the round limit mid-sentence.
**Wrap up** in the header brings in a facilitator to close it out. It is not one
of the participants, takes no round-robin turns, and is entirely optional: never
press it and nothing changes.

Pressing it runs a bounded closing sequence:

1. The facilitator calls time, names what is still unresolved, and asks specific
   people direct questions by name.
2. Every participant speaks once more. Their prompt switches to closing mode:
   final position in one or two sentences, answer any direct question first, no
   new tangents.
3. The facilitator writes up what the group actually arrived at — agreed,
   still-disagreed (naming who holds which position), and next steps.

That last message is the deliverable, so it renders as its own outcome card
rather than another chat bubble. The facilitator is told never to invent
agreement that did not happen.

The sequence is step-indexed, so Pause and Resume work across it. Name the host
in **Facilitator** in the sidebar (default `Facilitator`) — worth setting for a
non-English room.

## Exporting

**Export** in the header downloads the whole discussion as a Markdown file,
named from the topic and the date (`npchat-<topic>-YYYY-MM-DD.md`).

The file is built for handing to another model rather than for archiving, so it
carries more than the lines: topic, language, progress, and every participant's
bio, traits and verbosity. The receiving model needs to know who these people
are — "Гриць wants a lighting diagram" means nothing without knowing Гриць is
the gaffer. The outcome, if there is one, gets its own `## Outcome` section.

Section headings stay in English as machine-readable scaffolding even when the
dialogue is not. System error rows are left out; they are app diagnostics, not
dialogue.

## How a turn works

Each turn is one `POST /v1/messages` call for one character, made directly from
the browser (hence the `anthropic-dangerous-direct-browser-access` header). The
character gets a system prompt built from its bio, traits and verbosity, plus the
full chat transcript as a single user message — the way somebody who just joined
the group would see it. Turn order is plain round-robin.

The model is a constant at the top of `src/constants.js`:

```js
export const MODEL = "claude-haiku-4-5-20251001"; // fast and cheap for testing
// better character acting, more expensive: "claude-sonnet-5"
```

`max_tokens` is deliberately low (300) — it is the cheapest brake on characters
writing walls of text. Verbosity is a per-character stat (1–3) that maps to an
explicit length rule in the prompt.

Runs stop after 5 rounds by default; **+3 rounds** extends. On an API error the
loop halts and the error appears as a system row in the transcript.

## Layout

```
src/
  constants.js          model, palette, limits, the preset room
  api.js                prompt construction + the Messages API call
  App.jsx               the turn loop and controls
  components/
    Sidebar.jsx         API key, topic, opening message, party
    CharacterCard.jsx   character card + inline editor
    ChatLog.jsx         message rows, typing indicator, autoscroll
    Avatar.jsx
```

Design tokens and the visual direction are documented at the top of
`src/index.css`.
