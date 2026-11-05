import { CAMPAIGNS, CAMPAIGNS_PER_CHAPTER, CHAPTERS, type CampaignDefinition } from "./campaigns";
import type { ArmyReport } from "./settlementSimulation";

/**
 * 0.16.0 achievement badges. Pure rules: no DOM, no saves. main.ts evaluates
 * them after every battle and keeps the earned ids in the save (`badges`,
 * beside the snapshot, merged as a union across copies like stars).
 *
 * Two kinds:
 * - progress badges come from the star table alone, so a returning player
 *   gets every one they have already earned (`progressBadges`);
 * - feat badges come from one battle's report (`featBadges`).
 */

export type BadgeTier = "bronze" | "silver" | "gold";
/** Which drawing the medal shows (ui/badgeArt.ts). */
export type BadgeEmblem = "fire" | "star" | "crown" | "chakra" | "elephant" | "horse" | "tower" | "hammer" | "scales" | "shield" | "lotus" | "sword";

export interface BadgeDefinition {
  id: string;
  name: string;
  /** How to earn it, shown on locked medals too. */
  how: string;
  tier: BadgeTier;
  emblem: BadgeEmblem;
}

const CHAPTER_EMBLEMS: BadgeEmblem[] = ["fire", "lotus", "sword", "tower", "chakra"];

export const BADGES: readonly BadgeDefinition[] = [
  { id: "first-victory", name: "First Victory", how: "Win any campaign.", tier: "bronze", emblem: "fire" },
  { id: "three-stars", name: "Flawless Raja", how: "Earn ★★★ in a campaign.", tier: "silver", emblem: "star" },
  ...CHAPTERS.map((chapter, index): BadgeDefinition => ({
    id: `chapter-${index + 1}`,
    name: `Lord of ${chapter.name}`,
    how: `Win all ${CAMPAIGNS_PER_CHAPTER} campaigns of chapter ${["I", "II", "III", "IV", "V"][index]}.`,
    tier: index < 2 ? "bronze" : index < 4 ? "silver" : "gold",
    emblem: CHAPTER_EMBLEMS[index] ?? "crown",
  })),
  { id: "stars-25", name: "Star Gatherer", how: "Collect 25 stars.", tier: "bronze", emblem: "star" },
  { id: "stars-50", name: "Star Keeper", how: "Collect 50 stars.", tier: "silver", emblem: "star" },
  { id: "stars-75", name: "Chakravartin", how: "Collect all 75 stars.", tier: "gold", emblem: "crown" },
  { id: "hard-win", name: "Unbowed", how: "Win a hard campaign.", tier: "silver", emblem: "shield" },
  { id: "close-call", name: "Against the Odds", how: "Win by less than 15% strength.", tier: "silver", emblem: "scales" },
  { id: "gajapati", name: "Gajapati", how: "Win with a war elephant in your army.", tier: "silver", emblem: "elephant" },
  { id: "ashvapati", name: "Ashvapati", how: "Win with 5 or more horsemen.", tier: "bronze", emblem: "horse" },
  { id: "no-sellswords", name: "Self-Reliant", how: "Win campaign 6 or later without sellswords.", tier: "bronze", emblem: "sword" },
  { id: "watchtower", name: "Eyes on the Wall", how: "Win after your Prakara fells the enemy.", tier: "bronze", emblem: "tower" },
  { id: "master-builder", name: "Master Builder", how: "Win with 16 or more buildings.", tier: "silver", emblem: "hammer" },
  { id: "dharma", name: "Defender of Dharma", how: "Win with the Dharma Stambha raised.", tier: "gold", emblem: "chakra" },
];

const BY_ID = new Map(BADGES.map((badge) => [badge.id, badge]));
export function badgeById(id: string): BadgeDefinition | undefined { return BY_ID.get(id); }

/** Badges earned from the best-stars table (campaign id → 1–3). */
export function progressBadges(stars: Record<string, number>): string[] {
  const earned: string[] = [];
  const won = (campaign: CampaignDefinition): boolean => (stars[campaign.id] ?? 0) > 0;
  const total = CAMPAIGNS.reduce((sum, campaign) => sum + Math.min(3, Math.max(0, stars[campaign.id] ?? 0)), 0);
  if (CAMPAIGNS.some(won)) earned.push("first-victory");
  if (CAMPAIGNS.some((campaign) => (stars[campaign.id] ?? 0) >= 3)) earned.push("three-stars");
  CHAPTERS.forEach((_chapter, index) => {
    const inChapter = CAMPAIGNS.filter((campaign) => campaign.chapter === index);
    if (inChapter.length && inChapter.every(won)) earned.push(`chapter-${index + 1}`);
  });
  if (total >= 25) earned.push("stars-25");
  if (total >= 50) earned.push("stars-50");
  if (total >= CAMPAIGNS.length * 3) earned.push("stars-75");
  if (CAMPAIGNS.some((campaign) => campaign.tier === "hard" && won(campaign))) earned.push("hard-win");
  return earned;
}

export interface BattleFacts {
  campaign: CampaignDefinition;
  report: ArmyReport;
  builtBuildingIds: readonly string[];
}

/** Badges one battle earns on its own (only victories earn feats). */
export function featBadges({ campaign, report, builtBuildingIds }: BattleFacts): string[] {
  if (!report.win) return [];
  const earned: string[] = [];
  const built = new Set(builtBuildingIds);
  if (report.margin < 0.15) earned.push("close-call");
  if ((report.units.elephants ?? 0) > 0) earned.push("gajapati");
  if (report.units.horsemen >= 5) earned.push("ashvapati");
  if (campaign.number >= 6 && report.sellswords.archers + report.sellswords.swordsmen === 0) earned.push("no-sellswords");
  const felled = report.felled ? report.felled.archers + report.felled.swordsmen + report.felled.horsemen : 0;
  if (felled > 0) earned.push("watchtower");
  if (built.size >= 16) earned.push("master-builder");
  if (built.has("dharma-stambha")) earned.push("dharma");
  return earned;
}

/** Cleans a stored badge list: known ids only, once each, in catalog order. */
export function readBadges(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const ids = new Set(raw.filter((id): id is string => typeof id === "string" && BY_ID.has(id)));
  return BADGES.map((badge) => badge.id).filter((id) => ids.has(id));
}

/** Union of two badge lists, in catalog order. */
export function mergeBadges(...lists: Array<readonly string[] | undefined>): string[] {
  return readBadges(lists.flatMap((list) => list ?? []));
}

/**
 * Everything earned after a battle: the previous list plus progress and feat
 * badges. `fresh` lists the ones that are new, in catalog order, for the reveal.
 */
export function awardBadges(previous: readonly string[], stars: Record<string, number>, facts: BattleFacts | null): { all: string[]; fresh: string[] } {
  const before = new Set(readBadges(previous));
  const all = mergeBadges([...before], progressBadges(stars), facts ? featBadges(facts) : []);
  return { all, fresh: all.filter((id) => !before.has(id)) };
}
