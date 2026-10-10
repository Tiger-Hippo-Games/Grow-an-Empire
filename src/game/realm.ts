import { CAMPAIGNS } from "./campaigns";
import { SCORE_PER_LEVEL } from "./leaderboard";

/**
 * The Rival Realm: you and 1,008 AI rajas climbing the same 25-campaign road
 * (design: "Grow an Empire: Bharatvarsha", project docs). The player's goal is
 * rank 1.
 *
 * - Everyone is ranked by the portal leaderboard score (level × 100 + stars,
 *   `leaderboard.ts`), then by who got there first, so the in-game rank and the
 *   portal board agree on what counts.
 * - The field is fixed (seed 108), the same for every player. A rival's skill
 *   limits how far it can ever get: it clears a campaign only while its skill
 *   is within the share of all build orders that win that campaign
 *   (`CAMPAIGN_FIELD`, from Tools/balance/calibrate.ts), so the field thins
 *   exactly as fast as the campaigns get harder. Its stars follow the same
 *   tables.
 * - Rivals climb with time: the realm moves one **season** for each battle the
 *   player fights and one per real day away (at most 7 a visit). Each rival's
 *   pace (0.25–0.9 campaigns a season) and head start decide where it stands.
 * - Rivals never touch the player's city, stockpile or battles.
 *
 * The AI rows sit behind `RealmSource`, with one row shape for AI and real
 * players, so a later portal source can replace or mix in real players
 * without changing the screens. Pure: no DOM, no platform, no clock (callers
 * pass the time in).
 */

export const RIVAL_COUNT = 1008;
export const REALM_SEED = 108;
/** Seasons added for real days away, per visit. */
export const MAX_AWAY_SEASONS = 7;
const DAY_MS = 86_400_000;

/**
 * Share of all build orders that win campaign k with at least 1, 2 and 3
 * stars (index k − 1). From `npx tsx Tools/balance/calibrate.ts` (`field`);
 * `balance.test.ts` checks it against the live rules.
 */
export const CAMPAIGN_FIELD: ReadonlyArray<readonly [number, number, number]> = [
  [1, 1, 1],
  [0.8758, 0.5967, 0.1875],
  [0.8419, 0.4436, 0.1521],
  [0.7957, 0.4272, 0.1372],
  [0.6479, 0.3257, 0.117],
  [0.8811, 0.6189, 0.2024],
  [0.7578, 0.3911, 0.134],
  [0.7164, 0.369, 0.1239],
  [0.6821, 0.3682, 0.1117],
  [0.4993, 0.261, 0.0908],
  [0.7609, 0.3818, 0.132],
  [0.6362, 0.3628, 0.1113],
  [0.5906, 0.2961, 0.1167],
  [0.5528, 0.2886, 0.0984],
  [0.3498, 0.2024, 0.0664],
  [0.6271, 0.3286, 0.0944],
  [0.5186, 0.2686, 0.0944],
  [0.4965, 0.2556, 0.087],
  [0.4446, 0.2251, 0.0696],
  [0.1968, 0.1406, 0.0365],
  [0.5245, 0.2868, 0.1039],
  [0.403, 0.2223, 0.0626],
  [0.358, 0.2188, 0.0628],
  [0.3174, 0.207, 0.0604],
  [0.0504, 0.0268, 0.0138],
];

export const JANAPADAS = [
  "Kashi", "Kosala", "Anga", "Magadha", "Vajji", "Malla", "Chedi", "Vatsa",
  "Kuru", "Panchala", "Matsya", "Surasena", "Assaka", "Avanti", "Gandhara", "Kamboja",
] as const;
export const EMBLEMS = ["lotus", "conch", "elephant", "peacock", "tiger", "sun", "moon", "serpent", "trident", "chakra", "banyan", "fish"] as const;
export type Emblem = typeof EMBLEMS[number];
/** Banner colours, one per emblem slot (paired by the rival's index). */
export const BANNER_COLOURS = ["#b3261e", "#e0a526", "#0f6e6e", "#2b2f6b", "#7a3b8f", "#2f7d3a", "#c25e1a", "#5a6b7a"] as const;

const KINGS = ["Vikram", "Devavrata", "Indrasen", "Suryadev", "Bhanu", "Chandraketu", "Harsha", "Jayant", "Kirtivarman", "Mahendra",
  "Narasimha", "Pratap", "Rudradaman", "Satyaki", "Shatrujit", "Udayan", "Vasusena", "Yashodhar", "Amogh", "Bhoja",
  "Dhruv", "Gajendra", "Hemachandra", "Ishvar", "Kanishka", "Lokesh", "Madhav", "Nakul", "Parikshit", "Raghav",
  "Shaurya", "Tejas", "Uttam", "Vira", "Aditya", "Balaram", "Chitrangad", "Dushyant", "Ekalavya", "Govinda"];
const QUEENS = ["Mrinalini", "Damayanti", "Sanyogita", "Padmavati", "Rukmini", "Shakuntala", "Tara", "Urvashi", "Vasundhara", "Yashoda",
  "Amba", "Bhanumati", "Chitra", "Devika", "Gargi", "Hemlata", "Indumati", "Jayanti", "Kaveri", "Lilavati",
  "Madri", "Nandini", "Prabhavati", "Rajeshwari", "Savitri", "Tilottama", "Uma", "Vaidehi", "Ahalya", "Chandrika",
  "Draupadi", "Gauri", "Kamala", "Malini", "Nayantara", "Rohini", "Sharmishtha", "Sunanda", "Vrinda", "Mandakini"];

/** Titles by level (highest campaign won), for kings and queens alike. */
const TITLES: ReadonlyArray<{ upTo: number; king: string; queen: string }> = [
  { upTo: 0, king: "Vanavasi", queen: "Vanavasi" },
  { upTo: 5, king: "Samanta", queen: "Samanta" },
  { upTo: 10, king: "Raja", queen: "Rani" },
  { upTo: 15, king: "Maharaja", queen: "Maharani" },
  { upTo: 20, king: "Rajadhiraja", queen: "Rajarajeshwari" },
  { upTo: 25, king: "Samrat", queen: "Samragni" },
];
export const CHAKRAVARTIN = "Chakravartin";

export function titleFor(level: number, queen = false): string {
  const row = TITLES.find((entry) => level <= entry.upTo) ?? TITLES[TITLES.length - 1];
  return queen ? row.queen : row.king;
}

/** One rival in the fixed field. */
export interface RivalProfile {
  id: string;
  name: string;
  queen: boolean;
  janapada: string;
  emblem: Emblem;
  colour: string;
  /** How far it can ever get (0–25). */
  maxLevel: number;
  /** Stars on each campaign it can clear (index k − 1). */
  stars: number[];
  /** Campaigns climbed per season. */
  pace: number;
  /** Seasons of head start. */
  headStart: number;
}

/** A row on the realm board: the same shape for AI rajas and (later) real players. */
export interface RealmRow {
  id: string;
  kind: "ai" | "player";
  name: string;
  title: string;
  janapada: string;
  emblem: Emblem;
  colour: string;
  level: number;
  stars: number;
  score: number;
  /** Season the score was reached (earlier ranks higher on a tie). */
  reachedSeason: number;
}

/** Where rows come from. Today the seeded AI field; later the portal's players. */
export interface RealmSource {
  readonly kind: "ai" | "portal";
  /** Every rival's row at `season`. */
  rows(season: number): readonly RealmRow[];
}

/** mulberry32: small, fast and the same everywhere. */
function prng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

let field: RivalProfile[] | null = null;

/** The 1,008 rivals, generated once from the seed. */
export function rivalField(): readonly RivalProfile[] {
  if (field) return field;
  const random = prng(REALM_SEED);
  const names: Array<{ name: string; queen: boolean; janapada: string }> = [];
  for (const janapada of JANAPADAS) {
    for (const name of KINGS) names.push({ name, queen: false, janapada });
    for (const name of QUEENS) names.push({ name, queen: true, janapada });
  }
  for (let index = names.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(random() * (index + 1));
    [names[index], names[swap]] = [names[swap], names[index]];
  }
  field = [];
  for (let index = 0; index < RIVAL_COUNT; index += 1) {
    const skill = random();
    const stars: number[] = [];
    let maxLevel = 0;
    for (const [win, two, three] of CAMPAIGN_FIELD) {
      // A little luck per campaign, so the same skill doesn't always stop at the same gate.
      const roll = Math.min(1, Math.max(0, skill + (random() - 0.5) * 0.06));
      if (roll > win) break;
      // Stars take more luck than winning: even the best rajas drop a star now and then.
      const margin = Math.min(1, skill + random() * 0.15);
      stars.push(margin <= three ? 3 : margin <= two ? 2 : 1);
      maxLevel += 1;
    }
    const pick = names[index];
    field.push({
      id: `ai-${String(index + 1).padStart(4, "0")}`,
      name: `${pick.name} of ${pick.janapada}`,
      queen: pick.queen,
      janapada: pick.janapada,
      emblem: EMBLEMS[Math.floor(random() * EMBLEMS.length)],
      colour: BANNER_COLOURS[Math.floor(random() * BANNER_COLOURS.length)],
      maxLevel,
      stars,
      pace: 0.25 + random() * 0.65,
      headStart: random() * 4,
    });
  }
  return field;
}

/** Where one rival stands at `season`. */
export function rivalRow(rival: RivalProfile, season: number): RealmRow {
  const climbed = Math.floor(rival.pace * (Math.max(0, season) + rival.headStart));
  const level = Math.min(rival.maxLevel, climbed);
  const stars = rival.stars.slice(0, level).reduce((sum, value) => sum + value, 0);
  // The season it reached this level: the first season where its climb got this far.
  const reachedSeason = level === 0 ? 0 : Math.max(0, Math.ceil(level / rival.pace - rival.headStart));
  return {
    id: rival.id, kind: "ai", name: rival.name, title: titleFor(level, rival.queen), janapada: rival.janapada,
    emblem: rival.emblem, colour: rival.colour, level, stars, score: level * SCORE_PER_LEVEL + stars, reachedSeason,
  };
}

/** The seeded AI field as a source of rows. */
export class AiRealmSource implements RealmSource {
  readonly kind = "ai" as const;
  rows(season: number): readonly RealmRow[] {
    return rivalField().map((rival) => rivalRow(rival, season));
  }
}

/** Board order: higher score first, then whoever reached it first, then id. */
export function compareRows(a: RealmRow, b: RealmRow): number {
  return b.score - a.score || a.reachedSeason - b.reachedSeason || (a.kind === b.kind ? a.id.localeCompare(b.id) : a.kind === "player" ? -1 : 1);
}

/** What the game keeps about the realm, beside the stars in the save. */
export interface RealmState {
  schema: 1;
  /** Seasons the realm has moved since the player's first visit. */
  season: number;
  /** When the player was last here (ISO), for the seasons that pass while away. */
  lastSeen: string | null;
  /** Rank at the last result, for "812 → 655". */
  lastRank: number | null;
  /** Season the player's score last rose. */
  reachedSeason: number;
  /** The score at that season. */
  lastScore: number;
}

export function newRealmState(): RealmState {
  return { schema: 1, season: 0, lastSeen: null, lastRank: null, reachedSeason: 0, lastScore: 0 };
}

/** Reads unknown saved data as a realm state, or a fresh one. Never throws. */
export function readRealmState(raw: unknown): RealmState {
  const fresh = newRealmState();
  if (!raw || typeof raw !== "object") return fresh;
  const data = raw as Record<string, unknown>;
  const count = (value: unknown, fallback: number): number =>
    typeof value === "number" && Number.isFinite(value) && value >= 0 ? Math.floor(value) : fallback;
  return {
    schema: 1,
    season: count(data.season, 0),
    lastSeen: typeof data.lastSeen === "string" && !Number.isNaN(Date.parse(data.lastSeen)) ? data.lastSeen : null,
    lastRank: typeof data.lastRank === "number" && data.lastRank >= 1 ? Math.floor(data.lastRank) : null,
    reachedSeason: count(data.reachedSeason, 0),
    lastScore: count(data.lastScore, 0),
  };
}

/** Merges two copies (local and cloud): the realm only moves forward. */
export function mergeRealmStates(a: RealmState | undefined, b: RealmState | undefined): RealmState | undefined {
  if (!a || !b) return a ?? b;
  const later = a.season >= b.season ? a : b;
  const seen = [a.lastSeen, b.lastSeen].filter((value): value is string => value !== null).sort().pop() ?? null;
  return { ...later, lastSeen: seen };
}

/** A visit: seasons for the days away (at most 7), and the visit time recorded. */
export function visitRealm(state: RealmState, now: Date): RealmState {
  const last = state.lastSeen ? Date.parse(state.lastSeen) : NaN;
  const away = Number.isNaN(last) ? 0 : Math.min(MAX_AWAY_SEASONS, Math.max(0, Math.floor((now.getTime() - last) / DAY_MS)));
  return { ...state, season: state.season + away, lastSeen: now.toISOString() };
}

/** The player's own standing, as a board row. */
export interface PlayerStanding { name: string; queen?: boolean; level: number; stars: number }

export function playerRow(state: RealmState, player: PlayerStanding): RealmRow {
  const score = player.level * SCORE_PER_LEVEL + player.stars;
  return {
    id: "you", kind: "player", name: player.name, title: titleFor(player.level, player.queen), janapada: "Your janapada",
    emblem: "sun", colour: "#e0a526", level: player.level, stars: player.stars, score,
    reachedSeason: score > state.lastScore ? state.season : state.reachedSeason,
  };
}

/** The board around the player. */
export interface RealmStanding {
  rank: number;
  /** Everyone on the board, the player included. */
  of: number;
  player: RealmRow;
  top: RealmRow[];
  /** Up to 3 rows just above and below the player. */
  above: RealmRow[];
  below: RealmRow[];
  /** The nearest rival above (null at rank 1). */
  nemesis: RealmRow | null;
}

export function realmStanding(source: RealmSource, state: RealmState, player: PlayerStanding): RealmStanding {
  const me = playerRow(state, player);
  const rows = [...source.rows(state.season), me].sort(compareRows);
  const index = rows.indexOf(me);
  const rank = index + 1;
  if (rank === 1) me.title = CHAKRAVARTIN;
  return {
    rank, of: rows.length, player: me,
    top: rows.slice(0, 10),
    above: rows.slice(Math.max(0, index - 3), index),
    below: rows.slice(index + 1, index + 4),
    nemesis: index > 0 ? rows[index - 1] : null,
  };
}

/** The result of one battle on the realm. */
export interface RealmResult {
  state: RealmState;
  before: number;
  after: RealmStanding;
  /** Rivals who were above the player before the battle and are below now. */
  overtaken: number;
  /** The highest-ranked of them (the notable one to name). */
  notable: RealmRow | null;
}

/**
 * A battle was fought: the realm moves one season and the player's new
 * standing is ranked. `previous` is the player's standing before the battle.
 */
export function recordBattle(source: RealmSource, state: RealmState, previous: PlayerStanding, next: PlayerStanding): RealmResult {
  const beforeRows = [...source.rows(state.season), playerRow(state, previous)].sort(compareRows);
  const beforeIndex = beforeRows.findIndex((row) => row.kind === "player");
  const wasAbove = new Set(beforeRows.slice(0, beforeIndex).map((row) => row.id));
  const before = state.lastRank ?? beforeIndex + 1;
  const advanced: RealmState = { ...state, season: state.season + 1 };
  const nextScore = next.level * SCORE_PER_LEVEL + next.stars;
  const after = realmStanding(source, advanced, next);
  const afterRows = [...source.rows(advanced.season)].sort(compareRows);
  const passed = afterRows.filter((row) => wasAbove.has(row.id) && compareRows(row, after.player) > 0);
  const improved = nextScore > state.lastScore;
  return {
    state: {
      ...advanced,
      lastRank: after.rank,
      reachedSeason: improved ? advanced.season : advanced.reachedSeason,
      lastScore: Math.max(state.lastScore, nextScore),
    },
    before,
    after,
    overtaken: passed.length,
    notable: passed[0] ?? null,
  };
}

/** How many rajas have conquered each campaign at `season` (for the map). */
export function conquerorsByCampaign(source: RealmSource, season: number): number[] {
  const counts = new Array<number>(CAMPAIGNS.length).fill(0);
  for (const row of source.rows(season)) for (let index = 0; index < row.level; index += 1) counts[index] += 1;
  return counts;
}

/** Rivals camped at each campaign (their next one) at `season`, up to `limit` each. */
export function campedAt(source: RealmSource, season: number, limit = 3): RealmRow[][] {
  const camps: RealmRow[][] = CAMPAIGNS.map(() => []);
  const rows = [...source.rows(season)].sort(compareRows);
  for (const row of rows) {
    if (row.level >= CAMPAIGNS.length) continue;
    const camp = camps[row.level];
    if (camp.length < limit) camp.push(row);
  }
  return camps;
}

/** The player's level and stars from their best stars per campaign id. */
export function standingFromStars(campaignStars: Readonly<Record<string, number>>, name: string): PlayerStanding {
  let level = 0;
  let stars = 0;
  for (const campaign of CAMPAIGNS) {
    const earned = Math.min(3, Math.max(0, Math.floor(campaignStars[campaign.id] ?? 0)));
    if (earned > 0) { stars += earned; level = Math.max(level, campaign.number); }
  }
  return { name, level, stars };
}

/** A board row with its rank. */
export type RankedRow = RealmRow & { rank: number };

/** The whole board in order, with ranks; `janapada` filters it (ranks stay realm-wide). */
export function rankedRows(source: RealmSource, state: RealmState, player: PlayerStanding, janapada?: string): RankedRow[] {
  const me = playerRow(state, player);
  const rows = [...source.rows(state.season), me].sort(compareRows).map((row, index) => ({ ...row, rank: index + 1 }));
  if (rows[0].kind === "player") rows[0].title = CHAKRAVARTIN;
  return janapada ? rows.filter((row) => row.janapada === janapada || row.kind === "player") : rows;
}
