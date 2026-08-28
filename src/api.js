import {
  MODEL,
  MAX_TOKENS,
  OUTCOME_MAX_TOKENS,
  PALETTE,
  MIN_CHARACTERS,
  FACILITATOR_ID,
  uid,
} from "./constants.js";

const VERBOSITY_RULE = {
  1: "One or two short sentences. Maximally terse.",
  2: "Two or three sentences.",
  3: "One short paragraph, no more.",
};

// With no explicit language everything simply follows the topic, so a Ukrainian
// topic yields a Ukrainian conversation with no extra configuration.
export function languageRuleFor(language) {
  return language?.trim()
    ? `Write in ${language.trim()}. Always, no matter what language anyone else uses.`
    : "Write in the same language as the discussion topic.";
}

export function buildSystemPrompt(character, language, closing) {
  const languageRule = languageRuleFor(language);
  const closingRules = closing
    ? `\n\nThe discussion is being wrapped up:
- Give your FINAL position on the topic, in one or two sentences.
- If ${closing.facilitatorName} asked you something directly, answer that first, plainly and concretely.
- Do not open a new line of argument. Do not add caveats you have not already made.`
    : "";

  return `You are ${character.name}, a participant in a group chat.

Who you are: ${character.bio}
Your traits: ${character.traits.join(", ")}

Rules:
- Write ONLY your own message. No name prefix, no quotes, no stage directions, no explanations.
- ${VERBOSITY_RULE[character.verbosity] ?? VERBOSITY_RULE[2]}
- ${languageRule}
- This is a chat, not an essay. Write like a messenger app: conversational, informal is fine.
- React to the specific LAST message, not to the discussion as a whole.
- Do NOT summarize what others said. Do NOT open with "Interesting point" or "I agree".
- You have a position and you're not shy about disagreeing. Pushing your own view is fine.
- Never speak for another participant.
- Stay in character. Never mention that you are an AI or a language model.${closingRules}`;
}

/*
 * The transcript the speaker sees: the opening message (attributed to the
 * first character) followed by every real turn. Full history, no truncation.
 */
export function buildTranscript({ characters, turns, openingMessage, facilitator }) {
  const nameOf = (id) =>
    (id === FACILITATOR_ID ? facilitator?.name : null) ??
    characters.find((c) => c.id === id)?.name ??
    "Someone";
  const lines = [];
  const opening = openingMessage?.trim();
  if (opening && characters.length) {
    lines.push(`${characters[0].name}: ${opening}`);
  }
  for (const turn of turns) {
    if (turn.kind === "error") continue; // system rows are never shown to NPCs
    lines.push(`${nameOf(turn.characterId)}: ${turn.text}`);
  }
  return lines;
}

export function buildUserMessage({ topic, characters, turns, openingMessage, facilitator, tail }) {
  const lines = buildTranscript({ characters, turns, openingMessage, facilitator });
  const body = lines.length
    ? `Chat:\n${lines.join("\n")}`
    : "You're opening the discussion.";
  return `Discussion topic: ${topic}\n\n${body}\n\n${tail ?? "Your turn to reply."}`;
}

/*
 * The prompt forbids a name prefix, but models slip. Stripping it here is
 * cheap insurance for something the reader would notice immediately.
 */
export function sanitize(text, name) {
  let out = (text ?? "").trim();
  const prefix = new RegExp(`^${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*:\\s*`, "i");
  out = out.replace(prefix, "").trim();
  if (out.length > 1 && /^["“](.*)["”]$/s.test(out)) {
    out = out.replace(/^["“]/, "").replace(/["”]$/, "").trim();
  }
  return out;
}

function readableError(status, payload, raw) {
  const detail = payload?.error?.message || payload?.message || raw?.slice(0, 200);
  // A key that isn't scoped to one workspace must name the workspace per request.
  if (status === 400 && /anthropic-workspace-id/i.test(detail ?? "")) {
    return `${detail} Add it in Settings → Connection → Workspace ID (Console → Settings → Workspaces, "ID" column).`;
  }
  if (status === 404 && /workspace/i.test(detail ?? "")) {
    return `${detail} Check the Workspace ID in Settings, and that your key has access to it.`;
  }
  if (status === 401) {
    return `API key rejected (401). ${detail || "Check the key in Settings."}`;
    }
  if (status === 429) return `Rate limited (429). ${detail || "Slow down and retry."}`;
  if (status === 400) return `Bad request (400). ${detail || ""}`.trim();
  return `API error ${status}. ${detail || "No detail returned."}`.trim();
}

async function postMessage({ apiKey, workspaceId, system, userContent, maxTokens }) {
  let res;
  try {
    res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "anthropic-dangerous-direct-browser-access": "true",
        // Required for identity-linked keys that span more than one workspace.
        ...(workspaceId?.trim() ? { "anthropic-workspace-id": workspaceId.trim() } : {}),
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: maxTokens,
        system,
        messages: [{ role: "user", content: userContent }],
      }),
    });
  } catch {
    throw new Error(
      "Could not reach the Anthropic API — network blocked or offline."
    );
  }

  const raw = await res.text();
  let data = null;
  try {
    data = JSON.parse(raw);
  } catch {
    /* non-JSON body; readableError falls back to the raw text */
  }

  if (!res.ok) throw new Error(readableError(res.status, data, raw));
  return (data?.content ?? []).map((b) => b.text || "").join("");
}

export async function callClaude({
  apiKey,
  workspaceId,
  character,
  topic,
  characters,
  turns,
  openingMessage,
  language,
  facilitator,
  closing,
}) {
  const raw = await postMessage({
    apiKey,
    workspaceId,
    maxTokens: MAX_TOKENS,
    system: buildSystemPrompt(character, language, closing),
    userContent: buildUserMessage({
      topic,
      characters,
      turns,
      openingMessage,
      facilitator,
    }),
  });

  const text = sanitize(raw, character.name);
  if (!text) throw new Error(`${character.name} returned an empty message.`);
  return text;
}

/* ---------------------------------------------------------------- *
 * Cast generation
 * ---------------------------------------------------------------- */

const CAST_SYSTEM = (count, language) => {
  const languageRule = language?.trim()
    ? `Write every name, bio and trait in ${language.trim()}.`
    : "Write every name, bio and trait in the same language as the topic.";

  return `You design casts of characters for a group chat that has to be genuinely interesting to read.

Return ONLY a JSON array of exactly ${count} objects. No prose, no markdown fences, no explanation.

Each object has exactly these keys:
{"name": string, "bio": string, "traits": [string], "verbosity": 1 | 2 | 3}

Rules:
- name: a short chat handle. One word, no spaces, no title, no surname.
- bio: 1-3 sentences covering who they are, what they care about, and — most importantly — what they argue AGAINST.
- traits: 2 or 3 lowercase tags, e.g. "impatient", "dry humor", "contrarian".
- verbosity: 1 = one sentence, 2 = two or three, 3 = a short paragraph.
- ${languageRule}

What makes the cast good:
- They must genuinely DISAGREE. Give them incompatible priorities, not different flavours of the same opinion. At least one should think the topic itself is the wrong question.
- Vary verbosity deliberately: include at least one 1 and at least one 2. Never give everyone the same number.
- Vary register. Not everyone is a polite expert — someone should be blunt, funny, weary, or openly annoyed.
- No two characters may share a profession or a rhetorical style.
- Avoid stock panel-show casting: no generic "ethicist" plus "economist" plus "optimist" line-up unless the topic really demands it.`;
};

/* Models sometimes wrap JSON in prose or fences; take the first array. */
function extractJsonArray(text) {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const body = fenced ? fenced[1] : text;
  const start = body.indexOf("[");
  const end = body.lastIndexOf("]");
  if (start === -1 || end === -1 || end < start) return null;
  try {
    return JSON.parse(body.slice(start, end + 1));
  } catch {
    return null;
  }
}

function coerceCharacter(raw, index) {
  const name = String(raw?.name ?? "").trim().split(/\s+/)[0];
  if (!name) return null;
  const traits = Array.isArray(raw?.traits)
    ? raw.traits.map((t) => String(t).trim().toLowerCase()).filter(Boolean).slice(0, 3)
    : [];
  const verbosity = [1, 2, 3].includes(Number(raw?.verbosity)) ? Number(raw.verbosity) : 2;
  return {
    id: uid(),
    name: name.slice(0, 24),
    bio: String(raw?.bio ?? "").trim(),
    traits,
    verbosity,
    color: PALETTE[index % PALETTE.length],
  };
}

export async function generateCharacters({
  apiKey,
  workspaceId,
  topic,
  language,
  count,
  avoidNames = [],
}) {
  const avoid = avoidNames.filter(Boolean).length
    ? `\n\nThese casts were already generated for this topic — produce a clearly different one, with different people, different jobs and different angles: ${avoidNames.join(", ")}.`
    : "";

  const text = await postMessage({
    apiKey,
    workspaceId,
    maxTokens: 1500,
    system: CAST_SYSTEM(count, language),
    userContent: `Discussion topic: ${topic}\n\nDesign ${count} participants.${avoid}`,
  });

  const parsed = extractJsonArray(text);
  if (!Array.isArray(parsed) || !parsed.length) {
    throw new Error("The model did not return a usable cast. Try again.");
  }

  const cast = parsed.map(coerceCharacter).filter(Boolean).slice(0, count);
  if (cast.length < MIN_CHARACTERS) {
    throw new Error(`Only got ${cast.length} usable character(s). Try again.`);
  }
  return cast;
}


/* ---------------------------------------------------------------- *
 * Facilitator — closing the discussion out
 * ---------------------------------------------------------------- */

const FACILITATOR_CALL = (name, language) => `You are ${name}, the facilitator of this group chat. You are not one of the participants and you have no stake in the argument.

You have just been asked to bring the discussion to a close.

Write ONE short chat message that:
- tells the group you are wrapping up,
- names the 1 or 2 specific things that are still unresolved or unanswered,
- asks a SPECIFIC person, by name, a direct and concrete question about one of them.

Rules:
- 2 to 4 sentences. This is a chat message, not a report.
- Do NOT summarize the discussion. Do NOT restate what everyone said.
- Be concrete: refer to actual points people made, never "the interesting discussion" or "many good ideas".
- No name prefix, no quotes, no stage directions.
- ${languageRuleFor(language)}`;

const FACILITATOR_OUTCOME = (name, language) => `You are ${name}, the facilitator of this group chat. The discussion is over and everyone has given their final position.

Write what the group actually ARRIVED AT. This is the deliverable the group met for, so it must be usable by someone who did not read the chat.

Cover, in this order and only what applies:
- what they agreed on,
- what they still disagree on, naming who holds which position,
- the concrete decisions or next steps that follow.

Rules:
- Short bullet lines starting with "- ", under short plain headings on their own line.
- Be specific to THIS discussion. "They discussed trade-offs" is worthless — name the trade-off and the call that was made.
- Never invent agreement that did not happen. If they did not settle something, say so plainly.
- No preamble, no sign-off, no congratulations.
- ${languageRuleFor(language)}`;

export async function callFacilitator({
  apiKey,
  workspaceId,
  mode, // "call" | "outcome"
  facilitator,
  topic,
  characters,
  turns,
  openingMessage,
  language,
}) {
  const outcome = mode === "outcome";
  const raw = await postMessage({
    apiKey,
    workspaceId,
    maxTokens: outcome ? OUTCOME_MAX_TOKENS : MAX_TOKENS,
    system: outcome
      ? FACILITATOR_OUTCOME(facilitator.name, language)
      : FACILITATOR_CALL(facilitator.name, language),
    userContent: buildUserMessage({
      topic,
      characters,
      turns,
      openingMessage,
      facilitator,
      tail: outcome
        ? "Write what the group arrived at."
        : "Your turn to speak. Wrap it up.",
    }),
  });

  const text = sanitize(raw, facilitator.name);
  if (!text) throw new Error(`${facilitator.name} returned an empty message.`);
  return text;
}

/* ---------------------------------------------------------------- *
 * Scene generation
 * ---------------------------------------------------------------- */

/*
 * Asked cold, models converge on the same handful of topics. Seeding each
 * request with a random corner of life is what actually buys variety.
 */
const SCENE_ANGLES = [
  "a decision inside a small business",
  "a craft or creative trade arguing about its own tools",
  "something mundane in a household that people are weirdly firm about",
  "a city or neighbourhood question",
  "a hobby community with strong internal factions",
  "a workplace policy that sounds reasonable and annoys everyone",
  "a question about money, pricing, or who pays for what",
  "how a school, club, or course should be run",
  "an old technology being replaced by a new one",
  "an etiquette question with no settled answer",
  "a sport, game, or competition and how it should be judged",
  "food, cooking, or how a place should be run",
  "how something should be preserved, restored, or allowed to decay",
  "a rule that exists for safety and gets in the way",
  "travel, transport, or how people get around",
  "what a public space is actually for",
];

let lastAngle = null;
/* Never hand out the same angle twice running — consecutive repeats read as
 * "it keeps giving me the same thing" even when the draw is fair. */
function pickAngle() {
  let angle = SCENE_ANGLES[Math.floor(Math.random() * SCENE_ANGLES.length)];
  if (angle === lastAngle && SCENE_ANGLES.length > 1) {
    const rest = SCENE_ANGLES.filter((a) => a !== lastAngle);
    angle = rest[Math.floor(Math.random() * rest.length)];
  }
  lastAngle = angle;
  return angle;
}

function extractJsonObject(text) {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const body = fenced ? fenced[1] : text;
  const start = body.indexOf("{");
  const end = body.lastIndexOf("}");
  if (start === -1 || end === -1 || end < start) return null;
  try {
    return JSON.parse(body.slice(start, end + 1));
  } catch {
    return null;
  }
}

export async function generateScene({ apiKey, workspaceId, language, avoidTopics = [] }) {
  const hint = pickAngle();
  const avoid = avoidTopics.filter(Boolean).length
    ? `\n\nDo not produce anything close to these, which were already used: ${avoidTopics
        .map((t) => `"${t}"`)
        .join("; ")}.`
    : "";

  const system = `You invent topics for a group chat between a few opinionated people.

Return ONLY a JSON object. No prose, no markdown fences, no explanation:
{"topic": string, "opening": string}

- topic: the question or proposition they will argue about. One sentence, concrete and specific. It must be something reasonable people genuinely disagree on — not a question with an obvious right answer, and not a vague theme like "the future of work".
- opening: the literal first chat message, spoken by one of the participants. One or two sentences. A pointed opinion or a concrete complaint that invites pushback. Never a greeting, never "let's discuss X", never a question addressed to nobody.

${languageRuleFor(language)}`;

  const text = await postMessage({
    apiKey,
    workspaceId,
    maxTokens: 500,
    system,
    userContent: `Invent one scene. Steer it toward this area, but do not name the area literally: ${hint}.${avoid}`,
  });

  const parsed = extractJsonObject(text);
  const topic = String(parsed?.topic ?? "").trim();
  if (!topic) throw new Error("The model did not return a usable scene. Try again.");
  return { topic, opening: String(parsed?.opening ?? "").trim() };
}
