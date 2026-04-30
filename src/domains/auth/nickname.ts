const ADJECTIVES = [
  "brave",
  "bright",
  "calm",
  "cheerful",
  "clever",
  "cosmic",
  "curious",
  "cute",
  "eager",
  "fluffy",
  "funny",
  "gentle",
  "happy",
  "jolly",
  "kind",
  "lively",
  "lucky",
  "merry",
  "nimble",
  "noble",
  "plucky",
  "proud",
  "quick",
  "quiet",
  "sharp",
  "shiny",
  "silly",
  "spry",
  "stealthy",
  "sunny",
  "swift",
  "tame",
  "tidy",
  "tiny",
  "vivid",
  "witty",
  "zesty",
] as const;

const ANIMALS = [
  "badger",
  "bear",
  "beaver",
  "bunny",
  "cat",
  "cheetah",
  "crow",
  "deer",
  "dolphin",
  "duck",
  "eagle",
  "falcon",
  "finch",
  "fox",
  "gecko",
  "goose",
  "hawk",
  "hedgehog",
  "heron",
  "horse",
  "koala",
  "lemur",
  "lion",
  "lynx",
  "moose",
  "mouse",
  "newt",
  "otter",
  "owl",
  "panda",
  "penguin",
  "puffin",
  "rabbit",
  "raccoon",
  "raven",
  "seal",
  "sloth",
  "sparrow",
  "squirrel",
  "swan",
  "tiger",
  "turtle",
  "whale",
  "wolf",
] as const;

const RANDOM_DIGITS_MIN = 1000;
const RANDOM_DIGITS_RANGE = 9000;

function pickRandom<T>(items: readonly T[]): T {
  const index = Math.floor(Math.random() * items.length);
  return items[index]!;
}

function randomFourDigits(): number {
  return Math.floor(RANDOM_DIGITS_MIN + Math.random() * RANDOM_DIGITS_RANGE);
}

export function generateNickname(): string {
  return `${pickRandom(ADJECTIVES)}-${pickRandom(ANIMALS)}-${randomFourDigits()}`;
}
