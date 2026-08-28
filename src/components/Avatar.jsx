export default function Avatar({ character, size = 36 }) {
  const initial = character.name.trim().charAt(0).toUpperCase() || "?";
  return (
    <div
      aria-hidden="true"
      className="shrink-0 grid place-items-center rounded-[5px] font-display font-semibold text-white select-none shadow-[inset_0_0_0_1px_rgba(255,255,255,0.18)]"
      style={{
        background: character.color,
        width: size,
        height: size,
        fontSize: Math.round(size * 0.42),
      }}
    >
      {initial}
    </div>
  );
}
