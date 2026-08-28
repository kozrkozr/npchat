export const MODEL = "claude-haiku-4-5-20251001"; // fast and cheap for testing
// better character acting, more expensive: "claude-sonnet-5"

export const MAX_TOKENS = 300;
export const OUTCOME_MAX_TOKENS = 800;
export const TURN_DELAY_MS = 600;
export const DEFAULT_ROUNDS = 5;
export const ROUND_STEP = 3;
export const MIN_CHARACTERS = 2;
export const MAX_CHARACTERS = 6;

/* Character colours — six distinct hues, all legible under white text. */
export const PALETTE = [
  "#c0523c", // clay
  "#2e7c6d", // teal
  "#57499b", // violet
  "#a8813c", // brass
  "#3e6ea0", // steel
  "#8e3e68", // mulberry
];

export const VERBOSITY = {
  1: { label: "Terse", hint: "one sentence" },
  2: { label: "Normal", hint: "two or three" },
  3: { label: "Verbose", hint: "short paragraph" },
};

export const uid = () => Math.random().toString(36).slice(2, 10);

export const nextColor = (characters) =>
  PALETTE.find((c) => !characters.some((ch) => ch.color === c)) ??
  PALETTE[characters.length % PALETTE.length];

/*
 * The facilitator is not a party member: it never takes a round-robin turn and
 * is not editable as a character. It exists to close the discussion out.
 */
export const FACILITATOR_ID = "facilitator";
export const FACILITATOR_COLOR = "#39404f";
export const DEFAULT_FACILITATOR_NAME = "Facilitator";

export const makeFacilitator = (name) => ({
  id: FACILITATOR_ID,
  name: name?.trim() || DEFAULT_FACILITATOR_NAME,
  color: FACILITATOR_COLOR,
});

export const PRESET_TOPIC = "Should humanity colonize Mars?";

export const presetCharacters = () => [
  {
    id: uid(),
    name: "Mirko",
    bio: "Techno-optimist startup founder. Believes any problem yields to scale and speed. Hates hearing that something is impossible.",
    traits: ["impatient", "grandiose"],
    verbosity: 2,
    color: PALETTE[0],
  },
  {
    id: uid(),
    name: "Dana",
    bio: "Planetary scientist. Knows the details and gets irritated when they are waved away. Deals in specifics, dryly mocks slogans.",
    traits: ["precise", "dry humor"],
    verbosity: 2,
    color: PALETTE[1],
  },
  {
    id: uid(),
    name: "Lev",
    bio: "Skeptical philosopher. Asks \"why\" instead of \"how\". Sees Mars as a form of avoidance.",
    traits: ["contrarian", "laconic"],
    verbosity: 1,
    color: PALETTE[2],
  },
];
