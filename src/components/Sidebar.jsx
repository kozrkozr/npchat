import { KeyRound, Users, Clapperboard, Plus, X, Eye, EyeOff, Sparkles, Loader2 } from "lucide-react";
import { useState } from "react";
import CharacterCard from "./CharacterCard.jsx";
import {
  MIN_CHARACTERS,
  MAX_CHARACTERS,
  DEFAULT_FACILITATOR_NAME,
  uid,
  nextColor,
} from "../constants.js";
import { generateCharacters, generateScene } from "../api.js";

const field =
  "w-full rounded-[5px] border border-white/12 bg-panel2 px-2.5 py-2 text-[13px] text-white placeholder:text-white/30 focus:border-brass/70 focus:outline-none";

function Section({ icon: Icon, title, meta, children }) {
  return (
    <section className="border-b border-white/10 px-4 py-4">
      <div className="mb-3 flex items-center gap-2">
        <Icon className="h-3.5 w-3.5 text-brass" strokeWidth={2} />
        <h2 className="label-xs text-white/70">{title}</h2>
        {meta && <span className="ml-auto label-xs text-white/35">{meta}</span>}
      </div>
      {children}
    </section>
  );
}

export default function Sidebar({
  apiKey,
  setApiKey,
  workspaceId,
  setWorkspaceId,
  topic,
  setTopic,
  openingMessage,
  setOpeningMessage,
  language,
  setLanguage,
  facilitatorName,
  setFacilitatorName,
  characters,
  setCharacters,
  onClose,
  onPartyGenerated,
  locked,
}) {
  const [editingId, setEditingId] = useState(null);
  const [showKey, setShowKey] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [genError, setGenError] = useState(null);
  const [pastNames, setPastNames] = useState([]); // steers regeneration away from repeats
  const [sceneBusy, setSceneBusy] = useState(false);
  const [sceneError, setSceneError] = useState(null);
  const [pastTopics, setPastTopics] = useState([]);

  const updateCharacter = (next) =>
    setCharacters((cs) => cs.map((c) => (c.id === next.id ? next : c)));

  const removeCharacter = (id) => {
    setCharacters((cs) => cs.filter((c) => c.id !== id));
    if (editingId === id) setEditingId(null);
  };

  const sceneBlocked = !apiKey.trim() ? "Add your API key first." : null;

  const makeScene = async () => {
    if (sceneBusy || sceneBlocked || locked) return;
    setSceneBusy(true);
    setSceneError(null);
    try {
      const scene = await generateScene({
        apiKey,
        workspaceId,
        language,
        avoidTopics: pastTopics,
      });
      setTopic(scene.topic);
      setOpeningMessage(scene.opening);
      setPastTopics((prev) => [...prev, scene.topic].slice(-8));
      onPartyGenerated?.(); // a new scene invalidates the transcript too
    } catch (err) {
      setSceneError(err.message);
    } finally {
      setSceneBusy(false);
    }
  };

  const genBlocked = !apiKey.trim()
    ? "Add your API key first."
    : !topic.trim()
      ? "Give the room a topic first."
      : null;

  const generateParty = async () => {
    if (generating || genBlocked || locked) return;
    setGenerating(true);
    setGenError(null);
    try {
      const cast = await generateCharacters({
        apiKey,
        workspaceId,
        topic,
        language,
        count: Math.min(Math.max(characters.length, MIN_CHARACTERS), MAX_CHARACTERS),
        avoidNames: pastNames,
      });
      setCharacters(cast);
      setPastNames((prev) => [...prev, ...cast.map((c) => c.name)].slice(-18));
      setEditingId(null);
      onPartyGenerated?.();
    } catch (err) {
      setGenError(err.message);
    } finally {
      setGenerating(false);
    }
  };

  const addCharacter = () => {
    if (characters.length >= MAX_CHARACTERS) return;
    const created = {
      id: uid(),
      name: `NPC ${characters.length + 1}`,
      bio: "",
      traits: [],
      verbosity: 2,
      color: nextColor(characters),
    };
    setCharacters((cs) => (cs.length >= MAX_CHARACTERS ? cs : [...cs, created]));
    setEditingId(created.id);
  };

  return (
    <div className="flex h-full flex-col bg-panel text-white">
      <header className="flex items-center gap-2.5 border-b border-white/10 px-4 py-3.5">
        <div className="grid h-7 w-7 place-items-center rounded-[5px] bg-brass font-display text-[13px] font-semibold text-panel">
          N
        </div>
        <div className="min-w-0">
          <div className="label-xs text-white">NPChat</div>
          <div className="font-display text-[10px] text-white/40">Session Zero</div>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close settings"
          className="ml-auto rounded-[4px] p-1.5 text-white/50 hover:bg-white/10 hover:text-white lg:hidden"
        >
          <X className="h-4 w-4" />
        </button>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <Section icon={KeyRound} title="Connection">
          <div className="relative">
            <input
              type={showKey ? "text" : "password"}
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="sk-ant-…"
              autoComplete="off"
              spellCheck={false}
              aria-label="Anthropic API key"
              className={`${field} pr-9`}
            />
            <button
              type="button"
              onClick={() => setShowKey((s) => !s)}
              aria-label={showKey ? "Hide API key" : "Show API key"}
              className="absolute inset-y-0 right-0 grid w-9 place-items-center text-white/40 hover:text-white"
            >
              {showKey ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
            </button>
          </div>
          <p className="mt-1.5 font-display text-[10px] leading-relaxed text-white/35">
            Held in memory for this tab only. Never stored, never committed.
          </p>

          <label htmlFor="npc-workspace" className="mt-3 block label-xs text-white/45">
            Workspace ID <span className="text-white/25">optional</span>
          </label>
          <input
            id="npc-workspace"
            value={workspaceId}
            onChange={(e) => setWorkspaceId(e.target.value)}
            placeholder="wrkspc_…"
            autoComplete="off"
            spellCheck={false}
            className={`${field} mt-1`}
          />
          <p className="mt-1.5 font-display text-[10px] leading-relaxed text-white/35">
            Only needed if your key is not scoped to a single workspace.
          </p>
        </Section>

        <Section icon={Clapperboard} title="Scene">
          <button
            type="button"
            onClick={makeScene}
            disabled={sceneBusy || !!sceneBlocked || locked}
            title={sceneBlocked ?? "Invent a random topic and opening line"}
            className="mb-2.5 flex w-full items-center justify-center gap-1.5 rounded-[5px] border border-brass/60 bg-brass/15 px-3 py-2 font-display text-[11px] font-semibold tracking-[0.12em] text-brass uppercase transition-colors hover:bg-brass/25 disabled:cursor-not-allowed disabled:opacity-35 disabled:hover:bg-brass/15"
          >
            {sceneBusy ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> Inventing…
              </>
            ) : (
              <>
                <Sparkles className="h-3.5 w-3.5" />
                {pastTopics.length ? "Another scene" : "Generate scene"}
              </>
            )}
          </button>

          <p className="mb-2.5 font-display text-[10px] leading-relaxed text-white/35">
            {sceneBlocked ??
              "Invents a random topic and opening line, and clears the transcript. Generate a party afterwards to match it."}
          </p>

          {sceneError && (
            <p
              role="alert"
              className="mb-2.5 border-l-2 border-alert bg-alert/10 px-2.5 py-2 font-display text-[10px] leading-relaxed text-alert"
            >
              {sceneError}
            </p>
          )}

          <label htmlFor="npc-topic" className="block label-xs text-white/45">
            Topic
          </label>
          <input
            id="npc-topic"
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder="What are they arguing about?"
            className={`${field} mt-1`}
          />

          <label htmlFor="npc-language" className="mt-3 block label-xs text-white/45">
            Language <span className="text-white/25">optional</span>
          </label>
          <input
            id="npc-language"
            value={language}
            onChange={(e) => setLanguage(e.target.value)}
            placeholder="Follows the topic"
            className={`${field} mt-1`}
          />

          <label htmlFor="npc-facilitator" className="mt-3 block label-xs text-white/45">
            Facilitator <span className="text-white/25">optional</span>
          </label>
          <input
            id="npc-facilitator"
            value={facilitatorName}
            onChange={(e) => setFacilitatorName(e.target.value)}
            placeholder={DEFAULT_FACILITATOR_NAME}
            className={`${field} mt-1`}
          />
          <p className="mt-1.5 font-display text-[10px] leading-relaxed text-white/35">
            Name of the host who closes the discussion out on Wrap up.
          </p>

          <label htmlFor="npc-opening" className="mt-3 block label-xs text-white/45">
            Opening message <span className="text-white/25">optional</span>
          </label>
          <textarea
            id="npc-opening"
            value={openingMessage}
            onChange={(e) => setOpeningMessage(e.target.value)}
            rows={2}
            placeholder="The literal first line, spoken by the first character."
            className={`${field} mt-1 resize-y leading-snug`}
          />
        </Section>

        <Section
          icon={Users}
          title="Party"
          meta={`${characters.length}/${MAX_CHARACTERS}`}
        >
          <button
            type="button"
            onClick={generateParty}
            disabled={generating || !!genBlocked || locked}
            title={genBlocked ?? `Replace the party with ${characters.length} characters written for this topic`}
            className="mb-2.5 flex w-full items-center justify-center gap-1.5 rounded-[5px] border border-brass/60 bg-brass/15 px-3 py-2 font-display text-[11px] font-semibold tracking-[0.12em] text-brass uppercase transition-colors hover:bg-brass/25 disabled:cursor-not-allowed disabled:opacity-35 disabled:hover:bg-brass/15"
          >
            {generating ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> Generating…
              </>
            ) : (
              <>
                <Sparkles className="h-3.5 w-3.5" />
                {pastNames.length ? "Regenerate party" : "Generate party"}
              </>
            )}
          </button>

          <p className="mb-2.5 font-display text-[10px] leading-relaxed text-white/35">
            {genBlocked ??
              `Writes ${characters.length} characters from the topic and clears the transcript. Edit any of them afterwards.`}
          </p>

          {genError && (
            <p
              role="alert"
              className="mb-2.5 border-l-2 border-alert bg-alert/10 px-2.5 py-2 font-display text-[10px] leading-relaxed text-alert"
            >
              {genError}
            </p>
          )}

          <ul className="flex flex-col gap-2">
            {characters.map((c) => (
              <CharacterCard
                key={c.id}
                character={c}
                editing={editingId === c.id}
                onEdit={() => setEditingId(c.id)}
                onDone={() => setEditingId(null)}
                onChange={updateCharacter}
                onRemove={() => removeCharacter(c.id)}
                canRemove={characters.length > MIN_CHARACTERS}
              />
            ))}
          </ul>

          <button
            type="button"
            onClick={addCharacter}
            disabled={characters.length >= MAX_CHARACTERS}
            className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-[5px] border border-dashed border-white/20 px-3 py-2 font-display text-[11px] tracking-[0.12em] text-white/60 uppercase hover:border-brass/60 hover:text-white disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:border-white/20 disabled:hover:text-white/60"
          >
            <Plus className="h-3.5 w-3.5" /> Add character
          </button>

          {locked && (
            <p className="mt-2.5 font-display text-[10px] leading-relaxed text-brass">
              Edits apply from the next turn onward.
            </p>
          )}
        </Section>
      </div>
    </div>
  );
}
