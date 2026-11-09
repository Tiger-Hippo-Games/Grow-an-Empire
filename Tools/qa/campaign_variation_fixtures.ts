import { writeFileSync } from 'node:fs';
import { CAMPAIGNS } from '../../src/game/campaigns';
import { SettlementSimulation } from '../../src/game/settlementSimulation';
import { playMove } from '../../src/game/__tests__/play';
const stars = Object.fromEntries(CAMPAIGNS.map(c => [c.id,3]));
const save = (sim: SettlementSimulation) => ({...sim.serialize(),runId:'campaign-variation-qa',settings:{tutorialComplete:true,muted:true},campaignStars:stars});
const old = new SettlementSimulation({...CAMPAIGNS[1],moveLimit:12});
for(let move=0;move<12;move++) playMove(old);
const completed = new SettlementSimulation({...CAMPAIGNS[1],moveLimit:12,objective:{...CAMPAIGNS[1].objective,army:{swordsmen:1,archers:0,horsemen:0,veterancy:1}}});
for(let move=0;move<12;move++) playMove(completed);
completed.muster(completed.bestHire());
writeFileSync('Tools/qa/out/campaign-variation-fixtures.json',JSON.stringify({
 campaigns:CAMPAIGNS.map(c => ({number:c.number,name:c.name,moves:c.moveLimit,enemy:c.objective.enemyName,faction:c.objective.kingdomName,army:c.objective.army,save:save(new SettlementSimulation(c))})),
 oldMuster:save(old),oldCompleted:save(completed)
}));
