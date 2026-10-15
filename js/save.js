// localStorage keys stay stable. Unknown future fields are kept.
// Older flat saves (cash / pos / hour / stars) are migrated into v1.

import { defaultTime } from "./shift.js";

export const SAVE_KEY = "pingtung-life-save-v1";
export const BOARD_KEY = "pingtung-life-board-v1";

export const CHAPTERS = [
  "intro",
  "findjob",
  "choice",
  "honest_work",
  "honest_delivery",
  "honest_shop",
  "honest_open",
  "honest_festival",
  "honest_end",
  "under_race",
  "under_tag",
  "under_crate",
  "under_recruit",
  "under_heat",
  "under_end",
  "free",
];

export function defaultState() {
  return {
    v: 1,
    money: 1600,
    time: defaultTime(),
    stamina: 100,
    wanted: 0,
    x: 0,
    y: 0,
    z: 148,
    yaw: Math.PI,
    riding: null,
    vehicleTint: null,
    stolen: false,
    inside: null,
    chapter: "intro",
    path: null,
    flags: {},
    tags: [],
    deliveries: 0,
    shifts: 0,
    crates: 0,
    crew: 0,
    shopOwned: false,
    rep: 0,
    heat: 0,
    kentingVisited: false,
    endingsSeen: [],
    rainUntil: 0,
    wantedLock: 0,
    job: null,
  };
}

export function defaultBoard() {
  return {
    v: 1,
    music: 0.75,
    sfx: 0.85,
    mute: false,
    showTouch: "auto",
    uiScale: 1,
    endings: [],
    races: [],
    bestDelivery: null,
    shifts: 0,
    rep: 0,
    heat: 0,
  };
}

function num(value, min, max, fallback) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

export function migrateSave(raw) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const d = defaultState();
  const src = { ...raw };

  if (src.money == null && src.cash != null) src.money = src.cash;
  if (src.money == null && src.dollars != null) src.money = src.dollars;
  if (src.wanted == null && src.stars != null) src.wanted = src.stars;
  if (src.time == null && typeof src.hour === "number") src.time = src.hour * 3600;
  if (src.time == null && src.gameTime != null) src.time = src.gameTime;
  if (Array.isArray(src.pos)) {
    src.x = src.pos[0];
    src.y = src.pos[1] || 0;
    src.z = src.pos[2];
  }
  if (src.position && typeof src.position === "object") {
    if (src.x == null) src.x = src.position.x;
    if (src.y == null) src.y = src.position.y || 0;
    if (src.z == null) src.z = src.position.z;
  }
  if (src.chapter == null && typeof src.mission === "string") src.chapter = src.mission;
  if (src.path == null && src.route != null) {
    src.path = src.route === "crime" || src.route === "underworld" ? "under" : src.route;
  }
  if (src.riding && typeof src.riding === "object") {
    src.vehicleTint = src.riding.tint || src.vehicleTint || null;
    src.stolen = !!src.riding.stolen;
    src.riding = src.riding.type === "car" ? "car" : "scooter";
  }

  const out = { ...d, ...src, v: 1 };
  out.money = num(out.money, 0, 1e9, d.money);
  out.time = num(out.time, 0, 1e12, d.time);
  out.stamina = num(out.stamina, 0, 100, 100);
  out.wanted = Math.round(num(out.wanted, 0, 5, 0));
  out.x = num(out.x, -8000, 8000, d.x);
  out.y = num(out.y, -20, 80, 0);
  out.z = num(out.z, -8000, 8000, d.z);
  out.yaw = num(out.yaw, -100, 100, d.yaw);
  out.deliveries = Math.round(num(out.deliveries, 0, 9999, 0));
  out.shifts = Math.round(num(out.shifts, 0, 9999, 0));
  out.crates = Math.round(num(out.crates, 0, 99, 0));
  out.crew = Math.round(num(out.crew, 0, 99, 0));
  out.rep = Math.round(num(out.rep, 0, 99999, 0));
  out.heat = Math.round(num(out.heat, 0, 99999, 0));
  out.rainUntil = num(out.rainUntil, 0, 1e12, 0);
  out.wantedLock = num(out.wantedLock, 0, 1e12, 0);
  out.shopOwned = !!out.shopOwned;
  out.stolen = !!out.stolen;
  out.kentingVisited = !!out.kentingVisited;

  if (!out.flags || typeof out.flags !== "object" || Array.isArray(out.flags)) out.flags = {};
  if (!Array.isArray(out.tags)) out.tags = [];
  out.tags = out.tags.filter((t) => typeof t === "string").slice(0, 12);
  if (!Array.isArray(out.endingsSeen)) out.endingsSeen = [];
  if (!CHAPTERS.includes(out.chapter)) out.chapter = "intro";
  if (out.path !== "honest" && out.path !== "under") out.path = null;
  if (out.inside !== "home" && out.inside !== "jail" && out.inside !== "shop") out.inside = null;
  if (out.riding !== "scooter" && out.riding !== "car") out.riding = null;
  if (!Array.isArray(out.vehicleTint) || out.vehicleTint.length < 3) out.vehicleTint = null;

  if (out.job && typeof out.job === "object") {
    const left = num(out.job.left, 0, 600, 0);
    const x = num(out.job.x, -8000, 8000, 0);
    const z = num(out.job.z, -8000, 8000, 0);
    const phase = out.job.phase === "drop" ? "drop" : "pickup";
    if (left <= 0 || (out.job.type !== "delivery" && out.job.type !== "crate")) out.job = null;
    else out.job = { type: out.job.type, phase, x, z, left };
  } else out.job = null;

  out.v = 1;
  return out;
}

export function migrateBoard(raw) {
  const d = defaultBoard();
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return { ...d, endings: [], races: [] };
  const src = { ...raw };
  if (src.music == null && src.volume != null) src.music = src.volume;
  const out = { ...d, ...src, v: 1 };
  out.music = num(out.music, 0, 1, d.music);
  out.sfx = num(out.sfx, 0, 1, d.sfx);
  out.mute = !!out.mute;
  if (out.showTouch !== "on" && out.showTouch !== "off") out.showTouch = "auto";
  out.uiScale = num(out.uiScale, 0.8, 1.3, 1);
  if (!Array.isArray(out.endings)) out.endings = [];
  out.endings = out.endings.filter((e) => e === "honest" || e === "under");
  if (!Array.isArray(out.races)) out.races = [];
  out.races = out.races
    .filter((r) => r && typeof r === "object" && Number.isFinite(Number(r.time)))
    .map((r) => ({ name: String(r.name || "中正路"), time: num(r.time, 0, 3600, 0) }))
    .slice(0, 8);
  out.bestDelivery = out.bestDelivery == null ? null : num(out.bestDelivery, 0, 600, null);
  out.shifts = Math.round(num(out.shifts, 0, 99999, 0));
  out.rep = Math.round(num(out.rep, 0, 99999, 0));
  out.heat = Math.round(num(out.heat, 0, 99999, 0));
  out.v = 1;
  return out;
}

function storage() {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export function readSave() {
  const s = storage();
  if (!s) return null;
  try {
    const raw = JSON.parse(s.getItem(SAVE_KEY) || "null");
    if (!raw) return null;
    return migrateSave(raw);
  } catch {
    return null;
  }
}

export function writeSave(state) {
  const s = storage();
  if (!s) return false;
  try {
    const data = migrateSave(state);
    if (!data) return false;
    s.setItem(SAVE_KEY, JSON.stringify(data));
    return true;
  } catch {
    return false;
  }
}

export function readBoard() {
  const s = storage();
  if (!s) return defaultBoard();
  try {
    const raw = JSON.parse(s.getItem(BOARD_KEY) || "null");
    return migrateBoard(raw);
  } catch {
    return defaultBoard();
  }
}

export function writeBoard(board) {
  const s = storage();
  if (!s) return false;
  try {
    s.setItem(BOARD_KEY, JSON.stringify(migrateBoard(board)));
    return true;
  } catch {
    return false;
  }
}

export function hasSave() {
  return !!readSave();
}
