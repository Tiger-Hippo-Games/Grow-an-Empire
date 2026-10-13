import type { PlatformAdapter } from "../platform/types";
import { escapeHtml } from "./dom";

/** Live portal players are displayed separately from the seeded AI Realm. */
export function createPlayerLeaderboard(platform: PlatformAdapter, signedIn: () => boolean) {
  let request = 0;
  return {
    async show(container: HTMLElement): Promise<void> {
      const current = ++request;
      container.innerHTML = `<p class="flow-note">Loading this week's players…</p>`;
      const board = await platform.readLeaderboard();
      if (current !== request || !container.isConnected) return;
      container.innerHTML = `
        <p class="flow-note">One point per distinct campaign won. Best score this week counts.</p>
        <p class="flow-note quiet">Weekly · Resets Monday at 00:00 UTC (05:30 IST).</p>
        ${board === "unavailable" ? `<p role="status">The leaderboard is unavailable. Try again shortly.</p>` : `
          ${board.entries.length ? `<table class="player-rankings"><caption class="ws">Top ten players this week</caption><thead><tr><th>Rank</th><th>Player</th><th>Campaigns won</th></tr></thead><tbody>${board.entries.map(row => `<tr><td>${row.rank}</td><td>${escapeHtml(row.displayName)}</td><td>${row.score}</td></tr>`).join("")}</tbody></table>` : `<p class="flow-note">No scores yet this week. Win a campaign to join the competition.</p>`}
          ${signedIn() ? `<p class="flow-note" role="status">${board.me?.rank ? `Your rank: #${board.me.rank} · ${board.me.score ?? 0} campaigns won` : "You have no score this week yet. Finish a battle to post your campaign wins."}</p>` : ""}
        `}
        ${!signedIn() ? `<p class="flow-note">Sign in on the portal to post your score. Guests can view the rankings.</p>` : ""}
        <button type="button" class="flow-button" data-refresh>Refresh rankings</button>`;
      container.querySelector("[data-refresh]")?.addEventListener("click", () => { void this.show(container); });
    },
    cancel(): void { request++; },
  };
}
