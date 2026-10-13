import { CAMPAIGNS } from "./campaigns";

/**
 * The player's standing for the portal leaderboard (Docs/LEADERBOARD.md).
 *
 * - **level**: the highest campaign won (1–25; 0 before the first win).
 *   Campaigns open in order, so this is how far up the road the player is.
 * - **score**: one point per distinct campaign won. Replays and stars do not add points.
 * - **reachedAt**: when the score last went up. The portal breaks a tie by
 *   who got there first.
 *
 * Pure: no DOM, no platform. main.ts saves it in the cloud progress and
 * submits it to the SDK leaderboard at battle end. Analytics are diagnostic.
 */
export const SCORE_PER_LEVEL = 100;
export const LEADERBOARD_SCHEMA = 2;

export interface LeaderboardEntry {
  schema: number;
  /** Highest campaign number won, 0–25. */
  level: number;
  /** Id of that campaign, e.g. "campaign-7-wolfmoor"; null before the first win. */
  campaignId: string | null;
  campaignName: string | null;
  /** Best stars summed over every campaign, 0–75. */
  totalStars: number;
  /** One point for each distinct campaign won, 0–25. Stars do not change the score. */
  score: number;
  /** ISO time the score last increased; null while it is 0. */
  reachedAt: string | null;
}

/**
 * Builds the entry from the best stars per campaign id. `previous` (the last
 * saved entry) keeps `reachedAt` when nothing improved, so replaying without
 * a better result doesn't push the player down a tie.
 */
export function leaderboardEntry(
  campaignStars: Readonly<Record<string, number>>,
  previous?: Partial<LeaderboardEntry> | null,
  now: Date = new Date(),
): LeaderboardEntry {
  let level = 0;
  let campaignId: string | null = null;
  let campaignName: string | null = null;
  let totalStars = 0;
  let completedCampaigns = 0;
  for (const campaign of CAMPAIGNS) {
    const stars = campaignStars[campaign.id] ?? 0;
    if (!Number.isFinite(stars) || Math.floor(stars) < 1) continue;
    completedCampaigns += 1;
    totalStars += Math.min(3, Math.floor(stars));
    if (campaign.number > level) {
      level = campaign.number;
      campaignId = campaign.id;
      campaignName = campaign.name;
    }
  }
  const score = completedCampaigns;
  const unchanged = previous?.schema === LEADERBOARD_SCHEMA && previous.score === score && typeof previous.reachedAt === "string";
  return {
    schema: LEADERBOARD_SCHEMA, level, campaignId, campaignName, totalStars, score,
    reachedAt: score === 0 ? null : unchanged ? previous.reachedAt as string : now.toISOString(),
  };
}

/** Reads a stored entry (from a save of any age), or null if it isn't one. */
export function readLeaderboardEntry(raw: unknown): LeaderboardEntry | null {
  if (!raw || typeof raw !== "object") return null;
  const entry = raw as Partial<LeaderboardEntry>;
  if (typeof entry.score !== "number" || !Number.isFinite(entry.score)) return null;
  return {
    schema: typeof entry.schema === "number" ? entry.schema : LEADERBOARD_SCHEMA,
    level: typeof entry.level === "number" ? entry.level : 0,
    campaignId: typeof entry.campaignId === "string" ? entry.campaignId : null,
    campaignName: typeof entry.campaignName === "string" ? entry.campaignName : null,
    totalStars: typeof entry.totalStars === "number" ? entry.totalStars : 0,
    score: entry.score,
    reachedAt: typeof entry.reachedAt === "string" ? entry.reachedAt : null,
  };
}

/**
 * True for a signed-in portal account (email or Google), false for a guest
 * or an unknown account type. The portal's leaderboard is for signed-in
 * players; guests still get an entry in their own save, which counts if
 * the portal keeps the player id when a guest registers.
 */
export function isRegisteredPlayer(authType: string | undefined | null): boolean {
  return typeof authType === "string" && authType.length > 0 && authType.toUpperCase() !== "GUEST";
}
