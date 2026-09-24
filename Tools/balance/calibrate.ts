/**
 * Sizes the 25 enemies so the share of build orders that win falls evenly
 * from 100% to 5%, and sets each campaign's star margins from how far its
 * winning build orders win by (2 stars ≈ the better half of winners, 3 stars ≈
 * the top 15%, capped at 50% and 100%). Prints the values to copy into
 * CAMPAIGN_SEEDS in src/game/campaigns.ts.
 *
 *   npx tsx Tools/balance/calibrate.ts
 */
import { bestMargin, searchEndings, winShare } from "../../src/game/balance";
import type { EnemyArmy } from "../../src/game/battle";
import { CAMPAIGN_SEEDS } from "../../src/game/campaigns";

{
  const { endings } = searchEndings();
  const rows: string[] = [];
  CAMPAIGN_SEEDS.forEach((seed, index) => {
    const target = 1 - (index * 0.95) / 24;
    const kind = seed.archers === 0 ? "S" : seed.swordsmen === 0 ? "A" : "M";
    let best: { d: number; enemy: EnemyArmy; share: number } | null = null;
    for (const veterancy of [1, 1.1, 1.2]) {
      for (let n = 1; n <= 70; n += 1) {
        const swordsmen = kind === "S" ? n : kind === "A" ? 0 : Math.round(n / 2);
        const enemy: EnemyArmy = { swordsmen, archers: n - swordsmen, horsemen: 0, veterancy };
        const share = winShare(endings, enemy);
        const d = Math.abs(share - target) + (veterancy - 1) * 0.02;
        if (!best || d < best.d) best = { d, enemy, share };
        if (share < target - 0.1) break;
      }
    }
    const { enemy, share } = best!;
    const margins = endings.map((e) => bestMargin(e, enemy)).filter((m) => m > 0).sort((a, b) => a - b);
    const quantile = (p: number) => margins[Math.min(margins.length - 1, Math.floor(p * margins.length))] ?? 0;
    const two = Math.min(0.5, Math.max(0.05, Math.floor((quantile(0.5) * 100) / 5) * 5 / 100));
    const three = Math.min(1, Math.max(two + 0.05, Math.floor((quantile(0.85) * 100) / 5) * 5 / 100));
    rows.push(JSON.stringify({ n: index + 1, target: +target.toFixed(3), share: +share.toFixed(4), swordsmen: enemy.swordsmen, archers: enemy.archers, veterancy: enemy.veterancy, two: +two.toFixed(2), three: +three.toFixed(2) }));
    console.log(rows.at(-1));
  });
}
