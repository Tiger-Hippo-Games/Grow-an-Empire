import type { EnemyArmy, StarMargins } from "./battle";
import { MAX_CAMPAIGN_MOVES } from "./content";

/**
 * The 25 campaigns. Every campaign uses the same rules (12 moves, the same
 * starting stockpile and buildings); only the enemy changes. Each enemy was
 * sized with the balance simulation so the share of all build orders that win
 * falls evenly from 100% (Campaign 1) to about 5% (Campaign 25), and the star
 * margins were set from how far the winning build orders win by
 * (`__tests__/balance.test.ts` keeps both honest). See the design doc for the table.
 */

/** The threat faced after the final move. */
export interface CampaignObjective {
  enemyName: string;
  kingdomName: string;
  /** One line for the enemy briefing popup. */
  briefing: string;
  /** What counters this army, in plain words. */
  counterHint: string;
  /** Total enemy head count (kept for older code paths and analytics). */
  strength: number;
  army: EnemyArmy;
}

/** One playable campaign. `id` is stored in saves, so a save only loads into its own campaign. */
export interface CampaignDefinition {
  id: string;
  /** 1-based position on the campaign road. */
  number: number;
  name: string;
  subtitle: string;
  moveLimit: number;
  availableBuildingIds: string[];
  objective: CampaignObjective;
  /** Win margins for two and three stars (0.35 = win by 35%). */
  stars: StarMargins;
}

const ALL_BUILDINGS = [
  "woodcutter", "farm", "swine-farm", "bakery", "sawmill", "butchery", "fruit-orchard", "winery",
  "quarry", "house", "granary", "marketplace", "blacksmith", "weapons-workshop", "barracks", "stable",
];

const SWORD_HINT = "Archers are strong against a swordsman horde.";
const ARCHER_HINT = "Horsemen ride down archers; swordsmen suffer under their volleys.";
const MIXED_HINT = "A mixed army is never badly countered.";

export interface CampaignSeed {
  slug: string; name: string; subtitle: string; enemyName: string; kingdomName: string; briefing: string;
  swordsmen: number; archers: number; horsemen?: number; veterancy?: number; two: number; three: number;
}

/** Enemy sizes, veterancy and star margins come from Tools/balance/calibrate.ts (see the design doc). */
export const CAMPAIGN_SEEDS: CampaignSeed[] = [
  { slug: "first-muster", name: "The First Muster", subtitle: "Found a settlement before the Ashfang scouts return.", enemyName: "The Ashfang Scout", kingdomName: "Ashfang Clan", briefing: "A lone Ashfang scout tests the new camp.", swordsmen: 1, archers: 0, two: 0.5, three: 1 },
  { slug: "reedmarsh", name: "Reedmarsh Crossing", subtitle: "Poachers from the marsh want the new granaries.", enemyName: "The Reedmarsh Poachers", kingdomName: "Reedmarsh", briefing: "Marsh bowmen creep in through the reeds.", swordsmen: 0, archers: 7, two: 0.5, three: 1 },
  { slug: "ashfang-raiders", name: "Ashfang Raiders", subtitle: "The scout brought his clan.", enemyName: "The Ashfang Raiders", kingdomName: "Ashfang Clan", briefing: "Ashfang blades and bows come together this time.", swordsmen: 6, archers: 5, two: 0.5, three: 1 },
  { slug: "iron-tusk", name: "Iron Tusk Pass", subtitle: "Brigands hold the mountain pass.", enemyName: "The Iron Tusk Brigands", kingdomName: "Iron Tusk Hills", briefing: "Hard-bitten brigands march down from the pass.", swordsmen: 13, archers: 0, two: 0.5, three: 1 },
  { slug: "grey-hood", name: "Grey Hood Woods", subtitle: "Outlaw archers rule the old forest.", enemyName: "The Grey Hood Bowmen", kingdomName: "Grey Hood Woods", briefing: "Hooded archers shoot from the treeline.", swordsmen: 0, archers: 12, veterancy: 1.1, two: 0.5, three: 1 },
  { slug: "cinderfield", name: "Cinderfield", subtitle: "Marauders burn their way across the plain.", enemyName: "The Cinderfield Marauders", kingdomName: "Cinderfield", briefing: "Marauders with torches and bows cross the burnt plain.", swordsmen: 8, archers: 7, two: 0.5, three: 1 },
  { slug: "wolfmoor", name: "Wolfmoor", subtitle: "The moor clans have united.", enemyName: "The Wolfmoor Clansmen", kingdomName: "Wolfmoor", briefing: "A wall of clansmen advances across the moor.", swordsmen: 16, archers: 0, veterancy: 1.1, two: 0.5, three: 1 },
  { slug: "thornwood", name: "Thornwood", subtitle: "Hunters turn their bows on the settlement.", enemyName: "The Thornwood Hunters", kingdomName: "Thornwood", briefing: "Thornwood hunters loose arrows from the brambles.", swordsmen: 0, archers: 13, veterancy: 1.2, two: 0.45, three: 0.85 },
  { slug: "ashfang-warband", name: "The Ashfang Warband", subtitle: "The clan returns, larger and angrier.", enemyName: "The Ashfang Warband", kingdomName: "Ashfang Clan", briefing: "The Ashfang warband marches with drums.", swordsmen: 10, archers: 9, two: 0.45, three: 0.7 },
  { slug: "black-anvil", name: "Black Anvil", subtitle: "Mercenary swordsmen sell their blades to the highest bidder.", enemyName: "The Black Anvil Company", kingdomName: "Black Anvil", briefing: "Veteran mercenaries in black steel.", swordsmen: 22, archers: 0, two: 0.4, three: 0.6 },
  { slug: "sable-crow", name: "Sable Crow Ridge", subtitle: "Archers who never miss.", enemyName: "The Sable Crow Archers", kingdomName: "Sable Crow Ridge", briefing: "Black-feathered arrows darken the sky.", swordsmen: 0, archers: 19, two: 0.35, three: 0.55 },
  { slug: "duskriver", name: "Duskriver", subtitle: "Freebooters sail up the river at dusk.", enemyName: "The Duskriver Freebooters", kingdomName: "Duskriver", briefing: "Freebooters land with cutlasses and crossbows.", swordsmen: 12, archers: 11, two: 0.25, three: 0.4 },
  { slug: "blood-oath", name: "Blood Oath", subtitle: "A legion sworn never to retreat.", enemyName: "The Blood Oath Legion", kingdomName: "Blood Oath Keep", briefing: "Oath-sworn legionaries who never break.", swordsmen: 27, archers: 0, two: 0.2, three: 0.3 },
  { slug: "hollow-peak", name: "Hollow Peak", subtitle: "Longbowmen on the high ground.", enemyName: "The Hollow Peak Longbows", kingdomName: "Hollow Peak", briefing: "Longbows from the peaks outrange anything you have.", swordsmen: 0, archers: 20, veterancy: 1.1, two: 0.2, three: 0.35 },
  { slug: "red-banner", name: "Red Banner", subtitle: "A crusading host under red banners.", enemyName: "The Red Banner Host", kingdomName: "Red Banner March", briefing: "A disciplined host of blades and bows.", swordsmen: 12, archers: 12, veterancy: 1.1, two: 0.1, three: 0.25 },
  { slug: "stonejaw", name: "Stonejaw", subtitle: "The horde from the quarries.", enemyName: "The Stonejaw Horde", kingdomName: "Stonejaw Quarries", briefing: "A horde with hammers and cleavers.", swordsmen: 27, archers: 0, veterancy: 1.1, two: 0.1, three: 0.2 },
  { slug: "nightfen", name: "Nightfen", subtitle: "Stalkers who strike from the fog.", enemyName: "The Nightfen Stalkers", kingdomName: "Nightfen", briefing: "Archers hidden in the fen fog.", swordsmen: 0, archers: 25, two: 0.1, three: 0.25 },
  { slug: "twin-serpent", name: "Twin Serpent", subtitle: "Two clans, one army.", enemyName: "The Twin Serpent Pact", kingdomName: "Twin Serpent Vale", briefing: "Two clans march as one: swords and bows.", swordsmen: 13, archers: 13, veterancy: 1.1, two: 0.05, three: 0.15 },
  { slug: "iron-tusk-horde", name: "The Iron Tusk Horde", subtitle: "The brigands are back with every blade they own.", enemyName: "The Iron Tusk Horde", kingdomName: "Iron Tusk Hills", briefing: "Every brigand in the hills.", swordsmen: 32, archers: 0, two: 0.05, three: 0.15 },
  { slug: "silverleaf", name: "Silverleaf", subtitle: "Elite rangers from the silver woods.", enemyName: "The Silverleaf Rangers", kingdomName: "Silverleaf", briefing: "Silent rangers with silver-tipped arrows.", swordsmen: 0, archers: 27, two: 0.05, three: 0.2 },
  { slug: "ashfang-council", name: "The Ashfang War Council", subtitle: "The clan chiefs lead in person.", enemyName: "The Ashfang War Council", kingdomName: "Ashfang Clan", briefing: "The Ashfang chiefs and their guard.", swordsmen: 14, archers: 14, veterancy: 1.1, two: 0.05, three: 0.1 },
  { slug: "grim-harrow", name: "Grim Harrow", subtitle: "A legion that leaves nothing standing.", enemyName: "The Grim Harrow Legion", kingdomName: "Grim Harrow", briefing: "A legion that salts the fields behind it.", swordsmen: 31, archers: 0, veterancy: 1.1, two: 0.05, three: 0.1 },
  { slug: "thousand-arrows", name: "The Thousand Arrows", subtitle: "An army of archers.", enemyName: "The Thousand Arrows", kingdomName: "The Arrow Coast", briefing: "More arrows than you can count.", swordsmen: 0, archers: 24, veterancy: 1.2, two: 0.05, three: 0.15 },
  { slug: "crown-of-cinders", name: "Crown of Cinders", subtitle: "A king who burns what he cannot rule.", enemyName: "The Crown of Cinders", kingdomName: "Cinder Throne", briefing: "The Cinder King's own army.", swordsmen: 17, archers: 16, two: 0.05, three: 0.1 },
  { slug: "ashfang-warlord", name: "The Ashfang Warlord", subtitle: "The last stand against the clan.", enemyName: "The Ashfang Warlord", kingdomName: "Ashfang Clan", briefing: "The Warlord brings every Ashfang blade.", swordsmen: 37, archers: 0, two: 0.05, three: 0.1 },
];

function hintFor(seed: CampaignSeed): string {
  if (seed.archers === 0) return SWORD_HINT;
  if (seed.swordsmen === 0) return ARCHER_HINT;
  return MIXED_HINT;
}

export function campaignFromSeed(seed: CampaignSeed, index: number): CampaignDefinition {
  const army: EnemyArmy = { swordsmen: seed.swordsmen, archers: seed.archers, horsemen: seed.horsemen ?? 0, veterancy: seed.veterancy ?? 1 };
  return {
    // Campaign 1 keeps its original id so existing saves still load into it.
    id: index === 0 ? "campaign-1-first-muster" : `campaign-${index + 1}-${seed.slug}`,
    number: index + 1,
    name: seed.name,
    subtitle: seed.subtitle,
    moveLimit: MAX_CAMPAIGN_MOVES,
    availableBuildingIds: ALL_BUILDINGS,
    objective: {
      enemyName: seed.enemyName,
      kingdomName: seed.kingdomName,
      briefing: seed.briefing,
      counterHint: hintFor(seed),
      strength: army.swordsmen + army.archers + army.horsemen,
      army,
    },
    stars: { two: seed.two, three: seed.three },
  };
}

export const CAMPAIGNS: readonly CampaignDefinition[] = CAMPAIGN_SEEDS.map(campaignFromSeed);

export const CAMPAIGN_1 = CAMPAIGNS[0];

export function campaignById(id: string): CampaignDefinition | undefined {
  return CAMPAIGNS.find((campaign) => campaign.id === id);
}

/** Stars needed in total to open campaign `number` (1-based): 1.8 × the campaigns before it, rounded down. */
export function starsToUnlock(number: number): number {
  return number <= 1 ? 0 : Math.floor(1.8 * (number - 1));
}

export function totalStars(stars: Readonly<Record<string, number>>): number {
  return CAMPAIGNS.reduce((sum, campaign) => sum + Math.max(0, Math.min(3, stars[campaign.id] ?? 0)), 0);
}

/** Whether campaign `number` is open: the one before it is won, and enough stars are held in total. */
export function isCampaignUnlocked(number: number, stars: Readonly<Record<string, number>>): boolean {
  if (!Number.isInteger(number) || number > CAMPAIGNS.length) return false;
  if (number <= 1) return true;
  const previous = CAMPAIGNS[number - 2];
  return (stars[previous.id] ?? 0) >= 1 && totalStars(stars) >= starsToUnlock(number);
}
