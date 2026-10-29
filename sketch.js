const QUICK_MINUTES = [1, 3, 5, 10, 15, 20];
const RING_CIRCUMFERENCE = 2 * Math.PI * 118;
const MASCOT_STYLES = [
  { name: "綠芽隊長", kind: "sprout", color: "#77e3b2", accent: "#d8ff8a" },
  { name: "莓果明星", kind: "berry", color: "#ff829c", accent: "#ffd166" },
  { name: "星際夥伴", kind: "star", color: "#9b8cff", accent: "#7ce9ff" },
  { name: "陽光啦啦隊", kind: "sun", color: "#ffb454", accent: "#fff08a" },
  { name: "海風小隊長", kind: "wave", color: "#69c8ff", accent: "#b1ffe5" }
];

let timerState = {
  running: false,
  paused: false,
  finished: false,
  phase: "work",
  round: 1,
  workMs: 0,
  restMs: 0,
  rounds: 1,
  phaseDuration: 0,
  deadline: 0,
  pausedMs: 0
};

let audioContext;
let transitionSound;
let transitionSoundUnlocked = false;
let speechVoices = [];
let lastPaintedSecond = -1;
let lastPaintedPhase = null;

function setup() {
  noCanvas();
  document.documentElement.lang = "zh-Hant";
  document.title = "小組運動計時器";
  document.body.innerHTML = `
    <main class="app-shell">
      <header class="topbar">
        <a class="brand" href="#" aria-label="小組運動計時器首頁">
          <span class="brand-mark" aria-hidden="true">◎</span>
          <span>小組運動計時器</span>
        </a>
        <button class="icon-button fullscreen-button" id="fullscreen-button" type="button" aria-label="進入全螢幕">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 3H3v5M16 3h5v5M3 16v5h5m13-5v5h-5"/></svg>
          <span>全螢幕</span>
        </button>
      </header>

      <section class="timer-card" aria-label="小組倒數計時器">
        <div class="settings-panel">
          <div class="eyebrow"><span class="eyebrow-dot"></span> GROUP WORKOUT TIMER</div>
          <h1>準備好，<span>開始動起來。</span></h1>
          <p class="intro">設定運動與休息時間，帶領每一組訓練。</p>

          <div class="quick-settings">
            <div class="section-label">快速設定 <span>運動時間</span></div>
            <div class="quick-buttons" id="quick-buttons"></div>
          </div>

          <div class="field-grid">
            <label class="field">
              <span class="field-label">運動時間</span>
              <span class="time-inputs">
                <span class="input-wrap"><input id="work-minutes" type="number" min="0" max="99" value="1" inputmode="numeric" aria-label="運動分鐘"><small>分</small></span>
                <span class="time-colon">:</span>
                <span class="input-wrap"><input id="work-seconds" type="number" min="0" max="59" value="0" inputmode="numeric" aria-label="運動秒數"><small>秒</small></span>
              </span>
            </label>
            <label class="field">
              <span class="field-label">休息時間</span>
              <span class="time-inputs">
                <span class="input-wrap"><input id="rest-minutes" type="number" min="0" max="99" value="0" inputmode="numeric" aria-label="休息分鐘"><small>分</small></span>
                <span class="time-colon">:</span>
                <span class="input-wrap"><input id="rest-seconds" type="number" min="0" max="59" value="15" inputmode="numeric" aria-label="休息秒數"><small>秒</small></span>
              </span>
            </label>
          </div>

          <label class="rounds-field" for="round-count">
            <span><span class="field-label">循環組數</span><small>運動＋休息為 1 個循環</small></span>
            <span class="round-stepper">
              <button type="button" id="round-minus" aria-label="減少組數">−</button>
              <input id="round-count" type="number" min="1" max="99" value="3" inputmode="numeric" aria-label="循環組數">
              <button type="button" id="round-plus" aria-label="增加組數">＋</button>
            </span>
          </label>

          <div class="quick-note"><span class="note-icon">↗</span> 空白鍵開始／暫停 <span class="note-divider">·</span> R 重設</div>
        </div>

        <div class="display-panel" id="display-panel">
          <div class="timer-topline">
            <span class="phase-badge" id="phase-badge"><span class="phase-dot"></span><span id="phase-label">準備開始</span></span>
            <span class="round-label" id="round-label">第 <b>1</b> / 3 組</span>
          </div>
          <div class="timer-display" id="timer-display">
            <svg class="progress-ring" viewBox="0 0 260 260" role="img" aria-label="計時進度">
              <defs>
                <linearGradient id="ring-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stop-color="#81f7d8"/>
                  <stop offset="100%" stop-color="#55b5ff"/>
                </linearGradient>
              </defs>
              <circle class="ring-track" cx="130" cy="130" r="118"/>
              <circle class="ring-progress" id="ring-progress" cx="130" cy="130" r="118"/>
            </svg>
            <div class="time-center">
              <div class="time-readout" id="time-readout" aria-live="polite">01:00</div>
              <div class="time-caption" id="time-caption">準備就緒</div>
            </div>
          </div>
          <p class="timer-message" id="timer-message" aria-live="polite">設定好時間，就可以出發了。</p>
          <div class="timer-controls">
            <button class="start-button" id="start-button" type="button"><span class="play-icon">▶</span><span>開始</span></button>
            <button class="reset-button" id="reset-button" type="button"><span class="reset-icon">↻</span>重設</button>
          </div>
        </div>
      </section>
      <footer class="footer"><span>MOVE TOGETHER</span><span>每一次努力，都是進步。</span></footer>
    </main>
  `;

  buildQuickButtons();
  bindControls();
  transitionSound = new Audio("y1457.mp3");
  transitionSound.preload = "auto";
  transitionSound.volume = 1;
  if ("speechSynthesis" in window) {
    loadSpeechVoices();
    window.speechSynthesis.addEventListener("voiceschanged", loadSpeechVoices);
  }
  refreshPreview();
}

function draw() {
  if (!timerState.running) return;

  advanceTimer(Date.now());
  const remaining = Math.max(0, timerState.deadline - Date.now());
  const second = Math.ceil(remaining / 1000);
  if (second !== lastPaintedSecond || timerState.phase !== lastPaintedPhase) {
    paintTimer(remaining);
    playTimerCue(second, timerState.phase);
    lastPaintedSecond = second;
    lastPaintedPhase = timerState.phase;
  }
}

function buildQuickButtons() {
  const container = document.getElementById("quick-buttons");
  QUICK_MINUTES.forEach((minutes) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "quick-button";
    button.textContent = `${minutes} 分`;
    button.addEventListener("click", () => {
      if (timerIsActive()) return;
      document.getElementById("work-minutes").value = minutes;
      document.getElementById("work-seconds").value = 0;
      refreshPreview();
      markQuickButton(minutes);
    });
    container.appendChild(button);
  });
  markQuickButton(1);
}

function bindControls() {
  ["work-minutes", "work-seconds", "rest-minutes", "rest-seconds", "round-count"].forEach((id) => {
    document.getElementById(id).addEventListener("input", () => {
      if (timerIsActive()) return;
      normalizeInput(id);
      markQuickButton(null);
      refreshPreview();
    });
  });

  document.getElementById("round-minus").addEventListener("click", () => adjustRounds(-1));
  document.getElementById("round-plus").addEventListener("click", () => adjustRounds(1));
  document.getElementById("start-button").addEventListener("click", toggleTimer);
  document.getElementById("reset-button").addEventListener("click", resetTimer);
  document.getElementById("fullscreen-button").addEventListener("click", toggleFullscreen);

  document.addEventListener("keydown", (event) => {
    const editing = event.target instanceof HTMLElement &&
      event.target.closest("input, textarea, select, [contenteditable='true']");
    if (editing || event.repeat) return;
    if (event.code === "Space") {
      event.preventDefault();
      toggleTimer();
    } else if (event.key.toLowerCase() === "r") {
      resetTimer();
    }
  });
}

function normalizeInput(id) {
  const input = document.getElementById(id);
  const min = Number(input.min);
  const max = Number(input.max);
  let value = Number.parseInt(input.value, 10);
  if (!Number.isFinite(value)) value = min;
  value = Math.max(min, Math.min(max, value));
  input.value = value;
}

function adjustRounds(amount) {
  if (timerIsActive()) return;
  const input = document.getElementById("round-count");
  input.value = Math.max(1, Math.min(99, (Number(input.value) || 1) + amount));
  refreshPreview();
}

function markQuickButton(minutes) {
  document.querySelectorAll(".quick-button").forEach((button, index) => {
    button.classList.toggle("selected", QUICK_MINUTES[index] === minutes);
  });
}

function readSettings() {
  const value = (id) => Number(document.getElementById(id).value) || 0;
  return {
    workMs: (value("work-minutes") * 60 + value("work-seconds")) * 1000,
    restMs: (value("rest-minutes") * 60 + value("rest-seconds")) * 1000,
    rounds: Math.max(1, value("round-count"))
  };
}

function refreshPreview() {
  const settings = readSettings();
  const startSeconds = settings.workMs > 0 ? Math.ceil(settings.workMs / 1000) : 0;
  document.getElementById("time-readout").textContent = formatTime(startSeconds);
  document.getElementById("time-caption").textContent = "準備就緒";
  document.getElementById("phase-label").textContent = "準備開始";
  document.getElementById("round-label").innerHTML = `第 <b>1</b> / ${settings.rounds} 組`;
  document.getElementById("timer-message").textContent =
    settings.workMs > 0 ? "設定好時間，就可以出發了。" : "請設定大於 0 的運動時間。";
  setRingProgress(1);
  setAlertState(false);
  document.getElementById("start-button").disabled = settings.workMs === 0;
}

function toggleTimer() {
  if (timerState.running) {
    stopSpeech();
    timerState.pausedMs = Math.max(0, timerState.deadline - Date.now());
    timerState.running = false;
    timerState.paused = true;
    document.getElementById("start-button").innerHTML = '<span class="play-icon">▶</span><span>繼續</span>';
    document.getElementById("phase-label").textContent = "已暫停";
    document.getElementById("time-caption").textContent = "已暫停";
    document.getElementById("timer-message").textContent = "休息一下，準備好再繼續。";
    return;
  }

  if (timerState.finished) resetTimer();
  if (timerState.paused) {
    prepareAudio();
    timerState.deadline = Date.now() + timerState.pausedMs;
    timerState.paused = false;
  } else {
    const settings = readSettings();
    if (settings.workMs <= 0) return;
    prepareAudio();
    unlockTransitionSound();
    timerState = {
      running: true,
      paused: false,
      finished: false,
      phase: "prepare",
      round: 1,
      workMs: settings.workMs,
      restMs: settings.restMs,
      rounds: settings.rounds,
      phaseDuration: 5000,
      deadline: Date.now() + 5000,
      pausedMs: 0
    };
  }
  timerState.running = true;
  setSettingsEnabled(false);
  document.getElementById("start-button").innerHTML = '<span class="pause-icon">Ⅱ</span><span>暫停</span>';
  document.getElementById("timer-message").textContent =
    timerState.phase === "prepare" ? "準備倒數，馬上開始！" :
      timerState.phase === "work" ? "專注運動，穩住節奏！" : "喝口水，準備下一組。";
  syncTimerLabels();
  const remaining = Math.max(0, timerState.deadline - Date.now());
  const second = Math.ceil(remaining / 1000);
  lastPaintedSecond = second;
  lastPaintedPhase = timerState.phase;
  paintTimer(remaining);
  playTimerCue(second, timerState.phase);
}

function advanceTimer(now) {
  while (timerState.running && now >= timerState.deadline) {
    if (timerState.phase === "prepare") {
      startPhase("work", timerState.workMs);
    } else if (
      timerState.phase === "work" &&
      timerState.restMs > 0 &&
      timerState.round < timerState.rounds
    ) {
      startPhase("rest", timerState.restMs);
    } else if (timerState.round < timerState.rounds) {
      timerState.round += 1;
      startPhase("work", timerState.workMs);
    } else {
      finishTimer();
      break;
    }
  }
}

function startPhase(phase, duration) {
  timerState.phase = phase;
  timerState.phaseDuration = duration;
  timerState.deadline += duration;
  timerState.pausedMs = 0;
  syncTimerLabels();
  playPhaseChangeCue(phase);
  if (phase === "work" || phase === "rest") speakPhaseAnnouncement(phase);
  document.getElementById("timer-message").textContent =
    phase === "prepare" ? "準備倒數，馬上開始！" :
      phase === "work" ? "專注運動，穩住節奏！" : "休息一下，準備下一組。";
}

function syncTimerLabels() {
  const phaseNames = { prepare: "準備倒數", work: "運動中", rest: "休息中" };
  const captions = { prepare: "準備開始", work: "保持節奏", rest: "深呼吸" };
  document.getElementById("phase-label").textContent = phaseNames[timerState.phase];
  document.getElementById("time-caption").textContent = captions[timerState.phase];
  document.getElementById("round-label").innerHTML = `第 <b>${timerState.round}</b> / ${timerState.rounds} 組`;
  document.getElementById("display-panel").classList.toggle("is-rest", timerState.phase === "rest");
}

function paintTimer(remainingMs) {
  const remainingSeconds = Math.ceil(Math.max(0, remainingMs) / 1000);
  document.getElementById("time-readout").textContent = formatTime(remainingSeconds);
  const progress = timerState.phaseDuration > 0 ? Math.max(0, remainingMs / timerState.phaseDuration) : 0;
  setRingProgress(progress);
  setAlertState(timerState.running && remainingSeconds <= 10);
}

function setRingProgress(progress) {
  const ring = document.getElementById("ring-progress");
  if (!ring) return;
  ring.style.strokeDasharray = `${RING_CIRCUMFERENCE}`;
  ring.style.strokeDashoffset = `${RING_CIRCUMFERENCE * (1 - Math.max(0, Math.min(1, progress)))}`;
}

function setAlertState(active) {
  document.getElementById("timer-display")?.classList.toggle("is-urgent", active);
  document.getElementById("phase-badge")?.classList.toggle("is-urgent", active);
}

function finishTimer() {
  stopSpeech();
  timerState.running = false;
  timerState.paused = false;
  timerState.finished = true;
  timerState.pausedMs = 0;
  setSettingsEnabled(true);
  document.getElementById("time-readout").textContent = "00:00";
  document.getElementById("time-caption").textContent = "訓練完成";
  document.getElementById("phase-label").textContent = "完成";
  document.getElementById("round-label").innerHTML = `完成 <b>${timerState.rounds}</b> 組`;
  document.getElementById("timer-message").textContent = "時間到！做得太棒了。";
  document.getElementById("start-button").innerHTML = '<span class="play-icon">▶</span><span>再來一次</span>';
  setRingProgress(0);
  setAlertState(false);
  playAlarm();
  showCelebration();
}

function resetTimer() {
  stopSpeech();
  timerState.running = false;
  timerState.paused = false;
  timerState.finished = false;
  timerState.pausedMs = 0;
  timerState.phase = "work";
  timerState.round = 1;
  setSettingsEnabled(true);
  document.getElementById("display-panel").classList.remove("is-rest");
  document.getElementById("start-button").innerHTML = '<span class="play-icon">▶</span><span>開始</span>';
  refreshPreview();
  lastPaintedSecond = -1;
  lastPaintedPhase = null;
}

function timerIsActive() {
  return timerState.running || timerState.paused;
}

function setSettingsEnabled(enabled) {
  document.querySelectorAll(
    ".quick-button, #work-minutes, #work-seconds, #rest-minutes, #rest-seconds, #round-count, #round-minus, #round-plus"
  ).forEach((control) => {
    control.disabled = !enabled;
  });
}

function formatTime(totalSeconds) {
  const minutes = Math.floor(totalSeconds / 60).toString().padStart(2, "0");
  const seconds = (totalSeconds % 60).toString().padStart(2, "0");
  return `${minutes}:${seconds}`;
}

function prepareAudio() {
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) {
    console.warn("此瀏覽器不支援 Web Audio API，無法播放鬧鈴。");
    return;
  }
  const context = getAudioContext();
  if (context.state !== "running") {
    context.resume().catch((error) => console.error("無法啟用音訊：", error));
  }
  playTone(1046, 0.32, 0.18, "triangle");
}

function getAudioContext() {
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) return null;
  if (!audioContext || audioContext.state === "closed") {
    audioContext = new AudioContextClass();
  }
  return audioContext;
}

function playTimerCue(second, phase) {
  if (second <= 0) return;
  const countdownStart = phase === "rest" ? 3 : 5;
  if (second <= countdownStart) {
    playCountdownTone(second, phase);
    speakCountdownNumber(second);
  } else {
    playStopwatchTick(second, phase);
  }
}

function playStopwatchTick(second, phase) {
  const tick = second % 2 === 0;
  const frequency = phase === "work"
    ? (tick ? 1480 : 1180)
    : (tick ? 1120 : 900);
  playTone(frequency, 0.28, 0.12, "square");
}

function playCountdownTone(second, phase) {
  const baseFrequency = phase === "rest" ? 740 : 880;
  const frequency = baseFrequency + (second - 1) * 55;
  const loudness = phase === "rest" ? 0.3 : 0.36;
  playTone(frequency, loudness, 0.2, "sine");
}

function playPhaseChangeCue(phase) {
  if (phase === "work" || phase === "rest") playTransitionSound(phase);
}

function unlockTransitionSound() {
  if (!transitionSound || transitionSoundUnlocked) return;
  transitionSound.muted = true;
  transitionSound.play().then(() => {
    transitionSound.pause();
    transitionSound.currentTime = 0;
    transitionSound.muted = false;
    transitionSoundUnlocked = true;
  }).catch((error) => {
    transitionSound.muted = false;
    console.error("無法啟用開始／結束音效：", error);
  });
}

function playTransitionSound(phase) {
  if (!transitionSound) return;
  transitionSound.pause();
  transitionSound.currentTime = 0;
  transitionSound.muted = false;
  transitionSound.play().catch((error) => {
    console.error("無法播放開始／結束音效：", error);
    playGong(phase);
  });
}

function playGong(phase) {
  const context = getAudioContext();
  if (!context) return;
  const now = context.currentTime;
  const fundamental = phase === "work" ? 190 : 155;
  const partials = [
    { ratio: 1, level: 0.38, decay: 1.15 },
    { ratio: 2.42, level: 0.21, decay: 0.9 },
    { ratio: 3.87, level: 0.13, decay: 0.72 },
    { ratio: 5.31, level: 0.08, decay: 0.55 }
  ];

  partials.forEach(({ ratio, level, decay }) => {
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    const frequency = fundamental * ratio;
    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(frequency * 1.07, now);
    oscillator.frequency.exponentialRampToValueAtTime(frequency, now + 0.08);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(level, now + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + decay);
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start(now);
    oscillator.stop(now + decay + 0.02);
  });
  if (context.state !== "running") {
    context.resume().catch((error) => console.error("無法播放敲鑼音效：", error));
  }
}

function playTone(frequency, volume, duration, type, delay = 0) {
  const context = getAudioContext();
  if (!context) return;
  const startAt = context.currentTime + delay;
  const oscillator = context.createOscillator();
  const gain = context.createGain();
  oscillator.type = type;
  oscillator.frequency.setValueAtTime(frequency, startAt);
  gain.gain.setValueAtTime(0.0001, startAt);
  gain.gain.exponentialRampToValueAtTime(volume, startAt + 0.008);
  gain.gain.exponentialRampToValueAtTime(0.0001, startAt + duration);
  oscillator.connect(gain);
  gain.connect(context.destination);
  oscillator.start(startAt);
  oscillator.stop(startAt + duration + 0.01);
  if (context.state !== "running") {
    context.resume().catch((error) => console.error("無法播放計時音效：", error));
  }
}

function speakCountdownNumber(number) {
  const spokenNumbers = ["零", "一", "二", "三", "四", "五"];
  speakText(spokenNumbers[number] || String(number));
}

function loadSpeechVoices() {
  if ("speechSynthesis" in window) {
    speechVoices = window.speechSynthesis.getVoices();
  }
}

function speakText(text) {
  if (!("speechSynthesis" in window) || typeof SpeechSynthesisUtterance === "undefined") return;
  const synthesis = window.speechSynthesis;
  if (speechVoices.length === 0) loadSpeechVoices();

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = "zh-TW";
  utterance.rate = 1;
  utterance.pitch = 1.15;
  utterance.volume = 1;
  const chineseVoice = speechVoices.find((voice) => /^zh[-_]tw$/i.test(voice.lang)) ||
    speechVoices.find((voice) => /^zh[-_]Hant/i.test(voice.lang)) ||
    speechVoices.find((voice) => /^zh/i.test(voice.lang));
  if (chineseVoice) utterance.voice = chineseVoice;
  utterance.onerror = (event) => {
    if (event.error !== "interrupted" && event.error !== "canceled") {
      console.error("無法播放語音提示：", event.error);
    }
  };
  synthesis.resume();
  synthesis.speak(utterance);
}

function speakPhaseAnnouncement(phase) {
  speakText(phase === "rest" ? "休息" : "開始");
}

function stopSpeech() {
  if ("speechSynthesis" in window) window.speechSynthesis.cancel();
}

function showCelebration() {
  document.getElementById("celebration-overlay")?.remove();

  const mascot = MASCOT_STYLES[Math.floor(Math.random() * MASCOT_STYLES.length)];
  const overlay = document.createElement("section");
  overlay.id = "celebration-overlay";
  overlay.className = "celebration-overlay";
  overlay.setAttribute("role", "dialog");
  overlay.setAttribute("aria-modal", "true");
  overlay.setAttribute("aria-labelledby", "celebration-title");
  overlay.innerHTML = `
    <div class="confetti-layer" aria-hidden="true"></div>
    <div class="celebration-card">
      <button class="celebration-close" type="button" aria-label="關閉慶祝畫面">×</button>
      <div class="mascot-wrap" style="--mascot-color:${mascot.color};--mascot-accent:${mascot.accent}">
        ${renderMascotSvg(mascot)}
      </div>
      <p class="celebration-kicker">循環完成</p>
      <h2 id="celebration-title">太棒了！</h2>
      <p class="celebration-name">${mascot.name}為你比讚！</p>
      <button class="celebration-continue" type="button">完成</button>
    </div>
  `;

  document.body.appendChild(overlay);
  const close = () => overlay.remove();
  overlay.querySelector(".celebration-close").addEventListener("click", close);
  overlay.querySelector(".celebration-continue").addEventListener("click", close);
  overlay.addEventListener("click", (event) => {
    if (event.target === overlay) close();
  });

  const confettiLayer = overlay.querySelector(".confetti-layer");
  const colors = [mascot.color, mascot.accent, "#ff6b7a", "#69c8ff", "#fff1a8"];
  for (let index = 0; index < 90; index += 1) {
    const piece = document.createElement("span");
    piece.className = "confetti-piece";
    piece.style.left = `${Math.random() * 100}%`;
    piece.style.setProperty("--confetti-color", colors[index % colors.length]);
    piece.style.setProperty("--fall-duration", `${2.8 + Math.random() * 2.2}s`);
    piece.style.setProperty("--fall-delay", `${Math.random() * 1.4}s`);
    piece.style.setProperty("--confetti-sway", `${-90 + Math.random() * 180}px`);
    piece.style.setProperty("--confetti-rotation", `${Math.random() * 900 - 450}deg`);
    confettiLayer.appendChild(piece);
  }
}

function renderMascotSvg(mascot) {
  const faces = `
    <path class="mascot-eye" d="M78 77a3.5 3.5 0 1 0 0 .1zm29 0a3.5 3.5 0 1 0 0 .1z"/>
    <path class="mascot-smile" d="M86 89q7 8 14 0"/>
    <path class="mascot-cheek" d="M68 86q5 4 10 0m26 0q5 4 10 0"/>
  `;
  const thumbsUp = `
    <path class="mascot-arm" d="M119 97c14-8 22-24 28-39 3-8 10-10 15-6 4 3 3 9 1 14l-7 17 10-3c7-2 12 3 11 9-1 5-6 7-11 9 5 1 7 6 5 10-2 5-8 6-14 7l-21 7z"/>
    <path class="mascot-thumb" d="M148 74l7-17c2-5 2-9 0-11-3-2-6 0-8 4l-8 19z"/>
  `;
  const sparkles = `<path class="mascot-spark" d="m43 48 3 8 8 3-8 3-3 8-3-8-8-3 8-3zm95-26 2 6 6 2-6 2-2 6-2-6-6-2 6-2z"/>`;

  let character;
  if (mascot.kind === "berry") {
    character = `
      <path class="mascot-arm" d="M56 94 32 77q-9-7-14 1-4 8 5 14l24 22zm65-5 28-18q9-6 14 2 4 8-5 14l-28 20z"/>
      <path class="mascot-body" d="M90 39c-9-11-27-7-30 9-17-4-27 12-18 25-13 12-6 30 9 34-2 17 14 27 29 18 10 12 28 10 35-4 17 3 28-14 19-28 12-14 3-31-12-34 2-16-15-26-29-17-1-1-2-2-3-3z"/>
      <path class="mascot-belly" d="M64 84c0-17 11-27 26-27s26 10 26 27-11 27-26 27-26-10-26-27z"/>
      ${faces}
      <path class="mascot-spark" d="m39 44 3 8 8 3-8 3-3 8-3-8-8-3 8-3zm99 4 3 7 7 3-7 3-3 7-3-7-7-3 7-3z"/>
      <path class="mascot-thumb" d="M22 76l-2-16q-1-8 6-9 7 0 8 8l2 18z"/>
    `;
  } else if (mascot.kind === "star") {
    character = `
      <path class="mascot-arm" d="m57 106-19 7q-10 4-14-5-3-9 7-13l23-9zm65-20 23 8q10 3 7 13-3 9-13 6l-24-9z"/>
      <path class="mascot-body" d="m90 28 17 23 29-3-12 27 16 24-29 3-17 26-17-26-29-3 16-24-12-27 29 3z"/>
      ${faces}
      <path class="mascot-thumb" d="m28 106-8-8q-5-6 0-11 5-4 10 2l8 9z"/>
      <path class="mascot-spark" d="m44 39 2 6 6 2-6 2-2 6-2-6-6-2 6-2zm92 8 3 8 8 3-8 3-3 8-3-8-8-3 8-3z"/>
    `;
  } else if (mascot.kind === "sun") {
    character = `
      <path class="mascot-arm" d="M57 103 34 92q-10-5-6-14 5-8 14-3l20 12zm63-17 20-12q9-5 14 3 4 9-6 14l-22 11z"/>
      <path class="mascot-body" d="m90 23 12 18 21-7 1 22 21 9-14 17 10 20-22 2-8 21-18-12-18 12-8-21-22-2 10-20-14-17 21-9 1-22 21 7z"/>
      <path class="mascot-belly" d="M65 83c0-16 10-26 25-26s25 10 25 26-10 26-25 26-25-10-25-26z"/>
      ${faces}
      <path class="mascot-thumb" d="m25 85-6-13q-4-8 3-11 7-3 10 5l7 16z"/>
      <path class="mascot-spark" d="m43 44 2 6 6 2-6 2-2 6-2-6-6-2 6-2zm95 2 2 7 7 2-7 2-2 7-2-7-7-2 7-2z"/>
    `;
  } else if (mascot.kind === "wave") {
    character = `
      <path class="mascot-arm" d="m58 98-24-2q-11-1-10-11 1-9 11-8l24 2zm63-19 22-10q10-4 14 5 3 9-7 13l-21 10z"/>
      <path class="mascot-body" d="M90 36c13-13 33-4 30 12 18-3 27 15 15 27 12 15 1 33-16 31-6 17-28 20-38 6-17 7-32-8-25-24-16-10-10-31 7-35-1-12 13-21 27-17z"/>
      <path class="mascot-belly" d="M65 83c0-16 10-26 25-26s25 10 25 26-10 26-25 26-25-10-25-26z"/>
      ${faces}
      <path class="mascot-thumb" d="m23 81-1-15q0-9 8-9 7 1 7 9v16z"/>
      <path class="mascot-spark" d="m43 43 2 7 7 2-7 2-2 7-2-7-7-2 7-2zm99 1 3 8 8 3-8 3-3 8-3-8-8-3 8-3z"/>
    `;
  } else {
    character = `
      ${thumbsUp}
      <path class="mascot-body" d="M88 31c11-13 30-7 31 9 15-5 27 9 20 23 14 8 12 28-2 34 8 16-6 31-23 27-8 15-29 15-38 2-17 8-32-5-27-22-17-7-17-29-1-37-4-16 12-28 27-21 2-8 6-13 13-15z"/>
      <path class="mascot-belly" d="M64 82c0-17 12-28 28-28s28 11 28 28-12 30-28 30S64 99 64 82z"/>
      ${faces}
      ${sparkles}
      <path class="mascot-foot" d="M65 122q-3 10-13 11m60-5q4 8 13 8"/>
    `;
  }

  return `<svg class="mascot" viewBox="0 0 180 170" role="img" aria-label="${mascot.name}為你加油">${character}</svg>`;
}

function playAlarm() {
  playTransitionSound("work");
}

function toggleFullscreen() {
  if (document.fullscreenElement) {
    document.exitFullscreen().catch((error) => console.error("無法離開全螢幕：", error));
  } else {
    document.documentElement.requestFullscreen().catch((error) => console.error("無法進入全螢幕：", error));
  }
}
