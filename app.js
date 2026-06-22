/* QRLife — encode text/link into a QR code, then run Conway's Game of Life
   seeded by that QR pattern. */

(function () {
  "use strict";

  // ---- DOM ----
  const $ = (id) => document.getElementById(id);
  const inputEl = $("input");
  const generateBtn = $("generate");
  const errorEl = $("error");
  const stageEl = $("stage");
  const canvas = $("canvas");
  const ctx = canvas.getContext("2d");
  const playPauseBtn = $("playPause");
  const stepBtn = $("step");
  const resetBtn = $("reset");
  const speedEl = $("speed");
  const wrapEl = $("wrap");
  const ghostEl = $("ghost");
  const genCountEl = $("genCount");
  const popCountEl = $("popCount");
  const statusEl = $("status");

  // ---- State ----
  let size = 0;          // grid is size x size
  let grid = null;       // Uint8Array, current generation
  let next = null;       // Uint8Array, scratch buffer
  let seed = null;       // Uint8Array, the original QR pattern (gen 0)
  let generation = 0;
  let playing = false;
  let timerId = null;       // setInterval handle for the simulation loop
  let startTimerId = null;  // setInterval handle for the pre-start QR countdown

  // Cycle detection: map each generation's exact state -> the generation it
  // first appeared. A repeat means we've entered a cycle.
  let seen = new Map();
  let cycle = null; // { period, startGen } once detected
  const SEEN_LIMIT = 50000; // bound memory; give up exact detection beyond this

  // ---- QR generation ----
  // Build the cellular grid from the QR module matrix. We add a quiet-border
  // margin so gliders have room to travel and the QR stays scannable at gen 0.
  function buildFromText(text) {
    const QUIET = 6; // margin of dead cells around the QR
    const qr = qrcode(0, "M"); // version 0 = auto-fit, error-correction M
    qr.addData(text);
    qr.make();

    const count = qr.getModuleCount();
    const dim = count + QUIET * 2;

    size = dim;
    seed = new Uint8Array(dim * dim);
    for (let r = 0; r < count; r++) {
      for (let c = 0; c < count; c++) {
        if (qr.isDark(r, c)) {
          seed[(r + QUIET) * dim + (c + QUIET)] = 1;
        }
      }
    }

    grid = seed.slice();
    next = new Uint8Array(dim * dim);
    generation = 0;
  }

  // ---- Cycle detection ----
  // Pack the grid into a compact binary string (8 cells per byte) — an exact,
  // collision-free key for the current state.
  function stateKey() {
    const len = grid.length;
    const bytes = new Uint8Array((len + 7) >> 3);
    for (let i = 0; i < len; i++) {
      if (grid[i]) bytes[i >> 3] |= 1 << (i & 7);
    }
    let s = "";
    // Chunk to avoid call-stack limits on String.fromCharCode for big grids.
    for (let i = 0; i < bytes.length; i += 4096) {
      s += String.fromCharCode.apply(null, bytes.subarray(i, i + 4096));
    }
    return s;
  }

  function initDetection() {
    seen = new Map();
    cycle = null;
    seen.set(stateKey(), generation);
    setStatus("Evolving…", "");
  }

  function detect() {
    if (cycle) return; // already know the period — keep animating it
    if (seen.size > SEEN_LIMIT) {
      seen.clear();
      seen.set(stateKey(), generation);
      return;
    }
    const key = stateKey();
    const prev = seen.get(key);
    if (prev !== undefined) {
      cycle = { period: generation - prev, startGen: prev };
      seen.clear(); // detection done — free the memory
      onCycle();
    } else {
      seen.set(key, generation);
    }
  }

  function onCycle() {
    let pop = 0;
    for (let i = 0; i < grid.length; i++) pop += grid[i];

    if (cycle.period === 1) {
      // Frozen forever — nothing more to watch, so stop here.
      if (pop === 0) {
        setStatus("💀 Extinct @ gen " + cycle.startGen, "dead");
      } else {
        setStatus("🧊 Frozen still-life @ gen " + cycle.startGen, "stable");
      }
      pause();
    } else {
      // A repeating loop — leave it playing so the user can watch it cycle.
      setStatus(
        "🔁 Stable cycle · period " + cycle.period + " (since gen " + cycle.startGen + ")",
        "stable"
      );
    }
  }

  function setStatus(text, cls) {
    statusEl.textContent = text;
    statusEl.className = "status" + (cls ? " " + cls : "");
  }

  // ---- Game of Life ----
  function tick() {
    const wrap = wrapEl.checked;
    const n = size;

    for (let r = 0; r < n; r++) {
      for (let c = 0; c < n; c++) {
        let live = 0;
        for (let dr = -1; dr <= 1; dr++) {
          for (let dc = -1; dc <= 1; dc++) {
            if (dr === 0 && dc === 0) continue;
            let rr = r + dr;
            let cc = c + dc;
            if (wrap) {
              rr = (rr + n) % n;
              cc = (cc + n) % n;
            } else if (rr < 0 || rr >= n || cc < 0 || cc >= n) {
              continue;
            }
            live += grid[rr * n + cc];
          }
        }
        const idx = r * n + c;
        const alive = grid[idx];
        // Conway's rules: survive on 2-3 neighbours, born on exactly 3.
        next[idx] = alive ? (live === 2 || live === 3 ? 1 : 0) : (live === 3 ? 1 : 0);
      }
    }

    const tmp = grid;
    grid = next;
    next = tmp;
    generation++;
    detect();
  }

  // ---- Rendering ----
  function render() {
    const n = size;
    const px = Math.max(1, Math.floor(canvas.width / n));
    const drawn = px * n;

    // White background, centred.
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const offset = Math.floor((canvas.width - drawn) / 2);
    const showGhost = ghostEl.checked;

    for (let r = 0; r < n; r++) {
      for (let c = 0; c < n; c++) {
        const idx = r * n + c;
        const alive = grid[idx];
        const wasSeed = seed[idx];

        if (alive) {
          ctx.fillStyle = "#15803d";
        } else if (showGhost && wasSeed) {
          ctx.fillStyle = "#e2e8f0"; // faded QR ghost
        } else {
          continue;
        }
        ctx.fillRect(offset + c * px, offset + r * px, px, px);
      }
    }
  }

  function updateStats() {
    let pop = 0;
    for (let i = 0; i < grid.length; i++) pop += grid[i];
    genCountEl.textContent = "Gen " + generation;
    popCountEl.textContent = "Pop " + pop;
  }

  function loopStep() {
    tick();
    render();
    updateStats();
  }

  // We drive the loop with setInterval (not requestAnimationFrame) so it keeps
  // advancing when the tab is in the background — browsers suspend rAF for
  // hidden tabs, which froze the simulation when the user switched away.
  function scheduleTimer() {
    if (timerId) clearInterval(timerId);
    const fps = Number(speedEl.value);
    timerId = setInterval(loopStep, 1000 / fps);
  }

  function play() {
    if (playing) return;
    clearStartCountdown();
    playing = true;
    playPauseBtn.textContent = "⏸ Pause";
    if (!cycle) setStatus("Evolving…", "");
    scheduleTimer();
  }

  function pause() {
    clearStartCountdown();
    playing = false;
    playPauseBtn.textContent = "▶ Play";
    if (timerId) {
      clearInterval(timerId);
      timerId = null;
    }
  }

  // After Generate we hold the static QR on screen for a beat so it's clearly
  // readable/scannable, then auto-start the simulation.
  function startWithCountdown(seconds) {
    clearStartCountdown();
    pause();
    let remaining = seconds;
    setStatus("Showing QR · starting in " + remaining + "s…", "");
    startTimerId = setInterval(function () {
      remaining--;
      if (remaining > 0) {
        setStatus("Showing QR · starting in " + remaining + "s…", "");
      } else {
        clearStartCountdown();
        play();
      }
    }, 1000);
  }

  function clearStartCountdown() {
    if (startTimerId) {
      clearInterval(startTimerId);
      startTimerId = null;
    }
  }

  function resetToSeed() {
    pause();
    grid = seed.slice();
    generation = 0;
    initDetection();
    render();
    updateStats();
  }

  // ---- Wiring ----
  function generate() {
    const text = inputEl.value.trim();
    errorEl.hidden = true;
    if (!text) {
      errorEl.textContent = "Please enter a link or some text first.";
      errorEl.hidden = false;
      return;
    }
    try {
      pause();
      buildFromText(text);
    } catch (e) {
      errorEl.textContent =
        "Couldn't make a QR code from that — it may be too long. Try shorter text. (" +
        (e && e.message ? e.message : e) + ")";
      errorEl.hidden = false;
      return;
    }
    initDetection();
    stageEl.hidden = false;
    render();
    updateStats();
    // Show the QR still for a couple of seconds, then start the simulation.
    startWithCountdown(3);
  }

  generateBtn.addEventListener("click", generate);
  inputEl.addEventListener("keydown", (e) => {
    if (e.key === "Enter") generate();
  });

  playPauseBtn.addEventListener("click", () => (playing ? pause() : play()));
  stepBtn.addEventListener("click", () => {
    pause();
    tick();
    render();
    updateStats();
  });
  resetBtn.addEventListener("click", resetToSeed);
  ghostEl.addEventListener("change", render);
  // Apply a new speed immediately while playing.
  speedEl.addEventListener("input", () => {
    if (playing) scheduleTimer();
  });
  // Changing edge behaviour changes the rules, so old states are no longer
  // comparable — restart detection from the current generation.
  wrapEl.addEventListener("change", () => {
    if (grid) initDetection();
  });

  // Generate the default value on load so there's something to see.
  generate();
})();
