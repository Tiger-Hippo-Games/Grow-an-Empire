import * as THREE from "three";
import type { ArmyCounts, BattleRound } from "../game/battle";
import { civicGround } from "./cityLayout";
import { WALK_CELL_ASPECT, WORK_CELL_ASPECT, type CharacterAssets, type CharacterRole, type WalkDirection } from "./characterAssets";

/**
 * The battle, fought in the city itself: the player's army forms up in front of
 * the civic centre, the enemy marches up from the south, the lines close and
 * strike, and each round the fallen fade away. The outcome is already decided
 * by `resolveBattle`; this only shows it (round by round, as the HUD bar at the
 * top counts). Sprites reuse the soldiers' walk and work (strike) sheets.
 *
 * Self-timed: main.ts calls `update(now)` every animation frame while
 * `active`, whatever the game's pause state, and renders the scene.
 */

type Kind = keyof ArmyCounts | "militia";
interface Fighter {
  sprite: THREE.Sprite;
  role: CharacterRole;
  kind: Kind;
  enemy: boolean;
  home: THREE.Vector2;
  front: THREE.Vector2;
  phase: number;
  /** Time it fell (ms), or null while standing. */
  fellAt: number | null;
}

/** Sprites drawn per unit kind; bigger armies still count in full in the HUD. */
const MAX_PER_KIND = 20;
const MARCH_MS = 1300;
const ROUND_MS = 1100;
const FADE_MS = 450;
/** How far south of its lines the enemy starts its march. */
const MARCH_IN = 8;

const ROLES: Record<Kind, { player: CharacterRole; enemy: CharacterRole; size: number }> = {
  swordsmen: { player: "swordsman", enemy: "enemy", size: 2.15 },
  archers: { player: "archer", enemy: "archer", size: 2.15 },
  horsemen: { player: "horseman", enemy: "horseman", size: 2.95 },
  militia: { player: "militia", enemy: "militia", size: 2.0 },
};
/** Front line first: swordsmen, then horsemen, archers behind, militia last (the loss order in battle.ts). */
const ORDER: Kind[] = ["swordsmen", "horsemen", "archers", "militia"];
/** Enemy archers and riders share the player's sheets, so they wear a raider's red. */
const ENEMY_TINT = 0xff9a8a;

export interface BattleCounts { archers: number; swordsmen: number; horsemen: number; militia: number }

export interface BattlePlayback {
  /** Fires as each round lands (0-based), with both sides' survivors. */
  onRound?(index: number, round: BattleRound): void;
  onDone(): void;
}

export function createBattleField(scene: THREE.Scene, characters: CharacterAssets) {
  const fighters: Fighter[] = [];
  let startedAt = 0;
  let rounds: BattleRound[] = [];
  let roundsShown = 0;
  let playback: BattlePlayback | null = null;
  let active = false;
  let reducedMotion = false;

  function clear(): void {
    for (const fighter of fighters) { scene.remove(fighter.sprite); fighter.sprite.material.dispose(); }
    fighters.length = 0;
  }

  /** Where the two front lines meet: the open ground south of the civic centre. */
  const MEET_Y = civicGround.y - 10;
  const ROW_GAP = 1.25;

  function formation(counts: BattleCounts, enemy: boolean): void {
    let row = 0;
    for (const kind of ORDER) {
      const shown = Math.min(counts[kind], MAX_PER_KIND);
      if (shown === 0) continue;
      const { size } = ROLES[kind];
      const perRow = kind === "horsemen" ? 9 : 14;
      const spacing = kind === "horsemen" ? 1.8 : 1.25;
      for (let index = 0; index < shown; index += 1) {
        const column = index % perRow;
        const rowInKind = Math.floor(index / perRow);
        const across = (column - (Math.min(shown, perRow) - 1) / 2) * spacing + (rowInKind % 2) * 0.3;
        const depth = (row + rowInKind) * ROW_GAP;
        // The city's army holds the ground in front of the civic centre, facing the viewer;
        // the enemy marches up from the south. Front ranks are nearest the meeting line.
        const home = enemy
          ? new THREE.Vector2(civicGround.x + across, MEET_Y - 1.6 - depth)
          : new THREE.Vector2(civicGround.x + across, MEET_Y + 1.6 + depth);
        const front = new THREE.Vector2(home.x, home.y + (enemy ? 1.0 : -1.0));
        const role = enemy ? ROLES[kind].enemy : ROLES[kind].player;
        const material = new THREE.SpriteMaterial({ map: characters.getFrame(role, 0, enemy ? 0 : 4), transparent: true, depthTest: false });
        if (enemy && role !== "enemy") material.color.setHex(ENEMY_TINT);
        const sprite = new THREE.Sprite(material);
        sprite.scale.set(size * WALK_CELL_ASPECT, size, 1);
        sprite.position.set(home.x, (enemy ? home.y - MARCH_IN : home.y) + size / 2, 2.7);
        // Nearer the viewer (lower on screen) draws on top.
        sprite.renderOrder = 70 + Math.round(40 - (home.y - MEET_Y));
        scene.add(sprite);
        fighters.push({ sprite, role, kind, enemy, home, front, phase: (index * 0.37) % 1, fellAt: null });
      }
      row += Math.ceil(shown / perRow);
    }
  }

  /** How many of `kind` stand on a side after a round (counts capped like the sprites). */
  function standing(round: BattleRound, enemy: boolean, kind: Kind): number {
    const side = enemy ? round.enemy : round.player;
    const value = kind === "militia" ? (enemy ? 0 : round.player.militia) : side[kind as keyof ArmyCounts];
    return value;
  }

  function applyRound(round: BattleRound, now: number, start: BattleCounts, enemyStart: ArmyCounts): void {
    for (const enemy of [false, true]) {
      for (const kind of ORDER) {
        const total = enemy ? (kind === "militia" ? 0 : enemyStart[kind as keyof ArmyCounts]) : start[kind];
        if (total === 0) continue;
        const sprites = fighters.filter((fighter) => fighter.enemy === enemy && fighter.kind === kind);
        // Keep the drawn share of survivors in step with the real share.
        const keep = Math.round((standing(round, enemy, kind) / total) * sprites.length);
        let alive = sprites.filter((fighter) => fighter.fellAt === null);
        // The front of each block falls first.
        alive = alive.sort((a, b) => (enemy ? b.home.y - a.home.y : a.home.y - b.home.y));
        for (const fighter of alive.slice(0, Math.max(0, alive.length - keep))) fighter.fellAt = now;
      }
    }
  }

  let playerStart: BattleCounts = { archers: 0, swordsmen: 0, horsemen: 0, militia: 0 };
  let enemyStart: ArmyCounts = { archers: 0, swordsmen: 0, horsemen: 0 };

  function finish(): void {
    if (!active) return;
    active = false;
    const done = playback;
    playback = null;
    done?.onDone();
  }

  return {
    get active() { return active; },

    /** Loads the sheets the battle needs (call when the muster opens, so the fight starts drawn). */
    prepare(): Promise<void> {
      const roles: CharacterRole[] = ["swordsman", "archer", "horseman", "militia", "enemy"];
      return Promise.all(roles.map((role) => characters.ensureRole(role, true).catch(() => undefined))).then(() => undefined);
    },

    /** Starts the fight. `now` is performance.now(). */
    play(player: BattleCounts, enemy: ArmyCounts, battleRounds: BattleRound[], callbacks: BattlePlayback, now: number, reduced = false): void {
      clear();
      playerStart = { ...player };
      enemyStart = { ...enemy };
      rounds = battleRounds;
      roundsShown = 0;
      playback = callbacks;
      reducedMotion = reduced;
      startedAt = now;
      formation(player, false);
      formation({ ...enemy, militia: 0 }, true);
      active = true;
    },

    /** Ends the fight now (Skip): every round is applied at once. */
    skip(now = performance.now()): void {
      if (!active) return;
      for (; roundsShown < rounds.length; roundsShown += 1) {
        applyRound(rounds[roundsShown], now - FADE_MS, playerStart, enemyStart);
        playback?.onRound?.(roundsShown, rounds[roundsShown]);
      }
      finish();
    },

    /** Removes the fighters (back to the city, a new run). */
    clear(): void {
      active = false;
      playback = null;
      clear();
    },

    /** Per frame while active: march, close, strike, fall. */
    update(now: number): void {
      if (fighters.length === 0) return;
      const t = now - startedAt;
      const march = reducedMotion ? 1 : Math.min(1, t / MARCH_MS);
      const fightTime = Math.max(0, t - MARCH_MS);
      const due = reducedMotion ? rounds.length : Math.min(rounds.length, Math.floor(fightTime / ROUND_MS));
      while (active && roundsShown < due) {
        applyRound(rounds[roundsShown], now, playerStart, enemyStart);
        playback?.onRound?.(roundsShown, rounds[roundsShown]);
        roundsShown += 1;
      }
      // Lines close during the first round, then hold the front.
      const close = march < 1 ? 0 : Math.min(1, fightTime / (ROUND_MS * 0.6));
      for (const fighter of fighters) {
        const { sprite } = fighter;
        const size = sprite.scale.y;
        if (fighter.fellAt !== null) {
          const fade = Math.min(1, (now - fighter.fellAt) / FADE_MS);
          sprite.material.opacity = 1 - fade;
          sprite.visible = fade < 1;
          continue;
        }
        const arriveY = fighter.enemy ? fighter.home.y - MARCH_IN * (1 - march) : fighter.home.y;
        const x = THREE.MathUtils.lerp(fighter.home.x, fighter.front.x, close);
        const y = THREE.MathUtils.lerp(arriveY, fighter.front.y, close);
        sprite.position.set(x, y + size / 2, 2.7);
        const facing: WalkDirection = fighter.enemy ? 0 : 4;
        const moving = march < 1 || (close > 0 && close < 1);
        let texture: THREE.Texture | null = null;
        // Archers loose from where they stand; everyone else strikes once the lines meet.
        if (!moving && march >= 1 && active) texture = characters.getWorkFrame(fighter.role, Math.floor(now / 110 + fighter.phase * 8));
        sprite.scale.x = size * (texture ? WORK_CELL_ASPECT : WALK_CELL_ASPECT);
        texture ??= characters.getFrame(fighter.role, moving ? Math.floor(now / 140 + fighter.phase * 4) : 0, facing);
        if (sprite.material.map !== texture) { sprite.material.map = texture; sprite.material.needsUpdate = true; }
      }
      // A short beat after the last round, so the final fall is seen.
      if (active && roundsShown >= rounds.length && (reducedMotion || fightTime >= rounds.length * ROUND_MS + FADE_MS)) finish();
    },
  };
}

export type BattleField = ReturnType<typeof createBattleField>;
