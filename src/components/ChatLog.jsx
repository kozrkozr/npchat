import { useEffect, useRef } from "react";
import { MessagesSquare, Flag } from "lucide-react";
import Avatar from "./Avatar.jsx";

function Bubble({ children }) {
  return (
    <div className="mt-1.5 w-fit max-w-[62ch] rounded-md border border-rule bg-log px-3.5 py-2.5 text-[15px] leading-[1.6] whitespace-pre-wrap break-words">
      {children}
    </div>
  );
}

function Row({ character, name, badge, children }) {
  return (
    <div className="npc-enter flex gap-3">
      <Avatar character={character} />
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2">
          <span className="label-xs" style={{ color: character.color }}>
            {name}
          </span>
          {badge && <span className="label-xs text-muted">{badge}</span>}
        </div>
        {children}
      </div>
    </div>
  );
}

function TypingRow({ character }) {
  return (
    <Row character={character} name={character.name} badge="typing">
      <Bubble>
        <span className="sr-only">{character.name} is typing…</span>
        <span aria-hidden="true" className="flex items-center gap-1.5 py-1">
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              className="npc-dot block h-[7px] w-[7px] rounded-full"
              style={{ background: character.color, animationDelay: `${i * 0.16}s` }}
            />
          ))}
        </span>
      </Bubble>
    </Row>
  );
}

/*
 * The outcome is the deliverable, not another chat line, so it gets its own
 * card. The facilitator is asked for "heading / - bullet" lines; anything that
 * is not a bullet is treated as a heading, which degrades gracefully.
 */
function OutcomeCard({ facilitator, text }) {
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
  return (
    <div className="npc-enter rounded-md border border-brass/50 bg-brass/[0.07] px-4 py-3.5">
      <div className="flex items-center gap-2">
        <Flag className="h-3.5 w-3.5 text-brass" strokeWidth={2} />
        <span className="label-xs text-brass">Outcome</span>
        <span className="label-xs text-muted">{facilitator.name}</span>
      </div>
      <div className="mt-3 flex flex-col gap-1.5">
        {lines.map((line, i) => {
          const bullet = /^[-•*]\s+/.test(line);
          if (bullet) {
            return (
              <div key={i} className="flex gap-2 text-[14.5px] leading-[1.55]">
                <span aria-hidden="true" className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-brass" />
                <span>{line.replace(/^[-•*]\s+/, "")}</span>
              </div>
            );
          }
          return (
            <div key={i} className={`label-xs text-ink ${i === 0 ? "" : "mt-2.5"}`}>
              {line.replace(/[:：]\s*$/, "")}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ErrorRow({ text }) {
  return (
    <div
      role="alert"
      className="npc-enter border-l-[3px] border-alert bg-alert/[0.06] px-3.5 py-2.5"
    >
      <div className="label-xs text-alert">System</div>
      <p className="mt-1 font-display text-[12.5px] leading-relaxed text-alert break-words">
        {text}
      </p>
    </div>
  );
}

function EmptyState({ topic, blockedReason }) {
  return (
    <div className="grid h-full place-items-center px-6 text-center">
      <div className="max-w-sm">
        <MessagesSquare className="mx-auto h-7 w-7 text-muted" strokeWidth={1.5} />
        <p className="mt-4 label-xs text-muted">The room is set</p>
        <p className="mt-2 text-[15px] leading-relaxed text-ink">
          {topic ? `“${topic}”` : "Give the room a topic to begin."}
        </p>
        <p className="mt-3 font-display text-[12px] leading-relaxed text-muted">
          {blockedReason ?? "Press Start and watch them argue."}
        </p>
      </div>
    </div>
  );
}

export default function ChatLog({
  facilitator,
  characters,
  turns,
  openingMessage,
  typingId,
  topic,
  blockedReason,
}) {
  const scrollerRef = useRef(null);
  const stickRef = useRef(true);

  const byId = (id) =>
    (facilitator && id === facilitator.id ? facilitator : null) ??
    characters.find((c) => c.id === id);
  const opening = openingMessage?.trim();
  const first = characters[0];
  const typing = typingId ? byId(typingId) : null;

  const onScroll = () => {
    const el = scrollerRef.current;
    if (!el) return;
    // Only keep pinning to the bottom while the reader is already there.
    stickRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 120;
  };

  useEffect(() => {
    const el = scrollerRef.current;
    if (!el || !stickRef.current) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    el.scrollTo({ top: el.scrollHeight, behavior: reduce ? "auto" : "smooth" });
  }, [turns, typingId]);

  const isEmpty = turns.length === 0 && !opening && !typing;

  return (
    <div
      ref={scrollerRef}
      onScroll={onScroll}
      className="flex-1 overflow-y-auto overscroll-contain"
    >
      {isEmpty ? (
        <EmptyState topic={topic} blockedReason={blockedReason} />
      ) : (
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-5 px-4 py-6 sm:px-6">
          {opening && first && (
            <Row character={first} name={first.name} badge="opening">
              <Bubble>{opening}</Bubble>
            </Row>
          )}

          {turns.map((turn) => {
            if (turn.kind === "error") return <ErrorRow key={turn.id} text={turn.text} />;
            if (turn.kind === "outcome")
              return <OutcomeCard key={turn.id} facilitator={facilitator} text={turn.text} />;
            const character = byId(turn.characterId);
            if (!character) return null;
            const isHost = facilitator && turn.characterId === facilitator.id;
            return (
              <Row
                key={turn.id}
                character={character}
                name={character.name}
                badge={isHost ? "facilitator" : null}
              >
                <Bubble>{turn.text}</Bubble>
              </Row>
            );
          })}

          {typing && <TypingRow character={typing} />}
        </div>
      )}
    </div>
  );
}
