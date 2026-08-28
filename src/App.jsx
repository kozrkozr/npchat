import { useEffect, useRef, useState } from "react";
import {
  Play,
  Pause,
  RotateCcw,
  Plus,
  Flag,
  Download,
  Check,
  SlidersHorizontal,
} from "lucide-react";
import Sidebar from "./components/Sidebar.jsx";
import ChatLog from "./components/ChatLog.jsx";
import { callClaude, callFacilitator } from "./api.js";
import { buildExport, downloadMarkdown, exportFilename } from "./export.js";
import {
  DEFAULT_ROUNDS,
  ROUND_STEP,
  TURN_DELAY_MS,
  MIN_CHARACTERS,
  PRESET_TOPIC,
  presetCharacters,
  makeFacilitator,
  FACILITATOR_ID,
  uid,
} from "./constants.js";

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function Button({ variant = "ghost", children, ...props }) {
  const styles = {
    primary: "bg-ink text-log hover:bg-ink/85 border-ink",
    ghost: "bg-log text-ink border-rule hover:border-ink/40 hover:bg-white",
  }[variant];
  return (
    <button
      type="button"
      className={`flex items-center gap-1.5 rounded-[5px] border px-3 py-1.5 font-display text-[11px] font-semibold tracking-[0.12em] uppercase transition-colors disabled:cursor-not-allowed disabled:opacity-35 ${styles}`}
      {...props}
    >
      {children}
    </button>
  );
}

export default function App() {
  const [apiKey, setApiKey] = useState("");
  const [workspaceId, setWorkspaceId] = useState(""); // only for multi-workspace keys
  const [topic, setTopic] = useState(PRESET_TOPIC);
  const [openingMessage, setOpeningMessage] = useState("");
  const [language, setLanguage] = useState(""); // blank = follow the topic
  const [characters, setCharacters] = useState(presetCharacters);

  const [turns, setTurns] = useState([]);
  const [cursor, setCursor] = useState(0); // NPC turns taken; drives round-robin
  const [maxRounds, setMaxRounds] = useState(DEFAULT_ROUNDS);
  const [running, setRunning] = useState(false);
  const [typingId, setTypingId] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [facilitatorName, setFacilitatorName] = useState("");
  const [phase, setPhase] = useState("open"); // open | closing | done
  const [exported, setExported] = useState(null); // null | "ok" | "fail"

  /* The loop outlives any single render, so it reads live values from a ref. */
  const live = useRef({
    apiKey, workspaceId, topic, openingMessage, language, characters, maxRounds,
    facilitator: makeFacilitator(facilitatorName),
  });
  useEffect(() => {
    live.current = {
      apiKey, workspaceId, topic, openingMessage, language, characters, maxRounds,
      facilitator: makeFacilitator(facilitatorName),
    };
  }, [apiKey, workspaceId, topic, openingMessage, language, characters, maxRounds, facilitatorName]);

  const turnsRef = useRef([]);
  const cursorRef = useRef(0);
  const runningRef = useRef(false); // pause flag the running loop can actually see
  const loopRef = useRef(false); // guards StrictMode double-invoke / double-click
  const phaseRef = useRef("open");
  const wrapRef = useRef(false); // set by Wrap up; the loop picks it up after the current turn
  const closingStepRef = useRef(0); // 0 = facilitator call, 1..N = final words, N+1 = outcome

  const appendTurn = (turn) => {
    turnsRef.current = [...turnsRef.current, turn];
    setTurns(turnsRef.current);
  };

  const perRound = Math.max(characters.length, 1);
  const limitReached = cursor >= maxRounds * perRound;
  const roundNow = Math.min(Math.floor(cursor / perRound) + 1, maxRounds);

  const blockedReason = !apiKey.trim()
    ? "Add your Anthropic API key in Settings to start."
    : !topic.trim()
      ? "Give the room a topic to start."
      : characters.length < MIN_CHARACTERS
        ? `Add at least ${MIN_CHARACTERS} characters.`
        : null;

  const canStart = !blockedReason && !limitReached && phase !== "done";
  const canWrapUp = !blockedReason && phase === "open" && turns.length > 0;

  /* One participant turn. Returns false if the loop should stop. */
  async function takeTurn(speaker, closing) {
    const room = live.current;
    setTypingId(speaker.id);
    try {
      const text = await callClaude({
        apiKey: room.apiKey,
        workspaceId: room.workspaceId,
        topic: room.topic,
        openingMessage: room.openingMessage,
        language: room.language,
        facilitator: room.facilitator,
        character: speaker,
        characters: room.characters,
        turns: turnsRef.current,
        closing: closing ? { facilitatorName: room.facilitator.name } : null,
      });
      appendTurn({ id: uid(), characterId: speaker.id, text });
      return true;
    } catch (err) {
      appendTurn({ id: uid(), kind: "error", text: err.message });
      runningRef.current = false; // halt on error, no retries
      return false;
    } finally {
      setTypingId(null);
    }
  }

  async function facilitatorTurn(mode) {
    const room = live.current;
    setTypingId(FACILITATOR_ID);
    try {
      const text = await callFacilitator({
        apiKey: room.apiKey,
        workspaceId: room.workspaceId,
        mode,
        facilitator: room.facilitator,
        topic: room.topic,
        openingMessage: room.openingMessage,
        language: room.language,
        characters: room.characters,
        turns: turnsRef.current,
      });
      appendTurn({
        id: uid(),
        characterId: FACILITATOR_ID,
        kind: mode === "outcome" ? "outcome" : undefined,
        text,
      });
      return true;
    } catch (err) {
      appendTurn({ id: uid(), kind: "error", text: err.message });
      runningRef.current = false;
      return false;
    } finally {
      setTypingId(null);
    }
  }

  /*
   * Closing sequence: the facilitator calls time, every participant gives a
   * final word (answering any direct question), then the facilitator writes up
   * what the group arrived at. Step-indexed so Pause/Resume can cross it.
   */
  async function runClosingSequence() {
    const cast = live.current.characters;

    if (closingStepRef.current === 0) {
      if (!(await facilitatorTurn("call"))) return;
      closingStepRef.current = 1;
      if (!runningRef.current) return;
      await sleep(TURN_DELAY_MS);
    }

    while (closingStepRef.current <= cast.length) {
      if (!runningRef.current) return;
      const speaker = cast[closingStepRef.current - 1];
      if (!speaker) break;
      if (!(await takeTurn(speaker, true))) return;
      closingStepRef.current += 1;
      if (!runningRef.current) return;
      await sleep(TURN_DELAY_MS);
    }

    if (!runningRef.current) return;
    if (!(await facilitatorTurn("outcome"))) return;
    phaseRef.current = "done";
    setPhase("done");
  }

  async function runLoop() {
    if (loopRef.current) return;
    loopRef.current = true;
    runningRef.current = true;
    setRunning(true);

    try {
      while (runningRef.current) {
        if (wrapRef.current) {
          await runClosingSequence();
          break;
        }

        const { characters: cast, maxRounds: rounds } = live.current;
        if (cast.length < MIN_CHARACTERS) break;
        if (cursorRef.current >= rounds * cast.length) break;

        const speaker = cast[cursorRef.current % cast.length];
        if (!(await takeTurn(speaker, false))) break;
        cursorRef.current += 1;
        setCursor(cursorRef.current);

        if (!runningRef.current) break; // pause lands after the current turn
        await sleep(TURN_DELAY_MS);
      }
    } finally {
      runningRef.current = false;
      loopRef.current = false;
      setRunning(false);
      setTypingId(null);
    }
  }

  const start = () => {
    if (runningRef.current || (!canStart && !wrapRef.current)) return;
    if (turnsRef.current.length === 0) {
      // The opening message is spoken by the first character, so the next
      // voice is the second one — nobody replies to themselves.
      cursorRef.current = live.current.openingMessage.trim() ? 1 : 0;
      setCursor(cursorRef.current);
    }
    runLoop();
  };

  const pause = () => {
    runningRef.current = false;
  };

  const wrapUp = () => {
    if (!canWrapUp) return;
    wrapRef.current = true;
    closingStepRef.current = 0;
    phaseRef.current = "closing";
    setPhase("closing");
    if (!runningRef.current) runLoop();
  };

  const addRounds = () => {
    if (blockedReason || phase !== "open") return;
    const next = maxRounds + ROUND_STEP;
    setMaxRounds(next);
    live.current.maxRounds = next; // the loop reads the ref, not state
    if (!runningRef.current) runLoop();
  };

  const exportTimer = useRef(null);
  useEffect(() => () => clearTimeout(exportTimer.current), []);

  const exportTranscript = () => {
    if (!turns.length) return;
    const markdown = buildExport({
      topic,
      language,
      openingMessage,
      characters,
      facilitator: makeFacilitator(facilitatorName),
      turns,
      phase,
      cursor,
      maxRounds,
    });
    const ok = downloadMarkdown(markdown, exportFilename(topic));
    setExported(ok ? "ok" : "fail");
    clearTimeout(exportTimer.current);
    exportTimer.current = setTimeout(() => setExported(null), 2000);
  };

  const reset = () => {
    runningRef.current = false;
    turnsRef.current = [];
    cursorRef.current = 0;
    setTurns([]);
    setCursor(0);
    setMaxRounds(DEFAULT_ROUNDS);
    live.current.maxRounds = DEFAULT_ROUNDS;
    setTypingId(null);
    wrapRef.current = false;
    closingStepRef.current = 0;
    phaseRef.current = "open";
    setPhase("open");
  };

  // The empty state already spells out why Start is disabled — don't say it twice.
  const statusNote = phase === "done"
    ? "Wrapped up. Reset to run another discussion."
    : phase === "closing"
      ? "Wrapping up: final positions, then the outcome."
      : limitReached
    ? `Round limit reached — add ${ROUND_STEP} more to continue.`
    : turns.length
      ? blockedReason
      : null;

  return (
    <div className="flex h-dvh overflow-hidden bg-paper">
      {sidebarOpen && (
        <div
          onClick={() => setSidebarOpen(false)}
          className="fixed inset-0 z-30 bg-panel/50 lg:hidden"
          aria-hidden="true"
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-40 w-[86vw] max-w-[330px] transition-transform duration-200 lg:static lg:z-auto lg:w-[330px] lg:shrink-0 lg:translate-x-0 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <Sidebar
          apiKey={apiKey}
          setApiKey={setApiKey}
          workspaceId={workspaceId}
          setWorkspaceId={setWorkspaceId}
          topic={topic}
          setTopic={setTopic}
          openingMessage={openingMessage}
          setOpeningMessage={setOpeningMessage}
          language={language}
          setLanguage={setLanguage}
          facilitatorName={facilitatorName}
          setFacilitatorName={setFacilitatorName}
          characters={characters}
          setCharacters={setCharacters}
          onClose={() => setSidebarOpen(false)}
          onPartyGenerated={reset}
          locked={running}
        />
      </aside>

      <main className="flex min-w-0 flex-1 flex-col">
        <header className="border-b border-rule bg-log px-4 py-3 sm:px-6">
          <div className="mx-auto flex w-full max-w-3xl flex-col gap-3">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setSidebarOpen(true)}
                aria-label="Open settings"
                className="rounded-[5px] border border-rule p-1.5 text-muted hover:text-ink lg:hidden"
              >
                <SlidersHorizontal className="h-4 w-4" />
              </button>

              <div className="min-w-0 flex-1">
                <div className="label-xs text-muted">Topic</div>
                <div className="truncate text-[14px] font-medium">
                  {topic || "Untitled room"}
                </div>
              </div>

              <div className="flex shrink-0 items-center gap-2">
                {running && (
                  <span className="flex items-center gap-1.5 label-xs text-brass">
                    <span className="npc-dot h-1.5 w-1.5 rounded-full bg-brass" />
                    Live
                  </span>
                )}
                <span className="label-xs text-muted tabular-nums">
                  Round {roundNow}/{maxRounds}
                </span>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {running ? (
                <Button variant="primary" onClick={pause}>
                  <Pause className="h-3.5 w-3.5" /> Pause
                </Button>
              ) : (
                <Button variant="primary" onClick={start} disabled={!canStart}>
                  <Play className="h-3.5 w-3.5" />
                  {turns.length ? "Resume" : "Start"}
                </Button>
              )}
              <Button onClick={addRounds} disabled={!!blockedReason}>
                <Plus className="h-3.5 w-3.5" /> {ROUND_STEP} rounds
              </Button>
              <Button
                onClick={wrapUp}
                disabled={!canWrapUp}
                title={
                  phase === "open"
                    ? "Bring in the facilitator to close the discussion out"
                    : "The discussion is already being wrapped up"
                }
              >
                <Flag className="h-3.5 w-3.5" /> Wrap up
              </Button>
              <Button
                onClick={exportTranscript}
                disabled={!turns.length}
                title="Download the whole discussion as a Markdown file, ready to hand to another model"
              >
                {exported === "ok" ? (
                  <>
                    <Check className="h-3.5 w-3.5" /> Saved
                  </>
                ) : exported === "fail" ? (
                  <>
                    <Download className="h-3.5 w-3.5" /> Failed
                  </>
                ) : (
                  <>
                    <Download className="h-3.5 w-3.5" /> Export
                  </>
                )}
              </Button>
              <Button onClick={reset} disabled={!turns.length && cursor === 0}>
                <RotateCcw className="h-3.5 w-3.5" /> Reset
              </Button>

              {statusNote && (
                <p className="w-full font-display text-[11px] leading-relaxed text-muted sm:w-auto sm:flex-1 sm:text-right">
                  {statusNote}
                </p>
              )}
            </div>
          </div>
        </header>

        <ChatLog
          facilitator={makeFacilitator(facilitatorName)}
          characters={characters}
          turns={turns}
          openingMessage={openingMessage}
          typingId={typingId}
          topic={topic}
          blockedReason={blockedReason}
        />
      </main>
    </div>
  );
}
