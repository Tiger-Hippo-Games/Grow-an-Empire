/**
 * Campaign definitions. A campaign sets the move limit, which buildings may be
 * offered, and the enemy force at the finale.
 */

/** The threat faced after the final move. `strength` is the number of enemy swordsmen. */
export interface CampaignObjective {
  enemyName: string;
  kingdomName: string;
  briefing: string;
  strength: number;
}

/** One playable campaign. `id` is stored in saves, so a save only loads into its own campaign. */
export interface CampaignDefinition {
  id: string;
  name: string;
  subtitle: string;
  moveLimit: number;
  availableBuildingIds: string[];
  objective: CampaignObjective;
}

/** Campaign 1: every building is available; defend the city after twelve moves. */
export const CAMPAIGN_1: CampaignDefinition = {
  id: "campaign-1-first-muster",
  name: "The First Muster",
  subtitle: "Found a settlement and prepare for the bandit host.",
  moveLimit: 12,
  availableBuildingIds: [
    "woodcutter", "farm", "swine-farm", "bakery", "sawmill", "butchery", "fruit-orchard", "winery",
    "quarry", "house", "granary", "marketplace", "blacksmith", "weapons-workshop", "barracks", "stable",
  ],
  objective: {
    enemyName: "The Ashfang Raiders",
    kingdomName: "Ashfang Kingdom",
    briefing: "Five raiders attack after Move 12. Win with 6 swordsmen, 10 archers, 6 horsemen, or 3 swordsmen and 3 archers.",
    strength: 5,
  },
};

const SHARED_BUILDINGS = CAMPAIGN_1.availableBuildingIds;

export const CAMPAIGN_2: CampaignDefinition = {
  id: "campaign-2-river-watch",
  name: "River Watch",
  subtitle: "Secure the bridge and orchards before the raiders cross.",
  moveLimit: 13,
  availableBuildingIds: SHARED_BUILDINGS,
  objective: {
    enemyName: "The Fordbreakers",
    kingdomName: "Fordbreaker Kingdom",
    briefing: "Six swordsmen advance from Fordbreaker Kingdom after Move 13. Build a stronger garrison to hold the bridge.",
    strength: 6,
  },
};

export const CAMPAIGN_3: CampaignDefinition = {
  id: "campaign-3-ashfang-gate",
  name: "Highmeadow Watch",
  subtitle: "Defend the hill farms from raiders gathering in the northern woods.",
  moveLimit: 14,
  availableBuildingIds: SHARED_BUILDINGS,
  objective: {
    enemyName: "The Highmeadow Host",
    kingdomName: "Highmeadow Kingdom",
    briefing: "Seven swordsmen come down from Highmeadow Kingdom after Move 14. Muster your strongest village defense.",
    strength: 7,
  },
};

export const CAMPAIGN_4: CampaignDefinition = {
  id: "campaign-4-shadowfen",
  name: "Eastwood Hamlet",
  subtitle: "Keep the woodland farms safe from raiders on the eastern lane.",
  moveLimit: 14,
  availableBuildingIds: SHARED_BUILDINGS,
  objective: {
    enemyName: "The Eastwood Reavers",
    kingdomName: "Eastwood Kingdom",
    briefing: "Six swordsmen strike from Eastwood Kingdom after Move 14. Hold the eastern village with a trained garrison.",
    strength: 6,
  },
};

export const CAMPAIGNS = [CAMPAIGN_1, CAMPAIGN_2, CAMPAIGN_3, CAMPAIGN_4] as const;

export function campaignById(id: string): CampaignDefinition | undefined {
  return CAMPAIGNS.find((campaign) => campaign.id === id);
}
