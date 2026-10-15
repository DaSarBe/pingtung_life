// 人物模型：卡通比例、部位上色、走路到騎車的關節動畫，遠處用同一批簡模。
import { MeshBuilder, compose, mulberry32, multiply } from "./engine.js";
import { RIDE, chamferBox, ellipsoid, rideGrips, tube } from "./models-vehicles.js";

const WHITE = [1, 1, 1];
const HIP = 0.9;
const THIGH = 0.42;
const SHIN = 0.4;
const SHOE_H = 0.08;
const NECK = 0.46;
const SHOULDER = 0.4;
const UPPER = 0.3;
const FORE = 0.26;
const SKINS = [
  [0.96, 0.83, 0.72],
  [0.9, 0.72, 0.56],
  [0.78, 0.58, 0.42],
  [0.62, 0.44, 0.32],
  [0.45, 0.31, 0.24],
  [0.33, 0.23, 0.18],
];
const HAIRS = [
  [0.1, 0.08, 0.07],
  [0.22, 0.13, 0.09],
  [0.45, 0.26, 0.14],
  [0.62, 0.4, 0.2],
  [0.86, 0.72, 0.42],
  [0.62, 0.62, 0.64],
  [0.16, 0.12, 0.2],
];
const PANTS = [
  [0.18, 0.24, 0.38],
  [0.2, 0.22, 0.26],
  [0.4, 0.34, 0.28],
  [0.16, 0.32, 0.46],
  [0.42, 0.16, 0.18],
  [0.82, 0.8, 0.76],
];
const SHOES = [
  [0.16, 0.14, 0.13],
  [0.9, 0.9, 0.92],
  [0.72, 0.18, 0.16],
  [0.18, 0.28, 0.58],
  [0.92, 0.74, 0.22],
];
const STYLES = ["short", "side", "bob", "pony", "bun", "spike"];
const ROLES = {
  aming: { skin: 1, hair: 0, hairStyle: "short", shirt: [0.2, 0.5, 0.84], pants: 0, shoes: 2, outfit: "jacket", sleeves: "long", acc: "none", height: 1 },
  landlord: { skin: 2, hair: 5, hairStyle: "side", shirt: [0.72, 0.46, 0.28], pants: 2, shoes: 0, outfit: "pants", sleeves: "short", acc: "glasses", height: 0.94, beard: true, slouch: 0.12 },
  axia: { skin: 1, hair: 1, hairStyle: "bun", shirt: [0.9, 0.32, 0.4], pants: 1, shoes: 0, outfit: "pants", sleeves: "short", acc: "apron", height: 0.97 },
  along: { skin: 2, hair: 0, hairStyle: "spike", shirt: [0.1, 0.1, 0.12], pants: 1, shoes: 0, outfit: "jacket", sleeves: "long", acc: "none", height: 1.06 },
  azhi: { skin: 1, hair: 2, hairStyle: "short", shirt: [0.95, 0.78, 0.18], pants: 0, shoes: 4, outfit: "pants", sleeves: "short", acc: "cap", height: 1 },
  amei: { skin: 0, hair: 1, hairStyle: "bob", shirt: [0.38, 0.66, 0.46], pants: 5, shoes: 1, outfit: "skirt", sleeves: "short", acc: "none", height: 0.96 },
  sushi: { skin: 1, hair: 0, hairStyle: "short", shirt: [0.32, 0.5, 0.82], pants: 0, shoes: 3, outfit: "pants", sleeves: "short", acc: "bag", height: 1 },
  acai: { skin: 3, hair: 2, hairStyle: "side", shirt: [0.62, 0.36, 0.22], pants: 2, shoes: 0, outfit: "pants", sleeves: "short", acc: "none", height: 1.04, beard: true },
  lili: { skin: 0, hair: 3, hairStyle: "pony", shirt: [0.86, 0.45, 0.68], pants: 0, shoes: 2, outfit: "skirt", sleeves: "short", acc: "none", height: 0.94 },
  fisher: { skin: 3, hair: 5, hairStyle: "short", shirt: [0.18, 0.42, 0.55], pants: 1, shoes: 0, outfit: "shorts", sleeves: "short", acc: "cap", height: 1, beard: true },
  vendor: { skin: 2, hair: 5, hairStyle: "side", shirt: [0.55, 0.32, 0.22], pants: 2, shoes: 0, outfit: "pants", sleeves: "short", acc: "apron", height: 0.93, beard: true, slouch: 0.08 },
  police: { skin: 1, hair: 0, hairStyle: "short", shirt: [0.12, 0.22, 0.45], pants: 1, shoes: 0, outfit: "pants", sleeves: "long", acc: "police", height: 1.04 },
  tourist: { skin: 0, hair: 4, hairStyle: "bob", shirt: [0.95, 0.55, 0.22], pants: 5, shoes: 1, outfit: "shorts", sleeves: "short", acc: "hat", height: 1 },
  delivery: { skin: 2, hair: 0, hairStyle: "short", shirt: [0.22, 0.24, 0.28], pants: 1, shoes: 0, outfit: "pants", sleeves: "short", acc: "delivery", height: 1.02 },
};

function mesh(renderer, build) {
  const b = new MeshBuilder();
  build(b);
  return renderer.createMesh(b);
}

function limb(b, len, sx, sz, color, tint, extra = 0.03) {
  chamferBox(b, 0, (extra - len) / 2, 0, sx, len + extra, sz, Math.min(0.02, sx * 0.3), color, 0, tint);
}

function hairShell(b, rx, ry, rz, y, z, mask) {
  const slices = 10;
  const stacks = 7;
  const grid = [];
  for (let i = 0; i <= stacks; i++) {
    const phi = (i / stacks) * Math.PI;
    const row = [];
    for (let j = 0; j <= slices; j++) {
      const theta = (j / slices) * Math.PI * 2;
      const nx = Math.sin(phi) * Math.cos(theta);
      const ny = Math.cos(phi);
      const nz = Math.sin(phi) * Math.sin(theta);
      row.push([nx * rx, y + ny * ry, z + nz * rz, nx, ny, nz]);
    }
    grid.push(row);
  }
  for (let i = 0; i < stacks; i++) {
    for (let j = 0; j < slices; j++) {
      const pts = [grid[i][j], grid[i + 1][j], grid[i + 1][j + 1], grid[i][j + 1]];
      const ny = (pts[0][4] + pts[1][4] + pts[2][4] + pts[3][4]) / 4;
      const nz = (pts[0][5] + pts[1][5] + pts[2][5] + pts[3][5]) / 4;
      if (mask && !mask(ny, nz)) continue;
      const base = b.pos.length / 3;
      for (const v of pts) {
        const k = 0.72 + 0.28 * (v[4] * 0.5 + 0.5);
        b.vert(v[0], v[1], v[2], v[3], v[4], v[5], k, k, k, 0, 1);
      }
      b.idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
    }
  }
}

function buildHead(b) {
  ellipsoid(b, 0, 0.17, 0, 0.158, 0.186, 0.16, 12, 8, WHITE, 0, 1);
  ellipsoid(b, -0.158, 0.16, -0.01, 0.04, 0.055, 0.032, 6, 4, WHITE, 0, 1);
  ellipsoid(b, 0.158, 0.16, -0.01, 0.04, 0.055, 0.032, 6, 4, WHITE, 0, 1);
  ellipsoid(b, 0, 0.145, 0.15, 0.03, 0.042, 0.04, 6, 4, WHITE, 0, 1);
  tube(b, 0, 0.02, 0, 0.07, 0.08, 8, WHITE, 0, 1, "y");
}

function buildFace(b) {
  ellipsoid(b, -0.055, 0.185, 0.145, 0.03, 0.032, 0.02, 7, 5, [0.96, 0.96, 0.97], 0, 0);
  ellipsoid(b, 0.055, 0.185, 0.145, 0.03, 0.032, 0.02, 7, 5, [0.96, 0.96, 0.97], 0, 0);
  ellipsoid(b, -0.055, 0.182, 0.164, 0.014, 0.016, 0.01, 6, 4, [0.08, 0.07, 0.07], 0, 0);
  ellipsoid(b, 0.055, 0.182, 0.164, 0.014, 0.016, 0.01, 6, 4, [0.08, 0.07, 0.07], 0, 0);
  ellipsoid(b, -0.048, 0.19, 0.172, 0.006, 0.006, 0.004, 4, 3, [1, 1, 1], 0, 0);
  ellipsoid(b, 0.062, 0.19, 0.172, 0.006, 0.006, 0.004, 4, 3, [1, 1, 1], 0, 0);
  chamferBox(b, -0.055, 0.228, 0.145, 0.055, 0.014, 0.02, 0.004, WHITE, 0, 1);
  chamferBox(b, 0.055, 0.228, 0.145, 0.055, 0.014, 0.02, 0.004, WHITE, 0, 1);
  chamferBox(b, 0, 0.1, 0.162, 0.07, 0.016, 0.018, 0.004, [0.58, 0.3, 0.32], 0, 0);
}

function buildHair(style) {
  return (b) => {
    if (style === "short" || style === "side" || style === "pony" || style === "bun" || style === "spike") {
      hairShell(b, 0.175, 0.2, 0.175, 0.185, -0.01, (ny, nz) => ny > 0.05 || nz < 0.05);
    }
    if (style === "side") chamferBox(b, 0.06, 0.22, 0.12, 0.12, 0.04, 0.08, 0.012, WHITE, 0, 1);
    if (style === "bob") hairShell(b, 0.185, 0.21, 0.18, 0.16, -0.01, (ny, nz) => ny > -0.35 && (nz < 0.35 || ny > 0.35));
    if (style === "pony") {
      tube(b, 0, 0.02, -0.16, 0.045, 0.28, 6, WHITE, 0, 1, "y");
      ellipsoid(b, 0, -0.12, -0.16, 0.06, 0.07, 0.06, 6, 4, WHITE, 0, 1);
    }
    if (style === "bun") ellipsoid(b, 0, 0.34, -0.04, 0.08, 0.07, 0.08, 7, 5, WHITE, 0, 1);
    if (style === "spike") {
      ellipsoid(b, -0.06, 0.36, 0.02, 0.04, 0.09, 0.04, 5, 4, WHITE, 0, 1);
      ellipsoid(b, 0.05, 0.38, -0.02, 0.035, 0.1, 0.035, 5, 4, WHITE, 0, 1);
      ellipsoid(b, 0, 0.34, 0.06, 0.035, 0.08, 0.035, 5, 4, WHITE, 0, 1);
    }
  };
}

export function createCharacterLib(renderer) {
  const lib = {
    shadow: mesh(renderer, (b) => {
      const seg = 12;
      const base = b.pos.length / 3;
      b.vert(0, 0, 0, 0, 1, 0, 0.07, 0.06, 0.05, 0, 0);
      for (let i = 0; i < seg; i++) {
        const a = (i / seg) * Math.PI * 2;
        b.vert(Math.cos(a), 0, Math.sin(a), 0, 1, 0, 0.07, 0.06, 0.05, 0, 0);
      }
      for (let i = 0; i < seg; i++) b.idx.push(base, base + 1 + i, base + 1 + ((i + 1) % seg));
    }),
    head: mesh(renderer, buildHead),
    face: mesh(renderer, buildFace),
    torso: mesh(renderer, (b) => {
      chamferBox(b, 0, 0.24, 0, 0.42, 0.44, 0.24, 0.035, WHITE, 0, 1);
      chamferBox(b, 0, 0.44, 0.01, 0.2, 0.06, 0.1, 0.012, [0.93, 0.93, 0.95], 0, 0);
    }),
    jacket: mesh(renderer, (b) => {
      chamferBox(b, 0, 0.22, 0, 0.48, 0.5, 0.26, 0.04, WHITE, 0, 1);
      chamferBox(b, 0, 0.46, 0.02, 0.22, 0.07, 0.12, 0.014, [0.12, 0.12, 0.14], 0, 0);
    }),
    pelvis: mesh(renderer, (b) => {
      chamferBox(b, 0, -0.02, 0, 0.36, 0.18, 0.22, 0.025, WHITE, 0, 1);
      chamferBox(b, 0, 0.06, 0.02, 0.34, 0.05, 0.16, 0.01, [0.12, 0.1, 0.09], 0, 0);
    }),
    skirt: mesh(renderer, (b) => {
      chamferBox(b, 0, -0.08, 0.01, 0.42, 0.16, 0.26, 0.02, WHITE, 0, 1);
      chamferBox(b, 0, -0.24, 0.02, 0.5, 0.2, 0.32, 0.025, WHITE, 0, 1);
    }),
    thigh: mesh(renderer, (b) => limb(b, THIGH, 0.15, 0.16, WHITE, 1)),
    shin: mesh(renderer, (b) => limb(b, SHIN, 0.12, 0.13, WHITE, 1)),
    shoe: mesh(renderer, (b) => {
      chamferBox(b, 0, -0.035, 0.03, 0.11, 0.05, 0.2, 0.016, WHITE, 0, 1);
      chamferBox(b, 0, -0.068, 0.04, 0.12, 0.025, 0.23, 0.008, [0.86, 0.86, 0.88], 0, 0);
    }),
    upper: mesh(renderer, (b) => limb(b, UPPER, 0.11, 0.11, WHITE, 1)),
    fore: mesh(renderer, (b) => limb(b, FORE, 0.09, 0.09, WHITE, 1)),
    hand: mesh(renderer, (b) => {
      chamferBox(b, 0, -0.04, 0.01, 0.08, 0.08, 0.05, 0.012, WHITE, 0, 1);
      chamferBox(b, 0.03, -0.03, 0.03, 0.03, 0.045, 0.03, 0.006, WHITE, 0, 1);
    }),
    armLod: mesh(renderer, (b) => {
      limb(b, 0.32, 0.11, 0.11, WHITE, 1);
      chamferBox(b, 0, -0.48, 0.01, 0.09, 0.36, 0.09, 0.016, [0.84, 0.66, 0.52], 0, 0);
    }),
    legLod: mesh(renderer, (b) => {
      limb(b, 0.72, 0.14, 0.15, WHITE, 1, 0.02);
      chamferBox(b, 0, -0.76, 0.04, 0.12, 0.08, 0.22, 0.014, [0.16, 0.14, 0.13], 0, 0);
    }),
    beard: mesh(renderer, (b) => ellipsoid(b, 0, 0.08, 0.1, 0.09, 0.07, 0.06, 6, 4, WHITE, 0, 1)),
    glasses: mesh(renderer, (b) => {
      chamferBox(b, -0.055, 0.185, 0.16, 0.07, 0.05, 0.012, 0.006, [0.12, 0.12, 0.14], 0, 0);
      chamferBox(b, 0.055, 0.185, 0.16, 0.07, 0.05, 0.012, 0.006, [0.12, 0.12, 0.14], 0, 0);
      chamferBox(b, 0, 0.185, 0.155, 0.03, 0.012, 0.012, 0.004, [0.12, 0.12, 0.14], 0, 0);
    }),
    cap: mesh(renderer, (b) => {
      tube(b, 0, 0.3, -0.01, 0.155, 0.12, 8, WHITE, 0, 1, "y");
      tube(b, 0, 0.24, 0.06, 0.2, 0.028, 10, WHITE, 0, 1, "y");
    }),
    hat: mesh(renderer, (b) => {
      tube(b, 0, 0.3, 0, 0.16, 0.1, 8, WHITE, 0, 1, "y");
      tube(b, 0, 0.24, 0, 0.26, 0.03, 10, WHITE, 0, 1, "y");
    }),
    policeCap: mesh(renderer, (b) => {
      tube(b, 0, 0.3, -0.01, 0.15, 0.11, 8, [0.1, 0.16, 0.32], 0, 0, "y");
      chamferBox(b, 0, 0.25, 0.1, 0.16, 0.02, 0.14, 0.006, [0.08, 0.08, 0.1], 0, 0);
      chamferBox(b, 0, 0.32, 0.14, 0.04, 0.04, 0.012, 0.004, [0.86, 0.72, 0.28], 0, 0);
    }),
    helmet: mesh(renderer, (b) => {
      hairShell(b, 0.2, 0.21, 0.2, 0.18, -0.015, (ny, nz) => ny > -0.15 || nz < -0.05);
      chamferBox(b, 0, 0.16, 0.16, 0.18, 0.07, 0.04, 0.01, [0.1, 0.12, 0.14], 0, 0);
    }),
    apron: mesh(renderer, (b) => {
      chamferBox(b, 0, 0.12, 0.13, 0.36, 0.42, 0.04, 0.012, [0.93, 0.9, 0.82], 0, 0);
      chamferBox(b, -0.12, 0.38, 0.08, 0.04, 0.16, 0.04, 0.008, [0.93, 0.9, 0.82], 0, 0);
      chamferBox(b, 0.12, 0.38, 0.08, 0.04, 0.16, 0.04, 0.008, [0.93, 0.9, 0.82], 0, 0);
    }),
    vest: mesh(renderer, (b) => {
      chamferBox(b, 0, 0.22, 0.13, 0.4, 0.36, 0.05, 0.012, [0.12, 0.18, 0.36], 0, 0);
      chamferBox(b, 0, 0.22, -0.12, 0.38, 0.34, 0.04, 0.01, [0.12, 0.18, 0.36], 0, 0);
      chamferBox(b, 0, 0.18, 0.155, 0.38, 0.06, 0.02, 0.006, [0.92, 0.78, 0.2], 0, 0);
    }),
    bag: mesh(renderer, (b) => chamferBox(b, 0.22, 0.12, 0, 0.08, 0.2, 0.16, 0.015, [0.35, 0.24, 0.14], 0, 0)),
    backpack: mesh(renderer, (b) => chamferBox(b, 0, 0.22, -0.16, 0.28, 0.32, 0.12, 0.02, [0.2, 0.28, 0.42], 0, 0)),
    delivery: mesh(renderer, (b) => {
      chamferBox(b, 0, 0.24, -0.18, 0.32, 0.28, 0.26, 0.02, [0.95, 0.55, 0.12], 0, 0);
      chamferBox(b, 0, 0.24, -0.3, 0.22, 0.08, 0.02, 0.006, [0.2, 0.2, 0.22], 0, 0);
    }),
    lod: mesh(renderer, (b) => {
      chamferBox(b, -0.1, 0.44, 0, 0.15, 0.52, 0.16, 0.02, [0.2, 0.24, 0.32], 0, 0);
      chamferBox(b, 0.1, 0.44, 0, 0.15, 0.52, 0.16, 0.02, [0.2, 0.24, 0.32], 0, 0);
      chamferBox(b, -0.1, 0.1, 0.04, 0.13, 0.08, 0.2, 0.012, [0.14, 0.13, 0.12], 0, 0);
      chamferBox(b, 0.1, 0.1, 0.04, 0.13, 0.08, 0.2, 0.012, [0.14, 0.13, 0.12], 0, 0);
      chamferBox(b, 0, 1.12, 0, 0.44, 0.48, 0.24, 0.03, WHITE, 0, 1);
      chamferBox(b, -0.26, 0.98, 0, 0.1, 0.4, 0.1, 0.018, WHITE, 0, 1);
      chamferBox(b, 0.26, 0.98, 0, 0.1, 0.4, 0.1, 0.018, WHITE, 0, 1);
      ellipsoid(b, 0, 1.52, 0, 0.16, 0.18, 0.16, 8, 6, [0.84, 0.66, 0.52], 0, 0);
      ellipsoid(b, 0, 1.6, -0.02, 0.17, 0.14, 0.16, 8, 5, [0.12, 0.1, 0.09], 0, 0);
    }),
  };
  lib.hair = {};
  for (const style of STYLES) lib.hair[style] = mesh(renderer, buildHair(style));
  return lib;
}

function colorOf(value, table, fallback) {
  if (Array.isArray(value)) return value;
  if (typeof value === "number") return table[((value % table.length) + table.length) % table.length];
  return fallback;
}

function hashKey(text) {
  let h = 2166136261;
  const s = String(text);
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

function resolveLook(spec) {
  const seed = spec.seed != null ? spec.seed >>> 0 : hashKey(spec.id || spec.tint || 1);
  const named = spec.role === "player" ? ROLES.aming : ROLES[spec.id] || (spec.role && ROLES[spec.role]);
  if (named) {
    const look = {
      skin: colorOf(named.skin, SKINS, SKINS[1]),
      hair: colorOf(named.hair, HAIRS, HAIRS[0]),
      hairStyle: named.hairStyle,
      shirt: spec.tint && spec.role !== "player" && !spec.look ? named.shirt : (named.shirt),
      pants: colorOf(named.pants, PANTS, PANTS[0]),
      shoes: colorOf(named.shoes, SHOES, SHOES[0]),
      outfit: named.outfit,
      sleeves: named.sleeves,
      acc: named.acc,
      height: named.height,
      beard: !!named.beard,
      slouch: named.slouch || 0,
    };
    if (spec.role === "player" && spec.tint && !(spec.look && spec.look.shirt)) look.shirt = spec.tint;
    if (spec.look && typeof spec.look === "object") {
      if (spec.look.skin != null) look.skin = colorOf(spec.look.skin, SKINS, look.skin);
      if (spec.look.hair != null) look.hair = colorOf(spec.look.hair, HAIRS, look.hair);
      if (spec.look.hairStyle && libStyle(spec.look.hairStyle)) look.hairStyle = spec.look.hairStyle;
      if (spec.look.shirt) look.shirt = spec.look.shirt;
      if (spec.look.pants != null) look.pants = colorOf(spec.look.pants, PANTS, look.pants);
      if (spec.look.shoes != null) look.shoes = colorOf(spec.look.shoes, SHOES, look.shoes);
      if (spec.look.outfit) look.outfit = spec.look.outfit;
      if (spec.look.sleeves) look.sleeves = spec.look.sleeves;
      if (spec.look.acc) look.acc = spec.look.acc;
      if (spec.look.height) look.height = spec.look.height;
      if (spec.look.beard != null) look.beard = !!spec.look.beard;
    }
    return look;
  }
  const rand = mulberry32(seed || 1);
  const style = STYLES[(rand() * STYLES.length) | 0];
  const feminine = style === "bob" || style === "pony" || style === "bun";
  let outfit = feminine ? (rand() < 0.45 ? "skirt" : "pants") : (rand() < 0.22 ? "jacket" : rand() < 0.4 ? "shorts" : "pants");
  let acc = "none";
  const roll = rand();
  if (roll < 0.1) acc = "glasses";
  else if (roll < 0.2) acc = "cap";
  else if (roll < 0.28) acc = "hat";
  else if (roll < 0.36) acc = "bag";
  if (seed % 17 === 0) {
    acc = "hat";
    outfit = "shorts";
  } else if (seed % 19 === 0) acc = "apron";
  else if (seed % 21 === 0) acc = "delivery";
  return {
    skin: SKINS[(rand() * SKINS.length) | 0],
    hair: HAIRS[(rand() * HAIRS.length) | 0],
    hairStyle: style,
    shirt: spec.tint || [0.4, 0.5, 0.7],
    pants: PANTS[(rand() * PANTS.length) | 0],
    shoes: SHOES[(rand() * SHOES.length) | 0],
    outfit,
    sleeves: outfit === "jacket" ? "long" : "short",
    acc,
    height: 0.92 + rand() * 0.16,
    beard: !feminine && rand() < 0.16,
    slouch: 0,
  };
}

function libStyle(name) {
  return STYLES.includes(name);
}

function poseOf(anim, phase, time) {
  const s = Math.sin(phase);
  const breath = Math.sin(time * 2.1);
  const p = {
    spine: breath * 0.03,
    breath: 1 + breath * 0.015,
    head: Math.sin(time * 1.6) * 0.05,
    armL: Math.sin(time * 1.2) * 0.05,
    armR: -Math.sin(time * 1.2) * 0.05,
    foreL: 0.12,
    foreR: 0.12,
    legL: 0,
    legR: 0,
    kneeL: 0.05,
    kneeR: 0.05,
    bob: breath * 0.006,
  };
  const gait = (amp, knee, lean, fore) => {
    p.armL = s * amp;
    p.armR = -s * amp;
    p.legL = -s * amp;
    p.legR = s * amp;
    p.kneeL = 0.08 + Math.max(0, -s) * knee;
    p.kneeR = 0.08 + Math.max(0, s) * knee;
    p.foreL = fore + Math.max(0, -p.armL) * 0.3;
    p.foreR = fore + Math.max(0, -p.armR) * 0.3;
    p.bob = Math.abs(s) * (0.02 + amp * 0.025);
    p.spine = lean;
    p.head = -lean * 0.35 + Math.sin(time * 2) * 0.03;
  };
  if (anim === "walk") gait(0.58, 0.6, 0.05, 0.16);
  else if (anim === "run") gait(0.88, 0.95, 0.16, 0.42);
  else if (anim === "sprint") gait(1.08, 1.2, 0.28, 0.6);
  else if (anim === "flee") {
    gait(1.02, 1.15, 0.32, 0.4);
    p.armL = -0.55 + s * 0.75;
    p.armR = -0.2 - s * 0.75;
    p.head = 0.18;
  } else if (anim === "talk") {
    p.armR = -1.05 + Math.sin(time * 6) * 0.22;
    p.foreR = 0.9;
    p.armL = 0.15;
    p.head = Math.sin(time * 3.4) * 0.14;
    p.spine = 0.04;
  } else if (anim === "arrest") {
    p.armL = -2.5;
    p.armR = -2.5;
    p.foreL = 0.3;
    p.foreR = 0.3;
    p.head = 0.1;
    p.spine = -0.04;
  } else if (anim === "drive") {
    p.spine = 0.22;
    p.armL = -1.15;
    p.armR = -1.15;
    p.foreL = 0.75;
    p.foreR = 0.75;
    p.legL = -1.2;
    p.legR = -1.2;
    p.kneeL = 1.2;
    p.kneeR = 1.2;
    p.head = -0.08;
    p.bob = 0;
    p.breath = 1;
  }
  return p;
}

const rootM = new Float32Array(16);
const torsoM = new Float32Array(16);
const headM = new Float32Array(16);
const aM = new Float32Array(16);
const bM = new Float32Array(16);
const cM = new Float32Array(16);
const scratch = new Float32Array(16);
const drawM = new Float32Array(16);

function child(out, parent, x, y, z, yaw = 0, pitch = 0, roll = 0, sx = 1, sy = 1, sz = 1) {
  compose(scratch, x, y, z, yaw, pitch, roll, sx, sy, sz);
  multiply(out, parent, scratch);
  return out;
}

function childBasis(out, parent, x, y, z, xAxis, yAxis, zAxis) {
  scratch[0] = xAxis[0]; scratch[1] = xAxis[1]; scratch[2] = xAxis[2]; scratch[3] = 0;
  scratch[4] = yAxis[0]; scratch[5] = yAxis[1]; scratch[6] = yAxis[2]; scratch[7] = 0;
  scratch[8] = zAxis[0]; scratch[9] = zAxis[1]; scratch[10] = zAxis[2]; scratch[11] = 0;
  scratch[12] = x; scratch[13] = y; scratch[14] = z; scratch[15] = 1;
  multiply(out, parent, scratch);
  return out;
}

function xform(m, p) {
  return [
    m[0] * p[0] + m[4] * p[1] + m[8] * p[2] + m[12],
    m[1] * p[0] + m[5] * p[1] + m[9] * p[2] + m[13],
    m[2] * p[0] + m[6] * p[1] + m[10] * p[2] + m[14],
  ];
}

function sub(a, b) { return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]; }
function add(a, b) { return [a[0] + b[0], a[1] + b[1], a[2] + b[2]]; }
function scale(a, s) { return [a[0] * s, a[1] * s, a[2] * s]; }
function dot(a, b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; }
function cross(a, b) {
  return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
}
function norm(a) {
  const l = Math.hypot(a[0], a[1], a[2]) || 1;
  return [a[0] / l, a[1] / l, a[2] / l];
}
function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }

function axesFromNegY(dir, pole) {
  const yAxis = norm([-dir[0], -dir[1], -dir[2]]);
  let xAxis = cross(pole, yAxis);
  if (Math.hypot(xAxis[0], xAxis[1], xAxis[2]) < 1e-4) xAxis = cross([0, 0, 1], yAxis);
  xAxis = norm(xAxis);
  const zAxis = norm(cross(xAxis, yAxis));
  xAxis = norm(cross(yAxis, zAxis));
  return [xAxis, yAxis, zAxis];
}

function ikBone(origin, target, l1, l2, pole) {
  const to = sub(target, origin);
  let dist = Math.hypot(to[0], to[1], to[2]);
  const max = l1 + l2 - 0.001;
  const min = Math.abs(l1 - l2) + 0.001;
  dist = Math.min(max, Math.max(min, dist));
  const dir = norm(to);
  const cosA = clamp((l1 * l1 + dist * dist - l2 * l2) / (2 * l1 * dist), -1, 1);
  const ang = Math.acos(cosA);
  let poleN = sub(pole, scale(dir, dot(pole, dir)));
  if (Math.hypot(poleN[0], poleN[1], poleN[2]) < 1e-4) poleN = [0, 1, 0];
  poleN = norm(poleN);
  const elbowDir = norm(add(scale(dir, Math.cos(ang)), scale(poleN, Math.sin(ang))));
  const elbow = add(origin, scale(elbowDir, l1));
  const handDir = norm(sub(target, elbow));
  return { elbow, elbowDir, handDir };
}

function paint(renderer, part, matrix, tint) {
  if (!part) return;
  renderer.draw(part, matrix, tint || WHITE, 1, 0);
}


function rideLimbs(renderer, lib, look, long, shorts, skirt) {
  compose(scratch, 0, 0, 0, 0, 0.5, 0);
  const shoulders = [xform(scratch, [-0.24, SHOULDER, 0.02]), xform(scratch, [0.24, SHOULDER, 0.02])];
  const grips = rideGrips(look._steer || 0).map((g) => [g[0] - RIDE.hip[0], g[1] - RIDE.hip[1], g[2] - RIDE.hip[2]]);
  const ankles = [RIDE.ankleL, RIDE.ankleR].map((g) => [g[0] - RIDE.hip[0], g[1] - RIDE.hip[1], g[2] - RIDE.hip[2]]);
  const hips = [[-0.1, 0, 0.02], [0.1, 0, 0.02]];
  for (let i = 0; i < 2; i++) {
    const side = i === 0 ? -1 : 1;
    const arm = ikBone(shoulders[i], grips[i], UPPER, FORE, [side * 0.9, -0.35, 0.25]);
    const [ux, uy, uz] = axesFromNegY(arm.elbowDir, [side, 0.2, 0.4]);
    paint(renderer, lib.upper, childBasis(aM, rootM, shoulders[i][0], shoulders[i][1], shoulders[i][2], ux, uy, uz), long ? look.shirt : look.skin);
    const [fx, fy, fz] = axesFromNegY(arm.handDir, [side, -0.2, 0.5]);
    paint(renderer, lib.fore, childBasis(bM, rootM, arm.elbow[0], arm.elbow[1], arm.elbow[2], fx, fy, fz), long ? look.shirt : look.skin);
    const wrist = add(arm.elbow, scale(arm.handDir, FORE));
    paint(renderer, lib.hand, childBasis(cM, rootM, wrist[0], wrist[1], wrist[2], fx, fy, fz), look.skin);
    const leg = ikBone(hips[i], ankles[i], THIGH, SHIN, [side * 0.45, 0.2, 1]);
    const [tx, ty, tz] = axesFromNegY(leg.elbowDir, [side, 1, 0.2]);
    paint(renderer, lib.thigh, childBasis(aM, rootM, hips[i][0], hips[i][1], hips[i][2], tx, ty, tz), skirt || shorts ? look.skin : look.pants);
    const [sx, sy, sz] = axesFromNegY(leg.handDir, [0, 1, 0.2]);
    paint(renderer, lib.shin, childBasis(bM, rootM, leg.elbow[0], leg.elbow[1], leg.elbow[2], sx, sy, sz), skirt || shorts ? look.skin : look.pants);
    const up = [0, 1, 0];
    const fwd = [0, 0, 1];
    const sideA = norm(cross(up, fwd));
    paint(renderer, lib.shoe, childBasis(cM, rootM, ankles[i][0], ankles[i][1], ankles[i][2], sideA, up, fwd), look.shoes);
  }
}


export function drawCharacter(renderer, lib, spec) {
  const look = resolveLook(spec);
  look._steer = spec.steer || 0;
  const anim = spec.anim || "idle";
  const lod = spec.lod ?? 0;
  const ride = anim === "ride";
  const drive = anim === "drive";
  const sc = ride || drive ? 1 : (look.height || 1);
  const pose = poseOf(anim, spec.phase || 0, spec.time || 0);
  pose.spine += look.slouch || 0;
  if (ride) {
    pose.spine = 0.5;
    pose.breath = 1;
    pose.head = -0.12;
    pose.bob = 0;
  }
  const hipBase = spec.origin === "hip" || ride ? 0 : HIP;
  const originY = ride ? spec.y : spec.y + pose.bob;
  compose(rootM, spec.x, originY, spec.z, spec.yaw || 0, 0, spec.roll || 0, sc, sc, sc);
  if (lod >= 2) {
    paint(renderer, lib.lod, rootM, look.shirt);
    if (spec.shadow !== false && !ride && !drive) {
      compose(drawM, spec.x, spec.y + 0.03, spec.z, 0, 0, 0, 0.42 * sc, 1, 0.42 * sc);
      renderer.draw(lib.shadow, drawM, WHITE, 0.3, 1);
    }
    return;
  }
  if (spec.shadow !== false && !ride && !drive) {
    compose(drawM, spec.x, spec.y + 0.03, spec.z, 0, 0, 0, 0.46 * sc, 1, 0.42 * sc);
    renderer.draw(lib.shadow, drawM, WHITE, 0.32, 1);
  }
  const skirt = look.outfit === "skirt" && !ride;
  const shorts = look.outfit === "shorts";
  const long = look.sleeves === "long" || ride;
  const acc = drive && (look.acc === "cap" || look.acc === "hat" || look.acc === "police") ? "none" : look.acc;
  child(torsoM, rootM, 0, hipBase, 0, 0, pose.spine, 0, 1, pose.breath, 1);
  paint(renderer, look.outfit === "jacket" || ride ? lib.jacket : lib.torso, torsoM, look.shirt);
  if (!skirt) paint(renderer, lib.pelvis, child(aM, rootM, 0, hipBase, 0), look.pants);
  else paint(renderer, lib.skirt, child(aM, rootM, 0, hipBase, 0), look.shirt);
  if (acc === "apron") paint(renderer, lib.apron, torsoM, WHITE);
  if (look.acc === "police" || acc === "delivery") paint(renderer, lib.vest, torsoM, WHITE);
  if (acc === "bag" && lod === 0) paint(renderer, lib.bag, torsoM, WHITE);
  if (acc === "delivery") paint(renderer, lib.delivery, torsoM, WHITE);
  if (acc === "hat" && lod === 0) paint(renderer, lib.backpack, torsoM, WHITE);

  child(headM, torsoM, 0, NECK * pose.breath, 0, 0, pose.head, 0);
  paint(renderer, lib.head, headM, look.skin);
  if (lod === 0) paint(renderer, lib.face, headM, look.hair);
  const helmet = ride || look.acc === "helmet";
  if (!helmet) paint(renderer, lib.hair[look.hairStyle] || lib.hair.short, headM, look.hair);
  if (look.beard && lod === 0 && !helmet) paint(renderer, lib.beard, headM, look.hair);
  if (helmet) paint(renderer, lib.helmet, headM, [0.86, 0.88, 0.9]);
  else if (acc === "cap" || acc === "delivery") paint(renderer, lib.cap, headM, acc === "delivery" ? [0.95, 0.55, 0.12] : look.shirt);
  else if (acc === "hat") paint(renderer, lib.hat, headM, [0.95, 0.78, 0.3]);
  else if (acc === "police") paint(renderer, lib.policeCap, headM, WHITE);
  if (acc === "glasses" && lod === 0 && !helmet) paint(renderer, lib.glasses, headM, WHITE);

  if (ride && lod === 0) {
    rideLimbs(renderer, lib, look, true, shorts, false);
    return;
  }
  if (ride) {
    pose.armL = -1.2;
    pose.armR = -1.2;
    pose.foreL = 0.8;
    pose.foreR = 0.8;
    pose.legL = -1.15;
    pose.legR = -1.15;
    pose.kneeL = 1.15;
    pose.kneeR = 1.15;
  }
  const full = lod === 0;
  for (const side of [-1, 1]) {
    const armP = side < 0 ? pose.armL : pose.armR;
    const foreP = side < 0 ? pose.foreL : pose.foreR;
    const legP = side < 0 ? pose.legL : pose.legR;
    const kneeP = side < 0 ? pose.kneeL : pose.kneeR;
    if (!full) {
      paint(renderer, lib.armLod, child(aM, torsoM, side * 0.24, SHOULDER, 0, 0, armP, side * 0.12), look.shirt);
      paint(renderer, lib.legLod, child(bM, rootM, side * 0.1, hipBase, 0, 0, legP, 0), shorts || skirt ? look.skin : look.pants);
      continue;
    }
    child(aM, torsoM, side * 0.24, SHOULDER, 0, 0, armP, side * 0.1);
    paint(renderer, lib.upper, aM, long ? look.shirt : look.skin);
    child(bM, aM, 0, -UPPER, 0, 0, -foreP, 0);
    paint(renderer, lib.fore, bM, long ? look.shirt : look.skin);
    paint(renderer, lib.hand, child(cM, bM, 0, -FORE, 0), look.skin);
    if (!skirt) {
      child(aM, rootM, side * 0.1, hipBase, 0, 0, legP, 0);
      paint(renderer, lib.thigh, aM, shorts ? look.skin : look.pants);
      child(bM, aM, 0, -THIGH, 0, 0, kneeP, 0);
      paint(renderer, lib.shin, bM, shorts ? look.skin : look.pants);
      paint(renderer, lib.shoe, child(cM, bM, 0, -SHIN, 0), look.shoes);
    } else {
      child(bM, rootM, side * 0.11, hipBase - 0.4, 0, 0, legP * 0.7, 0, 1, 0.8, 1);
      paint(renderer, lib.shin, bM, look.skin);
      paint(renderer, lib.shoe, child(cM, bM, 0, -SHIN, 0), look.shoes);
    }
  }
}
