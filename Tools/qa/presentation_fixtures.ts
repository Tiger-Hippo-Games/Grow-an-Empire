import { writeFileSync } from 'node:fs';
import { SettlementSimulation } from '../../src/game/settlementSimulation';
import proofs from '../../src/game/__tests__/fixtures/three-star-routes.json';
function city(n: number) {
 const sim = new SettlementSimulation();
 for (const choice of proofs[0].choices.slice(0,n)) {
  if(choice==='gather') sim.gather();
  else { sim.chooseBuilding(choice); sim.update(1e9); }
 }
 return sim;
}
const saved=(sim: SettlementSimulation) => ({...sim.serialize(),runId:'presentation-qa',settings:{tutorialComplete:true,muted:true},campaignStars:{}});
const fixtures: Record<string,unknown>={city:saved(city(4))};
for (const [name, units, elephants] of [
 ['archers',{archers:9,swordsmen:0,horsemen:0},0],
 ['swordsmen',{archers:0,swordsmen:11,horsemen:0},0],
 ['horsemen',{archers:0,swordsmen:0,horsemen:5},0],
 ['elephants',{archers:0,swordsmen:0,horsemen:0},2],
 ['mixed',{archers:18,swordsmen:32,horsemen:8},3],
 ['large',{archers:100,swordsmen:120,horsemen:45},8],
 ] as const) {
 const sim=city(12);
 sim.state.trainedUnits={...units}; sim.state.elephants=elephants;
 sim.state.population=sim.state.builtBuildingIds.length+sim.soldierCount;
 fixtures[name]=saved(sim);
}
writeFileSync('Tools/qa/out/presentation-fixtures.json',JSON.stringify(fixtures));
