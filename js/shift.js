// Game clock and calendar. Time never scales with vehicle speed.
// One real second advances CLOCK_RATE game-seconds (60 = one game minute).

export const CLOCK_RATE = 60;

export function defaultTime() {
  return 9 * 3600;
}

export function clockParts(time) {
  const safe = Number.isFinite(time) ? Math.max(0, time) : 0;
  const day = Math.floor(safe / 86400) + 1;
  const tod = safe % 86400;
  const hour = tod / 3600;
  const hh = Math.floor(hour);
  const mm = Math.floor((tod % 3600) / 60);
  return { day, hour, hh, mm, tod };
}

export function formatClock(time) {
  const { day, hh, mm } = clockParts(time);
  const h = String(hh).padStart(2, "0");
  const m = String(mm).padStart(2, "0");
  return `第${day}天 ${h}:${m}`;
}

export function formatMoney(n) {
  const v = Math.max(0, Math.round(Number(n) || 0));
  return "$" + v.toLocaleString("zh-Hant-TW");
}

export function nightFactor(hour) {
  if (hour >= 19.5 || hour < 5) return 1;
  if (hour >= 17 && hour < 19.5) return (hour - 17) / 2.5;
  if (hour >= 5 && hour < 7) return 1 - (hour - 5) / 2;
  return 0;
}

function mix(a, b, t) {
  return [
    a[0] + (b[0] - a[0]) * t,
    a[1] + (b[1] - a[1]) * t,
    a[2] + (b[2] - a[2]) * t,
  ];
}

function smoothstep(a, b, x) {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

// Keyframes: night, dawn, day, dusk.
const SKY = {
  nightTop: [0.02, 0.04, 0.1],
  nightHor: [0.1, 0.12, 0.22],
  dawnTop: [0.28, 0.38, 0.62],
  dawnHor: [0.95, 0.55, 0.32],
  dayTop: [0.34, 0.62, 0.92],
  dayHor: [0.72, 0.86, 0.98],
  duskTop: [0.22, 0.22, 0.45],
  duskHor: [0.93, 0.42, 0.28],
};

export function skyEnvironment(time) {
  const { hour } = clockParts(time);
  const night = nightFactor(hour);
  const dawn = hour >= 5 && hour < 8 ? smoothstep(5, 6.2, hour) * (1 - smoothstep(7, 8, hour)) : 0;
  const dusk = hour >= 16.5 && hour < 19.8 ? smoothstep(16.5, 17.6, hour) * (1 - smoothstep(18.8, 19.8, hour)) : 0;
  const dayT = 1 - night;

  let skyTop = mix(SKY.nightTop, SKY.dayTop, dayT);
  let skyHorizon = mix(SKY.nightHor, SKY.dayHor, dayT);
  skyTop = mix(skyTop, SKY.dawnTop, dawn * 0.85);
  skyHorizon = mix(skyHorizon, SKY.dawnHor, dawn);
  skyTop = mix(skyTop, SKY.duskTop, dusk * 0.9);
  skyHorizon = mix(skyHorizon, SKY.duskHor, dusk);

  const ang = ((hour - 6) / 12) * Math.PI;
  let sunY = Math.sin(ang);
  const sunX = Math.cos(ang);
  if (sunY < 0.08) sunY = 0.08;
  const sunDir = normalize([sunX, sunY, 0.15]);

  const sunDay = [1.0, 0.94, 0.82];
  const sunDawn = [1.0, 0.62, 0.32];
  const sunNight = [0.35, 0.42, 0.62];
  let sunColor = mix(sunNight, sunDay, dayT);
  sunColor = mix(sunColor, sunDawn, Math.max(dawn, dusk));
  const sunAmt = 0.22 + dayT * 0.85;
  sunColor = sunColor.map((c) => c * sunAmt);

  const ambient = mix([0.08, 0.1, 0.16], [0.36, 0.34, 0.3], dayT);
  const fogColor = mix(skyHorizon, mix(skyHorizon, [0.62, 0.58, 0.5], 0.2), 0.25);
  const fogDensity = 0.0036 + night * 0.0028;

  return {
    hour,
    night,
    sunDir,
    sunColor,
    ambient,
    fogColor,
    fogDensity,
    skyTop,
    skyHorizon,
  };
}

function normalize(v) {
  const l = Math.hypot(v[0], v[1], v[2]) || 1;
  return [v[0] / l, v[1] / l, v[2] / l];
}

export function festivalState(time) {
  const { day, hour } = clockParts(time);
  return {
    day,
    hour,
    // Stylized so players can actually catch them: tuna season the first week,
    // and a respectful evening parade every night.
    tuna: day <= 6,
    parade: hour >= 18.5 && hour <= 22,
    marketOpen: hour >= 17 || hour < 1,
  };
}

export function advanceClock(state, dt) {
  // Intentionally ignores speed, vehicle, and framerate spikes beyond the caller cap.
  state.time += dt * CLOCK_RATE;
}

export function skipHours(state, hours) {
  state.time += hours * 3600;
}

export function skipToHour(state, hour) {
  const { hh, mm } = clockParts(state.time);
  const now = hh + mm / 60;
  let delta = hour - now;
  if (delta <= 0.05) delta += 24;
  skipHours(state, delta);
}
