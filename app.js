/* ============================================================
   Focus — Pomodoro Timer
   Vanilla JS, no dependencies.

   Sections:
     1. Storage & state
     2. Helpers (time / date formatting)
     3. Timer engine
     4. Audio notification
     5. UI — timer
     6. UI — tasks
     7. UI — reports
     8. Settings dialog
     9. View switching, toast, keyboard
    10. Init
   ============================================================ */
(() => {
  "use strict";

  /* ---------- 1. Storage & state ---------- */

  const LS_KEY = "pomodoro.app.v1";

  const DEFAULT_SETTINGS = {
    focus: 25, // minutes
    shortBreak: 5,
    longBreak: 15,
    longEvery: 4, // focus sessions per long break
    sound: true,
    // 'off'        — every session is started manually
    // 'all'        — every next session starts automatically
    // 'until-long' — sessions chain automatically, but the chain stops
    //                once a long break has finished
    autoStartMode: "off",
    // 'dark' | 'light' | 'system' — 'system' follows the OS appearance
    theme: "dark",
    // 'auto' — layout follows the screen size (responsive)
    // 'mobile' / 'desktop' — force that UI regardless of screen size
    layout: "auto",
    // Soundscape played while a focus session is running.
    noise: "off", // off | white | pink | brown | rain | ocean | wind
    noiseVolume: 50, // 0–100
    // Background theme for the timer card (see BACKGROUNDS / styles.css).
    timerBg: "default",
    // When a scene background is picked, switch the noise to its matching
    // soundscape automatically (the noise can still be turned off any time).
    matchNoise: true,
    // iPhone flip mode: pause when the phone is picked up, resume when it
    // is placed face-down (needs a motion sensor; no-op on desktops).
    flipFocus: false,
  };

  // Presets offered in the "New Folder" dialog.
  const FOLDER_COLORS = [
    "#ff6b57", "#ffb340", "#3ecf8e", "#4cc9f0",
    "#5b9dff", "#b07cff", "#f472b6", "#94a3b8",
  ];
  // Minimal line icons (stroke = currentColor) matching the app's flat
  // interface. Folder records store the icon's key; legacy emoji values
  // from older saves are migrated in load().
  const ICONS = {
    folder: '<path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>',
    briefcase: '<rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/>',
    book: '<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>',
    code: '<polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/>',
    pen: '<path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4z"/>',
    flask: '<path d="M10 2v6.3L4.6 17.7A2 2 0 0 0 6.4 21h11.2a2 2 0 0 0 1.8-3.3L14 8.3V2"/><line x1="8.5" y1="2" x2="15.5" y2="2"/>',
    activity: '<polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>',
    zap: '<polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>',
    heart: '<path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>',
    home: '<path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>',
    target: '<circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/>',
    star: '<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>',
    leaf: '<path d="M11 20A7 7 0 0 1 4 13C4 8 8 4 20 2c-1 12-5 16-9 18z"/><path d="M4 21c2-3 5-6 9-8"/>',
    music: '<path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>',
    inbox: '<polyline points="22 12 16 12 14 15 10 15 8 12 2 12"/><path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/>',
    "volume-off": '<polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/>',
  };

  function iconSvg(name, size = 16) {
    const body = ICONS[name] || ICONS.folder;
    return (
      `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" ` +
      `stroke="currentColor" stroke-width="2" stroke-linecap="round" ` +
      `stroke-linejoin="round" aria-hidden="true">${body}</svg>`
    );
  }

  const FOLDER_ICONS = [
    "folder", "briefcase", "book", "code", "pen", "flask",
    "activity", "zap", "heart", "home", "target", "star",
  ];

  // Old saves stored emoji in folder.icon — map them to line icons.
  const LEGACY_ICON_MAP = {
    "📁": "folder", "💼": "briefcase", "📚": "book", "💻": "code",
    "🎨": "pen", "📝": "pen", "🧪": "flask", "🏃": "activity",
    "🧠": "zap", "🏠": "home", "🎯": "target", "⭐": "star",
  };

  const state = {
    settings: { ...DEFAULT_SETTINGS },
    folders: [], // { id, name, color, icon, parentId, collapsed, createdAt }
    tasks: [], // { id, name, done, folderId, createdAt }
    sessions: [], // { id, taskId, seconds, endedAt, completed } — focus time only
    activeTaskId: null,
    cycleCount: 0, // completed focus sessions since last long break
    updatedAt: 0, // last local modification, for sync conflict resolution
  };

  function load() {
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (!raw) return;
      const data = JSON.parse(raw);
      state.settings = { ...DEFAULT_SETTINGS, ...(data.settings || {}) };
      // Migrate the old boolean `autoStart` setting to `autoStartMode`.
      if (data.settings && data.settings.autoStartMode === undefined) {
        state.settings.autoStartMode = data.settings.autoStart ? "all" : "off";
      }
      delete state.settings.autoStart;
      state.folders = Array.isArray(data.folders) ? data.folders : [];
      // Migrate emoji icons from older saves to the line-icon keys.
      for (const folder of state.folders) {
        if (folder.icon && !ICONS[folder.icon]) {
          folder.icon = LEGACY_ICON_MAP[folder.icon] || "folder";
        }
      }
      state.tasks = Array.isArray(data.tasks) ? data.tasks : [];
      state.sessions = Array.isArray(data.sessions) ? data.sessions : [];
      state.activeTaskId = data.activeTaskId ?? null;
      state.cycleCount = data.cycleCount || 0;
      state.updatedAt = data.updatedAt || 0;
    } catch (err) {
      console.warn("Could not load saved data:", err);
    }
  }

  function save() {
    try {
      state.updatedAt = Date.now(); // used by Drive sync (last-write-wins)
      localStorage.setItem(LS_KEY, JSON.stringify(state));
    } catch (err) {
      console.warn("Could not save data:", err);
    }
    scheduleDrivePush();
  }

  const uid = () =>
    Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

  /* ---------- 2. Helpers ---------- */

  /** 1500 -> "25:00", 3900 -> "1:05:00" */
  function fmtClock(totalSeconds) {
    const s = Math.max(0, Math.round(totalSeconds));
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    const mm = String(m).padStart(2, "0");
    const ss = String(sec).padStart(2, "0");
    return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
  }

  /** 4500 -> "1h 15m", 300 -> "5m", 30 -> "<1m", 0 -> "0m" */
  function fmtDuration(totalSeconds) {
    const s = Math.round(totalSeconds);
    if (s === 0) return "0m";
    if (s < 60) return "<1m";
    const h = Math.floor(s / 3600);
    const m = Math.round((s % 3600) / 60);
    if (h === 0) return `${m}m`;
    return `${h}h ${String(m).padStart(2, "0")}m`;
  }

  /** Local calendar-day key, e.g. "2026-07-11" */
  function dayKey(ts) {
    const d = new Date(ts);
    return [
      d.getFullYear(),
      String(d.getMonth() + 1).padStart(2, "0"),
      String(d.getDate()).padStart(2, "0"),
    ].join("-");
  }

  /** Midnight (local) of the Monday of the week containing `ts`. */
  function startOfWeek(ts) {
    const d = new Date(ts);
    d.setHours(0, 0, 0, 0);
    const shift = (d.getDay() + 6) % 7; // Mon=0 … Sun=6
    d.setDate(d.getDate() - shift);
    return d.getTime();
  }

  const MODE_LABELS = { focus: "Focus", short: "Short Break", long: "Long Break" };

  /* ---------- 3. Timer engine ----------
     Time is computed from wall-clock timestamps (endAt), not by
     decrementing a counter, so the timer stays accurate even when
     the tab is throttled in the background. */

  const timer = {
    mode: "focus", // 'focus' | 'short' | 'long'
    total: DEFAULT_SETTINGS.focus * 60, // seconds
    remaining: DEFAULT_SETTINGS.focus * 60,
    running: false,
    endAt: 0, // timestamp when the session will finish
    lastStart: 0, // timestamp of the most recent Start press
    accrued: 0, // seconds actually elapsed in this session (across pauses)
    intervalId: null,
  };

  function durationFor(mode) {
    const s = state.settings;
    const minutes =
      mode === "focus" ? s.focus : mode === "short" ? s.shortBreak : s.longBreak;
    return minutes * 60;
  }

  /** Add the run-time since the last Start press to `accrued`. */
  function accrueElapsed() {
    if (!timer.running) return;
    const elapsed = (Date.now() - timer.lastStart) / 1000;
    timer.accrued += Math.max(0, elapsed);
    timer.lastStart = Date.now();
  }

  /** Record accrued focus time as a session in history (breaks are not logged). */
  function flushAccrued(completed) {
    const seconds = Math.round(timer.accrued);
    timer.accrued = 0;
    if (timer.mode !== "focus" || seconds < 5) return; // ignore accidental blips
    state.sessions.push({
      id: uid(),
      taskId: state.activeTaskId,
      seconds,
      endedAt: Date.now(),
      completed,
    });
    save();
    renderTasks(); // per-task totals shown in the list
  }

  function startTimer() {
    if (timer.running || timer.remaining <= 0) return;
    // Creating/resuming the AudioContext inside a user gesture satisfies
    // autoplay policies (Safari / WKWebView), so the chime can play later.
    ensureAudio();
    primeNotifyAudio();
    // When noise starts below, its own play() unlocks the shared player;
    // otherwise prime it now so flip-mode resumes can start audio later.
    if (state.settings.noise === "off" || timer.mode !== "focus") {
      primeNoiseAudio();
    }
    setupFlipFocus(true); // user gesture — lets iOS grant motion access
    timer.running = true;
    timer.lastStart = Date.now();
    timer.endAt = Date.now() + timer.remaining * 1000;
    timer.intervalId = setInterval(tick, 250);
    startNoise(); // soundscape plays only while a focus session runs
    renderControls();
  }

  function pauseTimer() {
    if (!timer.running) return;
    accrueElapsed();
    timer.running = false;
    clearInterval(timer.intervalId);
    stopNoise();
    timer.remaining = Math.max(0, Math.round((timer.endAt - Date.now()) / 1000));
    renderClock();
    renderControls();
  }

  function resetTimer() {
    pauseTimer();
    flushAccrued(false); // keep any partial focus time in history
    timer.remaining = timer.total;
    renderClock();
    renderControls();
  }

  function tick() {
    const remaining = Math.round((timer.endAt - Date.now()) / 1000);
    if (remaining !== timer.remaining) {
      timer.remaining = Math.max(0, remaining);
      renderClock();
    }
    if (remaining <= 0) completeSession();
  }

  /** Natural completion: log time, notify, and advance to the next mode. */
  function completeSession() {
    accrueElapsed();
    timer.running = false;
    clearInterval(timer.intervalId);
    timer.remaining = 0;

    stopNoise();
    playNotification(timer.mode); // the recording for the session that ended

    const autoMode = state.settings.autoStartMode;
    let next;
    let autoStart;
    if (timer.mode === "focus") {
      state.cycleCount += 1;
      flushAccrued(true);
      const longDue =
        state.cycleCount > 0 && state.cycleCount % state.settings.longEvery === 0;
      next = longDue ? "long" : "short";
      autoStart = autoMode !== "off"; // breaks auto-start in both auto modes
      showToast(
        longDue
          ? "Focus complete — take a long break 🎉"
          : "Focus complete — time for a short break"
      );
    } else {
      next = "focus";
      // In 'until-long' mode the chain stops once a long break has finished.
      autoStart =
        autoMode === "all" || (autoMode === "until-long" && timer.mode === "short");
      showToast(
        timer.mode === "long" && !autoStart && autoMode !== "off"
          ? "Long break over — start the next round when you're ready"
          : "Break over — back to focus"
      );
    }
    save();
    setMode(next, { autoStart });
  }

  /** Skip button: advance without counting the session as completed. */
  function skipSession() {
    pauseTimer();
    flushAccrued(false);
    setMode(timer.mode === "focus" ? "short" : "focus");
  }

  /** Switch session type; logs any partial focus time first. */
  function setMode(mode, { autoStart = false } = {}) {
    pauseTimer();
    flushAccrued(false);
    timer.mode = mode;
    timer.total = durationFor(mode);
    timer.remaining = timer.total;
    document.body.dataset.mode = mode;
    renderTimer();
    if (autoStart) startTimer();
  }

  /* ---------- 4. Audio notification ----------
     A short three-note chime generated with the Web Audio API,
     so no sound assets are needed. */

  let audioCtx = null;

  /** Create/resume the context during a user gesture (see startTimer).
      Not gated on the chime setting — the noise engine needs it too. */
  function ensureAudio() {
    try {
      audioCtx =
        audioCtx || new (window.AudioContext || window.webkitAudioContext)();
      if (audioCtx.state === "suspended") audioCtx.resume();
    } catch (err) {
      console.warn("Audio unavailable:", err);
    }
  }

  function playChime() {
    if (!state.settings.sound) return;
    try {
      audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
      if (audioCtx.state === "suspended") audioCtx.resume();
      const now = audioCtx.currentTime;
      [880, 1108.73, 1318.51].forEach((freq, i) => {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        const t = now + i * 0.18;
        osc.type = "sine";
        osc.frequency.value = freq;
        gain.gain.setValueAtTime(0.0001, t);
        gain.gain.exponentialRampToValueAtTime(0.18, t + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.5);
        osc.connect(gain).connect(audioCtx.destination);
        osc.start(t);
        osc.stop(t + 0.55);
      });
    } catch (err) {
      console.warn("Audio unavailable:", err);
    }
  }

  /* ---------- Notification recordings ----------
     One recording per session type, played when that session ENDS.
     The synth chime remains as a fallback if playback fails. */

  const NOTIFY_FILES = {
    focus: "notify-focus.mp3",
    short: "notify-short.mp3",
    long: "notify-long.mp3",
  };

  let notifyAudio = null;
  let notifyPrimed = false;

  /** Unlock the notification player inside a user gesture (see startTimer). */
  function primeNotifyAudio() {
    if (notifyPrimed) return;
    notifyPrimed = true;
    notifyAudio = new Audio(SOUND_DIR + NOTIFY_FILES.focus);
    notifyAudio.preload = "auto";
    notifyAudio.muted = true;
    notifyAudio
      .play()
      .then(() => {
        notifyAudio.pause();
        notifyAudio.currentTime = 0;
        notifyAudio.muted = false;
      })
      .catch(() => {
        notifyAudio.muted = false;
      });
  }

  /** Unlock the shared noise player inside a user gesture, so later
      non-gesture starts (flip mode, auto-start) are allowed by iOS. */
  let noisePrimed = false;

  function primeNoiseAudio() {
    if (noisePrimed) return;
    noisePrimed = true;
    const audio = ensureNoiseAudio();
    if (!audio.paused) return; // already playing — nothing to unlock
    const file = NOISE_FILES[state.settings.noise] || NOISE_FILES.white;
    if (!audio.currentSrc) audio.src = SOUND_DIR + file;
    audio.muted = true;
    audio
      .play()
      .then(() => {
        audio.pause();
        audio.currentTime = 0;
        audio.muted = false;
      })
      .catch(() => {
        audio.muted = false;
        noisePrimed = false; // try again on the next gesture
      });
  }

  /** endedMode: 'focus' | 'short' | 'long' — the session that just finished. */
  function playNotification(endedMode) {
    if (!state.settings.sound) return;
    if (!notifyAudio) {
      playChime();
      return;
    }
    notifyAudio.src = SOUND_DIR + (NOTIFY_FILES[endedMode] || NOTIFY_FILES.focus);
    notifyAudio.volume = 0.9;
    notifyAudio.play().catch(() => playChime());
  }

  /* ---------- White-noise engine ----------
     All soundscapes are synthesized with the Web Audio API from a looped
     noise buffer plus filters/LFOs — no audio files are needed.
       white — flat spectrum          pink  — softer, natural
       brown — deep rumble            rain  — band-passed pink noise
       ocean — brown noise with a slow swell   wind — slowly drifting band-pass */

  let noiseNodes = null;

  /** Looped noise buffer in one of three spectral colors. */
  function makeNoiseBuffer(ctx, color) {
    const length = ctx.sampleRate * 2;
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = buffer.getChannelData(0);

    if (color === "brown") {
      let last = 0;
      for (let i = 0; i < length; i++) {
        const white = Math.random() * 2 - 1;
        last = (last + 0.02 * white) / 1.02;
        data[i] = last * 3.5;
      }
    } else if (color === "pink") {
      // Paul Kellet's pink-noise approximation.
      let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
      for (let i = 0; i < length; i++) {
        const w = Math.random() * 2 - 1;
        b0 = 0.99886 * b0 + w * 0.0555179;
        b1 = 0.99332 * b1 + w * 0.0750759;
        b2 = 0.969 * b2 + w * 0.153852;
        b3 = 0.8665 * b3 + w * 0.3104856;
        b4 = 0.55 * b4 + w * 0.5329522;
        b5 = -0.7616 * b5 - w * 0.016898;
        data[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.11;
        b6 = w * 0.115926;
      }
    } else {
      for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;
    }
    return buffer;
  }

  // Recorded soundscapes (sounds/ folder) — preferred when present; the
  // synthesizer below remains as an automatic fallback if a file is
  // missing or playback is blocked.
  const SOUND_DIR = "sounds/";
  const NOISE_FILES = {
    white: "white-noise.mp3",
    pink: "pink-noise.mp3",
    brown: "brown-noise.mp3",
    rain: "light-rain.mp3",
    ocean: "sea-waves.mp3",
    wind: "wind.mp3",
    seaside: "sea-waves.mp3",
    forest: "forest.mp3",
    library: "library.mp3",
    fire: "fire-crackling.mp3",
    rainwindow: "rain-window.mp3",
    "campfire-sea": "campfire-by-the-sea.mp3",
    "forest-night": "forest-night.mp3",
    "library-talking": "library-talking.mp3",
    "rain-thunder": "rain-thunder.mp3",
    traffic: "traffic.mp3",
  };

  // ONE persistent player, reused for every soundscape. iOS unlocks an
  // audio element per user gesture; reusing the element unlocked by the
  // first Start tap lets flip-mode and auto-start resume playback from
  // motion/timer events (which are not gestures). Keeping the src also
  // resumes the same recording where it paused instead of restarting.
  let noiseAudio = null;
  let noiseRetryTimer = null;

  function ensureNoiseAudio() {
    if (!noiseAudio) {
      noiseAudio = new Audio();
      noiseAudio.loop = true;
      noiseAudio.preload = "auto";
    }
    return noiseAudio;
  }

  function startNoise() {
    const type = state.settings.noise;
    if (type === "off" || timer.mode !== "focus") return;
    stopNoise();
    const file = NOISE_FILES[type];
    if (!file) {
      startSynthNoise(type);
      return;
    }
    const audio = ensureNoiseAudio();
    const src = SOUND_DIR + file;
    // Only swap the source when the soundscape actually changed, so a
    // pause/resume continues the same recording seamlessly.
    if (!audio.currentSrc || !audio.currentSrc.endsWith(file)) {
      audio.src = src;
    }
    audio.volume = state.settings.noiseVolume / 100;
    audio.play().catch(() => {
      // Transient failures happen right after audio-session interruptions
      // (calls, Siri, flip resume) — retry once before falling back.
      clearTimeout(noiseRetryTimer);
      noiseRetryTimer = setTimeout(() => {
        if (state.settings.noise !== type || !timer.running) return;
        audio.play().catch((err) => {
          console.warn("Soundscape playback blocked, using synthesizer:", err);
          startSynthNoise(type);
        });
      }, 400);
    });
  }

  function startSynthNoise(type) {
    ensureAudio();
    if (!audioCtx) return;

    const ctx = audioCtx;
    const master = ctx.createGain();
    master.gain.value = (state.settings.noiseVolume / 100) * 0.35;
    master.connect(ctx.destination);

    const sources = []; // startable nodes (buffer sources, LFOs)
    const nodes = [master]; // gains / filters to disconnect on stop
    const timers = []; // interval ids driving random events (birds, crackles)

    /** Looped noise layer: colored buffer -> optional filter chain -> gain -> master. */
    const layer = (color, gainValue, shape) => {
      const src = ctx.createBufferSource();
      src.buffer = makeNoiseBuffer(ctx, color);
      src.loop = true;
      const gain = ctx.createGain();
      gain.gain.value = gainValue;
      (shape ? shape(src) : src).connect(gain).connect(master);
      src.start();
      sources.push(src);
      nodes.push(gain);
      return gain;
    };
    const filter = (input, kind, freq, q) => {
      const f = ctx.createBiquadFilter();
      f.type = kind;
      f.frequency.value = freq;
      if (q !== undefined) f.Q.value = q;
      input.connect(f);
      nodes.push(f);
      return f;
    };
    /** Slow sine LFO wired into an AudioParam. */
    const lfo = (param, hz, depth) => {
      const osc = ctx.createOscillator();
      osc.frequency.value = hz;
      const amount = ctx.createGain();
      amount.gain.value = depth;
      osc.connect(amount).connect(param);
      osc.start();
      sources.push(osc);
      nodes.push(amount);
    };

    switch (type) {
      case "pink":
        layer("pink", 1);
        break;
      case "brown":
        layer("brown", 1);
        break;
      case "rain":
        layer("pink", 1, (src) => filter(src, "bandpass", 1600, 0.5));
        break;
      case "wind": {
        let bp;
        layer("pink", 1, (src) => (bp = filter(src, "bandpass", 500, 1.2)));
        lfo(bp.frequency, 0.15, 250);
        break;
      }
      case "ocean": {
        const g = layer("brown", 1, (src) => filter(src, "lowpass", 600));
        lfo(g.gain, 0.11, 0.7);
        break;
      }
      case "seaside": {
        // rolling waves plus a light foam hiss
        const waves = layer("brown", 0.9, (src) => filter(src, "lowpass", 700));
        lfo(waves.gain, 0.09, 0.6);
        const hiss = layer("white", 0.08, (src) => filter(src, "highpass", 3200));
        lfo(hiss.gain, 0.13, 0.05);
        break;
      }
      case "forest": {
        // wind in the leaves plus random birdsong
        layer("pink", 0.45, (src) => filter(src, "lowpass", 1100));
        const sing = () => {
          const start = ctx.currentTime + Math.random() * 0.4;
          const notes = 2 + Math.floor(Math.random() * 3);
          for (let i = 0; i < notes; i++) {
            const t = start + i * (0.13 + Math.random() * 0.09);
            const osc = ctx.createOscillator();
            const env = ctx.createGain();
            const freq = 2400 + Math.random() * 1800;
            osc.frequency.setValueAtTime(freq, t);
            osc.frequency.exponentialRampToValueAtTime(freq * 0.7, t + 0.1);
            env.gain.setValueAtTime(0.0001, t);
            env.gain.exponentialRampToValueAtTime(0.5, t + 0.02);
            env.gain.exponentialRampToValueAtTime(0.0001, t + 0.13);
            osc.connect(env).connect(master);
            osc.start(t);
            osc.stop(t + 0.16);
          }
        };
        timers.push(setInterval(() => {
          if (Math.random() < 0.8) sing();
        }, 2600));
        break;
      }
      case "library": {
        // deep, quiet room tone with a hint of moving air
        layer("brown", 0.8, (src) => filter(src, "lowpass", 240));
        layer("white", 0.035, (src) => filter(src, "bandpass", 4200, 0.7));
        break;
      }
      case "fire": {
        // warm base roar plus random crackles
        layer("brown", 0.7, (src) => filter(src, "lowpass", 380));
        const crackleBuffer = makeNoiseBuffer(ctx, "white");
        const crackle = () => {
          const t = ctx.currentTime + Math.random() * 0.05;
          const duration = 0.02 + Math.random() * 0.05;
          const src = ctx.createBufferSource();
          src.buffer = crackleBuffer;
          const bp = ctx.createBiquadFilter();
          bp.type = "bandpass";
          bp.frequency.value = 1500 + Math.random() * 2800;
          bp.Q.value = 1;
          const env = ctx.createGain();
          env.gain.setValueAtTime(0.0001, t);
          env.gain.exponentialRampToValueAtTime(0.25 + Math.random() * 0.5, t + 0.005);
          env.gain.exponentialRampToValueAtTime(0.0001, t + duration);
          src.connect(bp).connect(env).connect(master);
          src.start(t, Math.random(), duration + 0.05);
          src.stop(t + duration + 0.06);
        };
        timers.push(setInterval(() => {
          if (Math.random() < 0.8) crackle();
          if (Math.random() < 0.35) crackle();
        }, 150));
        break;
      }
      case "rainwindow":
        // rain heard through glass: soft and muffled
        layer("pink", 1, (src) => filter(src, "lowpass", 750));
        layer("pink", 0.25, (src) => filter(src, "bandpass", 300, 1));
        break;
      default:
        layer("white", 1);
    }

    noiseNodes = { sources, nodes, timers };
  }

  function stopNoise() {
    clearTimeout(noiseRetryTimer);
    // Pause only — the element (and its iOS gesture unlock, and the
    // playback position) must survive for the next resume.
    if (noiseAudio && !noiseAudio.paused) noiseAudio.pause();
    if (!noiseNodes) return;
    const { sources, nodes, timers } = noiseNodes;
    noiseNodes = null;
    for (const id of timers) clearInterval(id);
    for (const s of sources) {
      try { s.stop(); } catch (e) { /* already stopped */ }
      try { s.disconnect(); } catch (e) { /* already gone */ }
    }
    for (const n of nodes) {
      try { n.disconnect(); } catch (e) { /* already gone */ }
    }
  }

  /* ---------- 5. UI — timer ---------- */

  const $ = (sel) => document.querySelector(sel);

  const el = {
    clock: $("#clock"),
    modeLabel: $("#mode-label"),
    activeTaskLabel: $("#active-task-label"),
    ring: $("#ring-progress"),
    startBtn: $("#start-btn"),
    cycleDots: $("#cycle-dots"),
    taskForm: $("#task-form"),
    taskInput: $("#task-input"),
    taskFolderSelect: $("#task-folder"),
    taskList: $("#task-list"),
    taskEmpty: $("#task-empty"),
    taskCount: $("#task-count"),
    toast: $("#toast"),
    dialog: $("#settings-dialog"),
    folderDialog: $("#folder-dialog"),
    folderName: $("#folder-name"),
    folderParent: $("#folder-parent"),
    folderTitle: $("#folder-dialog-title"),
    folderSubmit: $("#folder-submit"),
    colorPicker: $("#color-picker"),
    iconPicker: $("#icon-picker"),
  };

  // The ring circumference is derived from the SVG geometry so the
  // markup can change without touching this code.
  const RING_C = 2 * Math.PI * el.ring.r.baseVal.value;
  el.ring.style.strokeDasharray = String(RING_C);

  function renderClock() {
    el.clock.textContent = fmtClock(timer.remaining);
    const fraction = timer.total > 0 ? timer.remaining / timer.total : 0;
    el.ring.style.strokeDashoffset = String(RING_C * (1 - fraction));
    document.title = timer.running
      ? `${fmtClock(timer.remaining)} · ${MODE_LABELS[timer.mode]} — Focus`
      : "Focus — Pomodoro Timer";
    updateMediaSession();
  }

  /* ---------- Media session ----------
     While a soundscape plays, iOS shows a Now Playing card (Dynamic
     Island / lock screen). Feed it the countdown and the active task so
     it reads as the timer, and let its play/pause buttons drive the
     timer itself. */

  let lastMediaTitle = "";

  function updateMediaSession() {
    if (!("mediaSession" in navigator)) return;
    const title = `${fmtClock(timer.remaining)} · ${MODE_LABELS[timer.mode]}`;
    if (title === lastMediaTitle) return; // metadata updates once per second
    lastMediaTitle = title;
    const task = state.tasks.find((t) => t.id === state.activeTaskId);
    try {
      navigator.mediaSession.metadata = new MediaMetadata({
        title,
        artist: task ? task.name : "Focus",
        album: "Focus — Pomodoro Timer",
        artwork: [
          { src: "icons/icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "icons/icon-512.png", sizes: "512x512", type: "image/png" },
        ],
      });
      navigator.mediaSession.playbackState = timer.running ? "playing" : "paused";
    } catch (err) {
      /* MediaMetadata not supported — the OS shows its default card */
    }
  }

  function setupMediaSession() {
    if (!("mediaSession" in navigator)) return;
    const bind = (action, handler) => {
      try {
        navigator.mediaSession.setActionHandler(action, handler);
      } catch (err) {
        /* action not supported on this platform */
      }
    };
    bind("play", () => startTimer());
    bind("pause", () => pauseTimer());
    bind("nexttrack", () => skipSession());
  }

  function renderControls() {
    el.startBtn.textContent = timer.running ? "Pause" : "Start";
  }

  function renderCycleDots() {
    const every = state.settings.longEvery;
    const filled = state.cycleCount % every;
    el.cycleDots.innerHTML = "";
    for (let i = 0; i < every; i++) {
      const dot = document.createElement("span");
      dot.className = "dot" + (i < filled ? " is-filled" : "");
      el.cycleDots.appendChild(dot);
    }
    el.cycleDots.title = `${filled} of ${every} focus sessions until a long break`;
  }

  function folderOf(task) {
    return task ? state.folders.find((f) => f.id === task.folderId) : undefined;
  }

  /* ---------- Folder tree helpers (folders can nest via parentId) ---------- */

  /** Direct child folders of `parentId` (use null for the top level). */
  function childFolders(parentId) {
    return state.folders.filter((f) => (f.parentId || null) === (parentId || null));
  }

  /** Every folder id below `folderId` (children, grandchildren, …). */
  function descendantFolderIds(folderId) {
    const out = [];
    const stack = [folderId];
    while (stack.length) {
      const id = stack.pop();
      for (const f of state.folders) {
        if ((f.parentId || null) === id) {
          out.push(f.id);
          stack.push(f.id);
        }
      }
    }
    return out;
  }

  /** All tasks in a folder and any folder nested inside it. */
  function tasksInSubtree(folderId) {
    const ids = new Set([folderId, ...descendantFolderIds(folderId)]);
    return state.tasks.filter((t) => ids.has(t.folderId));
  }

  /** Folders in display order (depth-first), each with its nesting depth.
      `excludeId`, when given, drops that folder and its descendants — used
      to keep a folder from being reparented under itself. */
  function foldersInOrder(excludeId) {
    const excluded = new Set();
    if (excludeId) {
      excluded.add(excludeId);
      for (const id of descendantFolderIds(excludeId)) excluded.add(id);
    }
    const list = [];
    const walk = (parentId, depth) => {
      for (const folder of childFolders(parentId)) {
        if (excluded.has(folder.id)) continue;
        list.push({ folder, depth });
        walk(folder.id, depth + 1);
      }
    };
    walk(null, 0);
    return list;
  }

  function renderActiveTaskLabel() {
    const task = state.tasks.find((t) => t.id === state.activeTaskId);
    const folder = folderOf(task);
    el.activeTaskLabel.innerHTML = "";
    if (task && folder) {
      const icon = document.createElement("span");
      icon.className = "ribbon-icon";
      icon.innerHTML = iconSvg(folder.icon, 14);
      icon.style.color = folder.color;
      el.activeTaskLabel.appendChild(icon);
    }
    el.activeTaskLabel.appendChild(
      document.createTextNode(task ? task.name : "No task selected")
    );
    $("#task-ribbon").classList.toggle("is-empty", !task);
  }

  function renderTimer() {
    el.modeLabel.textContent = MODE_LABELS[timer.mode];
    renderClock();
    renderControls();
    renderCycleDots();
    renderActiveTaskLabel();
  }

  /* ---------- 6. UI — tasks ---------- */

  /** Total focus seconds per taskId. */
  function taskTotals() {
    const totals = new Map();
    for (const s of state.sessions) {
      totals.set(s.taskId, (totals.get(s.taskId) || 0) + s.seconds);
    }
    return totals;
  }

  function makeTaskItem(task, totals, inFolder, depth = 0) {
    const li = document.createElement("li");
    li.className =
      "task-item" +
      (inFolder ? " in-folder" : "") +
      (task.id === state.activeTaskId ? " is-active" : "") +
      (task.done ? " is-done" : "");
    li.dataset.id = task.id;
    // A task lines up with its folder header at the same width (same indent),
    // so task rectangles are never wider than the folders they sit under.
    if (depth > 0) li.style.marginLeft = depth * 16 + "px";

    const check = document.createElement("button");
    check.className = "task-check";
    check.textContent = "✓";
    check.title = task.done ? "Mark as not done" : "Mark as done";
    check.setAttribute("aria-label", check.title);

    const name = document.createElement("span");
    name.className = "task-name";
    name.textContent = task.name;

    const time = document.createElement("span");
    time.className = "task-time";
    time.textContent = fmtDuration(totals.get(task.id) || 0);

    const move = document.createElement("button");
    move.className = "task-move";
    move.textContent = "📂";
    move.title = "Move to folder";
    move.setAttribute("aria-label", `Move task ${task.name} to a folder`);

    const del = document.createElement("button");
    del.className = "task-delete";
    del.textContent = "×";
    del.title = "Delete task";
    del.setAttribute("aria-label", `Delete task ${task.name}`);

    li.append(check, name, time, move, del);
    return li;
  }

  function makeFolderHeader(folder, tasks, totals, depth = 0) {
    const li = document.createElement("li");
    li.className = "folder-header" + (folder.collapsed ? " is-collapsed" : "");
    li.dataset.folderId = folder.id;
    // Nested folders sit further right than their parent. Uses margin (not
    // padding) so the header box shrinks in step with the task rows below it,
    // keeping folders and their tasks the same width.
    if (depth > 0) li.style.marginLeft = depth * 16 + "px";

    const caret = document.createElement("span");
    caret.className = "folder-caret";
    caret.textContent = "▾";

    const icon = document.createElement("span");
    icon.className = "folder-icon";
    icon.innerHTML = iconSvg(folder.icon, 14);
    icon.style.background = folder.color + "26"; // ~15% alpha tint
    icon.style.borderColor = folder.color;
    icon.style.color = folder.color; // the SVG stroke uses currentColor

    const name = document.createElement("span");
    name.className = "folder-name";
    name.textContent = folder.name;
    name.style.color = folder.color;

    const seconds = tasks.reduce((sum, t) => sum + (totals.get(t.id) || 0), 0);
    const meta = document.createElement("span");
    meta.className = "folder-meta";
    meta.textContent = `${tasks.length} · ${fmtDuration(seconds)}`;

    const edit = document.createElement("button");
    edit.className = "task-move folder-edit";
    edit.innerHTML = iconSvg("pen", 14); // SVG (not a glyph) so it renders in WKWebView
    edit.title = "Edit folder (name, color, icon, parent)";
    edit.setAttribute("aria-label", `Edit folder ${folder.name}`);

    const del = document.createElement("button");
    del.className = "task-delete folder-delete";
    del.textContent = "×";
    del.title = "Delete folder (tasks are kept)";
    del.setAttribute("aria-label", `Delete folder ${folder.name}`);

    li.append(caret, icon, name, meta, edit, del);
    return li;
  }

  /** Options for the "add task to folder" dropdown in the task form. */
  function renderFolderSelect() {
    const previous = el.taskFolderSelect.value;
    el.taskFolderSelect.innerHTML = "";
    const inbox = document.createElement("option");
    inbox.value = "";
    inbox.textContent = "Inbox";
    el.taskFolderSelect.appendChild(inbox);
    for (const { folder, depth } of foldersInOrder()) {
      const option = document.createElement("option");
      option.value = folder.id;
      // Non-breaking spaces indent nested folders in the dropdown.
      option.textContent = "  ".repeat(depth) + folder.name;
      el.taskFolderSelect.appendChild(option);
    }
    // Keep the previous choice selected across re-renders when possible.
    if ([...el.taskFolderSelect.options].some((o) => o.value === previous)) {
      el.taskFolderSelect.value = previous;
    }
    el.taskFolderSelect.style.display = state.folders.length ? "" : "none";
  }

  function renderTasks() {
    const totals = taskTotals();
    el.taskList.innerHTML = "";
    el.taskCount.textContent = String(state.tasks.length);
    el.taskEmpty.style.display =
      state.tasks.length || state.folders.length ? "none" : "block";

    const folderIds = new Set(state.folders.map((f) => f.id));
    const loose = state.tasks.filter((t) => !folderIds.has(t.folderId));

    // Depth-first walk: a folder shows its subfolders first, then its own
    // tasks. A collapsed folder hides its whole subtree.
    const renderFolder = (folder, depth) => {
      const subtree = tasksInSubtree(folder.id); // count/time include nested
      el.taskList.appendChild(makeFolderHeader(folder, subtree, totals, depth));
      if (folder.collapsed) return;
      for (const child of childFolders(folder.id)) {
        renderFolder(child, depth + 1);
      }
      const tasks = state.tasks.filter((t) => t.folderId === folder.id);
      for (const task of tasks) {
        el.taskList.appendChild(makeTaskItem(task, totals, true, depth));
      }
    };
    for (const folder of childFolders(null)) {
      renderFolder(folder, 0);
    }

    if (loose.length && state.folders.length) {
      const label = document.createElement("li");
      label.className = "inbox-label";
      label.textContent = "📥 Inbox";
      el.taskList.appendChild(label);
    }
    for (const task of loose) {
      el.taskList.appendChild(makeTaskItem(task, totals, false));
    }

    renderFolderSelect();
    renderActiveTaskLabel();
  }

  function addTask(name, folderId) {
    const trimmed = name.trim();
    if (!trimmed) return;
    const task = {
      id: uid(),
      name: trimmed,
      done: false,
      folderId: folderId || null,
      createdAt: Date.now(),
    };
    state.tasks.push(task);
    // Auto-select the first task so time tracking works out of the box.
    if (state.tasks.length === 1) state.activeTaskId = task.id;
    save();
    renderTasks();
  }

  function handleTaskListClick(event) {
    // Folder rows: toggle collapse, or delete the folder (keeping its tasks).
    const header = event.target.closest(".folder-header");
    if (header) {
      const folder = state.folders.find((f) => f.id === header.dataset.folderId);
      if (!folder) return;
      if (event.target.closest(".folder-edit")) {
        openFolderDialog(folder); // edit name / color / icon / parent
      } else if (event.target.closest(".folder-delete")) {
        confirmFolderDelete(folder); // deletion happens only after confirmation
      } else {
        folder.collapsed = !folder.collapsed;
        save();
        renderTasks();
      }
      return;
    }

    const li = event.target.closest(".task-item");
    if (!li) return;
    const task = state.tasks.find((t) => t.id === li.dataset.id);
    if (!task) return;

    if (event.target.closest(".task-move")) {
      openMoveDialog(task.id);
      return;
    }
    if (event.target.closest(".task-delete")) {
      confirmTaskDelete(task); // sessions are kept so reports stay accurate
      return;
    }
    if (event.target.closest(".task-check")) {
      task.done = !task.done;
    } else {
      // Clicking the row selects / deselects the active task.
      state.activeTaskId = state.activeTaskId === task.id ? null : task.id;
    }
    save();
    renderTasks();
  }

  /* ---------- Folder dialog (create / edit) ---------- */

  let pickedColor = FOLDER_COLORS[0];
  let pickedIcon = FOLDER_ICONS[0];
  // null while creating a new folder; a folder id while editing one.
  let editingFolderId = null;

  function renderPickers() {
    el.colorPicker.innerHTML = "";
    for (const color of FOLDER_COLORS) {
      const swatch = document.createElement("button");
      swatch.type = "button";
      swatch.className = "swatch" + (color === pickedColor ? " is-selected" : "");
      swatch.style.background = color;
      swatch.setAttribute("aria-label", `Color ${color}`);
      swatch.addEventListener("click", () => {
        pickedColor = color;
        renderPickers();
      });
      el.colorPicker.appendChild(swatch);
    }

    el.iconPicker.innerHTML = "";
    for (const icon of FOLDER_ICONS) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "icon-pick" + (icon === pickedIcon ? " is-selected" : "");
      btn.innerHTML = iconSvg(icon, 18);
      btn.setAttribute("aria-label", `Icon ${icon}`);
      btn.addEventListener("click", () => {
        pickedIcon = icon;
        renderPickers();
      });
      el.iconPicker.appendChild(btn);
    }
  }

  /** Fill the parent-folder dropdown. When editing, `folder` is excluded
      (along with its descendants) so it can't be nested inside itself. */
  function renderFolderParentOptions(folder) {
    el.folderParent.innerHTML = "";
    const top = document.createElement("option");
    top.value = "";
    top.textContent = "None (top level)";
    el.folderParent.appendChild(top);
    for (const { folder: f, depth } of foldersInOrder(folder ? folder.id : null)) {
      const option = document.createElement("option");
      option.value = f.id;
      option.textContent = "  ".repeat(depth) + f.name;
      el.folderParent.appendChild(option);
    }
  }

  /** Open the dialog to create a new folder, or edit `folder` when given. */
  function openFolderDialog(folder) {
    editingFolderId = folder ? folder.id : null;
    el.folderName.value = folder ? folder.name : "";
    pickedColor = folder ? folder.color : FOLDER_COLORS[0];
    pickedIcon = folder ? folder.icon : FOLDER_ICONS[0];
    renderFolderParentOptions(folder);
    el.folderParent.value = folder ? folder.parentId || "" : "";
    el.folderTitle.textContent = folder ? "Edit Folder" : "New Folder";
    el.folderSubmit.textContent = folder ? "Save" : "Create";
    renderPickers();
    el.folderDialog.showModal();
  }

  /* ---------- Confirmation dialog (folders, tasks, imports) ---------- */

  let confirmCallback = null;

  function openConfirm(title, message, actionLabel, onConfirm) {
    confirmCallback = onConfirm;
    $("#confirm-title").textContent = title;
    $("#confirm-message").textContent = message;
    $("#confirm-delete").textContent = actionLabel;
    $("#confirm-dialog").showModal();
  }

  function confirmFolderDelete(folder) {
    const newParent = folder.parentId || null;
    const parentName = newParent
      ? (state.folders.find((f) => f.id === newParent) || {}).name
      : null;
    const dest = parentName ? `“${parentName}”` : "the Inbox";
    const count = state.tasks.filter((t) => t.folderId === folder.id).length;
    const subCount = childFolders(folder.id).length;
    const parts = [];
    if (count) parts.push(`${count} task${count === 1 ? "" : "s"}`);
    if (subCount) parts.push(`${subCount} subfolder${subCount === 1 ? "" : "s"}`);
    openConfirm(
      `Delete “${folder.name}”?`,
      parts.length === 0
        ? "This folder is empty."
        : `Its ${parts.join(" and ")} will move to ${dest} — tracked time and history are kept.`,
      "Delete",
      () => {
        for (const t of state.tasks) {
          if (t.folderId === folder.id) t.folderId = newParent; // move up
        }
        for (const f of state.folders) {
          if ((f.parentId || null) === folder.id) f.parentId = newParent;
        }
        state.folders = state.folders.filter((f) => f.id !== folder.id);
        save();
        renderTasks();
        showToast(`Folder “${folder.name}” deleted`);
      }
    );
  }

  function confirmTaskDelete(task) {
    openConfirm(
      `Delete “${task.name}”?`,
      "Its tracked focus time is kept in history and reports.",
      "Delete",
      () => {
        state.tasks = state.tasks.filter((t) => t.id !== task.id);
        if (state.activeTaskId === task.id) state.activeTaskId = null;
        save();
        renderTasks();
        showToast(`Task “${task.name}” deleted`);
      }
    );
  }

  /* ---------- Move-to-folder dialog ---------- */

  let movingTaskId = null;

  function openMoveDialog(taskId) {
    movingTaskId = taskId;
    const task = state.tasks.find((t) => t.id === taskId);
    if (!task) return;

    const options = $("#move-options");
    options.innerHTML = "";

    const choices = [
      { id: null, icon: "inbox", name: "Inbox", color: "", depth: 0 },
      ...foldersInOrder().map(({ folder, depth }) => ({ ...folder, depth })),
    ];
    for (const choice of choices) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className =
        "move-option" +
        ((task.folderId || null) === choice.id ? " is-current" : "");
      if (choice.depth) btn.style.marginLeft = choice.depth * 16 + "px";
      const iconWrap = document.createElement("span");
      iconWrap.className = "move-option-icon";
      iconWrap.innerHTML = iconSvg(choice.icon, 15);
      if (choice.color) iconWrap.style.color = choice.color;
      const label = document.createElement("span");
      label.textContent = choice.name;
      btn.append(iconWrap, label);
      if (choice.color) btn.style.borderLeftColor = choice.color;
      btn.addEventListener("click", () => {
        task.folderId = choice.id;
        save();
        renderTasks();
        $("#move-dialog").close();
      });
      options.appendChild(btn);
    }
    $("#move-dialog").showModal();
  }

  function submitFolder() {
    const name = el.folderName.value.trim();
    if (!name) return;
    const parentId = el.folderParent.value || null;
    if (editingFolderId) {
      const folder = state.folders.find((f) => f.id === editingFolderId);
      if (folder) {
        folder.name = name;
        folder.color = pickedColor;
        folder.icon = pickedIcon;
        folder.parentId = parentId;
      }
    } else {
      state.folders.push({
        id: uid(),
        name,
        color: pickedColor,
        icon: pickedIcon,
        parentId,
        collapsed: false,
        createdAt: Date.now(),
      });
    }
    editingFolderId = null;
    save();
    renderTasks();
  }

  /* ---------- 7. UI — reports ---------- */

  /** 19860 -> "5:31" — hours:minutes, used for records and period reports. */
  function fmtHM(totalSeconds) {
    const s = Math.max(0, Math.round(totalSeconds));
    let h = Math.floor(s / 3600);
    let m = Math.round((s % 3600) / 60);
    if (m === 60) {
      h += 1;
      m = 0;
    }
    return `${h}:${String(m).padStart(2, "0")}`;
  }

  /** Local calendar-month key, e.g. "2026-07" */
  function monthKey(ts) {
    const d = new Date(ts);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  }

  function renderReports() {
    const now = Date.now();
    const todayKey = dayKey(now);
    const weekStart = startOfWeek(now);

    let todaySec = 0;
    let weekSec = 0;
    let totalSec = 0;
    let completedCount = 0;

    for (const s of state.sessions) {
      totalSec += s.seconds;
      if (s.completed) completedCount += 1;
      if (dayKey(s.endedAt) === todayKey) todaySec += s.seconds;
      if (s.endedAt >= weekStart) weekSec += s.seconds;
    }

    $("#stat-today").textContent = fmtDuration(todaySec);
    $("#stat-week").textContent = fmtDuration(weekSec);
    $("#stat-sessions").textContent = String(completedCount);
    $("#stat-total").textContent = fmtDuration(totalSec);

    renderRecords();
    renderWeekChart(now);
    renderCustomReport();
  }

  /* Win Day / Win Week / Win Month — the periods with the most focus time
     (measured in time spent, not session count). */
  function renderRecords() {
    const byDay = new Map();
    const byWeek = new Map(); // keyed by the week's Monday timestamp
    const byMonth = new Map();
    for (const s of state.sessions) {
      const add = (map, key) => map.set(key, (map.get(key) || 0) + s.seconds);
      add(byDay, dayKey(s.endedAt));
      add(byWeek, startOfWeek(s.endedAt));
      add(byMonth, monthKey(s.endedAt));
    }

    const best = (map) => {
      let bestKey = null;
      let bestSeconds = 0;
      for (const [key, seconds] of map) {
        if (seconds > bestSeconds) {
          bestSeconds = seconds;
          bestKey = key;
        }
      }
      return bestKey === null ? null : { key: bestKey, seconds: bestSeconds };
    };

    const day = best(byDay);
    $("#record-day").textContent = day ? fmtHM(day.seconds) : "—";
    $("#record-day-sub").textContent = day
      ? new Date(day.key + "T12:00:00").toLocaleDateString(undefined, {
          weekday: "short",
          month: "short",
          day: "numeric",
          year: "numeric",
        })
      : "no focus time yet";

    const week = best(byWeek);
    $("#record-week").textContent = week ? fmtHM(week.seconds) : "—";
    $("#record-week-sub").textContent = week
      ? "Week of " +
        new Date(week.key).toLocaleDateString(undefined, {
          month: "short",
          day: "numeric",
          year: "numeric",
        })
      : "no focus time yet";

    const month = best(byMonth);
    $("#record-month").textContent = month ? fmtHM(month.seconds) : "—";
    $("#record-month-sub").textContent = month
      ? new Date(month.key + "-01T12:00:00").toLocaleDateString(undefined, {
          month: "long",
          year: "numeric",
        })
      : "no focus time yet";
  }

  function renderWeekChart(now) {
    // Focus seconds for each of the last 7 calendar days (oldest first).
    const days = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      days.push({
        key: dayKey(d.getTime()),
        label: d.toLocaleDateString(undefined, { weekday: "short" }),
        seconds: 0,
        isToday: i === 0,
      });
    }
    const byKey = new Map(days.map((d) => [d.key, d]));
    for (const s of state.sessions) {
      const day = byKey.get(dayKey(s.endedAt));
      if (day) day.seconds += s.seconds;
    }

    const max = Math.max(...days.map((d) => d.seconds), 1);
    const chart = $("#week-chart");
    chart.innerHTML = "";

    for (const day of days) {
      const col = document.createElement("div");
      col.className = "chart-col" + (day.isToday ? " is-today" : "");

      const value = document.createElement("span");
      value.className = "chart-value";
      value.textContent = day.seconds ? fmtDuration(day.seconds) : "";

      const bar = document.createElement("div");
      bar.className = "chart-bar" + (day.seconds ? "" : " is-empty");
      bar.style.height = `${Math.max(2, (day.seconds / max) * 100)}%`;
      bar.title = `${day.label}: ${fmtDuration(day.seconds)}`;

      const label = document.createElement("span");
      label.className = "chart-day";
      label.textContent = day.label;

      col.append(value, bar, label);
      chart.appendChild(col);
    }
  }

  /** [start, end] timestamps for the selected report period, or null if invalid. */
  function reportRange() {
    const now = new Date();
    const nowTs = now.getTime();
    switch ($("#report-period").value) {
      case "week":
        return { start: startOfWeek(nowTs), end: nowTs };
      case "month":
        return {
          start: new Date(now.getFullYear(), now.getMonth(), 1).getTime(),
          end: nowTs,
        };
      case "year":
        return { start: new Date(now.getFullYear(), 0, 1).getTime(), end: nowTs };
      case "all":
        return { start: 0, end: nowTs };
      default: {
        // custom — inclusive whole days from the two date inputs
        const startValue = $("#report-start").value;
        const endValue = $("#report-end").value;
        if (!startValue || !endValue) return null;
        const start = new Date(startValue + "T00:00:00").getTime();
        const end = new Date(endValue + "T23:59:59.999").getTime();
        return end >= start ? { start, end } : null;
      }
    }
  }

  function renderCustomReport() {
    $("#custom-range").hidden = $("#report-period").value !== "custom";

    const summary = $("#report-summary");
    summary.innerHTML = "";
    $("#report-tbody").innerHTML = "";

    const range = reportRange();
    if (!range) {
      summary.textContent =
        "Pick a valid start and end date (start must not be after end).";
      $("#report-empty").style.display = "none";
      lastReportRange = null;
      return;
    }
    lastReportRange = range; // used by the per-row edit / remove actions

    const sessions = state.sessions.filter(
      (s) => s.endedAt >= range.start && s.endedAt <= range.end
    );

    let total = 0;
    let completed = 0;
    const activeDays = new Set();
    for (const s of sessions) {
      total += s.seconds;
      if (s.completed) completed += 1;
      activeDays.add(dayKey(s.endedAt));
    }

    const stats = [
      ["Focus time", fmtHM(total)],
      ["Sessions", String(completed)],
      ["Active days", String(activeDays.size)],
      ["Avg / active day", activeDays.size ? fmtHM(total / activeDays.size) : "0:00"],
    ];
    for (const [label, value] of stats) {
      const wrap = document.createElement("div");
      wrap.className = "mini-stat";
      const l = document.createElement("span");
      l.className = "mini-label";
      l.textContent = label;
      const v = document.createElement("span");
      v.className = "mini-value";
      v.textContent = value;
      wrap.append(l, v);
      summary.appendChild(wrap);
    }

    renderPeriodTable(sessions);
  }

  function renderPeriodTable(sessions) {
    // Aggregate the given sessions per task (including tasks deleted since).
    const rows = new Map(); // taskId -> { name, deleted, sessions, seconds, last }
    const taskById = new Map(state.tasks.map((t) => [t.id, t]));

    for (const s of sessions) {
      let row = rows.get(s.taskId);
      if (!row) {
        const task = taskById.get(s.taskId);
        row = {
          taskId: s.taskId ?? null,
          name: task ? task.name : s.taskId ? "Deleted task" : "No task",
          deleted: !task,
          folder: folderOf(task),
          sessions: 0,
          seconds: 0,
          last: 0,
        };
        rows.set(s.taskId, row);
      }
      row.sessions += s.completed ? 1 : 0;
      row.seconds += s.seconds;
      row.last = Math.max(row.last, s.endedAt);
    }

    const tbody = $("#report-tbody");
    tbody.innerHTML = "";
    $("#report-empty").style.display = rows.size ? "none" : "block";

    const sorted = [...rows.values()].sort((a, b) => b.seconds - a.seconds);
    for (const row of sorted) {
      const tr = document.createElement("tr");

      const tdName = document.createElement("td");
      tdName.textContent = row.name;
      if (row.deleted) tdName.className = "task-deleted";
      if (row.folder) {
        const chip = document.createElement("span");
        chip.className = "report-folder";
        chip.innerHTML = iconSvg(row.folder.icon, 11) + " ";
        chip.appendChild(document.createTextNode(row.folder.name));
        chip.style.color = row.folder.color;
        tdName.append(" ", chip);
      }

      const tdSessions = document.createElement("td");
      tdSessions.textContent = String(row.sessions);

      const tdTime = document.createElement("td");
      tdTime.textContent = fmtDuration(row.seconds);

      const tdLast = document.createElement("td");
      tdLast.textContent = new Date(row.last).toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
      });

      // Per-row corrections: edit or remove the recorded data (confirmed
      // before anything is saved).
      const tdActions = document.createElement("td");
      tdActions.className = "row-actions";
      const editBtn = document.createElement("button");
      editBtn.className = "row-btn";
      editBtn.textContent = "✎";
      editBtn.title = "Edit recorded sessions / time";
      editBtn.setAttribute("aria-label", `Edit recorded time for ${row.name}`);
      editBtn.addEventListener("click", () => openReportEdit(row.taskId, row.name));
      const removeBtn = document.createElement("button");
      removeBtn.className = "row-btn";
      removeBtn.textContent = "×";
      removeBtn.title = "Remove these records";
      removeBtn.setAttribute("aria-label", `Remove records for ${row.name}`);
      removeBtn.addEventListener("click", () => confirmReportDelete(row.taskId, row.name));
      tdActions.append(editBtn, removeBtn);

      tr.append(tdName, tdSessions, tdTime, tdLast, tdActions);
      tbody.appendChild(tr);
    }
  }

  /* ---------- Report corrections (edit / remove rows) ---------- */

  let lastReportRange = null;
  let editTarget = null;

  function sessionsFor(taskId, range) {
    return state.sessions.filter(
      (s) =>
        (s.taskId ?? null) === taskId &&
        s.endedAt >= range.start &&
        s.endedAt <= range.end
    );
  }

  function removeSessionsFor(taskId, range) {
    state.sessions = state.sessions.filter(
      (s) =>
        !(
          (s.taskId ?? null) === taskId &&
          s.endedAt >= range.start &&
          s.endedAt <= range.end
        )
    );
  }

  function openReportEdit(taskId, name) {
    if (!lastReportRange) return;
    const rows = sessionsFor(taskId, lastReportRange);
    const total = rows.reduce((sum, s) => sum + s.seconds, 0);
    const completed = rows.filter((s) => s.completed).length;
    editTarget = { taskId, name, range: lastReportRange, total, completed };
    $("#edit-report-info").textContent =
      `“${name}” in this report period — currently ${completed} completed ` +
      `session${completed === 1 ? "" : "s"} and ${fmtHM(total)} of focus time.`;
    $("#edit-sessions").value = completed;
    $("#edit-minutes").value = Math.round(total / 60);
    $("#edit-report-dialog").showModal();
  }

  function applyReportEdit() {
    const target = editTarget;
    if (!target) return;
    const newSessions = Math.max(0, parseInt($("#edit-sessions").value, 10) || 0);
    const newMinutes = Math.max(0, parseInt($("#edit-minutes").value, 10) || 0);
    const newSeconds = newMinutes * 60;

    openConfirm(
      `Apply changes to “${target.name}”?`,
      `${target.completed} session${target.completed === 1 ? "" : "s"} / ` +
        `${fmtHM(target.total)} will become ${newSessions} session` +
        `${newSessions === 1 ? "" : "s"} / ${fmtHM(newSeconds)} in this period.`,
      "Apply",
      () => {
        $("#edit-report-dialog").close();
        editTarget = null;
        removeSessionsFor(target.taskId, target.range);
        // Rebuild the records: N equal completed sessions (plus remainder),
        // stamped at the end of the period so day/week/month grouping holds.
        const stamp = Math.min(target.range.end, Date.now());
        if (newSessions > 0) {
          const per = Math.floor(newSeconds / newSessions);
          for (let i = 0; i < newSessions; i++) {
            const seconds =
              i === newSessions - 1 ? newSeconds - per * (newSessions - 1) : per;
            state.sessions.push({
              id: uid(),
              taskId: target.taskId,
              seconds,
              endedAt: stamp - i * 1000,
              completed: true,
            });
          }
        } else if (newSeconds > 0) {
          // Time without completed sessions: one partial record.
          state.sessions.push({
            id: uid(),
            taskId: target.taskId,
            seconds: newSeconds,
            endedAt: stamp,
            completed: false,
          });
        }
        save();
        renderReports();
        renderTasks();
        showToast(`Records for “${target.name}” updated`);
      }
    );
  }

  function confirmReportDelete(taskId, name) {
    if (!lastReportRange) return;
    const range = lastReportRange;
    const rows = sessionsFor(taskId, range);
    const total = rows.reduce((sum, s) => sum + s.seconds, 0);
    openConfirm(
      `Remove records for “${name}”?`,
      `Deletes ${rows.length} recorded session${rows.length === 1 ? "" : "s"} ` +
        `(${fmtHM(total)}) in this report period. The task itself stays in your list.`,
      "Remove",
      () => {
        removeSessionsFor(taskId, range);
        save();
        renderReports();
        renderTasks();
        showToast(`Records for “${name}” removed`);
      }
    );
  }

  /* ---------- 8. Settings dialog ---------- */

  /* Segmented controls (Appearance / Layout) — dropdown-free settings. */
  function setSeg(id, value) {
    document
      .querySelectorAll(`#${id} button`)
      .forEach((b) => b.classList.toggle("is-active", b.dataset.value === value));
  }

  function segValue(id) {
    const active = document.querySelector(`#${id} button.is-active`);
    return active ? active.dataset.value : null;
  }

  function updateAutostopRow() {
    $("#autostop-row").classList.toggle(
      "is-disabled",
      !$("#set-autostart-on").checked
    );
  }

  function openSettings() {
    $("#set-focus").value = state.settings.focus;
    $("#set-short").value = state.settings.shortBreak;
    $("#set-long").value = state.settings.longBreak;
    $("#set-every").value = state.settings.longEvery;
    $("#set-sound").checked = state.settings.sound;
    setSeg("set-theme", state.settings.theme);
    setSeg("set-layout", state.settings.layout);
    $("#set-autostart-on").checked = state.settings.autoStartMode !== "off";
    $("#set-autostop").checked = state.settings.autoStartMode === "until-long";
    updateAutostopRow();
    $("#set-match").checked = state.settings.matchNoise;
    $("#set-flip").checked = state.settings.flipFocus;
    el.dialog.showModal();
  }

  function saveSettings() {
    const clamp = (v, min, max, fallback) => {
      const n = parseInt(v, 10);
      return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
    };
    const s = state.settings;
    s.focus = clamp($("#set-focus").value, 1, 180, s.focus);
    s.shortBreak = clamp($("#set-short").value, 1, 60, s.shortBreak);
    s.longBreak = clamp($("#set-long").value, 1, 60, s.longBreak);
    s.longEvery = clamp($("#set-every").value, 2, 12, s.longEvery);
    s.sound = $("#set-sound").checked;
    s.theme = segValue("set-theme") || s.theme;
    s.layout = segValue("set-layout") || s.layout;
    s.autoStartMode = !$("#set-autostart-on").checked
      ? "off"
      : $("#set-autostop").checked
        ? "until-long"
        : "all";
    s.matchNoise = $("#set-match").checked;
    s.flipFocus = $("#set-flip").checked;
    if (s.flipFocus) setupFlipFocus(true); // Save click = user gesture for iOS
    save();
    applyTheme();
    applyLayout();
    // Restart the current mode so the new duration takes effect immediately.
    setMode(timer.mode);
  }

  /* ---------- Layout mode (Auto / Mobile / Desktop) ----------
     The responsive breakpoints live in CSS as body classes, so the
     Settings choice can force either UI; in Auto they mirror the
     media-query widths. */

  /* ---------- Appearance (dark / light / system) ---------- */

  const systemDarkQuery = window.matchMedia("(prefers-color-scheme: dark)");

  function applyTheme() {
    const mode = state.settings.theme;
    const resolved =
      mode === "system" ? (systemDarkQuery.matches ? "dark" : "light") : mode;
    document.body.dataset.theme = resolved;
  }

  // Follow live OS appearance changes while in System mode.
  systemDarkQuery.addEventListener("change", () => {
    if (state.settings.theme === "system") applyTheme();
  });

  function applyLayout() {
    const mode = state.settings.layout;
    const width = window.innerWidth;
    const compact = mode === "mobile" || (mode === "auto" && width <= 860);
    const narrow = mode === "mobile" || (mode === "auto" && width <= 480);
    document.body.classList.toggle("layout-compact", compact);
    document.body.classList.toggle("layout-narrow", narrow);
    document.body.classList.toggle("layout-mobile", mode === "mobile");
  }

  /* ---------- Full-window timer (zen) & timer background ---------- */

  function toggleZen() {
    const on = document.body.classList.toggle("zen");
    const btn = $("#zen-btn");
    btn.classList.toggle("is-on", on);
    btn.title = on ? "Exit full-window timer (Esc)" : "Full-window timer";
  }

  // Background themes for the timer card; gradients live in styles.css
  // under the matching [data-bg="…"] selectors.
  const BACKGROUNDS = [
    { id: "default", name: "Default" },
    { id: "ocean", name: "Ocean" },
    { id: "forest", name: "Forest" },
    { id: "sunset", name: "Sunset" },
    { id: "lavender", name: "Lavender" },
    { id: "night", name: "Night Sky" },
    { id: "aurora", name: "Aurora" },
    // Scene backgrounds — every soundscape has one, so picking a sound can
    // apply its scene and vice versa. A photo dropped into backgrounds/
    // (see backgrounds/README.txt) replaces the built-in illustration.
    // Order matters: simple noises first, then nature/places, then the
    // extra recordings — the 🎧 picker lists them in this order.
    { id: "scene-white", name: "White Mist", sound: "white" },
    { id: "scene-pink", name: "Pink Dusk", sound: "pink" },
    { id: "scene-brown", name: "Sepia Dunes", sound: "brown" },
    { id: "scene-lightrain", name: "Light Rain", sound: "rain" },
    { id: "scene-ocean", name: "Open Ocean", sound: "ocean" },
    { id: "scene-wind", name: "Windy Fields", sound: "wind" },
    { id: "scene-seaside", name: "Seaside", sound: "seaside" },
    { id: "scene-forest", name: "Forest Walk", sound: "forest" },
    { id: "scene-library", name: "Library", sound: "library" },
    { id: "scene-fire", name: "Fireplace", sound: "fire" },
    { id: "scene-rain", name: "Rainy Window", sound: "rainwindow" },
    { id: "scene-campfire", name: "Campfire Shore", sound: "campfire-sea" },
    { id: "scene-forestnight", name: "Night Forest", sound: "forest-night" },
    { id: "scene-librarytalk", name: "Reading Room", sound: "library-talking" },
    { id: "scene-thunder", name: "Thunderstorm", sound: "rain-thunder" },
    { id: "scene-traffic", name: "City Lights", sound: "traffic" },
  ];

  // Display names for the soundscape picker (🎧 button on the ring).
  const NOISE_NAMES = {
    white: "White noise",
    pink: "Pink noise",
    brown: "Brown noise",
    rain: "Light rain",
    ocean: "Ocean waves",
    wind: "Wind",
    seaside: "Seaside waves",
    forest: "Forest & birds",
    library: "Library",
    fire: "Crackling fire",
    rainwindow: "Rain on the window",
    "campfire-sea": "Campfire by the sea",
    "forest-night": "Forest at night",
    "library-talking": "Busy library",
    "rain-thunder": "Rain & thunder",
    traffic: "City traffic",
  };

  function applyTimerBg() {
    $("#timer-card").dataset.bg = state.settings.timerBg;
  }

  function openBgDialog() {
    const grid = $("#bg-options");
    grid.innerHTML = "";
    for (const bg of BACKGROUNDS) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className =
        "bg-option" + (state.settings.timerBg === bg.id ? " is-selected" : "");
      btn.dataset.bg = bg.id; // picks up the same --timer-bg gradient as the card
      const label = document.createElement("span");
      label.textContent = bg.name;
      btn.appendChild(label);
      btn.addEventListener("click", () => {
        state.settings.timerBg = bg.id;
        // Scene backgrounds bring their own soundscape when matching is on;
        // the noise can still be turned off in Settings at any time.
        if (state.settings.matchNoise && bg.sound) {
          state.settings.noise = bg.sound;
          if (timer.running && timer.mode === "focus") startNoise();
        }
        save();
        applyTimerBg();
        openBgDialog(); // re-render to move the selection highlight
      });
      grid.appendChild(btn);
    }
    if (!$("#bg-dialog").open) $("#bg-dialog").showModal();
  }

  /* ---------- Soundscape picker (🎧 on the ring) ----------
     Selecting a sound applies its matching scene at the same time
     (unless background↔noise matching is disabled in Settings). */

  function openSoundDialog() {
    const grid = $("#sound-options");
    grid.innerHTML = "";

    const off = document.createElement("button");
    off.type = "button";
    off.className =
      "bg-option sound-off" + (state.settings.noise === "off" ? " is-selected" : "");
    const offLabel = document.createElement("span");
    offLabel.innerHTML = iconSvg("volume-off", 14) + " Off";
    off.appendChild(offLabel);
    off.addEventListener("click", () => {
      state.settings.noise = "off";
      stopNoise();
      save();
      openSoundDialog();
    });
    grid.appendChild(off);

    for (const bg of BACKGROUNDS) {
      if (!bg.sound) continue; // gradient-only themes live in the 🎨 picker
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className =
        "bg-option" + (state.settings.noise === bg.sound ? " is-selected" : "");
      btn.dataset.bg = bg.id; // shows the matching scene as the preview
      const label = document.createElement("span");
      label.textContent = NOISE_NAMES[bg.sound] || bg.name;
      btn.appendChild(label);
      btn.addEventListener("click", () => {
        state.settings.noise = bg.sound;
        if (state.settings.matchNoise) {
          state.settings.timerBg = bg.id;
          applyTimerBg();
        }
        if (timer.running && timer.mode === "focus") {
          startNoise();
        } else {
          // Not playing yet — use this click (a gesture) to unlock the
          // player so a flip-started session can play the sound later.
          noisePrimed = false;
          primeNoiseAudio();
        }
        save();
        openSoundDialog(); // re-render to move the selection highlight
      });
      grid.appendChild(btn);
    }
    $("#sound-volume").value = state.settings.noiseVolume;
    if (!$("#sound-dialog").open) $("#sound-dialog").showModal();
  }

  /* ---------- Backup & Sync ----------
     Data is exported as a JSON file the user can keep in a Google Drive
     folder (Drive for Desktop / the Drive app) to move between devices. */

  function exportJSON() {
    return JSON.stringify(
      { app: "focus-pomodoro", version: 1, exportedAt: new Date().toISOString(), ...state },
      null,
      2
    );
  }

  function downloadBackup() {
    const blob = new Blob([exportJSON()], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `focus-backup-${dayKey(Date.now())}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
    showToast("Backup downloaded");
  }

  async function copyBackup() {
    try {
      await navigator.clipboard.writeText(exportJSON());
      showToast("Backup copied to clipboard");
    } catch (err) {
      showToast("Copy failed — use Download instead");
    }
  }

  function importBackup() {
    let data;
    try {
      data = JSON.parse($("#import-text").value);
    } catch (err) {
      showToast("That is not valid backup data");
      return;
    }
    if (!data || !Array.isArray(data.tasks) || !Array.isArray(data.sessions)) {
      showToast("That is not a Focus backup");
      return;
    }
    openConfirm(
      "Import backup?",
      "This replaces all current data — tasks, folders, history and settings.",
      "Import",
      () => {
        localStorage.setItem(
          LS_KEY,
          JSON.stringify({
            settings: { ...DEFAULT_SETTINGS, ...(data.settings || {}) },
            folders: Array.isArray(data.folders) ? data.folders : [],
            tasks: data.tasks,
            sessions: data.sessions,
            activeTaskId: data.activeTaskId ?? null,
            cycleCount: data.cycleCount || 0,
          })
        );
        location.reload();
      }
    );
  }

  /* ---------- iPhone flip mode ----------
     Face-down (screen toward the table) means "focusing": the timer runs.
     Picking the phone up pauses it. Uses the motion sensor's gravity
     reading with hysteresis + a short debounce so brief wobbles don't
     toggle the timer. On iOS the sensor needs a user-gesture permission
     grant (requested when enabling the setting or pressing Start). */

  let flipAttached = false;
  let flipState = "unknown"; // 'down' | 'up' | 'unknown'
  let flipTimer = null;

  function handleMotion(event) {
    const gravity = event.accelerationIncludingGravity;
    if (!gravity || typeof gravity.z !== "number") return;
    let next = flipState;
    if (gravity.z > 6.5) next = "down"; // screen facing the table
    else if (gravity.z < 3.5) next = "up";
    if (next === flipState) return;
    flipState = next;
    clearTimeout(flipTimer);
    flipTimer = setTimeout(() => {
      if (!state.settings.flipFocus) return;
      if (
        flipState === "down" &&
        !timer.running &&
        timer.mode === "focus" &&
        timer.remaining > 0
      ) {
        startTimer();
        showToast("📱 Face down — focus running");
      } else if (flipState === "up" && timer.running && timer.mode === "focus") {
        pauseTimer();
        showToast("📱 Picked up — focus paused");
      }
    }, 650);
  }

  async function setupFlipFocus(fromGesture) {
    if (!state.settings.flipFocus || flipAttached) return;
    if (typeof DeviceMotionEvent === "undefined") return; // no sensor
    try {
      if (typeof DeviceMotionEvent.requestPermission === "function") {
        if (!fromGesture) return; // iOS only grants inside a user gesture
        const result = await DeviceMotionEvent.requestPermission();
        if (result !== "granted") {
          showToast("Motion access denied — flip mode unavailable");
          return;
        }
      }
      window.addEventListener("devicemotion", handleMotion);
      flipAttached = true;
    } catch (err) {
      console.warn("Flip mode unavailable:", err);
    }
  }

  /* ---------- Google Drive sync ----------
     Authorization-code flow with PKCE against the user's own OAuth client
     (Desktop type — loopback redirects like http://localhost:PORT are
     allowed without registration, which is exactly where this app runs).
     Data lives in Drive's hidden per-app "appDataFolder" as focus-data.json.
     Conflict policy: last write wins, decided by state.updatedAt. */

  const DRIVE_KEY = "pomodoro.drive.v1";
  const DRIVE_DEFAULT_CLIENT_ID =
    "1099091447585-49mo8r9jglkfpf9c5h62ehhh93093k8u.apps.googleusercontent.com";
  const DRIVE_SCOPE = "https://www.googleapis.com/auth/drive.appdata";
  const DRIVE_FILE = "focus-data.json";

  const drive = (() => {
    try {
      const saved = JSON.parse(localStorage.getItem(DRIVE_KEY));
      if (saved && typeof saved === "object") return saved;
    } catch (err) { /* fall through to defaults */ }
    return {
      clientId: DRIVE_DEFAULT_CLIENT_ID,
      clientSecret: "",
      accessToken: null,
      refreshToken: null,
      expiry: 0,
      fileId: null,
      lastSync: 0,
    };
  })();

  function driveSaveConfig() {
    localStorage.setItem(DRIVE_KEY, JSON.stringify(drive));
  }

  function driveConnected() {
    return Boolean(drive.refreshToken);
  }

  function renderDriveStatus() {
    const status = $("#drive-status");
    if (!status) return;
    status.textContent = driveConnected()
      ? "Connected. " +
        (drive.lastSync
          ? `Last synced ${new Date(drive.lastSync).toLocaleString()}.`
          : "Not synced yet — press Sync now.")
      : "Not connected. Paste the client secret and press Connect (your Google account must be listed as a test user while the consent screen is in testing mode).";
  }

  function base64url(bytes) {
    return btoa(String.fromCharCode(...bytes))
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");
  }

  async function driveConnect() {
    if (location.protocol === "file:") {
      showToast("Drive sync needs the app served over http — use the browser version or the updated Mac app");
      return;
    }
    drive.clientId = $("#drive-client-id").value.trim() || DRIVE_DEFAULT_CLIENT_ID;
    drive.clientSecret = $("#drive-secret").value.trim();
    if (!drive.clientSecret) {
      showToast("Paste the OAuth client secret first");
      return;
    }
    driveSaveConfig();

    const verifierBytes = crypto.getRandomValues(new Uint8Array(32));
    const verifier = base64url(verifierBytes);
    sessionStorage.setItem("drive.verifier", verifier);
    const digest = await crypto.subtle.digest(
      "SHA-256",
      new TextEncoder().encode(verifier)
    );
    const challenge = base64url(new Uint8Array(digest));

    location.href =
      "https://accounts.google.com/o/oauth2/v2/auth?" +
      new URLSearchParams({
        client_id: drive.clientId,
        redirect_uri: location.origin + location.pathname,
        response_type: "code",
        scope: DRIVE_SCOPE,
        code_challenge: challenge,
        code_challenge_method: "S256",
        access_type: "offline",
        prompt: "consent",
        state: "focus-drive",
      });
  }

  /** Completes the OAuth flow when Google redirects back with ?code=… */
  async function driveHandleRedirect() {
    const params = new URLSearchParams(location.search);
    if (params.get("state") !== "focus-drive" || !params.get("code")) return;
    const code = params.get("code");
    history.replaceState(null, "", location.pathname);
    try {
      const res = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          code,
          client_id: drive.clientId,
          client_secret: drive.clientSecret,
          redirect_uri: location.origin + location.pathname,
          grant_type: "authorization_code",
          code_verifier: sessionStorage.getItem("drive.verifier") || "",
        }),
      });
      const token = await res.json();
      if (token.error) throw new Error(token.error_description || token.error);
      drive.accessToken = token.access_token;
      drive.expiry = Date.now() + (token.expires_in - 60) * 1000;
      if (token.refresh_token) drive.refreshToken = token.refresh_token;
      driveSaveConfig();
      renderDriveStatus();
      showToast("Google Drive connected");
      driveSync(false);
    } catch (err) {
      console.warn("Drive connect failed:", err);
      showToast("Drive connection failed: " + err.message);
    }
  }

  async function driveToken() {
    if (drive.accessToken && Date.now() < drive.expiry) return drive.accessToken;
    if (!drive.refreshToken) throw new Error("not connected");
    const res = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: drive.clientId,
        client_secret: drive.clientSecret,
        refresh_token: drive.refreshToken,
        grant_type: "refresh_token",
      }),
    });
    const token = await res.json();
    if (token.error) throw new Error(token.error_description || token.error);
    drive.accessToken = token.access_token;
    drive.expiry = Date.now() + (token.expires_in - 60) * 1000;
    driveSaveConfig();
    return drive.accessToken;
  }

  async function driveApi(url, options = {}) {
    const token = await driveToken();
    const res = await fetch(url, {
      ...options,
      headers: { ...(options.headers || {}), Authorization: "Bearer " + token },
    });
    if (!res.ok) throw new Error("Drive API error " + res.status);
    return res;
  }

  async function driveFindFile() {
    if (drive.fileId) return drive.fileId;
    const res = await driveApi(
      "https://www.googleapis.com/drive/v3/files?spaces=appDataFolder&fields=files(id,name)&q=" +
        encodeURIComponent(`name='${DRIVE_FILE}'`)
    );
    const data = await res.json();
    drive.fileId = data.files && data.files[0] ? data.files[0].id : null;
    driveSaveConfig();
    return drive.fileId;
  }

  async function drivePull() {
    const id = await driveFindFile();
    if (!id) return null;
    const res = await driveApi(
      `https://www.googleapis.com/drive/v3/files/${id}?alt=media`
    );
    return res.json();
  }

  async function drivePush() {
    const body = JSON.stringify(state);
    const id = await driveFindFile();
    if (id) {
      await driveApi(
        `https://www.googleapis.com/upload/drive/v3/files/${id}?uploadType=media`,
        { method: "PATCH", headers: { "Content-Type": "application/json" }, body }
      );
    } else {
      const boundary = "focus-sync-boundary";
      const multipart =
        `--${boundary}\r\nContent-Type: application/json\r\n\r\n` +
        JSON.stringify({ name: DRIVE_FILE, parents: ["appDataFolder"] }) +
        `\r\n--${boundary}\r\nContent-Type: application/json\r\n\r\n` +
        body +
        `\r\n--${boundary}--`;
      const res = await driveApi(
        "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id",
        {
          method: "POST",
          headers: { "Content-Type": "multipart/related; boundary=" + boundary },
          body: multipart,
        }
      );
      const data = await res.json();
      drive.fileId = data.id;
      driveSaveConfig();
    }
  }

  /** Two-way sync. Adopting newer remote data reloads the page, so that
      path is skipped while a session is running (push still happens). */
  async function driveSync(manual) {
    if (!driveConnected()) {
      if (manual) showToast("Connect Google Drive first");
      return;
    }
    try {
      const remote = await drivePull();
      if (
        remote &&
        (remote.updatedAt || 0) > (state.updatedAt || 0) &&
        !timer.running
      ) {
        localStorage.setItem(
          LS_KEY,
          JSON.stringify({
            settings: { ...DEFAULT_SETTINGS, ...(remote.settings || {}) },
            folders: Array.isArray(remote.folders) ? remote.folders : [],
            tasks: Array.isArray(remote.tasks) ? remote.tasks : [],
            sessions: Array.isArray(remote.sessions) ? remote.sessions : [],
            activeTaskId: remote.activeTaskId ?? null,
            cycleCount: remote.cycleCount || 0,
            updatedAt: remote.updatedAt || 0,
          })
        );
        drive.lastSync = Date.now();
        driveSaveConfig();
        location.reload();
        return;
      }
      await drivePush();
      drive.lastSync = Date.now();
      driveSaveConfig();
      renderDriveStatus();
      if (manual) showToast("Synced with Google Drive");
    } catch (err) {
      console.warn("Drive sync failed:", err);
      if (manual) showToast("Drive sync failed — see console for details");
    }
  }

  let drivePushTimer = null;

  /** Called from save(): quietly push local changes a few seconds later. */
  function scheduleDrivePush() {
    if (!driveConnected()) return;
    clearTimeout(drivePushTimer);
    drivePushTimer = setTimeout(() => {
      drivePush()
        .then(() => {
          drive.lastSync = Date.now();
          driveSaveConfig();
          renderDriveStatus();
        })
        .catch((err) => console.warn("Drive push failed:", err));
    }, 4000);
  }

  function driveDisconnect() {
    drive.accessToken = null;
    drive.refreshToken = null;
    drive.expiry = 0;
    drive.fileId = null;
    driveSaveConfig();
    renderDriveStatus();
    showToast("Disconnected from Google Drive");
  }

  /* ---------- 9. View switching, toast, keyboard ---------- */

  function switchView(view) {
    document.querySelectorAll(".view-btn").forEach((btn) => {
      btn.classList.toggle("is-active", btn.dataset.view === view);
    });
    document.querySelectorAll(".view").forEach((section) => {
      section.classList.toggle("is-active", section.id === `view-${view}`);
    });
    if (view === "reports") renderReports();
  }

  let toastTimeout = null;

  function showToast(message) {
    el.toast.textContent = message;
    el.toast.classList.add("is-visible");
    clearTimeout(toastTimeout);
    toastTimeout = setTimeout(() => el.toast.classList.remove("is-visible"), 4000);
  }

  /* ---------- 10. Init ---------- */

  function bindEvents() {
    el.startBtn.addEventListener("click", () =>
      timer.running ? pauseTimer() : startTimer()
    );
    $("#reset-btn").addEventListener("click", resetTimer);
    $("#skip-btn").addEventListener("click", skipSession);

    document.querySelectorAll(".view-btn").forEach((btn) => {
      btn.addEventListener("click", () => switchView(btn.dataset.view));
    });

    el.taskForm.addEventListener("submit", (event) => {
      event.preventDefault();
      addTask(el.taskInput.value, el.taskFolderSelect.value || null);
      el.taskInput.value = "";
      el.taskInput.focus();
    });
    el.taskList.addEventListener("click", handleTaskListClick);

    $("#new-folder-btn").addEventListener("click", () => openFolderDialog());
    $("#folder-cancel").addEventListener("click", () => {
      editingFolderId = null;
      el.folderDialog.close();
    });
    $("#folder-form").addEventListener("submit", submitFolder);
    $("#move-cancel").addEventListener("click", () => $("#move-dialog").close());

    $("#confirm-cancel").addEventListener("click", () => {
      confirmCallback = null;
      $("#confirm-dialog").close();
    });
    $("#confirm-delete").addEventListener("click", () => {
      const action = confirmCallback;
      confirmCallback = null;
      $("#confirm-dialog").close();
      if (action) action();
    });

    $("#zen-btn").addEventListener("click", toggleZen);
    $("#bg-close").addEventListener("click", () => $("#bg-dialog").close());
    $("#sound-btn").addEventListener("click", openSoundDialog);
    $("#sound-close").addEventListener("click", () => $("#sound-dialog").close());

    // Segmented controls: one click selects within the group.
    document.querySelectorAll(".segmented").forEach((group) => {
      group.addEventListener("click", (event) => {
        const btn = event.target.closest("button[data-value]");
        if (!btn) return;
        group
          .querySelectorAll("button")
          .forEach((b) => b.classList.toggle("is-active", b === btn));
      });
    });
    $("#set-autostart-on").addEventListener("change", updateAutostopRow);

    // Volume lives in the 🎧 dialog and applies to playing audio instantly.
    $("#sound-volume").addEventListener("input", () => {
      const value = Math.min(
        100,
        Math.max(0, parseInt($("#sound-volume").value, 10) || 0)
      );
      state.settings.noiseVolume = value;
      if (noiseAudio) noiseAudio.volume = value / 100;
      if (noiseNodes) noiseNodes.nodes[0].gain.value = (value / 100) * 0.35;
    });
    $("#sound-volume").addEventListener("change", save);

    $("#backup-btn").addEventListener("click", () => {
      $("#drive-client-id").value = drive.clientId;
      $("#drive-secret").value = drive.clientSecret;
      renderDriveStatus();
      $("#backup-dialog").showModal();
    });
    $("#backup-close").addEventListener("click", () => $("#backup-dialog").close());
    $("#drive-connect").addEventListener("click", driveConnect);
    $("#drive-sync-now").addEventListener("click", () => driveSync(true));
    $("#drive-disconnect").addEventListener("click", driveDisconnect);
    $("#export-download").addEventListener("click", downloadBackup);
    $("#export-copy").addEventListener("click", copyBackup);
    $("#import-btn").addEventListener("click", importBackup);

    $("#report-period").addEventListener("change", () => {
      if ($("#report-period").value === "custom" && !$("#report-start").value) {
        // sensible default for a fresh custom range: the last 7 days
        const end = new Date();
        const start = new Date();
        start.setDate(start.getDate() - 6);
        $("#report-start").value = dayKey(start.getTime());
        $("#report-end").value = dayKey(end.getTime());
      }
      renderCustomReport();
    });
    $("#report-start").addEventListener("change", renderCustomReport);
    $("#report-end").addEventListener("change", renderCustomReport);

    $("#edit-report-cancel").addEventListener("click", () => {
      editTarget = null;
      $("#edit-report-dialog").close();
    });
    $("#edit-report-save").addEventListener("click", applyReportEdit);

    // Flip mode: switching away from the app while the phone is in use
    // pauses a running focus session (face-down lock does not).
    document.addEventListener("visibilitychange", () => {
      if (
        document.hidden &&
        state.settings.flipFocus &&
        flipState === "up" &&
        timer.running &&
        timer.mode === "focus"
      ) {
        pauseTimer();
      }
    });

    $("#settings-btn").addEventListener("click", openSettings);
    $("#settings-cancel").addEventListener("click", () => el.dialog.close());
    $("#settings-form").addEventListener("submit", saveSettings);

    // Esc leaves the full-window timer; Space toggles the timer unless
    // the user is typing or a dialog is open.
    document.addEventListener("keydown", (event) => {
      if (
        event.code === "Escape" &&
        document.body.classList.contains("zen") &&
        !document.querySelector("dialog[open]")
      ) {
        toggleZen();
        return;
      }
      if (event.code !== "Space") return;
      const target = event.target;
      if (
        document.querySelector("dialog[open]") ||
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target instanceof HTMLSelectElement ||
        target instanceof HTMLButtonElement
      ) {
        return;
      }
      event.preventDefault();
      timer.running ? pauseTimer() : startTimer();
    });

    // Re-evaluate the Auto layout when the window is resized.
    window.addEventListener("resize", applyLayout);
  }

  function init() {
    load();
    timer.mode = "focus";
    timer.total = durationFor("focus");
    timer.remaining = timer.total;
    document.body.dataset.mode = "focus";
    bindEvents();
    applyTheme();
    applyLayout();
    applyTimerBg();
    renderTimer();
    renderTasks();
    driveHandleRedirect(); // completes OAuth when returning from Google
    if (driveConnected()) driveSync(false); // pull/push on startup
    setupFlipFocus(false); // attaches directly where no permission is needed
    setupMediaSession(); // Dynamic Island / lock-screen card shows the timer

    // The flip-mode setting only makes sense on an iPhone/iPad.
    const isIOS =
      /iPhone|iPad|iPod/.test(navigator.userAgent) ||
      (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
    $("#flip-row").hidden = !isIOS;

    // Offline support / installable PWA (http(s) only — no-op on file://).
    if ("serviceWorker" in navigator && location.protocol.startsWith("http")) {
      navigator.serviceWorker
        .register("sw.js")
        .catch((err) => console.warn("Service worker unavailable:", err));
    }
  }

  init();
})();
