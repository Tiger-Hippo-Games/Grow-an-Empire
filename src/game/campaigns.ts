export interface CampaignObjective {
  enemyName: string;
  briefing: string;
  strength: number;
}

export interface CampaignDefinition {
  id: string;
  name: string;
  subtitle: string;
  moveLimit: number;
  availableBuildingIds: string[];
  objective: CampaignObjective;
}

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
