import {
  DEG, clamp, dampAngle, dist2, identity, pointBlocked, createRenderer, resolveCircle, wrapAngle,
} from "./engine.js";
import { createLibrary, drawCar, drawHeli, drawPerson, drawProp, drawRider, drawScooter, prepareFrame } from "./models.js";
import { createWorld, groundY as worldGround, highwayTFromZ, inZone, waterEdgeX, RACE_POINTS } from "./world.js";
import { CLOCK_RATE, advanceClock, festivalState, formatClock, formatMoney, skyEnvironment } from "./shift.js";
import { createAudio } from "./audio.js";
import { createSim, honk, updateSim } from "./sim.js";
import { crateDrops, createActivities, goalFor, interactItem, updateStory } from "./story.js";
import { defaultState, hasSave, readBoard, readSave, writeBoard, writeSave } from "./save.js";

const $ = (id) => document.getElementById(id);
const canvas = $("c");
const IDENT = identity(new Float32Array(16));
const keys = {};
const input = { x: 0, z: 0, accel: false, interactQueued: false, vehicleQueued: false };

let renderer, world, lib, sim, audio, activities;
let state = null;
let board = null;
let mode = "title";
let titleTime = 9 * 3600;
let camYaw = Math.PI;
let lookId = null;
let lookX = 0;
let lookHold = 0;
let speedV = 0;
let gameSpeed = 0;
let lean = 0;
let wheelSpin = 0;
let walkPhase = 0;
let shake = 0;
let dialog = null;
let race = null;
let mapRegion = "city";
let settingsReturn = "title";
let toastTimer = 0;
let toastText = "";
let placeText = "";
let promptText = "";
const goalPopup = { key: "", until: 0, pinned: false, expanded: false };
let saveTimer = 0;
let eventTimer = 8;
let blink = 0;
let bustLock = false;
const camera = {
  eye: [0, 8, 0],
  target: [0, 1, 0],
  forward: [0, 0, 1],
  right: [1, 0, 0],
  up: [0, 1, 0],
  fov: 58 * DEG,
};
const INTERACT_REACH = 4.2;
const MOUNT_REACH = 6.5;
const WALK_SPEED = 4.7;
const SPRINT_SPEED = 7.6;
let stuckTime = 0;
let stamWarned = false;
let moveKind = "idle";
const clockDebug = {
  enabled: new URLSearchParams(location.search).get("clock") === "1",
  wall: 0,
  running: 0,
  origin: null,
};

const game = {
  get state() { return state; },
  get world() { return world; },
  get sim() { return sim; },
  get audio() { return audio; },
  get mode() { return mode; },
  get speed() { return gameSpeed; },
  get race() { return race; },
  eventTimer: 48,
  say, toast, openActivity, startRace, startDelivery, startCrate,
  enter, exitInterior, save, showEnding, addMoney, addWanted, removeInteract, fade,
};

function syncViewport() {
  const vv = window.visualViewport;
  const h = vv && vv.height > 0 ? Math.min(vv.height, window.innerHeight || vv.height) : window.innerHeight;
  if (h > 0) document.documentElement.style.setProperty("--app-h", `${Math.round(h)}px`);
}

function boot() {
  syncViewport();
  window.addEventListener("resize", syncViewport);
  window.addEventListener("orientationchange", () => window.setTimeout(syncViewport, 250));
  if (window.visualViewport) window.visualViewport.addEventListener("resize", syncViewport);
  try {
    renderer = createRenderer(canvas);
    lib = createLibrary(renderer);
    world = createWorld(renderer);
    sim = createSim(world);
    audio = createAudio();
    activities = createActivities($("mini-canvas"));
    board = readBoard();
    applyAudio();
    $("btn-continue").disabled = !hasSave();
    if (clockDebug.enabled) $("clock-debug").hidden = false;
    bindInput();
    window.__PT = {
      get state() { return state; },
      get mode() { return mode; },
      get speed() { return gameSpeed; },
      get draws() { return renderer.draws.count; },
      board,
      tp(x, z) { if (state) { state.x = x; state.z = z; } },
      setTime(h) { if (state) state.time = h * 3600; },
      setWanted(n) { if (state) state.wanted = clamp(n, 0, 5); },
      setStamina(n) { if (state) state.stamina = clamp(n, 0, 100); },
      setChapter(c) { if (state) state.chapter = c; },
      get police() { return sim ? sim.police.length : 0; },
      get heli() { return !!(sim && sim.heli); },
      get blocks() { return sim ? sim.roadblocks.length : 0; },
      get scene() { return sceneName(); },
      get cameraYaw() { return camYaw; },
      get cam() { return camera.eye ? { x: camera.eye[0], y: camera.eye[1], z: camera.eye[2], yaw: camYaw } : null; },
      setCameraYaw(y) { camYaw = wrapAngle(y); lookHold = 1.2; },
      get chapter() { return state && state.chapter; },
      get goal() { return state ? activeGoal() : null; },
      get prompt() { return promptText; },
      get place() { return placeText; },
      get hint() { const el = $("hint"); return el.hidden ? "" : el.textContent; },
      get pos() { return state ? { x: state.x, y: state.y, z: state.z, yaw: state.yaw, riding: state.riding, stamina: state.stamina } : null; },
      setYaw(y) { if (state) { state.yaw = y; camYaw = y; lookHold = 0; } },
      blocked(x, z, r = 0.34) { return pointBlocked(state && state.inside ? world.interiorGrids[state.inside] : world.grid, x, z, r); },
      clockSample() { return readClockDebug(); },
      resetClockDebug() { resetClockDebug(); },
      mini() { return activities.snapshot(); },
      project(x, y, z) { return renderer.project(x, y, z); },
      get cops() { return sim ? sim.police.map((c) => ({ x: c.x, z: c.z, kind: c.kind })) : []; },
    };
    requestAnimationFrame(frame);
  } catch (err) {
    const fatal = $("fatal");
    fatal.hidden = false;
    fatal.textContent = "遊戲無法啟動：" + (err && err.message ? err.message : err);
  }
}

function applyAudio() {
  audio.setMusicVolume(board.music);
  audio.setSfxVolume(board.sfx);
  audio.setMute(board.mute);
  $("music-vol").value = String(Math.round(board.music * 100));
  $("sfx-vol").value = String(Math.round(board.sfx * 100));
  $("mute-check").checked = board.mute;
  $("touch-check").checked = board.showTouch === "on";
  const scale = Number(board.uiScale) || 1;
  board.uiScale = scale;
  document.documentElement.style.setProperty("--ui-scale", String(scale));
  $("ui-scale").value = String(Math.round(scale * 100));
}

function freshState() {
  const save = readSave();
  return save || null;
}

function beginPlaying(next, banner) {
  state = next;
  camYaw = state.yaw || 0;
  speedV = 0;
  gameSpeed = 0;
  race = null;
  dialog = null;
  if (state.job && state.job.left > 0) state.job.deadline = performance.now() + state.job.left * 1000;
  else state.job = null;
  if (state.race && Number.isFinite(state.race.elapsed)) {
    race = { i: state.race.i | 0, start: performance.now() - state.race.elapsed * 1000, warn: 0, opp: 0 };
  }
  state.race = null;
  mode = "playing";
  $("title").hidden = true;
  $("hud").hidden = false;
  $("pause").hidden = true;
  $("ending").hidden = true;
  goalPopup.key = "";
  goalPopup.pinned = false;
  goalPopup.until = 0;
  audio.resume();
  audio.setScene(sceneName(), true);
  save();
}

function bindInput() {
  window.addEventListener("keydown", (e) => {
    if (["Space", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.code)) e.preventDefault();
    if (e.code === "F3") {
      e.preventDefault();
      if (!e.repeat) toggleClockDebug();
      return;
    }
    if (e.repeat) return;
    keys[e.code] = true;
    audio.resume();
    if (mode === "dialog") {
      const pick = /^(?:Digit|Numpad)([1-9])$/.exec(e.code);
      if (pick) pickChoice(Number(pick[1]) - 1);
      else if (e.code === "Enter" || e.code === "KeyE") advanceDialog();
      return;
    }
    if (mode === "mini") {
      activities.key(e.code);
      if (e.code === "Escape") closeMini();
      return;
    }
    if (e.code === "KeyE") input.interactQueued = true;
    if (e.code === "KeyF") input.vehicleQueued = true;
    if (e.code === "KeyH") { honk(sim); audio.sfx("horn"); }
    if (e.code === "KeyM") toggleMap();
    if (e.code === "Escape") {
      if (!$("settings").hidden || !$("help").hidden || mode === "map") closeOverlays();
      else if (mode === "playing") openPause();
      else if (mode === "pause") closePause();
    }
  }, true);
  window.addEventListener("keyup", (e) => { keys[e.code] = false; if (e.code === "Space") input.accel = false; });
  window.addEventListener("blur", () => { for (const k of Object.keys(keys)) keys[k] = false; input.accel = false; });

  const joy = $("joy");
  const knob = $("joy-knob");
  let joyId = null;
  const moveJoy = (e) => {
    const rect = joy.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const maxR = rect.width * 0.34;
    let dx = e.clientX - cx;
    let dy = e.clientY - cy;
    const mag = Math.hypot(dx, dy) || 1;
    const clamped = Math.min(mag, maxR);
    dx = dx / mag * clamped;
    dy = dy / mag * clamped;
    knob.style.transform = `translate(${dx}px, ${dy}px)`;
    input.x = dx / maxR;
    input.z = -dy / maxR;
  };
  joy.addEventListener("pointerdown", (e) => {
    joyId = e.pointerId;
    joy.setPointerCapture(e.pointerId);
    audio.resume();
    moveJoy(e);
  });
  joy.addEventListener("pointermove", (e) => { if (e.pointerId === joyId) moveJoy(e); });
  const endJoy = (e) => {
    if (e.pointerId !== joyId) return;
    joyId = null;
    input.x = 0;
    input.z = 0;
    knob.style.transform = "translate(0px, 0px)";
  };
  joy.addEventListener("pointerup", endJoy);
  joy.addEventListener("pointercancel", endJoy);

  const hold = (el, fn) => {
    el.addEventListener("pointerdown", (e) => { e.preventDefault(); audio.resume(); fn(true); });
    el.addEventListener("pointerup", () => fn(false));
    el.addEventListener("pointercancel", () => fn(false));
    el.addEventListener("pointerleave", () => fn(false));
  };
  hold($("btn-accel"), (v) => { if (mode === "playing") input.accel = v; });
  $("btn-interact").addEventListener("pointerdown", (e) => {
    e.preventDefault();
    audio.resume();
    if (mode === "dialog") { advanceDialog(); return; }
    if (mode === "playing") input.interactQueued = true;
  });
  $("btn-vehicle").addEventListener("pointerdown", (e) => {
    e.preventDefault();
    audio.resume();
    if (mode === "playing") input.vehicleQueued = true;
  });
  $("goal").addEventListener("click", () => {
    goalPopup.pinned = !goalPopup.pinned;
    if (!goalPopup.pinned) goalPopup.until = 0;
  });
  $("ui-scale").addEventListener("input", (e) => {
    board.uiScale = Number(e.target.value) / 100;
    document.documentElement.style.setProperty("--ui-scale", String(board.uiScale));
    writeBoard(board);
  });

  canvas.addEventListener("pointerdown", (e) => {
    if (mode !== "playing" || (e.button != null && e.button !== 0)) return;
    lookId = e.pointerId;
    lookX = e.clientX;
    try { canvas.setPointerCapture(e.pointerId); } catch { /* already released */ }
    audio.resume();
  });
  canvas.addEventListener("pointermove", (e) => {
    if (e.pointerId !== lookId) return;
    const dx = e.clientX - lookX;
    lookX = e.clientX;
    if (Math.abs(dx) < 0.4) return;
    camYaw = wrapAngle(camYaw - dx * 0.0075);
    lookHold = 0.85;
  });
  const endLook = (e) => {
    if (e.pointerId !== lookId) return;
    lookId = null;
  };
  canvas.addEventListener("pointerup", endLook);
  canvas.addEventListener("pointercancel", endLook);

  $("btn-new").addEventListener("click", () => { audio.resume(); beginPlaying(newGame(), true); });
  $("btn-continue").addEventListener("click", () => {
    audio.resume();
    const saved = readSave();
    if (saved) beginPlaying(saved, false);
  });
  $("btn-settings").addEventListener("click", () => openSettings("title"));
  $("btn-help").addEventListener("click", () => { $("help").hidden = false; });
  $("btn-help2").addEventListener("click", () => { $("help").hidden = false; });
  $("help-close").addEventListener("click", () => { $("help").hidden = true; });
  $("btn-menu").addEventListener("click", () => openPause());
  $("minimap").addEventListener("click", () => {
    if (!state || mode !== "playing") return;
    openMap();
  });
  $("btn-resume").addEventListener("click", closePause);
  $("btn-save").addEventListener("click", () => { save(); toast("已儲存"); });
  $("btn-pause-settings").addEventListener("click", () => openSettings("pause"));
  $("btn-map").addEventListener("click", () => { $("pause").hidden = true; openMap(); });
  $("btn-title").addEventListener("click", toTitle);
  $("settings-close").addEventListener("click", closeSettings);
  $("music-vol").addEventListener("input", (e) => {
    board.music = Number(e.target.value) / 100;
    audio.setMusicVolume(board.music);
    writeBoard(board);
  });
  $("sfx-vol").addEventListener("input", (e) => {
    board.sfx = Number(e.target.value) / 100;
    audio.setSfxVolume(board.sfx);
    writeBoard(board);
  });
  $("mute-check").addEventListener("change", (e) => {
    board.mute = e.target.checked;
    applyAudio();
    writeBoard(board);
  });
  $("touch-check").addEventListener("change", (e) => {
    board.showTouch = e.target.checked ? "on" : "off";
    writeBoard(board);
  });
  $("map-close").addEventListener("click", () => { $("map").hidden = true; if (mode === "map") mode = "playing"; });
  $("map-city").addEventListener("click", () => setMapRegion("city"));
  $("map-kenting").addEventListener("click", () => setMapRegion("kenting"));
  $("mini-canvas").addEventListener("pointerdown", (e) => activities.pointer(e));
  $("mini-close").addEventListener("click", closeMini);
  $("ending-free").addEventListener("click", () => {
    state.chapter = "free";
    mode = "playing";
    $("ending").hidden = true;
    save();
  });
  $("ending-title-btn").addEventListener("click", toTitle);
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      freezeTimers();
      save();
    } else resumeTimers();
  });
  window.addEventListener("pagehide", () => { freezeTimers(); save(); });
}

function freezeTimers() {
  if (!state) return;
  if (state.job && state.job.deadline) state.job.left = Math.max(0, (state.job.deadline - performance.now()) / 1000);
  if (race) race.elapsed = (performance.now() - race.start) / 1000;
}

function resumeTimers() {
  if (!state) return;
  if (state.job && state.job.left > 0) state.job.deadline = performance.now() + state.job.left * 1000;
  if (race && Number.isFinite(race.elapsed)) race.start = performance.now() - race.elapsed * 1000;
}

function newGame() {
  const next = defaultState();
  next.x = world.spawn.x;
  next.z = world.spawn.z;
  next.yaw = world.spawn.yaw;
  return next;
}

function openSettings(from) {
  settingsReturn = from;
  if (from === "pause") $("pause").hidden = true;
  $("settings").hidden = false;
  audio.resume();
}
function closeSettings() {
  $("settings").hidden = true;
  if (settingsReturn === "pause" && mode === "pause") $("pause").hidden = false;
}
function openPause() {
  if (!state || mode === "title") return;
  mode = "pause";
  $("pause").hidden = false;
  renderRecords();
}
function closePause() {
  $("pause").hidden = true;
  if (mode === "pause") mode = "playing";
}
function closeOverlays() {
  if (!$("settings").hidden) { closeSettings(); return; }
  if (!$("help").hidden) { $("help").hidden = true; return; }
  $("map").hidden = true;
  if (mode === "map") mode = "playing";
}
function setMapRegion(region) {
  mapRegion = region;
  $("map-city").classList.toggle("active", region === "city");
  $("map-kenting").classList.toggle("active", region === "kenting");
}
function openMap() {
  if (!state) return;
  mode = "map";
  setMapRegion(state.z < -500 ? "kenting" : "city");
  $("map").hidden = false;
}
function toggleMap() {
  if (!state || mode === "title" || mode === "pause") return;
  if (mode === "map") { $("map").hidden = true; mode = "playing"; }
  else openMap();
}
function toTitle() {
  save();
  mode = "title";
  $("hud").hidden = true;
  $("pause").hidden = true;
  $("ending").hidden = true;
  $("map").hidden = true;
  $("title").hidden = false;
  $("btn-continue").disabled = !hasSave();
  document.body.classList.remove("show-touch");
}

function say(lines, onDone) {
  dialog = { lines, i: 0, onDone: typeof onDone === "function" ? onDone : null };
  mode = "dialog";
  input.interactQueued = false;
  input.vehicleQueued = false;
  input.accel = false;
  renderDialog();
}
function closeDialog() {
  const done = dialog && dialog.onDone;
  dialog = null;
  $("dialog").hidden = true;
  if (mode === "dialog") mode = "playing";
  if (done) done();
}
function renderDialog() {
  const el = $("dialog");
  if (!dialog) { el.hidden = true; return; }
  el.hidden = false;
  const line = dialog.lines[dialog.i];
  $("dlg-name").textContent = line.name || "";
  $("dlg-text").textContent = line.text || "";
  const box = $("dlg-choices");
  box.replaceChildren();
  if (line.choices) {
    line.choices.forEach((choice, index) => {
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = choice.label;
      button.addEventListener("click", () => pickChoice(index));
      box.appendChild(button);
    });
  } else {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "next";
    button.textContent = dialog.i < dialog.lines.length - 1 ? "繼續" : "好";
    button.addEventListener("click", advanceDialog);
    box.appendChild(button);
  }
  el.querySelector(".card").scrollTop = 0;
}
function pickChoice(index) {
  const line = dialog && dialog.lines[dialog.i];
  const choice = line && line.choices && line.choices[index];
  if (!choice) return;
  dialog = null;
  $("dialog").hidden = true;
  if (mode === "dialog") mode = "playing";
  choice.run();
}
function advanceDialog() {
  if (!dialog) return;
  if (dialog.lines[dialog.i].choices) return;
  dialog.i += 1;
  if (dialog.i >= dialog.lines.length) closeDialog();
  else renderDialog();
}

function toast(text) {
  toastText = text;
  toastTimer = 2.6;
}
function fade(fn) {
  const el = $("fade");
  el.classList.add("on");
  window.setTimeout(() => {
    fn();
    el.classList.remove("on");
  }, 260);
}
function addMoney(n) { state.money = Math.max(0, state.money + n); }
function addWanted(n) {
  const before = state.wanted;
  state.wanted = clamp(state.wanted + n, 0, 5);
  if (state.wanted > before) {
    toast(state.wanted >= 5 ? "通緝五顆星，直升機來了" : `通緝 ${state.wanted} 顆星`);
    state.heat += 1;
  }
}
function removeInteract(item) {
  world.interactables = world.interactables.filter((it) => it !== item);
}
function enter(id) {
  const room = world.interiors[id];
  if (!room) return;
  fade(() => {
    state.inside = id;
    state.riding = null;
    speedV = 0;
    state.x = room.spawn.x;
    state.z = room.spawn.z;
    state.yaw = room.spawn.yaw;
    camYaw = state.yaw;
  });
}
function exitInterior() {
  const room = world.interiors[state.inside];
  if (!room) return;
  fade(() => {
    const out = room.outside;
    state.inside = null;
    state.x = out.x;
    state.z = out.z;
    state.yaw = out.yaw;
    camYaw = state.yaw;
  });
}
function openActivity(name, opts) {
  activities.open(name, opts);
  $("mini-title").textContent = activities.label();
  $("mini").hidden = false;
  mode = "mini";
}
function closeMini() {
  if (activities.active()) activities.close();
  $("mini").hidden = true;
  if (mode === "mini") mode = "playing";
}

function startRace() {
  if (state.money < 200) { toast("報名費要 $200"); return; }
  if (state.inside) { toast("先出門"); return; }
  state.money -= 200;
  addWanted(2);
  if (!state.riding) {
    state.riding = "scooter";
    state.vehicleTint = state.vehicleTint || [0.9, 0.2, 0.16];
  }
  state.x = 0;
  state.z = -16;
  state.yaw = Math.PI;
  camYaw = state.yaw;
  speedV = 0;
  race = { i: 0, start: performance.now(), warn: 0, opp: 0 };
  toast("街跑開始，跟著光門");
  audio.sfx("horn");
}
function startDelivery() {
  if (state.job) { toast("先完成手上的差事"); return; }
  if (state.chapter === "intro") { toast("先去跟陳桑打招呼"); return; }
  const spot = farSpot(55);
  state.job = { type: "delivery", phase: "drop", x: spot.x, z: spot.z, left: 75, deadline: performance.now() + 75000 };
  toast("餐點好了，跟著箭頭送");
}
function startCrate() {
  if (state.path !== "under") { toast("這箱鳳梨酥不關你的事"); return; }
  if (state.job) { toast("先送完這一趟"); return; }
  const drop = crateDrops()[Math.min(state.crates, 2)];
  state.job = { type: "crate", phase: "drop", x: drop.x, z: drop.z, left: 90, deadline: performance.now() + 90000 };
  addWanted(1);
  toast("箱子綁上了，送到亮處");
}
function farSpot(minDist) {
  let pick = world.sidewalks[0];
  for (let n = 0; n < 12; n++) {
    const s = world.sidewalks[(Math.random() * world.sidewalks.length) | 0];
    if (Math.hypot(s.x - state.x, s.z - state.z) > minDist) return s;
    pick = s;
  }
  return pick;
}

function showEnding(kind) {
  const copy = kind === "honest"
    ? "阿霞把招牌交給你的那天，夜市還是一樣吵。你的店從星村賣到黑鮪魚季，屏東的人開始用你的名字叫那碗湯。沒有通緝、沒有直升機，只有打烊後還亮著的燈。"
    : "阿龍把夜市這一帶的氣氛交給你。沒有血腥的加冕，只有一整排被你贏過的機車、三個會喊哩賀的夥伴，還有認得你尾燈的警察。這是虛構的屏東之夜，燈籠還是會在十一點亮起。";
  state.chapter = kind === "honest" ? "honest_end" : "under_end";
  if (!state.endingsSeen.includes(kind)) state.endingsSeen.push(kind);
  if (!board.endings.includes(kind)) board.endings.push(kind);
  writeBoard(board);
  $("ending-title").textContent = kind === "honest" ? "結局 · 屏東好店長" : "結局 · 屏東的夜";
  $("ending-text").textContent = copy;
  $("ending").hidden = false;
  mode = "ending";
  audio.sfx("win");
  save();
}

function save() {
  if (!state || mode === "title") return;
  if (state.job && state.job.deadline) state.job.left = Math.max(0, (state.job.deadline - performance.now()) / 1000);
  if (race) state.race = { i: race.i, elapsed: (performance.now() - race.start) / 1000 };
  else state.race = null;
  board.shifts = Math.max(board.shifts || 0, state.shifts || 0);
  board.rep = Math.max(board.rep || 0, state.rep || 0);
  board.heat = Math.max(board.heat || 0, state.heat || 0);
  writeSave(state);
  writeBoard(board);
  state.race = null;
}

function renderRecords() {
  const ends = board.endings.map((e) => (e === "honest" ? "店長" : "夜路")).join("、") || "尚未達成";
  const raceBest = board.races[0] ? `${board.races[0].time.toFixed(1)} 秒` : "尚無";
  $("records").textContent = `結局：${ends}\n街跑最佳：${raceBest}\n班次 ${board.shifts || 0}　善名 ${board.rep || 0}　風聲 ${board.heat || 0}`;
}

let last = performance.now();
let fpsWindow = 0;
let fpsFrames = 0;
function frame(now) {
  const raw = Math.min(0.25, Math.max(0, (now - last) / 1000));
  last = now;
  const dt = Math.min(0.05, raw);
  if (!document.hidden) {
    update(dt, raw);
    render();
    fpsWindow += dt;
    fpsFrames += 1;
    if (fpsWindow >= 1.2) {
      renderer.adaptQuality(fpsFrames / fpsWindow);
      if (fpsFrames / fpsWindow < 28 && sim) {
        if (sim.peds.length > 10) sim.peds.length = 10;
        if (sim.traffic.length > 8) sim.traffic.length = 8;
      }
      fpsWindow = 0;
      fpsFrames = 0;
    }
  }
  requestAnimationFrame(frame);
}

function clockRunning() {
  return !!state && (mode === "playing" || mode === "map" || mode === "mini");
}

function update(dt, clockDt = dt) {
  blink += dt;
  shake = Math.max(0, shake - dt);
  if (mode === "title") {
    titleTime += clockDt * CLOCK_RATE;
    audio.setScene("title");
    audio.update();
    return;
  }
  if (!state) return;
  const runClock = clockRunning();
  if (runClock) advanceClock(state, clockDt);
  if (clockDebug.enabled) {
    clockDebug.wall += clockDt;
    if (runClock) clockDebug.running += clockDt;
    if (clockDebug.origin == null) clockDebug.origin = state.time;
  }
  document.body.classList.toggle("raining", state.time < state.rainUntil && !state.inside);
  if (mode === "playing") {
    updatePlayer(dt);
    updateSim(sim, game, dt);
    if (sim.caught) bust();
    updateJob(dt);
    updateRace(dt);
    updateStory(game, dt);
    collisions(dt);
    decayWanted(dt);
  } else if (mode === "mini") {
    activities.update(dt);
    activities.draw();
    if (!activities.active()) {
      $("mini").hidden = true;
      if (mode === "mini") mode = "playing";
    }
  } else if (mode === "dialog" || mode === "pause" || mode === "ending") {
    /* 對話、暫停、結局時世界與時鐘都停著；大地圖與小遊戲仍在 update 外面推進時鐘 */
  }
  if (toastTimer > 0) {
    toastTimer -= dt;
    if (toastTimer <= 0) toastText = "";
  }
  document.body.classList.toggle("in-dialog", mode === "dialog");
  document.body.classList.toggle("cine", mode === "dialog" || mode === "ending");
  audio.setScene(sceneName());
  audio.update();
  audio.tickSiren();
  audio.setChase(state.wanted >= 2 && mode === "playing" ? Math.min(1, 0.35 + state.wanted * 0.12) : 0);
  audio.setEngine(state.riding && mode === "playing" ? gameSpeed : 0);
  updateHud();
  saveTimer += dt;
  if (saveTimer > 20) { saveTimer = 0; save(); }
  syncTouch();
}

function sceneName() {
  if (mode === "title") return "title";
  if (mode === "ending") return "home";
  if (!state) return "day";
  if (state.inside === "jail") return "jail";
  if (state.inside === "home" || state.inside === "shop") return "home";
  if (state.wanted >= 2) return "chase";
  if (sim?.nearParade) return "festival";
  const hour = ((state.time % 86400) / 3600);
  const market = inZone("market", state.x, state.z) && (hour >= 17 || hour < 1);
  if (market && (!state.riding || gameSpeed < 7)) return "market";
  if (inZone("kenting", state.x, state.z) && (!state.riding || gameSpeed < 8)) return "kenting";
  if (state.riding) return "drive";
  if (hour >= 19 || hour < 5.5) return "night";
  return "day";
}

function updatePlayer(dt) {
  const grid = state.inside ? world.interiorGrids[state.inside] : world.grid;
  const riding = state.riding;
  const radius = riding === "car" ? 1.15 : riding === "scooter" ? 0.7 : 0.34;
  let ix = input.x;
  let iz = input.z;
  if (keys.KeyA || keys.ArrowLeft) ix -= 1;
  if (keys.KeyD || keys.ArrowRight) ix += 1;
  if (keys.KeyW || keys.ArrowUp) iz += 1;
  if (keys.KeyS || keys.ArrowDown) iz -= 1;
  const mag = Math.hypot(ix, iz);
  const nx = mag > 1 ? ix / mag : ix;
  const nz = mag > 1 ? iz / mag : iz;
  const vehicleThrust = input.accel || !!keys.Space || nz > 0.5;
  const footSprint = !!(input.accel || keys.Space || keys.ShiftLeft || keys.ShiftRight);
  const rain = state.time < state.rainUntil ? 0.86 : 1;

  const prevX = state.x;
  const prevZ = state.z;
  let wish = 0;
  if (!riding) {
    if (mag > 0.12) {
      const fx = Math.sin(camYaw);
      const fz = Math.cos(camYaw);
      const rx = -Math.cos(camYaw);
      const rz = Math.sin(camYaw);
      let mx = rx * nx + fx * nz;
      let mz = rz * nx + fz * nz;
      const len = Math.hypot(mx, mz) || 1;
      mx /= len; mz /= len;
      state.yaw = Math.atan2(mx, mz);
      const sprint = footSprint && state.stamina > 1;
      const spd = (sprint ? SPRINT_SPEED : WALK_SPEED) * Math.min(1, mag) * rain;
      if (sprint) state.stamina = Math.max(0, state.stamina - 18 * dt);
      else state.stamina = Math.min(100, state.stamina + 9 * dt);
      gameSpeed = spd;
      wish = spd * dt;
      slideMove(grid, mx * wish, mz * wish, radius);
      walkPhase += spd * dt * 2.2;
      moveKind = sprint ? "sprint" : "walk";
    } else {
      gameSpeed = 0;
      const rec = state.stamina <= 8 ? 5 : 16;
      state.stamina = Math.min(100, state.stamina + rec * dt);
      moveKind = "idle";
    }
    lean = 0;
  } else {
    const max = (riding === "car" ? 34 : 24) * rain;
    const accel = riding === "car" ? 12 : 15;
    if (vehicleThrust) {
      speedV = Math.min(max, speedV + accel * dt);
      if (!state.flags.taughtRide) markTaught("taughtRide");
    }
    else if (nz < -0.35 || keys.KeyS || keys.ArrowDown) speedV = Math.max(-6, speedV - accel * dt);
    else speedV *= Math.exp(-1.35 * dt);
    const turnRate = (riding === "car" ? 1.5 : 2.2) * clamp(Math.abs(speedV) / 8, 0.28, 1);
    state.yaw -= nx * turnRate * dt * (speedV < 0 ? -1 : 1);
    lean = clamp(nx * 0.28, -0.3, 0.3);
    wish = Math.abs(speedV) * dt;
    slideMove(grid, Math.sin(state.yaw) * speedV * dt, Math.cos(state.yaw) * speedV * dt, radius);
    wheelSpin += speedV * dt / 0.32;
    gameSpeed = Math.abs(speedV);
    state.stamina = Math.min(100, state.stamina + 6 * dt);
    walkPhase += dt * 2;
    moveKind = riding === "car" ? "car" : "scooter";
  }

  const moved = Math.hypot(state.x - prevX, state.z - prevZ);
  if (wish > 0.02 && moved < wish * 0.28) stuckTime += dt;
  else stuckTime = Math.max(0, stuckTime - dt);
  if (stuckTime > 0.28) {
    const side = Math.sin(stuckTime * 7) >= 0 ? 1 : -1;
    const a = (riding ? state.yaw : camYaw) + side * Math.PI / 2;
    for (const dist of [0.85, 1.35, 1.9]) {
      const tx = state.x + Math.sin(a) * dist;
      const tz = state.z + Math.cos(a) * dist;
      if (!pointBlocked(grid, tx, tz, radius + 0.05)) {
        state.x = tx;
        state.z = tz;
        stuckTime = 0;
        if (riding) speedV *= 0.75;
        break;
      }
    }
  }
  if (riding && wish > 0.02 && moved < wish * 0.4) speedV *= 0.9;
  if (!state.inside) {
    const limited = limitWorld(state.x, state.z);
    state.x = limited.x;
    state.z = limited.z;
    state.y = worldGround(state.x, state.z);
  } else state.y = 0;

  if (input.interactQueued) {
    input.interactQueued = false;
    const item = nearestInteract();
    if (item) {
      interactItem(game, item);
      if (mode === "dialog") markTaught("taughtTalk");
    } else if (state.riding) toast("附近沒有可互動的東西");
  }
  if (input.vehicleQueued) {
    input.vehicleQueued = false;
    toggleVehicle();
  }
  if (lookId != null) lookHold = 0.85;
  else lookHold = Math.max(0, lookHold - dt);
  if (riding && lookId == null) camYaw = dampAngle(camYaw, state.yaw, lookHold > 0 ? 2.6 : 8, dt);
  if (state.stamina <= 0.5 && !stamWarned) {
    stamWarned = true;
    toast("體力用完了，慢慢走會恢復");
  } else if (state.stamina > 30) stamWarned = false;
}

function slideMove(grid, dx, dz, radius) {
  const direct = resolveCircle(grid, state.x + dx, state.z + dz, radius);
  if (!direct.hit) {
    state.x = direct.x;
    state.z = direct.z;
    return;
  }
  const alongX = resolveCircle(grid, state.x + dx, state.z, radius);
  const alongZ = resolveCircle(grid, state.x, state.z + dz, radius);
  const dx1 = alongX.x - state.x;
  const dz1 = alongX.z - state.z;
  const dx2 = alongZ.x - state.x;
  const dz2 = alongZ.z - state.z;
  const pick = dx1 * dx1 + dz1 * dz1 >= dx2 * dx2 + dz2 * dz2 ? alongX : alongZ;
  const nudged = dx1 * dx1 + dz1 * dz1 >= dx2 * dx2 + dz2 * dz2
    ? resolveCircle(grid, pick.x, pick.z + dz, radius)
    : resolveCircle(grid, pick.x + dx, pick.z, radius);
  state.x = nudged.x;
  state.z = nudged.z;
}

function limitWorld(x, z) {
  let nx = x;
  let nz = z;
  if (nz < -170 && nz > -840 && nx > waterEdgeX(nz)) {
    nx = waterEdgeX(nz);
    speedV *= 0.3;
  }
  if (nz <= -840 && nx > waterEdgeX(nz)) nx = waterEdgeX(nz);
  if (nz < -170 && nz > -840) {
    const minX = Math.sin(highwayTFromZ(nz) * Math.PI * 2) * 28 - 30;
    if (nx < minX) nx = minX;
  }
  if (nz > -160) {
    nx = clamp(nx, -185, 175);
    nz = clamp(nz, -165, 208);
  }
  nz = clamp(nz, -1090, 208);
  nx = clamp(nx, -200, 190);
  return { x: nx, z: nz };
}

function toggleVehicle() {
  if (state.inside) { toast("室內沒有車"); return; }
  if (state.riding) {
    const side = 1.5;
    world.parked.push({
      id: "drop-" + Math.random(),
      type: state.riding,
      x: state.x + Math.cos(state.yaw) * side,
      z: state.z - Math.sin(state.yaw) * side,
      yaw: state.yaw,
      tint: state.vehicleTint || [0.8, 0.2, 0.2],
      owned: !state.stolen,
    });
    state.x += Math.cos(state.yaw) * side;
    state.z -= Math.sin(state.yaw) * side;
    state.riding = null;
    state.stolen = false;
    speedV = 0;
    audio.sfx("click");
    return;
  }
  let best = null;
  let bestD = MOUNT_REACH * MOUNT_REACH;
  for (const v of world.parked) {
    const d = dist2(state.x, state.z, v.x, v.z);
    if (d < bestD) { bestD = d; best = v; }
  }
  if (best) {
    mount(best, false);
    return;
  }
  let traffic = null;
  bestD = 3 * 3;
  for (const v of sim.traffic) {
    if (v.speed > 2.5) continue;
    const d = dist2(state.x, state.z, v.x, v.z);
    if (d < bestD) { bestD = d; traffic = v; }
  }
  if (traffic) {
    sim.traffic.splice(sim.traffic.indexOf(traffic), 1);
    mount({ type: traffic.type, x: traffic.x, z: traffic.z, yaw: traffic.yaw, tint: traffic.tint, owned: false }, true);
  } else toast("附近沒有可騎的車");
}

function mount(v, fromTraffic) {
  state.riding = v.type === "car" ? "car" : "scooter";
  state.vehicleTint = v.tint || [0.8, 0.15, 0.12];
  state.stolen = !v.owned;
  state.x = v.x;
  state.z = v.z;
  state.yaw = v.yaw || state.yaw;
  speedV = 0;
  if (!fromTraffic) world.parked = world.parked.filter((p) => p !== v);
  if (!v.owned) {
    addWanted(1);
    toast("這不是你的車");
  } else audio.sfx("click");
}

function nearestInteract() {
  const list = interiorSpots();
  if (!state.inside) {
    const goal = activeGoal();
    if (goal) {
      let goalItem = null;
      let goalSpot = 2.4 * 2.4;
      for (const item of list) {
        if (item.type === "pickup") continue;
        const spot = dist2(item.x, item.z, goal.x, goal.z);
        if (spot < goalSpot) { goalSpot = spot; goalItem = item; }
      }
      if (goalItem && dist2(state.x, state.z, goalItem.x, goalItem.z) <= INTERACT_REACH * INTERACT_REACH) return goalItem;
    }
  }
  let best = null;
  let bestD = INTERACT_REACH * INTERACT_REACH;
  for (const item of list) {
    const d = dist2(state.x, state.z, item.x, item.z);
    if (d < bestD) { bestD = d; best = item; }
  }
  return best;
}
function interiorSpots() {
  if (state.inside === "home") {
    const room = world.interiors.home;
    return [
      { id: "exit", type: "exit", name: "出門", x: room.exit.x, z: room.exit.z },
      { id: "bed", type: "bed", name: "床", x: 1998.4, z: 1999.6 },
    ];
  }
  if (state.inside === "shop") {
    const room = world.interiors.shop;
    return [
      { id: "exit", type: "exit", name: "出門", x: room.exit.x, z: room.exit.z },
      { id: "shop-counter", type: "counter", name: "開始營業", x: room.counter.x, z: room.counter.z },
    ];
  }
  if (state.inside === "jail") {
    return [{ id: "exit", type: "exit", name: "離開派出所", x: world.interiors.jail.exit.x, z: world.interiors.jail.exit.z }];
  }
  return world.interactables;
}

function collisions() {
  if (!state.riding) return;
  for (const ped of sim.peds) {
    if (dist2(state.x, state.z, ped.x, ped.z) < 1.5 * 1.5 && gameSpeed > 7) {
      ped.x += Math.sin(state.yaw) * 1.2;
      ped.z += Math.cos(state.yaw) * 1.2;
      ped.flee = 2;
      if (ped.cool <= 0) {
        ped.cool = 2;
        addWanted(1);
        audio.sfx("yelp");
        toast("撞到路人了");
        shake = 0.35;
        speedV *= 0.4;
      }
    }
  }
  for (const v of sim.traffic) {
    const reach = (state.riding === "car" ? 2.2 : 1.5);
    if (dist2(state.x, state.z, v.x, v.z) < reach * reach && gameSpeed > 4) {
      speedV *= 0.35;
      v.speed *= 0.3;
      shake = 0.3;
    }
  }
  for (const cop of sim.police) {
    if (cop.kind === "foot") continue;
    const reach = 2.3;
    if (dist2(state.x, state.z, cop.x, cop.z) < reach * reach && gameSpeed > 8) {
      speedV *= 0.3;
      cop.speed *= 0.2;
      shake = 0.45;
      addWanted(1);
    }
  }
  for (const block of sim.roadblocks) {
    const dx = state.x - block.x;
    const dz = state.z - block.z;
    const d = Math.hypot(dx, dz);
    const min = state.riding === "car" ? 2.5 : 2.1;
    if (d < min && d > 0.001) {
      state.x = block.x + (dx / d) * min;
      state.z = block.z + (dz / d) * min;
      if (gameSpeed > 5) { speedV *= 0.2; shake = 0.5; toast("路障擋住了"); }
    }
  }
}

function decayWanted(dt) {
  if (state.wanted <= 0) return;
  if (state.time < state.wantedLock) return;
  if (sim.seenPlayer) state.loseSight = 0;
  else state.loseSight = (state.loseSight || 0) + dt;
  if (state.loseSight > 9) {
    state.wanted -= 1;
    state.loseSight = 0;
    if (state.wanted === 0) toast("警察跟丟了");
  }
}

function bust() {
  if (mode !== "playing" || bustLock) return;
  bustLock = true;
  const fine = Math.max(200, Math.round(state.money * 0.12));
  state.money = Math.max(0, state.money - fine);
  state.wanted = 0;
  state.riding = null;
  speedV = 0;
  race = null;
  state.job = null;
  state.time += 6 * 3600;
  audio.sfx("jail");
  fade(() => {
    state.inside = "jail";
    const room = world.interiors.jail;
    state.x = room.spawn.x;
    state.z = room.spawn.z;
    state.yaw = room.spawn.yaw;
    bustLock = false;
    say([
      { name: "值班員警", text: `你被帶回派出所。罰了 ${fine} 元，時間也跳過了六小時。這是卡通化的收場，沒有人受傷。` },
      { name: "值班員警", text: "門可以開。出去之後，星會清掉。" },
    ]);
  });
}

function updateJob(dt) {
  if (!state.job) return;
  state.job.left = Math.max(0, (state.job.deadline - performance.now()) / 1000);
  const d = Math.hypot(state.x - state.job.x, state.z - state.job.z);
  if (d < 3.3) {
    if (state.job.type === "delivery") {
      const pay = 180 + Math.round(state.job.left * 3);
      state.money += pay;
      state.deliveries += 1;
      state.rep += 1;
      const used = 75 - state.job.left;
      if (board.bestDelivery == null || used < board.bestDelivery) board.bestDelivery = used;
      audio.sfx("coin");
      toast(`送到了，入帳 ${pay} 元`);
    } else {
      state.crates += 1;
      state.money += 450;
      state.heat += 1;
      audio.sfx("coin");
      toast(`箱子送到，阿龍給了 450 元（${state.crates}/3）`);
      if (state.crates >= 3 && state.chapter === "under_crate") state.chapter = "under_recruit";
    }
    state.job = null;
    save();
    return;
  }
  if (state.job.left <= 0) {
    toast(state.job.type === "delivery" ? "外送逾時了" : "箱子沒送到");
    audio.sfx("lose");
    state.job = null;
  }
}

function updateRace(dt) {
  if (!race) return;
  const pts = RACE_POINTS;
  const target = pts[Math.min(race.i, pts.length - 1)];
  if (Math.hypot(state.x - target.x, state.z - target.z) < 7) race.i += 1;
  const elapsed = (performance.now() - race.start) / 1000;
  race.opp = elapsed / 46;
  let off = 0;
  for (let i = 0; i < pts.length - 1; i++) {
    const d = pointSegment(state.x, state.z, pts[i], pts[i + 1]);
    off = i === 0 ? d : Math.min(off, d);
  }
  if (off > 28) race.warn += dt;
  else race.warn = Math.max(0, race.warn - dt);
  if (race.i >= pts.length - 1 && race.opp < 1) {
    const time = elapsed;
    state.money += 900;
    board.races.push({ name: "中正路", time });
    board.races.sort((a, b) => a.time - b.time);
    board.races = board.races.slice(0, 5);
    writeBoard(board);
    if (state.chapter === "under_race") state.chapter = "under_tag";
    state.flags.raceWon = true;
    audio.sfx("win");
    toast(`你贏了，${time.toFixed(1)} 秒，獎金 $900`);
    race = null;
    save();
  } else if (race.opp >= 1 || race.warn > 3.2) {
    audio.sfx("lose");
    toast(race.warn > 3 ? "偏離賽道，比賽取消" : "阿志先到終點");
    race = null;
  }
}

function pointSegment(px, pz, a, b) {
  const dx = b.x - a.x;
  const dz = b.z - a.z;
  const l2 = dx * dx + dz * dz || 1;
  let t = ((px - a.x) * dx + (pz - a.z) * dz) / l2;
  t = clamp(t, 0, 1);
  return Math.hypot(px - (a.x + dx * t), pz - (a.z + dz * t));
}

function nearestParked() {
  let best = null;
  let bestD = MOUNT_REACH * MOUNT_REACH;
  for (const v of world.parked) {
    const d = dist2(state.x, state.z, v.x, v.z);
    if (d < bestD) { bestD = d; best = v; }
  }
  return best;
}

function interactPrompt(item) {
  if (item.type === "npc") return `按 E 與${item.name}說話`;
  if (item.type === "door") return `按 E 進入${item.name}`;
  return `按 E ${item.name}`;
}

function currentPlace() {
  if (!state) return "";
  if (state.inside) return state.inside === "jail" ? "派出所裡" : state.inside === "shop" ? "店裡" : "家裡";
  let best = null;
  let bestD = 75 * 75;
  for (const label of world.labels) {
    const d = dist2(state.x, state.z, label.x, label.z);
    if (d < bestD) { bestD = d; best = label; }
  }
  return best ? best.text : "";
}

function markTaught(flag) {
  if (!state.flags || typeof state.flags !== "object") state.flags = {};
  if (state.flags[flag]) return;
  state.flags[flag] = true;
  save();
}

function npcNearby(meters) {
  const reach = meters * meters;
  for (const npc of world.npcs) {
    if (dist2(state.x, state.z, npc.x, npc.z) <= reach) return true;
  }
  return false;
}

function activeTutorial() {
  if (!state || mode !== "playing" || state.inside) return "";
  if (state.riding && !state.flags.taughtRide) return "按住加速，車會跟著車頭往前";
  if (!state.flags.taughtTalk && npcNearby(8)) return "按 E 跟對方說話";
  return "";
}

function toggleClockDebug() {
  clockDebug.enabled = !clockDebug.enabled;
  resetClockDebug();
  $("clock-debug").hidden = !clockDebug.enabled;
}

function resetClockDebug() {
  clockDebug.wall = 0;
  clockDebug.running = 0;
  clockDebug.origin = state ? state.time : null;
}

function readClockDebug() {
  const origin = clockDebug.origin == null ? (state ? state.time : 0) : clockDebug.origin;
  const gameMin = state ? (state.time - origin) / 60 : 0;
  const ratio = gameMin > 0.02 ? clockDebug.running / gameMin : 60 / CLOCK_RATE;
  return {
    wall: clockDebug.wall,
    running: clockDebug.running,
    gameMin,
    ratio,
    theory: 60 / CLOCK_RATE,
    runningClock: clockRunning(),
    mode: moveKind,
    screen: mode,
  };
}

function renderClockDebug() {
  const el = $("clock-debug");
  if (!clockDebug.enabled || !state) { el.hidden = true; return; }
  el.hidden = false;
  const sample = readClockDebug();
  const names = { idle: "站著", walk: "走路", sprint: "衝刺", scooter: "騎車", car: "開車" };
  const screens = { playing: "遊玩", dialog: "對話", map: "大地圖", pause: "暫停", mini: "小遊戲", ending: "結局" };
  el.textContent = [
    "時間偵錯　F3 關閉",
    `現實 ${sample.wall.toFixed(2)} 秒`,
    `遊戲 ${sample.gameMin.toFixed(2)} 分`,
    `時鐘進行 ${sample.running.toFixed(2)} 秒`,
    `比例 ${sample.ratio.toFixed(2)} 秒／遊戲分`,
    `理論 ${sample.theory.toFixed(2)}（每秒 1 分鐘）`,
    `${screens[mode] || mode}・${names[moveKind] || moveKind}・${sample.runningClock ? "時鐘進行" : "時鐘暫停"}`,
  ].join("\n");
}

function drawGoalMarker(goal) {
  const marks = [];
  const push = (x, z, tint) => {
    if (marks.some((m) => Math.hypot(m.x - x, m.z - z) < 2)) return;
    marks.push({ x, z, tint });
  };
  for (const id of ["landlord", "axia"]) {
    const npc = world.npcs.find((n) => n.id === id);
    if (npc) push(npc.x, npc.z, id === "axia" ? [1, 0.45, 0.52] : [1, 0.86, 0.35]);
  }
  const mine = world.parked.find((v) => v.id === "mine");
  if (!state.riding && mine) push(mine.x, mine.z, [1, 0.28, 0.22]);
  if (goal) push(goal.x, goal.z, [1, 0.78, 0.25]);
  for (const mark of marks) {
    const d = Math.hypot(mark.x - state.x, mark.z - state.z);
    const gy = worldGround(mark.x, mark.z);
    if (d > 8 && d < 260) drawProp(renderer, lib.beam, mark.x, gy, mark.z, 0, 1, mark.tint);
    if (goal && Math.hypot(mark.x - goal.x, mark.z - goal.z) < 2 && d < 90) {
      drawProp(renderer, lib.ring, mark.x, gy + 0.08, mark.z, blink * 0.5, 1.15, null);
    }
  }
  if (!state.riding && mine) {
    const scooterDist = Math.hypot(mine.x - state.x, mine.z - state.z);
    if (scooterDist > 2.5 && scooterDist < 90 && !marks.some((m) => m.x === mine.x && Math.hypot(m.x - goal.x, m.z - goal.z) < 2)) {
      drawProp(renderer, lib.ring, mine.x, worldGround(mine.x, mine.z) + 0.08, mine.z, -blink * 0.7, 0.72, [1, 0.28, 0.22]);
    }
  }
}

function viewHitsChunk(chunk) {
  if (!state || state.inside || !world.cameraGrid) return false;
  const eye = camera.eye;
  const target = camera.target;
  const dx = target[0] - eye[0];
  const dy = target[1] - eye[1];
  const dz = target[2] - eye[2];
  const len = Math.hypot(dx, dy, dz) || 1;
  const samples = [eye, [eye[0] + dx / len * 0.9, eye[1] + dy / len * 0.9, eye[2] + dz / len * 0.9]];
  const min = chunk.min;
  const max = chunk.max;
  for (const p of samples) {
    if (!pointBlocked(world.cameraGrid, p[0], p[2], 0.2)) continue;
    if (p[0] < min[0] - 0.5 || p[0] > max[0] + 0.5) continue;
    if (p[1] < min[1] - 1 || p[1] > max[1] + 1) continue;
    if (p[2] < min[2] - 0.5 || p[2] > max[2] + 0.5) continue;
    return true;
  }
  return false;
}

function updateHud() {
  const goal = activeGoal();
  $("money").textContent = formatMoney(state.money);
  $("clock").textContent = formatClock(state.time);
  const stars = "★★★★★".slice(0, state.wanted) + "☆☆☆☆☆".slice(state.wanted);
  $("stars").textContent = stars;
  const showStam = moveKind === "sprint" || state.stamina < 28;
  const stam = $("stam");
  stam.hidden = !showStam;
  if (showStam) {
    $("stam-fill").style.width = `${clamp(state.stamina, 0, 100)}%`;
    stam.classList.toggle("empty", state.stamina <= 8);
    stam.classList.toggle("low", state.stamina > 8 && state.stamina < 28);
    $("stam-label").textContent = state.stamina <= 8 ? "體力用完" : state.stamina < 28 ? "體力不足" : "體力";
  }
  placeText = currentPlace();
  renderClockDebug();
  syncGoalCard(goal);
  renderHint();
  const dx = goal.x - state.x;
  const dz = goal.z - state.z;
  const dist = Math.hypot(dx, dz);
  const fx = Math.sin(camYaw);
  const fz = Math.cos(camYaw);
  const rx = -Math.cos(camYaw);
  const rz = Math.sin(camYaw);
  const ang = wrapAngle(Math.atan2(dx * rx + dz * rz, dx * fx + dz * fz));
  const distText = dist > 999 ? `${Math.round(dist / 100) / 10} km` : `${Math.round(dist)} 公尺`;
  updateGuide(goal, dist, ang, distText);
  const item = nearestInteract();
  updateKeyBadge(item);
  $("btn-interact").classList.toggle("ready", !!(item && mode === "playing"));
  const quest = $("quest-full");
  if (quest) quest.textContent = goal.detail ? `${goal.title}：${goal.detail}` : goal.title;
  drawMinimap();
  if (!$("map").hidden) drawBigMap();
}

function syncGoalCard(goal) {
  const key = `${goal.title}|${Math.round(goal.x)}|${Math.round(goal.z)}`;
  if (key !== goalPopup.key) {
    goalPopup.key = key;
    goalPopup.until = performance.now() + 4500;
    goalPopup.pinned = false;
  }
  goalPopup.expanded = goalPopup.pinned || performance.now() < goalPopup.until;
  $("goal").classList.toggle("expanded", goalPopup.expanded);
  $("goal-title").textContent = goal.title;
  $("goal-sub").textContent = goal.detail || "";
}

function renderHint() {
  const el = $("hint");
  if (!state || mode === "dialog" || mode === "ending" || mode === "pause" || goalPopup.expanded) {
    el.hidden = true;
    return;
  }
  const teach = activeTutorial();
  const text = teach || (toastTimer > 0 ? toastText : "") || placeText;
  el.hidden = !text;
  el.textContent = text || "";
}

function bearingLabel(ang) {
  const deg = ((ang * 180) / Math.PI + 360) % 360;
  if (deg < 22.5 || deg >= 337.5) return "正前方";
  if (deg < 67.5) return "右前方";
  if (deg < 112.5) return "正右方";
  if (deg < 157.5) return "右後方";
  if (deg < 202.5) return "正後方";
  if (deg < 247.5) return "左後方";
  if (deg < 292.5) return "正左方";
  return "左前方";
}

function updateGuide(goal, dist, ang, distText) {
  const el = $("guide");
  const arrow = $("guide-arrow");
  const label = $("guide-dist");
  if (!state || mode !== "playing" || dist < 12) {
    el.hidden = true;
    return;
  }
  const projected = renderer.project(goal.x, worldGround(goal.x, goal.z) + 2.2, goal.z);
  const w = canvas.clientWidth;
  const h = canvas.clientHeight;
  const marginX = w * 0.18;
  const marginY = h * 0.18;
  let onScreen = false;
  if (projected) {
    onScreen = projected.x > marginX && projected.x < w - marginX && projected.y > marginY && projected.y < h - marginY;
  }
  if (onScreen) {
    el.hidden = true;
    return;
  }
  el.hidden = false;
  const halfW = w / 2 - marginX;
  const halfH = h / 2 - marginY;
  const fx = Math.sin(ang);
  const fy = -Math.cos(ang);
  const sx = fx === 0 ? Infinity : halfW / Math.abs(fx);
  const sy = fy === 0 ? Infinity : halfH / Math.abs(fy);
  const t = Math.min(sx, sy);
  const px = w / 2 + fx * t;
  const py = h / 2 + fy * t;
  el.style.transform = `translate(${px}px, ${py}px)`;
  arrow.style.transform = `translate(-50%, -70%) rotate(${ang}rad)`;
  label.textContent = distText;
  label.style.transform = "translate(-50%, 10px)";
}

function updateKeyBadge(item) {
  const el = $("key-badge");
  promptText = "";
  if (!state || mode !== "playing") { el.hidden = true; return; }
  const parked = !state.riding ? nearestParked() : null;
  let focus = null;
  if (item) {
    const d = Math.hypot(item.x - state.x, item.z - state.z);
    focus = { x: item.x, z: item.z, y: 2.45, key: "E", lit: true, name: item.name, kind: item.type, id: item.id, d };
  } else if (parked) {
    const d = Math.hypot(parked.x - state.x, parked.z - state.z);
    focus = { x: parked.x, z: parked.z, y: 1.7, key: "F", lit: d <= MOUNT_REACH, name: parked.id === "mine" ? "紅色機車" : "車", kind: parked.type, id: parked.id, d };
  } else {
    let best = null;
    let bestD = 14 * 14;
    for (const npc of world.npcs) {
      const d = dist2(state.x, state.z, npc.x, npc.z);
      if (d < bestD) { bestD = d; best = npc; }
    }
    if (best) focus = { x: best.x, z: best.z, y: 2.45, key: "E", lit: false, name: best.name, kind: "npc", id: best.id, d: Math.sqrt(bestD) };
  }
  if (!focus) { el.hidden = true; return; }
  const p = renderer.project(focus.x, worldGround(focus.x, focus.z) + focus.y, focus.z);
  if (!p) { el.hidden = true; return; }
  el.hidden = false;
  el.textContent = focus.key;
  el.classList.toggle("lit", !!focus.lit);
  el.dataset.name = focus.name || "";
  el.style.transform = `translate(${p.x}px, ${p.y}px) translate(-50%, -130%)`;
  if (focus.lit && focus.key === "E") promptText = interactPrompt({ type: focus.kind, name: focus.name });
  else if (focus.lit && focus.key === "F") promptText = focus.id === "mine" ? "按 F 騎上紅色機車" : focus.kind === "car" ? "按 F 上車" : "按 F 騎車";
}

function activeGoal() {
  if (race) {
    const p = RACE_POINTS[Math.min(race.i, RACE_POINTS.length - 1)];
    return { title: "街頭賽進行中", detail: `對手 ${Math.min(99, Math.round(race.opp * 100))}%`, x: p.x, z: p.z };
  }
  if (state.job) {
    return {
      title: state.job.type === "crate" ? "把鳳梨酥箱送到" : "外送倒數",
      detail: `剩下 ${Math.ceil(state.job.left)} 秒`,
      x: state.job.x,
      z: state.job.z,
    };
  }
  const g = goalFor(state);
  if (state.chapter === "under_tag") {
    const wall = g;
    return wall;
  }
  return g;
}

function syncTouch() {
  const coarse = window.matchMedia("(pointer: coarse)").matches || window.innerWidth < 900;
  const on = board.showTouch === "on" || (board.showTouch !== "off" && coarse);
  document.body.classList.toggle("playing", mode === "playing" || mode === "dialog" || mode === "mini");
  document.body.classList.toggle("show-touch", on && (mode === "playing" || mode === "dialog" || mode === "mini"));
}

function render() {
  const envBase = skyEnvironment(mode === "title" ? titleTime : (state ? state.time : titleTime));
  const env = { ...envBase, sunDir: envBase.sunDir.slice(), ambient: envBase.ambient.slice() };
  if (state?.inside) {
    env.ambient = [0.55, 0.5, 0.42];
    env.fogDensity = 0.012;
    env.night = Math.min(env.night, 0.25);
  }
  layoutCamera();
  renderer.begin(camera, env);
  prepareFrame();
  if (!state || !state.inside) {
    const cx = camera.eye[0];
    const cz = camera.eye[2];
    for (const piece of world.big) {
      if (!renderer.visible(piece.min, piece.max)) continue;
      renderer.draw(piece.mesh, IDENT);
    }
    const faded = [];
    for (const chunk of world.chunks) {
      const mx = (chunk.min[0] + chunk.max[0]) / 2;
      const mz = (chunk.min[2] + chunk.max[2]) / 2;
      const d = dist2(cx, cz, mx, mz);
      if (d > 230 * 230) continue;
      if (!renderer.visible(chunk.min, chunk.max)) continue;
      if (viewHitsChunk(chunk)) faded.push(chunk);
      else renderer.draw(d > 95 * 95 ? chunk.lod : chunk.mesh, IDENT);
    }
    for (const chunk of faded) renderer.draw(chunk.mesh, IDENT, null, 0.34);
    for (const water of world.water) {
      if (!renderer.visible(water.min, water.max)) continue;
      renderer.drawWater(water.mesh, (state ? state.time : titleTime) * 0.02);
    }
    if (state && mode !== "title") drawActors();
    else drawActorsTitle();
  } else {
    const room = world.interiors[state.inside];
    renderer.draw(room.mesh, IDENT);
    drawPerson(renderer, lib, state.x, state.y, state.z, state.yaw, walkPhase, gameSpeed > 0.2, [0.2, 0.55, 0.85], false);
  }
  if (state && mode !== "title") projectUi();
}

function layoutCamera() {
  if (mode === "title" || !state) {
    const sway = Math.sin(titleTime * 0.015) * 1.1;
    setCamera([sway, 3.4, 124], [sway * 0.08, 4.8, 176], 46 * DEG);
    return;
  }
  const dist = state.inside ? 5.4 : state.riding === "car" ? 10.2 : state.riding ? 8.1 : 6.6;
  const height = state.inside ? 2.5 : state.riding === "car" ? 4.3 : state.riding ? 3.9 : 3.25;
  const desiredX = state.x - Math.sin(camYaw) * dist;
  const desiredZ = state.z - Math.cos(camYaw) * dist;
  let eyeY = state.y + height + Math.sin(blink * 30) * shake;
  const grid = state.inside ? world.interiorGrids[state.inside] : (world.cameraGrid || world.grid);
  const steps = 18;
  let clear = 1;
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    const x = state.x + (desiredX - state.x) * t;
    const z = state.z + (desiredZ - state.z) * t;
    if (pointBlocked(grid, x, z, 0.42)) {
      clear = Math.max(0.16, (i - 2) / steps);
      break;
    }
  }
  let eyeX = state.x + (desiredX - state.x) * clear;
  let eyeZ = state.z + (desiredZ - state.z) * clear;
  if (clear < 0.78) eyeY += (0.78 - clear) * 4.2;
  const dx = state.x - eyeX;
  const dz = state.z - eyeZ;
  const len = Math.hypot(dx, dz) || 1;
  if (pointBlocked(grid, eyeX + (dx / len) * 0.85, eyeZ + (dz / len) * 0.85, 0.3)) {
    clear = Math.max(0.14, clear - 0.18);
    eyeX = state.x + (desiredX - state.x) * clear;
    eyeZ = state.z + (desiredZ - state.z) * clear;
    eyeY += 1.4;
  }
  setCamera([eyeX, eyeY, eyeZ], [state.x, state.y + 1.2, state.z], (state.riding ? 62 : 58) * DEG);
}

function setCamera(eye, target, fov) {
  camera.eye = eye;
  camera.target = target;
  camera.fov = fov;
  const fx = target[0] - eye[0];
  const fy = target[1] - eye[1];
  const fz = target[2] - eye[2];
  const fl = Math.hypot(fx, fy, fz) || 1;
  camera.forward = [fx / fl, fy / fl, fz / fl];
  const rx = camera.forward[2];
  const rz = -camera.forward[0];
  const rl = Math.hypot(rx, rz) || 1;
  camera.right = [rx / rl, 0, rz / rl];
  const ux = camera.right[1] * camera.forward[2] - camera.right[2] * camera.forward[1];
  const uy = camera.right[2] * camera.forward[0] - camera.right[0] * camera.forward[2];
  const uz = camera.right[0] * camera.forward[1] - camera.right[1] * camera.forward[0];
  camera.up = [ux, uy, uz];
}

function drawActors() {
  const px = state.x;
  const pz = state.z;
  for (const v of world.parked) {
    if (dist2(px, pz, v.x, v.z) > 120 * 120) continue;
    const y = worldGround(v.x, v.z);
    if (v.type === "car") drawCar(renderer, lib, v.x, y, v.z, v.yaw, 0, v.tint, false, 0);
    else drawScooter(renderer, lib, v.x, y, v.z, v.yaw, 0, 0, v.tint);
  }
  for (const v of sim.traffic) {
    if (dist2(px, pz, v.x, v.z) > 140 * 140) continue;
    const y = worldGround(v.x, v.z);
    if (v.type === "car") drawCar(renderer, lib, v.x, y, v.z, v.yaw, v.phase, v.tint, false, 0);
    else drawScooter(renderer, lib, v.x, y, v.z, v.yaw, 0, v.phase, v.tint);
  }
  for (const ped of sim.peds) {
    if (dist2(px, pz, ped.x, ped.z) > 80 * 80) continue;
    const y = worldGround(ped.x, ped.z);
    if (dist2(px, pz, ped.x, ped.z) > 28 * 28) drawProp(renderer, lib.person, ped.x, y, ped.z, ped.yaw, 1, ped.tint);
    else drawPerson(renderer, lib, ped.x, y, ped.z, ped.yaw, ped.phase, ped.speed > 0.2, ped.tint, false);
  }
  for (const npc of world.npcs) {
    if (dist2(px, pz, npc.x, npc.z) > 90 * 90) continue;
    drawPerson(renderer, lib, npc.x, worldGround(npc.x, npc.z), npc.z, Math.atan2(px - npc.x, pz - npc.z), blink, false, npc.tint, false);
  }
  for (const cop of sim.police) {
    const y = worldGround(cop.x, cop.z);
    if (cop.kind === "foot") drawPerson(renderer, lib, cop.x, y, cop.z, cop.yaw, cop.phase, true, cop.tint, true);
    else if (cop.kind === "car") drawCar(renderer, lib, cop.x, y, cop.z, cop.yaw, cop.phase, [1, 1, 1], true, Math.sin(blink * 12));
    else drawScooter(renderer, lib, cop.x, y, cop.z, cop.yaw, 0, cop.phase, [0.9, 0.92, 0.96]);
  }
  for (const block of sim.roadblocks) {
    drawCar(renderer, lib, block.x, worldGround(block.x, block.z), block.z, block.yaw, 0, [1, 1, 1], true, Math.sin(blink * 12));
  }
  if (sim.heli) drawHeli(renderer, lib, sim.heli.x, sim.heli.y, sim.heli.z, sim.heli.yaw, sim.heli.spin);
  if (festivalState(state.time).parade && state.z > -220) {
    drawProp(renderer, lib.boat, 0, worldGround(0, sim.paradeZ), sim.paradeZ, 0, 1, null);
  }
  if (state.riding === "car") drawCar(renderer, lib, state.x, state.y, state.z, state.yaw, wheelSpin, state.vehicleTint || [0.2, 0.4, 0.8], false, 0);
  else if (state.riding === "scooter") {
    drawScooter(renderer, lib, state.x, state.y, state.z, state.yaw, lean, wheelSpin, state.vehicleTint || [0.82, 0.16, 0.14]);
    drawRider(renderer, lib, state.x, state.y, state.z, state.yaw, [0.2, 0.55, 0.85]);
  } else drawPerson(renderer, lib, state.x, state.y, state.z, state.yaw, walkPhase, gameSpeed > 0.2, [0.2, 0.55, 0.85], false);
  for (const item of world.interactables) {
    if (item.type !== "npc" || world.npcs.some((n) => n.id === item.id)) continue;
    if (dist2(px, pz, item.x, item.z) > 80 * 80) continue;
    drawPerson(renderer, lib, item.x, worldGround(item.x, item.z), item.z, Math.atan2(px - item.x, pz - item.z), blink, false, item.tint || [0.4, 0.55, 0.8], false);
  }
  if (state.job?.type === "crate" || (state.chapter || "").startsWith("under_crate")) {
    if (state.job?.type === "crate") drawProp(renderer, lib.crate, state.x, state.y + 1.1, state.z, state.yaw, 1, null);
  }
  drawGoalMarker(activeGoal());
  if (race) {
    const p = RACE_POINTS[Math.min(race.i, RACE_POINTS.length - 1)];
    drawProp(renderer, lib.arch, p.x, worldGround(p.x, p.z), p.z, 0, 1, null);
  }
}

function drawActorsTitle() {
  drawPerson(renderer, lib, 6, 0, 160, 2.4, blink, false, [0.8, 0.3, 0.25], false);
  drawScooter(renderer, lib, -6, 0, 158, 0.4, 0, blink, [0.8, 0.16, 0.14]);
}

function projectUi() {
  const spots = [];
  for (const npc of world.npcs) {
    if (dist2(state.x, state.z, npc.x, npc.z) < 18 * 18) spots.push({ text: npc.name, x: npc.x, y: 2.15, z: npc.z });
  }
  for (const item of world.interactables) {
    if (item.type !== "npc" || world.npcs.some((n) => n.id === item.id)) continue;
    if (dist2(state.x, state.z, item.x, item.z) < 18 * 18) spots.push({ text: item.name, x: item.x, y: 2.15, z: item.z });
  }
  placeLayer($("labels"), "world-label", spots);
  const barks = sim.barks.map((b) => ({ text: b.text, x: b.x, y: b.y, z: b.z }));
  placeLayer($("bubbles"), "bark", barks);
}
function placeLayer(root, className, list) {
  while (root.children.length < list.length) {
    const el = document.createElement("div");
    el.className = className;
    root.appendChild(el);
  }
  for (let i = 0; i < root.children.length; i++) {
    const el = root.children[i];
    const item = list[i];
    if (!item) { el.hidden = true; continue; }
    const p = renderer.project(item.x, item.y, item.z);
    const topCut = Math.max(64, canvas.clientHeight * 0.16);
    const botCut = canvas.clientHeight * 0.8;
    if (!p || p.y < topCut || p.y > botCut) { el.hidden = true; continue; }
    el.hidden = false;
    el.textContent = item.text;
    el.style.transform = `translate(${p.x}px, ${p.y}px) translate(-50%, -120%)`;
  }
}

function drawMinimap() {
  const c = $("minimap");
  const ctx = c.getContext("2d");
  const w = c.width;
  const h = c.height;
  ctx.clearRect(0, 0, w, h);
  ctx.save();
  ctx.beginPath();
  ctx.arc(w / 2, h / 2, w / 2 - 2, 0, Math.PI * 2);
  ctx.clip();
  ctx.fillStyle = "#17202b";
  ctx.fillRect(0, 0, w, h);
  if (state.inside) {
    ctx.fillStyle = "#f6f1e7";
    ctx.font = "16px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(state.inside === "jail" ? "派出所" : state.inside === "shop" ? "店內" : "家裡", w / 2, h / 2);
    ctx.restore();
    return;
  }
  ctx.translate(w / 2, h / 2);
  ctx.rotate(-state.yaw);
  const scale = 1.15;
  ctx.lineWidth = 4;
  ctx.strokeStyle = "#5c6b7d";
  for (const s of world.roadSegs) {
    const mx = (s.x0 + s.x1) / 2;
    const mz = (s.z0 + s.z1) / 2;
    if (dist2(state.x, state.z, mx, mz) > 170 * 170) continue;
    ctx.beginPath();
    ctx.moveTo((s.x0 - state.x) * scale, -(s.z0 - state.z) * scale);
    ctx.lineTo((s.x1 - state.x) * scale, -(s.z1 - state.z) * scale);
    ctx.stroke();
  }
  const goal = activeGoal();
  const blip = (x, z, color, r) => {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc((x - state.x) * scale, -(z - state.z) * scale, r, 0, Math.PI * 2);
    ctx.fill();
  };
  for (const id of ["landlord", "axia"]) {
    const npc = world.npcs.find((n) => n.id === id);
    if (npc) blip(npc.x, npc.z, id === "axia" ? "#ff8aa0" : "#ffe08a", 4);
  }
  ctx.fillStyle = "#ffb703";
  ctx.fillRect((goal.x - state.x) * scale - 3, -(goal.z - state.z) * scale - 3, 6, 6);
  ctx.fillStyle = "#ff4b4b";
  for (const v of world.parked) {
    if (v.id !== "mine") continue;
    ctx.beginPath();
    ctx.arc((v.x - state.x) * scale, -(v.z - state.z) * scale, 5, 0, Math.PI * 2);
    ctx.fill();
  }
  if (state.wanted > 0) {
    ctx.fillStyle = "#ff5a5a";
    for (const cop of sim.police) ctx.fillRect((cop.x - state.x) * scale - 2, -(cop.z - state.z) * scale - 2, 4, 4);
  }
  ctx.restore();
  ctx.fillStyle = "#fff6df";
  ctx.beginPath();
  ctx.moveTo(w / 2, h / 2 - 8);
  ctx.lineTo(w / 2 - 6, h / 2 + 7);
  ctx.lineTo(w / 2 + 6, h / 2 + 7);
  ctx.fill();
}

function drawBigMap() {
  const c = $("map-canvas");
  const ctx = c.getContext("2d");
  const w = c.width;
  const h = c.height;
  const region = mapRegion === "kenting"
    ? { minX: -80, maxX: 140, minZ: -1100, maxZ: -820, name: "墾丁" }
    : { minX: -180, maxX: 180, minZ: -180, maxZ: 210, name: "屏東市" };
  ctx.fillStyle = "#14202b";
  ctx.fillRect(0, 0, w, h);
  const sx = w / (region.maxX - region.minX);
  const sy = h / (region.maxZ - region.minZ);
  const scale = Math.min(sx, sy) * 0.92;
  const ox = w / 2 - ((region.minX + region.maxX) / 2) * scale;
  const oy = h / 2 + ((region.minZ + region.maxZ) / 2) * scale;
  const X = (x) => ox + x * scale;
  const Y = (z) => oy - z * scale;
  ctx.strokeStyle = "#6d7d90";
  ctx.lineWidth = 4;
  for (const s of world.roadSegs) {
    if (s.x0 < region.minX - 20 && s.x1 < region.minX - 20) continue;
    ctx.beginPath();
    ctx.moveTo(X(s.x0), Y(s.z0));
    ctx.lineTo(X(s.x1), Y(s.z1));
    ctx.stroke();
  }
  // 地圖在橫式會縮得很小，字級跟著實際顯示寬度放大，螢幕上至少約 12px
  const px = Math.max(1, w / Math.max(1, c.clientWidth || w));
  const labelFont = Math.round(Math.max(20, 12 * px));
  ctx.fillStyle = "#ffb703";
  ctx.font = `${labelFont}px sans-serif`;
  for (const label of world.labels) {
    if (label.x < region.minX || label.x > region.maxX || label.z < region.minZ || label.z > region.maxZ) continue;
    ctx.fillText(label.text, X(label.x) + 4, Y(label.z));
  }
  const goal = activeGoal();
  ctx.fillStyle = "#7dffa8";
  ctx.fillRect(X(goal.x) - 4, Y(goal.z) - 4, 8, 8);
  for (const id of ["landlord", "axia"]) {
    const npc = world.npcs.find((n) => n.id === id);
    if (!npc) continue;
    ctx.fillStyle = id === "axia" ? "#ff8aa0" : "#ffe08a";
    ctx.beginPath();
    ctx.arc(X(npc.x), Y(npc.z), 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillText(npc.name, X(npc.x) + 8, Y(npc.z) - 6);
  }
  ctx.fillStyle = "#ff4b4b";
  ctx.font = `${Math.round(labelFont * 0.9)}px sans-serif`;
  for (const v of world.parked) {
    if (v.id !== "mine") continue;
    if (v.x < region.minX || v.x > region.maxX || v.z < region.minZ || v.z > region.maxZ) continue;
    ctx.beginPath();
    ctx.arc(X(v.x), Y(v.z), 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillText("紅色機車", X(v.x) + 10, Y(v.z) - 8);
  }
  ctx.fillStyle = "#fff";
  ctx.beginPath();
  ctx.arc(X(state.x), Y(state.z), 6, 0, Math.PI * 2);
  ctx.fill();
}

boot();
