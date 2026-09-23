/**
 * Campaign definitions. A campaign sets the move limit, which buildings may be
 * offered, and the enemy force at the finale.
 */

/** The threat faced after the final move. `strength` is the number of enemy swordsmen. */
export interface CampaignObjective {
  enemyName: string;
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
    briefing: "Five swordsmen attack after Move 12. Defend with six swordsmen, ten archers, six horsemen, or at least three swordsmen and three archers.",
    strength: 5,
  },
};
