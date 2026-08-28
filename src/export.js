import { VERBOSITY, FACILITATOR_ID } from "./constants.js";

/*
 * The transcript is meant to be pasted into another model, so it carries the
 * context that makes the dialogue interpretable — who these people are and what
 * they were arguing about — not just the lines. Headings stay in English as
 * machine-readable scaffolding even when the dialogue itself is not.
 */
export function buildExport({
  topic,
  language,
  openingMessage,
  characters,
  facilitator,
  turns,
  phase,
  cursor,
  maxRounds,
}) {
  const out = [];
  const say = (line = "") => out.push(line);

  const perRound = Math.max(characters.length, 1);
  const roundNow = Math.min(Math.floor(cursor / perRound) + 1, maxRounds);
  const status =
    phase === "done" ? "wrapped up" : phase === "closing" ? "wrapping up" : "in progress";

  say("# Group chat transcript");
  say();
  say(`- **Topic:** ${topic || "(untitled)"}`);
  if (language?.trim()) say(`- **Language:** ${language.trim()}`);
  say(`- **Participants:** ${characters.length}`);
  say(`- **Progress:** round ${roundNow} of ${maxRounds}`);
  say(`- **Status:** ${status}`);
  say();
  say(
    "This is a transcript of a simulated group chat between fictional characters. " +
      "Each participant is described below, then the conversation follows in order."
  );
  say();

  say("## Participants");
  say();
  for (const c of characters) {
    say(`### ${c.name}`);
    if (c.bio) say(c.bio);
    if (c.traits.length) say(`*Traits:* ${c.traits.join(", ")}`);
    const v = VERBOSITY[c.verbosity];
    if (v) say(`*Verbosity:* ${c.verbosity} — ${v.hint}`);
    say();
  }

  const usedFacilitator = turns.some((t) => t.characterId === FACILITATOR_ID);
  if (usedFacilitator && facilitator) {
    say(`### ${facilitator.name}`);
    say(
      "Facilitator. Not one of the participants — brought in to close the discussion out."
    );
    say();
  }

  say("## Conversation");
  say();

  const nameOf = (id) =>
    (id === FACILITATOR_ID ? facilitator?.name : null) ??
    characters.find((c) => c.id === id)?.name ??
    "Unknown";

  const opening = openingMessage?.trim();
  if (opening && characters.length) {
    say(`**${characters[0].name}:** ${opening}`);
    say();
  }

  let outcomeOpen = false;
  for (const turn of turns) {
    if (turn.kind === "error") continue; // app diagnostics, not dialogue
    if (turn.kind === "outcome") {
      say("## Outcome");
      say();
      say(`Written by ${nameOf(turn.characterId)} at the end of the discussion.`);
      say();
      say(turn.text);
      say();
      outcomeOpen = true;
      continue;
    }
    if (outcomeOpen) {
      say("## Conversation (continued)");
      say();
      outcomeOpen = false;
    }
    const host = turn.characterId === FACILITATOR_ID ? " (facilitator)" : "";
    say(`**${nameOf(turn.characterId)}${host}:** ${turn.text}`);
    say();
  }

  return out.join("\n").replace(/\n{3,}/g, "\n\n").trim() + "\n";
}

/* A filename from the topic: keep letters (Cyrillic included), drop what a
 * filesystem would object to. */
export function exportFilename(topic) {
  const slug = (topic || "discussion")
    .replace(/[\\/:*?"<>|]+/g, " ")
    .replace(/\s+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48)
    .replace(/-+$/, "");
  const d = new Date();
  const stamp = [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, "0"),
    String(d.getDate()).padStart(2, "0"),
  ].join("-");
  return `npchat-${slug || "discussion"}-${stamp}.md`;
}

export function downloadMarkdown(text, filename) {
  try {
    const blob = new Blob([text], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.style.display = "none";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    // Give the download a tick to start before the blob goes away.
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
    return true;
  } catch {
    return false;
  }
}
