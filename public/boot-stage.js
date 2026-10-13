// Stage fit. Two layouts:
//  - "fixed": when the window or portal frame can show the 1280×720 stage
//    at 95% or more, the game is laid out at 1280×720 or more and scaled
//    as a whole. The stage takes the frame's own shape (wider or taller
//    than 16:9, never smaller than 1280×720), so the game fills the
//    portal's iframe edge to edge with no bars: the portal's frame is the
//    window height minus its 44 px bar, so a 1920×1080 screen gives about
//    1920×1036 or less (a 1920×1080 frame shows exactly 1.5×).
//  - "fluid": in smaller frames (phones, tablets, small windows, either
//    orientation) the stage takes the frame's own shape at 1:1 (scaled
//    down only below 568×320 / 320×568), and styles.css rearranges the
//    panels with container queries on #app, so text and buttons keep
//    their real size instead of shrinking with the stage.
// Runs before anything is drawn so the first frame is already the right
// size. styles.css reads --stage-*; sceneSetup.ts reads __gaeStageScale
// and __gaeLayout.
(function () {
  var WIDTH = 1280, HEIGHT = 720, FIXED_MIN_SCALE = 0.95;
  var root = document.documentElement;
  function fit() {
    var w = window.innerWidth, h = window.innerHeight;
    if (!(w > 0 && h > 0)) return; // A hidden 0×0 frame: keep the last good fit.
    var scale = Math.min(w / WIDTH, h / HEIGHT);
    var layout = "fixed", stageW = Math.round(w / scale), stageH = Math.round(h / scale);
    if (scale < FIXED_MIN_SCALE) {
      layout = "fluid";
      var portrait = h > w;
      scale = Math.min(1, w / (portrait ? 320 : 568), h / (portrait ? 568 : 320));
      stageW = Math.round(w / scale);
      stageH = Math.round(h / scale);
    }
    window.__gaeStageScale = scale;
    window.__gaeLayout = layout;
    root.dataset.layout = layout;
    root.dataset.orientation = stageH > stageW ? "portrait" : "landscape";
    root.style.setProperty("--stage-scale", String(scale));
    root.style.setProperty("--stage-w", stageW + "px");
    root.style.setProperty("--stage-h", stageH + "px");
  }
  fit();
  window.addEventListener("resize", fit);
  if (window.visualViewport) window.visualViewport.addEventListener("resize", fit);
})();
