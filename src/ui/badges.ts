import { BADGES, badgeById, type BadgeDefinition, type BadgeEmblem } from "../game/badges";
import { escapeHtml, focusFirst, trapTab } from "./dom";

/**
 * 0.16.0 medals: inline SVG (no downloads, sharp at any scale), a gallery
 * dialog and the "new badge" reveal used by the result popup.
 */

const EMBLEMS: Record<BadgeEmblem, string> = {
  fire: `<path d="M24 11c4 5 9 8 9 15a9 9 0 0 1-18 0c0-4 2-6 4-8 0 3 1 5 3 6-1-5 0-9 2-13z" fill="#ffd36b"/><path d="M24 22c2 2 4 4 4 7a4 4 0 0 1-8 0c0-2 2-4 4-7z" fill="#e8742a"/>`,
  star: `<path d="m24 11 3.8 8 8.7 1.1-6.4 6 1.7 8.6L24 30.4l-7.8 4.3 1.7-8.6-6.4-6 8.7-1.1z" fill="#fff0bd" stroke="#8a5a17" stroke-width="1.2"/>`,
  crown: `<path d="M13 31 11 17l7 6 6-10 6 10 7-6-2 14z" fill="#ffe08a" stroke="#8a5a17" stroke-width="1.2" stroke-linejoin="round"/><rect x="13" y="31" width="22" height="4" rx="1" fill="#e9b93a"/><circle cx="24" cy="24" r="2" fill="#c9452f"/>`,
  chakra: `<circle cx="24" cy="24" r="10" fill="none" stroke="#1f4f9a" stroke-width="2.2"/><circle cx="24" cy="24" r="2.4" fill="#1f4f9a"/><g stroke="#1f4f9a" stroke-width="1.3">${Array.from({ length: 12 }, (_, i) => { const a = (i / 12) * Math.PI * 2; return `<path d="M${(24 + Math.cos(a) * 2.6).toFixed(1)} ${(24 + Math.sin(a) * 2.6).toFixed(1)}L${(24 + Math.cos(a) * 9.6).toFixed(1)} ${(24 + Math.sin(a) * 9.6).toFixed(1)}"/>`; }).join("")}</g>`,
  elephant: `<ellipse cx="26" cy="25" rx="9" ry="6.5" fill="#8e8a88"/><circle cx="17" cy="22" r="5" fill="#8e8a88"/><path d="M13.5 24c-1.5 3-1.5 6 .5 9" stroke="#8e8a88" stroke-width="2.8" fill="none" stroke-linecap="round"/><path d="M19 31v4M23 31v4M29 31v4M33 30v5" stroke="#6f6b69" stroke-width="3" stroke-linecap="round"/><path d="M21 18h9l1 4H20z" fill="#c9452f"/><circle cx="16" cy="21" r="1" fill="#2b2420"/>`,
  horse: `<path d="M18 36c-.5-4 .5-7 3-9.5L17.5 24c-2 1-3.8.5-4.5-1-.5-1 0-2 1-2.8L20 13c1.6-1.8 4-2.5 6.3-2l1.3-2.2 1.5 2.8c3.4 2 5 6.3 4.5 10.6L32 36z" fill="#9a6235"/><path d="M26 11c3 .5 5.8 2.8 6.8 6.2 1 3.3.5 7.8-.8 18.8h-2.5c1.3-8.5 1.5-12.5.5-15.8-.8-2.6-2.4-4.6-4-5.6z" fill="#3a2a1d"/><circle cx="22.5" cy="16" r="1.2" fill="#1e1a16"/>`,
  tower: `<path d="M17 36V18h14v18z" fill="#b5624a"/><path d="M24 18h7v18h-7z" fill="#934a37"/><path d="M16 18v-4h3v2h3v-2h4v2h3v-2h3v4z" fill="#c6745a"/><path d="M22.5 23h3v5h-3z" fill="#2b2420"/><path d="M24 14V9" stroke="#6b4423" stroke-width="1.2"/><path d="M24 9l5 1.8-5 1.7z" fill="#e88828"/>`,
  hammer: `<path d="M26 22 14 34l2.5 2.5L28.5 24.5" stroke="#b4743f" stroke-width="3.2" stroke-linecap="round"/><path d="M23 15l5.5-2 7.5 7.5-3.5 3.5-2.8-2.8-3.4 3.4-4.2-4.2 3.4-3.4z" fill="#c3c8cc"/>`,
  scales: `<path d="M24 12v22M16 35h16" stroke="#8a5a17" stroke-width="2" stroke-linecap="round"/><path d="M14 17h20" stroke="#8a5a17" stroke-width="1.8" stroke-linecap="round"/><path d="M14 17l-4 8h8zM34 17l-4 8h8z" fill="none" stroke="#8a5a17" stroke-width="1.3"/><path d="M10 25a4 2 0 0 0 8 0zM30 25a4 2 0 0 0 8 0z" fill="#ffd36b"/>`,
  shield: `<path d="M24 11 34 15v8c0 6.5-4.4 11-10 13-5.6-2-10-6.5-10-13v-8z" fill="#3f6fb5"/><path d="M24 11 34 15v8c0 6.5-4.4 11-10 13z" fill="#2f568f"/><path d="M19.5 23l3 3 6-6.5" stroke="#f6e7c1" stroke-width="2.2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`,
  lotus: `<path d="M24 14c3 3 4 7 0 14-4-7-3-11 0-14z" fill="#f29bb4"/><path d="M24 28c-6-1-10-5-11-10 5 0 9 3 11 10zM24 28c6-1 10-5 11-10-5 0-9 3-11 10z" fill="#e8749a"/><path d="M14 31c6 2 14 2 20 0" stroke="#4f9a45" stroke-width="2" fill="none" stroke-linecap="round"/>`,
  sword: `<path d="M31 11h5v5L21 31l-5-5z" fill="#d3d6d8"/><path d="M36 11 21 26" stroke="#8c9194" stroke-width="1"/><path d="M13 25l10 10M15.5 30.5 11 35l2 2 4.5-4.5" stroke="#c4911c" stroke-width="2.6" stroke-linecap="round"/>`,
};

const TIER_COLOURS: Record<BadgeDefinition["tier"], [string, string, string]> = {
  bronze: ["#e3a36b", "#a8622f", "#6e3c18"],
  silver: ["#f1f3f5", "#aab2b9", "#5d666e"],
  gold: ["#ffe9a3", "#e2a92b", "#8a5a17"],
};

/** One medal as inline SVG. Locked medals are drawn grey with a lock ring. */
export function medal(badge: BadgeDefinition, earned: boolean, size = 64): string {
  const [light, mid, dark] = earned ? TIER_COLOURS[badge.tier] : ["#7b7f86", "#565a61", "#3a3d42"];
  const id = `m-${badge.id}-${earned ? "on" : "off"}`;
  return `<svg class="medal ${earned ? "earned" : "locked"} tier-${badge.tier}" width="${size}" height="${size}" viewBox="0 0 48 48" aria-hidden="true" focusable="false">
    <defs><radialGradient id="${id}" cx="40%" cy="35%" r="70%"><stop offset="0" stop-color="${light}"/><stop offset=".65" stop-color="${mid}"/><stop offset="1" stop-color="${dark}"/></radialGradient></defs>
    <path d="M15 2h7l2 9-6 2zM33 2h-7l-2 9 6 2z" fill="${earned ? "#c9452f" : "#4b4f55"}"/>
    <circle cx="24" cy="25" r="20" fill="url(#${id})" stroke="${dark}" stroke-width="1.5"/>
    <circle cx="24" cy="25" r="15.5" fill="none" stroke="${light}" stroke-opacity=".7" stroke-width="1" stroke-dasharray="2 2"/>
    <g transform="translate(0 1)" ${earned ? "" : `opacity=".45" filter="grayscale(1)"`}>${EMBLEMS[badge.emblem]}</g>
  </svg>`;
}

/** The "new badge" strip for the result popup. */
export function badgeRevealHtml(ids: readonly string[]): string {
  const badges = ids.map((id) => badgeById(id)).filter((badge): badge is BadgeDefinition => Boolean(badge));
  if (!badges.length) return "";
  return `<div class="badge-reveal" role="group" aria-label="New badge${badges.length > 1 ? "s" : ""} earned">
    <p class="badge-reveal-title">${badges.length > 1 ? `${badges.length} new badges!` : "New badge!"}</p>
    <ul>${badges.map((badge, index) => `<li style="--i:${index}">${medal(badge, true, 72)}<span><b>${escapeHtml(badge.name)}</b><small>${escapeHtml(badge.how)}</small></span></li>`).join("")}</ul>
  </div>`;
}

/** The badge gallery: every medal, earned in colour, the rest grey with how to earn it. */
export function createBadgeGallery(root: HTMLElement, onSound?: () => void) {
  const scrim = document.createElement("div");
  scrim.className = "badge-scrim hidden";
  const dialog = document.createElement("section");
  dialog.className = "badge-dialog";
  dialog.setAttribute("role", "dialog");
  dialog.setAttribute("aria-modal", "true");
  dialog.setAttribute("aria-labelledby", "badge-title");
  scrim.appendChild(dialog);
  root.appendChild(scrim);
  let returnFocus: HTMLElement | null = null;
  const isOpen = (): boolean => !scrim.classList.contains("hidden");
  document.addEventListener("keydown", (event) => {
    if (!isOpen()) return;
    trapTab(event, dialog);
    if (event.key === "Escape") { event.preventDefault(); close(); }
  });
  scrim.addEventListener("click", (event) => { if (event.target === scrim) close(); });

  function open(earnedIds: readonly string[]): void {
    const earned = new Set(earnedIds);
    const count = BADGES.filter((badge) => earned.has(badge.id)).length;
    dialog.innerHTML = `<header class="badge-head"><div><p class="flow-kicker">ACHIEVEMENTS</p><h2 id="badge-title">Royal Badges</h2><p class="badge-count"><b>${count}</b> of ${BADGES.length} earned</p></div>
      <button type="button" class="badge-close" data-action="close" aria-label="Close badges">✕</button></header>
      <div class="badge-progress" role="meter" aria-valuemin="0" aria-valuemax="${BADGES.length}" aria-valuenow="${count}" aria-label="Badges earned"><i style="width:${Math.round((count / BADGES.length) * 100)}%"></i></div>
      <ul class="badge-grid">${BADGES.map((badge) => {
        const has = earned.has(badge.id);
        return `<li class="${has ? "earned" : "locked"}" aria-label="${escapeHtml(`${badge.name}: ${has ? "earned" : "locked"}. ${badge.how}`)}">${medal(badge, has, 60)}<b>${escapeHtml(badge.name)}</b><small>${escapeHtml(badge.how)}</small></li>`;
      }).join("")}</ul>`;
    dialog.querySelector("[data-action=close]")!.addEventListener("click", close);
    const active = document.activeElement;
    returnFocus = active instanceof HTMLElement && active !== document.body ? active : null;
    scrim.classList.remove("hidden");
    onSound?.();
    dialog.querySelector<HTMLButtonElement>("[data-action=close]")?.focus({ preventScroll: true });
  }

  function close(): void {
    if (!isOpen()) return;
    scrim.classList.add("hidden");
    focusFirst(returnFocus, "#campaign-launch", "#city-ui-toggle");
    returnFocus = null;
  }

  return { open, close, get isOpen() { return isOpen(); } };
}

export type BadgeGallery = ReturnType<typeof createBadgeGallery>;
