/**
 * Sizes the 25 enemies against the reference build-first policy (Gather
 * when stuck), to the difficulty plan in src/game/campaigns.ts
 * (`targetWinShare`: within each five-campaign chapter easy → medium ×3 →
 * hard, each chapter harder than the last) and the enemy mix in `ENEMY_MIX`
 * (swordsmen S, archers A, horsemen H, in combinations). For each campaign it
 * tries the mix in even and 2:1 proportions and veterancy 1.0–1.2, never
 * repeating an army, and keeps the one whose share of winning build orders
 * is closest to the target. Star margins come from how far the winners win
 * by (2 stars ≈ the better half of winners, 3 stars ≈ the top 15%, capped at
 * 50% and 100%); `field` is the share of all build orders reaching 1, 2 and 3
 * stars (the AI rivals in realm.ts use it). Prints values for CAMPAIGN_SEEDS.
 *
 *   npx tsx Tools/balance/calibrate.ts
 */
import { bestMargin, searchEndings, winShare } from "../../src/game/balance";
import type { EnemyArmy } from "../../src/game/battle";
import { ENEMY_MIX, targetWinShare } from "../../src/game/campaigns";

{
  const { endings } = searchEndings();
  const used = new Set<string>();
  ENEMY_MIX.forEach((mix, index) => {
    const number = index + 1;
    const target = targetWinShare(number);
    const base = { S: mix.includes("S") ? 1 : 0, A: mix.includes("A") ? 1 : 0, H: mix.includes("H") ? 1 : 0 };
    const weights = [base, ...(["S", "A", "H"] as const).filter((k) => base[k] && mix.length > 1).map((k) => ({ ...base, [k]: 2 }))];
    let best: { d: number; enemy: EnemyArmy; share: number; key: string } | null = null;
    weights.forEach((w, uneven) => {
      for (const veterancy of [1, 1.1, 1.2]) {
        for (let n = 1; n <= (number === 1 ? 1 : 80); n += 1) {
          const total = w.S + w.A + w.H;
          let swordsmen = Math.round((n * w.S) / total);
          let horsemen = Math.round((n * w.H) / total);
          let archers = n - swordsmen - horsemen;
          if (!w.A) { if (w.S) swordsmen = n - horsemen; else horsemen = n; archers = 0; }
          if (archers < 0) continue;
          const enemy: EnemyArmy = { swordsmen, archers, horsemen, veterancy };
          const key = `${swordsmen}/${archers}/${horsemen}`;
          const share = winShare(endings, enemy);
          const d = Math.abs(share - target) + (veterancy - 1) * 0.02 + (uneven ? 0.004 : 0);
          if (!used.has(key) && (!best || d < best.d)) best = { d, enemy, share, key };
          if (share < target - 0.1) break;
        }
      }
    });
    const { enemy, share, key } = best!;
    used.add(key);
    const all = endings.map((e) => bestMargin(e, enemy));
    const margins = all.filter((m) => m > 0).sort((a, b) => a - b);
    const quantile = (p: number) => margins[Math.min(margins.length - 1, Math.floor(p * margins.length))] ?? 0;
    const two = Math.min(0.5, Math.max(0.05, Math.floor((quantile(0.5) * 100) / 5) * 5 / 100));
    const three = Math.min(1, Math.max(two + 0.05, Math.floor((quantile(0.85) * 100) / 5) * 5 / 100));
    const reach = (m: number) => +(all.filter((x) => x > 0 && x >= m - 1e-9).length / all.length).toFixed(4);
    console.log(JSON.stringify({ number, mix, target: +target.toFixed(3), share: +share.toFixed(4), ...enemy, two: +two.toFixed(2), three: +three.toFixed(2), field: [reach(0), reach(two), reach(three)] }));
  });
}
