/**
 * Visual timing language for the city. Gameplay construction remains thirty
 * simulation seconds; these values control how that time reads on screen.
 */
export const CITY_ANIMATION = {
  construction: {
    surveyEnd: 0.18,
    foundationEnd: 0.46,
    frameEnd: 0.74,
    finishingEnd: 0.93,
    placementPulseHz: 0.8,
  },
  routes: {
    serviceSpeed: 1.35,
    supplySpeed: 1.05,
    tradeSpeed: 1.15,
    civicSpeed: 1.1,
    endpointDwellFraction: 0.12,
    walkingFps: 8.2,
    workingFps: 2,
  },
  productionPulseSeconds: 1.15,
} as const;
