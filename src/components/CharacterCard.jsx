import { Pencil, Trash2, Check } from "lucide-react";
import Avatar from "./Avatar.jsx";
import { VERBOSITY, MIN_CHARACTERS } from "../constants.js";

const field =
  "w-full rounded-[5px] border border-white/12 bg-panel2 px-2.5 py-2 text-[13px] text-white placeholder:text-white/30 focus:border-brass/70 focus:outline-none";

/* Verbosity reads as a three-cell stat bar, not a form field. */
function VerbosityStat({ value, onChange }) {
  return (
    <div>
      <div className="flex gap-1" role="group" aria-label="Verbosity">
        {[1, 2, 3].map((v) => (
          <button
            key={v}
            type="button"
            onClick={() => onChange(v)}
            aria-pressed={value === v}
            aria-label={`Verbosity ${v} — ${VERBOSITY[v].label}`}
            className={`h-2.5 flex-1 rounded-[2px] transition-colors ${
              v <= value ? "bg-brass" : "bg-white/12 hover:bg-white/20"
            }`}
          />
        ))}
      </div>
      <p className="mt-1.5 label-xs text-white/45">
        {VERBOSITY[value].label} · {VERBOSITY[value].hint}
      </p>
    </div>
  );
}

export default function CharacterCard({
  character,
  editing,
  onEdit,
  onDone,
  onChange,
  onRemove,
  canRemove,
}) {
  const set = (patch) => onChange({ ...character, ...patch });

  if (!editing) {
    return (
      <li className="rounded-[6px] border border-white/10 bg-white/[0.04] p-2.5">
        <div className="flex items-start gap-2.5">
          <Avatar character={character} size={30} />
          <div className="min-w-0 flex-1">
            <div className="label-xs text-white">{character.name || "Unnamed"}</div>
            <p className="mt-1 line-clamp-2 text-[12px] leading-snug text-white/55">
              {character.bio || "No bio yet."}
            </p>
            <div className="mt-1.5 flex flex-wrap gap-1">
              {character.traits.map((t) => (
                <span
                  key={t}
                  className="rounded-[3px] bg-white/10 px-1.5 py-0.5 font-display text-[10px] text-white/70"
                >
                  {t}
                </span>
              ))}
            </div>
          </div>
          <div className="flex shrink-0 gap-0.5">
            <button
              type="button"
              onClick={onEdit}
              aria-label={`Edit ${character.name}`}
              className="rounded-[4px] p-1.5 text-white/50 hover:bg-white/10 hover:text-white"
            >
              <Pencil className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={onRemove}
              disabled={!canRemove}
              aria-label={`Remove ${character.name}`}
              title={canRemove ? "Remove" : `Keep at least ${MIN_CHARACTERS} characters`}
              className="rounded-[4px] p-1.5 text-white/50 hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-25 disabled:hover:bg-transparent"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
        <div className="mt-2 flex gap-1" aria-hidden="true">
          {[1, 2, 3].map((v) => (
            <span
              key={v}
              className={`h-1 flex-1 rounded-[2px] ${
                v <= character.verbosity ? "bg-brass/70" : "bg-white/10"
              }`}
            />
          ))}
        </div>
      </li>
    );
  }

  return (
    <li className="rounded-[6px] border border-brass/45 bg-white/[0.06] p-2.5">
      <div className="flex items-center gap-2.5">
        <Avatar character={character} size={30} />
        <input
          value={character.name}
          onChange={(e) => set({ name: e.target.value })}
          placeholder="Name"
          aria-label="Character name"
          className={field}
        />
      </div>

      <label className="mt-2.5 block label-xs text-white/45">Bio</label>
      <textarea
        value={character.bio}
        onChange={(e) => set({ bio: e.target.value })}
        rows={3}
        placeholder="Who they are, what they care about, what they argue against."
        className={`${field} mt-1 resize-y leading-snug`}
      />

      <label className="mt-2.5 block label-xs text-white/45">Traits</label>
      <input
        value={character.traits.join(", ")}
        onChange={(e) =>
          set({
            traits: e.target.value
              .split(",")
              .map((t) => t.trim())
              .filter(Boolean),
          })
        }
        placeholder="cynical, impatient"
        className={`${field} mt-1`}
      />

      <div className="mt-3">
        <span className="block label-xs text-white/45">Verbosity</span>
        <div className="mt-1.5">
          <VerbosityStat value={character.verbosity} onChange={(v) => set({ verbosity: v })} />
        </div>
      </div>

      <button
        type="button"
        onClick={onDone}
        className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-[5px] bg-brass px-3 py-2 font-display text-[11px] font-semibold tracking-[0.12em] text-panel uppercase hover:bg-brass/85"
      >
        <Check className="h-3.5 w-3.5" /> Done
      </button>
    </li>
  );
}
