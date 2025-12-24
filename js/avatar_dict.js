// js/avatar_dict.js
// Dictionary-based ASL player (words/phrases -> video clips), fallback to letters.

const DICT_URL = "./data/asl_dictionary.json";

// Paths
const PATH_WORDS = "./assets/asl/words/";
const PATH_LETTERS = "./assets/asl/letters/";
const FALLBACK_UNKNOWN = "./assets/asl/fallback/UNKNOWN.mp4"; // optional

// UI
const elText = document.getElementById("text");
const elMode = document.getElementById("mode");
const elSpeed = document.getElementById("speed");
const elIdle = document.getElementById("idle");

const btnLoad = document.getElementById("loadBtn");
const btnPlay = document.getElementById("playBtn");
const btnPause = document.getElementById("pauseBtn");
const btnStop = document.getElementById("stopBtn");
const btnPrev = document.getElementById("prevBtn");
const btnNext = document.getElementById("nextBtn");

const elNow = document.getElementById("now");
const elNext = document.getElementById("next");
const elStatus = document.getElementById("status");
const elQueueLen = document.getElementById("queueLen");
const elPreview = document.getElementById("preview");
const elOverlayPill = document.getElementById("overlayPill");

const player = document.getElementById("player");

// State
let DICT = null;              // { phrases: [{key, file, weight?}], words: {...} }
let phraseIndex = [];         // sorted by token length desc
let queue = [];               // array of items: {type:'word'|'letter'|'pause', key, src, ms?}
let qPos = -1;
let isPlaying = false;
let stopRequested = false;

// ---------- Helpers ----------
function setStatus(s) { elStatus.textContent = s; }
function normalizeText(raw) {
  // Uppercase, keep letters/numbers/spaces, replace punctuation with space.
  return (raw || "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function splitTokens(s) {
  const t = normalizeText(s);
  return t ? t.split(" ") : [];
}

function buildPhraseIndex(dict) {
  // dict.phrases: [{key:"GOOD MORNING", file:"GOOD_MORNING.mp4"}]
  const arr = Array.isArray(dict?.phrases) ? dict.phrases : [];
  // Sort by token count desc (greedy longest match)
  return arr
    .map(p => ({...p, tokens: splitTokens(p.key), tokenLen: splitTokens(p.key).length}))
    .filter(p => p.tokenLen > 0 && p.file)
    .sort((a,b) => (b.tokenLen - a.tokenLen) || (a.key.localeCompare(b.key)));
}

function canAutoplayVideo() {
  // We rely on user clicking Play; keep simple.
  return true;
}

function updateQueueUI() {
  elQueueLen.textContent = String(queue.length);
  const nextItem = queue[qPos + 1] || null;
  const nowItem = queue[qPos] || null;
  elNow.textContent = nowItem ? nowItem.key : "—";
  elNext.textContent = nextItem ? nextItem.key : "—";
  elOverlayPill.textContent = nowItem ? nowItem.key : "—";

  const preview = queue.slice(Math.max(0, qPos + 1), Math.max(0, qPos + 1) + 20)
    .map(it => it.type === "pause" ? "[PAUSE]" : it.key)
    .join(" • ");
  elPreview.textContent = preview || "—";

  btnPrev.disabled = !(qPos > 0);
  btnNext.disabled = !(qPos + 1 < queue.length);
  btnPause.disabled = !isPlaying;
  btnStop.disabled = !isPlaying && qPos < 0;
}

function ensureFileNameForWordKey(wordKey) {
  // If dictionary doesn't provide file explicitly, we infer "WORD.mp4"
  return `${wordKey.replace(/\s+/g, "_")}.mp4`;
}

function addPause(ms=120) {
  queue.push({ type:"pause", key:`PAUSE_${ms}ms`, ms });
}

function enqueueWord(key, file=null) {
  const f = file || ensureFileNameForWordKey(key);
  queue.push({ type:"word", key, src: PATH_WORDS + f });
}
function enqueueLetter(ch) {
  if (ch === " ") {
    queue.push({ type:"word", key:"SPACE", src: PATH_LETTERS + "SPACE.mp4" });
    return;
  }
  queue.push({ type:"letter", key:ch, src: PATH_LETTERS + `${ch}.mp4` });
}

function enqueueFingerspellWord(word) {
  // Spell each letter. Add small pause between words.
  for (let i = 0; i < word.length; i++) {
    const ch = word[i];
    if (ch >= "A" && ch <= "Z") enqueueLetter(ch);
  }
  addPause(120);
}

function matchPhrasesAndWords(tokens) {
  // Greedy:
  // 1) try longest phrases
  // 2) if none, try dict.words[token]
  // 3) else fingerspell token
  queue = [];
  qPos = -1;

  const mode = elMode.value;
  if (mode === "letters_only") {
    // Fingerspell everything (including spaces)
    for (let i = 0; i < tokens.length; i++) {
      enqueueFingerspellWord(tokens[i]);
    }
    updateQueueUI();
    return;
  }

  let i = 0;
  while (i < tokens.length) {
    let matched = false;

    // Try phrases (multi-token)
    for (const p of phraseIndex) {
      const len = p.tokenLen;
      if (len <= 1) continue;
      if (i + len > tokens.length) continue;

      const slice = tokens.slice(i, i + len);
      const joined = slice.join(" ");
      if (joined === p.key) {
        enqueueWord(p.key, p.file);
        addPause(160);
        i += len;
        matched = true;
        break;
      }
    }
    if (matched) continue;

    // Try single word dictionary
    const w = tokens[i];
    const wordEntry = DICT?.words?.[w]; // can be "HELLO.mp4" or {file:"HELLO.mp4"}
    if (wordEntry) {
      const file = typeof wordEntry === "string" ? wordEntry : wordEntry.file;
      enqueueWord(w, file);
      addPause(140);
      i += 1;
      continue;
    }

    // Fallback: fingerspell this token
    enqueueFingerspellWord(w);
    i += 1;
  }

  updateQueueUI();
}

// ---------- Playback engine ----------
async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function playItem(item) {
  if (!item) return;

  // Apply speed
  player.playbackRate = parseFloat(elSpeed.value || "1.0");

  if (item.type === "pause") {
    setStatus("Playing (pause)");
    updateQueueUI();
    await sleep(item.ms || 120);
    return;
  }

  setStatus("Loading clip…");
  player.src = item.src;

  // Try to play; if blocked, user must click Play again
  try {
    await player.play();
  } catch (e) {
    console.warn("Autoplay blocked or play failed:", e);
    setStatus("Click Play to start");
    isPlaying = false;
    updateQueueUI();
    return;
  }

  setStatus("Playing");
  updateQueueUI();

  // Wait for ended OR error
  await new Promise((resolve) => {
    const onEnd = () => cleanup(resolve);
    const onErr = () => cleanup(resolve);

    const cleanup = (done) => {
      player.removeEventListener("ended", onEnd);
      player.removeEventListener("error", onErr);
      done();
    };

    player.addEventListener("ended", onEnd, { once:true });
    player.addEventListener("error", onErr, { once:true });
  });
}

async function runQueue() {
  if (isPlaying) return;
  isPlaying = true;
  stopRequested = false;

  btnPlay.disabled = true;
  btnPause.disabled = false;
  btnStop.disabled = false;

  setStatus("Playing");
  updateQueueUI();

  // If starting fresh, go to first
  if (qPos < -1) qPos = -1;

  while (!stopRequested) {
    const next = queue[qPos + 1];
    if (!next) break;

    qPos++;
    updateQueueUI();
    await playItem(queue[qPos]);

    // If playItem caused autoplay block and turned isPlaying off, break
    if (!isPlaying) break;
  }

  // Finished
  if (!stopRequested && isPlaying) {
    setStatus("Finished");
    btnPlay.disabled = false;
    btnPause.disabled = true;
    btnStop.disabled = false;
    isPlaying = false;

    if (elIdle.value === "on" && queue.length > 0) {
      // Loop: restart after short pause
      await sleep(400);
      qPos = -1;
      updateQueueUI();
      runQueue();
      return;
    }
  }

  updateQueueUI();
}

function pauseQueue() {
  if (!isPlaying) return;
  try { player.pause(); } catch {}
  isPlaying = false;
  setStatus("Paused");
  btnPlay.disabled = false;
  btnPause.disabled = true;
  btnStop.disabled = false;
  updateQueueUI();
}

function stopQueue() {
  stopRequested = true;
  try { player.pause(); } catch {}
  player.removeAttribute("src");
  player.load();

  isPlaying = false;
  setStatus("Stopped");
  btnPlay.disabled = false;
  btnPause.disabled = true;
  btnStop.disabled = true;
  qPos = -1;
  updateQueueUI();
}

function stepPrev() {
  if (qPos <= 0) return;
  pauseQueue();
  qPos = Math.max(-1, qPos - 2); // -2 because runQueue increments before play
  updateQueueUI();
  runQueue();
}
function stepNext() {
  if (qPos + 1 >= queue.length) return;
  pauseQueue();
  // leave qPos as-is; runQueue will advance to qPos+1
  updateQueueUI();
  runQueue();
}

// ---------- Dictionary load ----------
async function loadDictionary() {
  setStatus("Loading dictionary…");
  try {
    const res = await fetch(DICT_URL, { cache: "no-store" });
    if (!res.ok) throw new Error(`Dictionary fetch failed: ${res.status}`);
    DICT = await res.json();
    phraseIndex = buildPhraseIndex(DICT);
    setStatus("Dictionary loaded");
    return true;
  } catch (e) {
    console.error(e);
    DICT = { phrases: [], words: {} };
    phraseIndex = [];
    setStatus("Dictionary missing (check /data/asl_dictionary.json)");
    return false;
  }
}

function rebuildQueueFromTextarea() {
  const tokens = splitTokens(elText.value);
  matchPhrasesAndWords(tokens);
}

// ---------- Wire up ----------
btnLoad.addEventListener("click", async () => {
  await loadDictionary();
  rebuildQueueFromTextarea();
});

btnPlay.addEventListener("click", () => {
  if (!queue.length) rebuildQueueFromTextarea();
  if (!queue.length) {
    setStatus("Nothing to play");
    return;
  }
  runQueue();
});

btnPause.addEventListener("click", pauseQueue);
btnStop.addEventListener("click", stopQueue);

btnPrev.addEventListener("click", stepPrev);
btnNext.addEventListener("click", stepNext);

elText.addEventListener("input", () => {
  // Don’t auto-play; only rebuild queue preview
  rebuildQueueFromTextarea();
});

elMode.addEventListener("change", rebuildQueueFromTextarea);
elSpeed.addEventListener("change", () => { player.playbackRate = parseFloat(elSpeed.value || "1.0"); });
elIdle.addEventListener("change", () => { /* no-op */ });

// Boot
await loadDictionary();
rebuildQueueFromTextarea();
setStatus("Idle");
updateQueueUI();
