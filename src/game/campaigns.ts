/**
 * Campaign definitions. A campaign sets the move limit, which buildings may be
 * offered, and the enemy the final army is scored against.
 */

/** The threat faced after the final move. `strength` is the score needed for a plain "Victory". */
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

/** Campaign 1: every building is available; beat the Ashfang Raiders (strength 45) after 8 moves. */
export const CAMPAIGN_1: CampaignDefinition = {
  id: "campaign-1-first-muster",
  name: "The First Muster",
  subtitle: "Found a settlement and prepare for the bandit host.",
  moveLimit: 8,
  availableBuildingIds: [
    "woodcutter", "farm", "swine-farm", "bakery", "sawmill", "butchery", "fruit-orchard", "winery",
    "quarry", "house", "granary", "marketplace", "blacksmith", "weapons-workshop", "barracks",
  ],
  objective: {
    enemyName: "The Ashfang Raiders",
    briefing: "A bandit host reaches the valley after the eighth construction. Raise, equip, and supply a force before they arrive.",
    strength: 45,
  },
};
