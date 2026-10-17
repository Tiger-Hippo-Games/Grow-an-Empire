// Boot watchdog. main.ts shows its own error screen once it's running, but
// if the game's code can't load or throws before that (e.g. a typo while
// editing, or the dev server stopped), the page would otherwise sit on the
// loading spinner forever. This replaces the spinner with an explanation.
// It stands down as soon as main.ts marks <html data-booted>.
(function () {
  var shown = false;
  function show(detail) {
    if (shown || document.documentElement.dataset.booted) return;
    var loading = document.getElementById("loading");
    if (!loading || loading.querySelector("button")) return; // main.ts already showed its own error.
    shown = true;
    // Tell the portal the game has answered, so its loading screen lifts
    // and this message is seen (main.ts never sends it twice).
    if (window.parent !== window && !window.__gaeReadySent) {
      window.__gaeReadySent = true;
      try { window.parent.postMessage({ type: "GAME_READY", gameVersion: "boot-error" }, window.location.origin); } catch (e) { /* Parent refused. */ }
    }
    // A machine-local host (single-label name or 127.x loopback); the portal is always a full domain.
    var host = window.location.hostname;
    var local = host.length > 0 && (host.indexOf(".") === -1 || /^127\./.test(host));
    var title = document.createElement("strong");
    title.textContent = "The game didn't start.";
    var body = document.createElement("span");
    body.textContent = window.location.protocol === "file:"
      ? "This page was opened straight from a folder, and browsers block a game's scripts and styles there. It runs on the portal, or locally with `pnpm preview`."
      : local
        ? detail + " If you're running the dev server, check its terminal window for errors, then reload."
        : "Something stopped it loading. Check your connection, then press Reload.";
    var retry = document.createElement("button");
    retry.type = "button";
    retry.textContent = "Reload";
    retry.onclick = function () { window.location.reload(); };
    loading.replaceChildren(title, body, retry);
  }
  window.addEventListener("error", function (event) {
    if (event.target instanceof HTMLScriptElement) {
      // The portal SDK only exists on the portal; without it the game plays offline.
      if ((event.target.src || "").indexOf("platform-sdk.js") !== -1) return;
      show("A script file failed to load.");
    }
    // A bug inside the portal's SDK doesn't stop the game (it falls back to offline play).
    else if ((event.filename || "").indexOf("platform-sdk.js") !== -1) return;
    // Muted cross-origin errors (the SDK) and the browser's ResizeObserver notice aren't the game's.
    else if (!(event.error instanceof Error) || /^(ResizeObserver loop|Script error)/i.test(event.message || "")) return;
    else if (event.message) show(event.message + ".");
  }, true);
  window.addEventListener("unhandledrejection", function (event) {
    var reason = event.reason;
    // Only the game's own code stops the boot; a rejected SDK request doesn't.
    if (!(reason instanceof Error) || !/\/game(-[\w-]+)?\.js|\/src\//.test(reason.stack || "") || /platform-sdk/.test(reason.stack || "")) return;
    show((reason && reason.message ? reason.message : String(reason)) + ".");
  });
  // Only complain if loading has *stalled*: a slow connection that is still
  // making progress must not be reported as a failure. main.ts updates
  // window.__gaeLoadActivityAt every time an image starts or finishes.
  var startedAt = Date.now();
  var stallTimer = setInterval(function () {
    if (document.documentElement.dataset.booted) return clearInterval(stallTimer);
    var lastActivity = window.__gaeLoadActivityAt || startedAt;
    if (Date.now() - lastActivity > 20000) {
      clearInterval(stallTimer);
      show("Loading stopped making progress for 20 seconds. Check your connection.");
    }
  }, 2000);
})();
