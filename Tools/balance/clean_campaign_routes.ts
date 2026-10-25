/** Dev-only feasibility check: find real, shortage-free three-star runs for every campaign.
 * Seeded safe-choice sampling; witnesses are QA evidence, never a claim of exhaustive search. */
import { writeFileSync } from "node:fs";
import { CAMPAIGNS } from "../../src/game/campaigns";
import { SettlementSimulation } from "../../src/game/settlementSimulation";

let seed = 0x3478a13f;
const random = () => { seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5; return (seed >>> 0) / 0x100000000; };
const proofs: Array<{ campaign: number; moves: number; choices: string[]; stars: number; margin: number }> = [];
for (const length of [...new Set(CAMPAIGNS.map(c => c.moveLimit))]) {
  const campaigns = CAMPAIGNS.filter(c => c.moveLimit === length), pending = new Set(campaigns.map(c => c.number));
  let attempts = 0;
  while (pending.size && attempts++ < 8192) {
    let sim = new SettlementSimulation(campaigns[0]);
    const choices: string[] = [];
    for (let move = 0; move < length; move++) {
      const actions = sim.state.availableBuildingIds.filter(id => sim.canAffordBuilding(id) || sim.swapPlanFor(id));
      actions.push("gather");
      const safe: Array<{ sim: SettlementSimulation; choice: string }> = [];
      for (const choice of actions) {
        const trial = new SettlementSimulation(campaigns[0]); Object.assign(trial.state, structuredClone(sim.state));
        if (choice === "gather") trial.gather();
        else { if (trial.canAffordBuilding(choice)) trial.chooseBuilding(choice); else trial.swapAndBuild(choice); trial.update(1e9); }
        const health = trial.state.campaignHealth;
        if (!health.populationIssueMoves && !health.resourceIssueMoves) safe.push({ sim: trial, choice });
      }
      if (!safe.length) break;
      // Mix build-first runs with runs that deliberately wait for stocks to grow.
      const builds = safe.filter(s => s.choice !== "gather");
      const pool = builds.length && random() > .14 ? builds : safe;
      const chosen = pool[Math.floor(random() * pool.length)];
      sim = chosen.sim; choices.push(chosen.choice);
    }
    if (sim.state.mode !== "muster") continue;
    for (const campaign of campaigns) {
      if (!pending.has(campaign.number)) continue;
      const finale = new SettlementSimulation(campaign); Object.assign(finale.state, structuredClone(sim.state)); finale.muster(finale.bestHire());
      const report = finale.state.armyReport!;
      if (report.stars === 3) { proofs.push({ campaign: campaign.number, moves: length, choices, stars: 3, margin: report.margin }); pending.delete(campaign.number); }
    }
  }
  console.info(JSON.stringify({ moves: length, attempts, missing: [...pending] }));
}
proofs.sort((a,b) => a.campaign-b.campaign);
writeFileSync("Tools/qa/out/clean-campaign-routes.json", JSON.stringify(proofs,null,2));
if (proofs.length !== CAMPAIGNS.length) throw new Error(`Found ${proofs.length}/${CAMPAIGNS.length} three-star routes. Investigate missing campaigns.`);
console.info(`ALL ${proofs.length} CAMPAIGNS HAVE A VERIFIED THREE-STAR ROUTE`);
