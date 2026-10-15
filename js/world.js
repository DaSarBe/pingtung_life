import { ColliderGrid, MeshBuilder, hex, mulberry32, pointBlocked } from "./engine.js";

export const XS = [-150, -100, -50, 0, 50, 100, 150];
export const ZS = [-150, -100, -50, 0, 50, 100, 150];

export const ZONES = {
  market: { minX: 52, maxX: 155, minZ: -155, maxZ: -52 },
  park: { minX: 52, maxX: 155, minZ: 2, maxZ: 102 },
  star: { minX: -155, maxX: -52, minZ: -155, maxZ: -52 },
  kenting: { minX: -90, maxX: 150, minZ: -1120, maxZ: -820 },
  home: { minX: 10, maxX: 42, minZ: 104, maxZ: 142 },
  station: { minX: -46, maxX: 46, minZ: 158, maxZ: 210 },
};

export const PLACES = {
  spawn: { x: 0, z: 148, yaw: Math.PI },
  homeDoor: { x: 25, z: 116 },
  tuna: { x: 16, z: -968 },
  parade: { x: 0, z: 0 },
};

export const RACE_POINTS = [
  { x: 0, z: -18 },
  { x: 0, z: -78 },
  { x: 0, z: -142 },
  { x: 36, z: -142 },
  { x: 50, z: -78 },
  { x: 50, z: -18 },
  { x: 0, z: -18 },
];

const ROAD = hex(0x3c4148);
const LINE = hex(0xe6c15a);
const GROUND = hex(0xd9d2c4);
const GRASS = hex(0x6fa84a);
const GRASS2 = hex(0x87b85a);
const SAND = hex(0xf0d7a2);
const WATER = hex(0x2f8fbf);
const PLASTER = hex(0xf3d2a4);
const CREAM = hex(0xf7efe2);
const WOOD = hex(0x8d5a3c);
const WOOD_DARK = hex(0x5c3a28);
const ROOF = hex(0xb84332);
const BRICK = hex(0xc45c48);
const GLASS = hex(0x8ec6e0);
const WINDOW = hex(0xffe1a8);
const CONCRETE = hex(0xcfc8bc);
const WHITE = hex(0xf4f1ea);
const BLUE = hex(0x1f4e9a);
const DARK = hex(0x2a2d33);
const LEAF = hex(0x3e8f45);
const PALM = hex(0x2f8a4a);
const TRUNK = hex(0x6b4a32);
const AWNING = [hex(0xd64545), hex(0xf0b429), hex(0x2a9d8f), hex(0xe07a5f), hex(0x3d7ea6), hex(0xc45c9a)];

export const NPCS = [
  { id: "landlord", name: "陳桑", x: 30, z: 112, tint: [0.86, 0.55, 0.32] },
  { id: "axia", name: "阿霞", x: 78, z: -100, tint: [0.9, 0.3, 0.38] },
  { id: "along", name: "阿龍", x: 100, z: -142, tint: [0.15, 0.16, 0.2] },
  { id: "azhi", name: "阿志", x: 0, z: -36, tint: [0.95, 0.78, 0.2] },
  { id: "amei", name: "阿美", x: -100, z: -92, tint: [0.45, 0.72, 0.55] },
  { id: "sushi", name: "小蘇", x: 0, z: 122, tint: [0.35, 0.55, 0.85] },
  { id: "acai", name: "阿財", x: 86, z: 36, tint: [0.75, 0.4, 0.25] },
  { id: "lili", name: "莉莉", x: 118, z: -116, tint: [0.85, 0.45, 0.7] },
  { id: "fisher", name: "漁販阿海", x: 16, z: -960, tint: [0.2, 0.45, 0.62] },
  { id: "vendor", name: "黑輪伯", x: 90, z: -78, tint: [0.55, 0.32, 0.22] },
];

export function highwayTFromZ(z) {
  return (z + 160) / -700;
}

export function bridgeHeight(t) {
  const bt = (t - 0.42) / 0.16;
  if (bt <= 0 || bt >= 1) return 0;
  return Math.sin(bt * Math.PI) * 4.2;
}

export function highwayX(t) {
  return Math.sin(t * Math.PI * 2) * 28;
}

export function groundY(_x, z) {
  if (z <= -155 && z >= -865) return bridgeHeight(highwayTFromZ(z));
  return 0;
}

export function waterEdgeX(z) {
  if (z > -175) return 520;
  if (z > -830) return highwayX(highwayTFromZ(z)) + 16;
  return 72;
}

export function inZone(name, x, z) {
  const r = ZONES[name];
  return !!r && x >= r.minX && x <= r.maxX && z >= r.minZ && z <= r.maxZ;
}

function reserved(x, z) {
  return inZone("park", x, z) || inZone("star", x, z) || inZone("market", x, z)
    || (x > -50 && x < 0 && z > -50 && z < 0)
    || (x > -50 && x < 0 && z > 50 && z < 100)
    || (x > 0 && x < 50 && z > 100 && z < 150);
}

export function createWorld(renderer) {
  const rng = mulberry32(0x70696e67);
  const duals = new Map();
  const colliders = [];
  const covers = [];
  const roadSegs = [];
  const labels = [];
  const sidewalks = [];
  const parked = [
    { id: "mine", type: "scooter", x: 16, z: 110, yaw: 0.6, tint: [0.82, 0.16, 0.14], owned: true },
    { id: "p1", type: "scooter", x: -12, z: 134, yaw: 1.4, tint: [0.2, 0.48, 0.86], owned: false },
    { id: "p2", type: "scooter", x: 62, z: -58, yaw: -0.4, tint: [0.95, 0.78, 0.15], owned: false },
    { id: "p3", type: "scooter", x: -70, z: 20, yaw: 2.2, tint: [0.35, 0.75, 0.55], owned: false },
    { id: "c1", type: "car", x: 36, z: 18, yaw: Math.PI, tint: [0.92, 0.55, 0.2], owned: false },
    { id: "c2", type: "car", x: -18, z: -18, yaw: 0.2, tint: [0.75, 0.8, 0.86], owned: false },
  ];

  function getDual(x, z) {
    const k = `${Math.floor(x / 70)},${Math.floor(z / 70)}`;
    let d = duals.get(k);
    if (!d) {
      d = { hi: new MeshBuilder(), lo: new MeshBuilder() };
      duals.set(k, d);
    }
    return d;
  }

  function put(x, y, z, sx, sy, sz, color, glow = 0, lod = true) {
    const d = getDual(x, z);
    d.hi.box(x, y, z, sx, sy, sz, color, glow, 0);
    if (lod) d.lo.box(x, y, z, sx, sy, sz, color, 0, 0);
  }

  function putRot(x, y, z, sx, sy, sz, yaw, pitch, color, glow = 0) {
    const d = getDual(x, z);
    d.hi.boxRot(x, y, z, sx, sy, sz, yaw, pitch, color, glow, 0);
  }

  function putRoof(x, y, z, sx, sy, sz, color) {
    const d = getDual(x, z);
    d.hi.prismRoof(x, y, z, sx, sy, sz, color, 0, 0);
    d.lo.prismRoof(x, y, z, sx, sy, sz, color, 0, 0);
  }

  function collider(x, z, w, d, face, porch) {
    let minX = x - w / 2, maxX = x + w / 2, minZ = z - d / 2, maxZ = z + d / 2;
    if (porch) {
      const cut = 1.7;
      if (face === "z+") maxZ -= cut;
      else if (face === "z-") minZ += cut;
      else if (face === "x+") maxX -= cut;
      else minX += cut;
      const cover = { minX: x - w / 2, maxX: x + w / 2, minZ: z - d / 2, maxZ: z + d / 2 };
      if (face === "z+") cover.minZ = maxZ;
      else if (face === "z-") cover.maxZ = minZ;
      else if (face === "x+") cover.minX = maxX;
      else cover.maxX = minX;
      covers.push(cover);
    }
    if (maxX - minX > 0.8 && maxZ - minZ > 0.8) colliders.push({ minX, maxX, minZ, maxZ });
  }

  function faceOf(x, z) {
    let best = Infinity;
    let face = "z-";
    for (const rx of XS) {
      const dist = Math.abs(x - rx);
      if (dist < best) {
        best = dist;
        face = x >= rx ? "x-" : "x+";
      }
    }
    for (const rz of ZS) {
      const dist = Math.abs(z - rz);
      if (dist < best) {
        best = dist;
        face = z >= rz ? "z-" : "z+";
      }
    }
    return face;
  }

  function windowBand(x, y, z, w, d, face) {
    const t = 0.08;
    if (face === "z+") put(x, y, z + d / 2 + 0.06, w * 0.7, 1.05, t, WINDOW, 1, false);
    else if (face === "z-") put(x, y, z - d / 2 - 0.06, w * 0.7, 1.05, t, WINDOW, 1, false);
    else if (face === "x+") put(x + w / 2 + 0.06, y, z, t, 1.05, d * 0.7, WINDOW, 1, false);
    else put(x - w / 2 - 0.06, y, z, t, 1.05, d * 0.7, WINDOW, 1, false);
  }

  function addBuilding(x, z, w, d, floors, style, wall, face) {
    const fh = 3.15;
    if (style === "shop") {
      const posts = [
        [x - w / 2 + 0.28, z - d / 2 + 0.28],
        [x + w / 2 - 0.28, z - d / 2 + 0.28],
        [x - w / 2 + 0.28, z + d / 2 - 0.28],
        [x + w / 2 - 0.28, z + d / 2 - 0.28],
      ];
      for (const [px, pz] of posts) put(px, 1.5, pz, 0.36, 3, 0.36, wall, 0, true);
      const uh = Math.max(fh, (floors - 1) * fh);
      put(x, 3.1 + uh / 2, z, w, uh, d, wall, 0, true);
      for (let f = 1; f < floors; f++) windowBand(x, 3.1 + f * fh * 0.92, z, w, d, face);
      const color = AWNING[Math.floor(rng() * AWNING.length)];
      if (face === "z+") put(x, 3.15, z + d / 2 + 0.55, w * 0.9, 0.12, 1.1, color, 0, false);
      else if (face === "z-") put(x, 3.15, z - d / 2 - 0.55, w * 0.9, 0.12, 1.1, color, 0, false);
      else if (face === "x+") put(x + w / 2 + 0.55, 3.15, z, 1.1, 0.12, d * 0.9, color, 0, false);
      else put(x - w / 2 - 0.55, 3.15, z, 1.1, 0.12, d * 0.9, color, 0, false);
      put(x + w * 0.2, 3.1 + uh + 0.45, z, 1.1, 0.7, 1.1, CONCRETE, 0, false);
      collider(x, z, w, d, face, true);
    } else if (style === "wood") {
      put(x, 1.6, z, w, 3.2, d, wall, 0, true);
      putRoof(x, 3.2, z, w + 0.6, 1.3, d + 0.6, ROOF);
      windowBand(x, 1.8, z, w, d, face);
      put(x, 0.7, z, w + 0.2, 0.35, 0.2, WOOD_DARK, 0, false);
      collider(x, z, w * 0.92, d * 0.92, face, false);
    } else {
      const h = floors * fh;
      put(x, h / 2, z, w, h, d, wall, 0, true);
      for (let f = 1; f < floors; f++) windowBand(x, f * fh + 1.2, z, w, d, face);
      put(x, h + 0.45, z - d * 0.15, 1.4, 0.9, 1.4, hex(0xb9c0c8), 0, false);
      put(x + w * 0.28, h + 0.35, z + d * 0.2, 0.7, 0.7, 0.7, hex(0x9aa3ad), 0, false);
      if (floors >= 5) {
        put(x, 2.2, z, w + 0.15, 0.12, 0.35, hex(0xded6c8), 0, false);
      }
      collider(x, z, w, d, face, false);
    }
  }

  function addTree(x, z, scale, palm) {
    const h = (palm ? 4.2 : 2.4) * scale;
    put(x, h / 2, z, 0.28 * scale, h, 0.28 * scale, TRUNK, 0, true);
    const d = getDual(x, z);
    if (palm) {
      d.lo.cone(x, h, z, 1.1 * scale, 1.6 * scale, 6, PALM, 0, 0);
      for (let i = 0; i < 5; i++) {
        const yaw = (i / 5) * Math.PI * 2;
        putRot(x, h + 0.2, z, 0.18, 0.08, 1.5 * scale, yaw, 0.7, PALM, 0);
      }
    } else {
      d.hi.sphere(x, h + 0.8 * scale, z, 1.15 * scale, 6, LEAF, 0, 0);
      d.hi.sphere(x + 0.4 * scale, h + 0.5 * scale, z + 0.2, 0.8 * scale, 6, hex(0x4ea056), 0, 0);
      d.lo.cone(x, h + 0.4, z, 1.2 * scale, 2.2 * scale, 6, LEAF, 0, 0);
    }
  }

  function addLamp(x, z) {
    put(x, 1.7, z, 0.12, 3.4, 0.12, DARK, 0, true);
    put(x, 3.45, z, 0.55, 0.12, 0.28, DARK, 0, true);
    put(x, 3.32, z, 0.28, 0.1, 0.16, WINDOW, 2, true);
  }

  const cityGround = new MeshBuilder();
  cityGround.box(0, -0.25, 0, 460, 0.5, 460, GROUND, 0, 0);
  const park = new MeshBuilder();
  park.box(102, 0.02, 52, 96, 0.08, 90, GRASS, 0, 0);
  park.box(70, 0.03, 50, 8, 0.05, 70, hex(0xe4dcc8), 0, 0);
  park.box(102, 0.03, 20, 70, 0.05, 8, hex(0xe4dcc8), 0, 0);

  const cityRoads = new MeshBuilder();
  function roadBox(x, y, z, sx, sy, sz, color) {
    cityRoads.box(x, y, z, sx, sy, sz, color, 0, 0);
  }
  for (const x of XS) {
    roadBox(x, 0.05, 0, 12, 0.08, 312, ROAD);
    roadSegs.push({ x0: x, z0: -156, x1: x, z1: 156 });
    for (let z = -140; z <= 140; z += 18) {
      if (ZS.some((rz) => Math.abs(z - rz) < 8)) continue;
      roadBox(x, 0.1, z, 0.16, 0.02, 8, LINE);
    }
  }
  for (let i = 0; i < ZS.length; i++) {
    const z = ZS[i];
    roadSegs.push({ x0: -156, z0: z, x1: 156, z1: z });
    for (let k = 0; k < XS.length - 1; k++) {
      const x0 = XS[k] + 6;
      const x1 = XS[k + 1] - 6;
      const mid = (x0 + x1) / 2;
      roadBox(mid, 0.05, z, x1 - x0, 0.08, 12, ROAD);
      roadBox(mid, 0.1, z, Math.max(2, x1 - x0 - 4), 0.02, 0.16, LINE);
    }
  }

  for (const x of XS) {
    for (let z = -150; z <= 150; z += 26) addLamp(x + 8, z);
  }

  for (let i = 0; i < XS.length - 1; i++) {
    for (let j = 0; j < ZS.length - 1; j++) {
      const x0 = XS[i], x1 = XS[i + 1], z0 = ZS[j], z1 = ZS[j + 1];
      const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
      if (reserved(cx, cz)) continue;
      const inset = 11;
      const a = x0 + inset, b = x1 - inset, c = z0 + inset, d = z1 - inset;
      if (b - a < 14 || d - c < 14) continue;
      const nearStation = cz > 70;
      const floors = nearStation ? 5 + Math.floor(rng() * 3) : 3 + Math.floor(rng() * 3);
      const style = floors <= 4 && cz < 80 ? "shop" : "walkup";
      const depth = Math.min(15, d - c);
      const zc = (c + d) / 2 - (d - c - depth) * 0.1;
      const gap = 2.6;
      const mid = (a + b) / 2;
      const leftW = mid - gap / 2 - a;
      const rightW = b - (mid + gap / 2);
      const walls = [PLASTER, CREAM, hex(0xe7b98c), hex(0xd98b78), hex(0xc7ddd4), hex(0xf0c9a0)];
      const w1 = walls[Math.floor(rng() * walls.length)];
      const w2 = walls[Math.floor(rng() * walls.length)];
      const xL = a + leftW / 2;
      const xR = b - rightW / 2;
      addBuilding(xL, zc, leftW, depth, floors, style, w1, faceOf(xL, zc));
      addBuilding(xR, zc, rightW, depth, Math.max(2, floors - 1), style, w2, faceOf(xR, zc));
      if (rng() > 0.45) addTree(cx, z0 + 8, 0.85 + rng() * 0.4, false);
    }
  }

  // 屏東車站
  put(0, 5, 176, 78, 10, 16, CREAM, 0, true);
  put(0, 10.4, 176, 80, 1.1, 18, hex(0x8e3428), 0, true);
  put(-30, 9, 176, 8, 18, 8, CREAM, 0, true);
  put(-30, 18.4, 176, 9, 1.2, 9, hex(0x8e3428), 0, true);
  put(-30, 14.5, 180.2, 3.2, 3.2, 0.2, WHITE, 0, false);
  put(-30, 14.5, 180.3, 0.12, 1.2, 0.08, DARK, 0, false);
  for (let i = -3; i <= 3; i++) windowBand(i * 10, 6.2, 176, 9, 16, "z-");
  put(0, 0.4, 164, 70, 0.3, 16, CONCRETE, 0, true);
  put(0, 0.15, 198, 90, 0.2, 10, hex(0x4a463f), 0, true);
  put(-2.2, 0.35, 198, 0.16, 0.12, 86, hex(0xb7b1a6), 0, true);
  put(2.2, 0.35, 198, 0.16, 0.12, 86, hex(0xb7b1a6), 0, true);
  put(0, 2.2, 194, 42, 3.4, 8, hex(0xd7dde6), 0, true);
  for (let i = -2; i <= 2; i++) put(i * 8, 2.3, 190.2, 5, 1.6, 0.12, GLASS, 1, false);
  put(0, 8.6, 167.7, 26, 2.4, 0.45, hex(0xc23b3b), 0, false);
  put(0, 8.6, 167.4, 20, 1.15, 0.12, hex(0xfff6df), 0, false);
  put(-30, 16.2, 171.6, 2.4, 2.4, 0.25, hex(0x1f4e9a), 0, false);
  put(-30, 16.2, 171.42, 0.12, 2.1, 0.08, hex(0xfff6df), 0, false);
  put(-30, 16.2, 171.42, 1.9, 0.12, 0.08, hex(0xfff6df), 0, false);
  collider(0, 176, 78, 16, "z-", false);
  collider(0, 194, 42, 8, "z-", false);
  labels.push({ text: "屏東車站", x: 0, y: 20, z: 176 });

  // 太平洋百貨
  put(-25, 9.6, -25, 32, 19.2, 26, hex(0xdfe7ef), 0, true);
  for (let f = 0; f < 6; f++) {
    put(-25, 2.2 + f * 3.2, -11.9, 28, 1.5, 0.25, GLASS, f > 0 ? 1 : 0, false);
    put(-8.9, 2.2 + f * 3.2, -25, 0.25, 1.5, 22, GLASS, f > 0 ? 1 : 0, false);
  }
  put(-25, 19.8, -25, 24, 1.2, 8, hex(0xc23b3b), 0, true);
  put(-25, 1.2, -11.2, 14, 0.35, 3.2, hex(0xf0d48a), 0, false);
  collider(-25, -25, 32, 26, "z+", false);
  labels.push({ text: "太平洋百貨", x: -25, y: 23, z: -25 });

  // 千禧公園
  {
    const d = getDual(100, 48);
    d.hi.disc(104, 0.08, 58, 14, 18, hex(0x3aa0c8), 0, 0);
    d.lo.disc(104, 0.08, 58, 14, 10, hex(0x3aa0c8), 0, 0);
  }
  put(104, 0.2, 58, 8, 0.3, 8, hex(0xbfc6c0), 0, true);
  put(100, 1.6, 28, 0.3, 3.2, 0.3, WHITE, 0, true);
  put(108, 1.6, 28, 0.3, 3.2, 0.3, WHITE, 0, true);
  put(104, 3.3, 28, 8.4, 0.3, 6, hex(0xd24b4b), 0, true);
  for (let i = 0; i < 10; i++) addTree(64 + (i % 5) * 16, 16 + Math.floor(i / 5) * 58, 1.05, false);
  addTree(128, 78, 1.4, false);
  labels.push({ text: "千禧公園", x: 104, y: 8, z: 48 });

  // 勝利星村
  const houseSpots = [
    [-128, -128], [-108, -130], [-88, -124], [-128, -108], [-106, -104], [-84, -108],
    [-130, -86], [-108, -82], [-86, -78], [-68, -120], [-66, -96], [-70, -74],
  ];
  houseSpots.forEach(([x, z], i) => {
    const wall = i % 2 ? WOOD : hex(0xa36b45);
    addBuilding(x, z, 8 + (i % 3), 7, 1, "wood", wall, "z+");
    if (i % 2 === 0) addTree(x + 6, z + 4, 0.9, false);
  });
  put(-100, 0.5, -100, 18, 0.8, 0.4, BRICK, 0, true);
  put(-100, 2.2, -100, 0.15, 2.6, 0.15, WOOD_DARK, 0, true);
  for (let i = -2; i <= 2; i++) put(-100 + i * 1.2, 3.3, -100, 0.18, 0.18, 0.18, WINDOW, 2, false);
  labels.push({ text: "勝利星村", x: -100, y: 7, z: -100 });

  // 屏東夜市
  for (let i = 0; i < 11; i++) {
    const x = 64 + i * 7;
    const color = AWNING[i % AWNING.length];
    for (const side of [-1, 1]) {
      const z = -100 + side * 4.6;
      put(x, 0.55, z, 3.2, 1.0, 1.6, hex(0x6b4a32), 0, true);
      putRot(x, 2.15, z + side * 0.2, 3.6, 0.1, 2.4, 0, side * -0.25, color, 0);
      put(x, 2.55, z, 0.16, 0.16, 0.16, WINDOW, 2, false);
      colliders.push({ minX: x - 1.6, maxX: x + 1.6, minZ: z - 0.8, maxZ: z + 0.8 });
    }
  }
  for (let i = 0; i < 11; i++) {
    const x = 64 + i * 7;
    put(x, 3.55, -100, 0.55, 0.42, 0.55, AWNING[i % AWNING.length], 2, false);
  }
  labels.push({ text: "屏東夜市", x: 98, y: 6, z: -100 });

  const carts = [[8, 28, 0], [-8, -28, 1], [108, 24, 2], [8, -36, 3], [-108, 40, 4]];
  carts.forEach(([x, z, i]) => {
    put(x, 0.45, z, 1.15, 0.7, 0.75, hex(0x6b4a32), 0, true);
    put(x, 1.15, z, 0.08, 1.5, 0.08, DARK, 0, true);
    put(x, 1.85, z, 1.7, 0.08, 1.7, AWNING[i % AWNING.length], 0, false);
    colliders.push({ minX: x - 0.7, maxX: x + 0.7, minZ: z - 0.5, maxZ: z + 0.5 });
  });

  // 派出所
  put(-28, 4.8, 74, 20, 9.6, 14, WHITE, 0, true);
  put(-28, 3.2, 67.1, 20.2, 1.2, 0.3, BLUE, 0, true);
  put(-28, 1.5, 66.4, 8, 0.2, 2.4, BLUE, 0, false);
  put(-36, 3.5, 66, 0.12, 7, 0.12, DARK, 0, true);
  collider(-28, 74, 20, 14, "z-", false);
  labels.push({ text: "屏東派出所", x: -28, y: 12, z: 74 });

  // 租屋處
  addBuilding(25, 126, 16, 14, 6, "walkup", hex(0xf0d2b4), "z-");
  labels.push({ text: "租屋處", x: 25, y: 16, z: 126 });

  // 小廟
  put(-112, 2.2, 28, 12, 4.4, 10, BRICK, 0, true);
  putRoof(-112, 4.4, 28, 13, 2.2, 11, hex(0x8e3428));
  put(-112, 1.6, 33.4, 0.4, 3.2, 0.4, hex(0xf2d48a), 0, true);
  put(-108, 1.6, 33.4, 0.4, 3.2, 0.4, hex(0xf2d48a), 0, true);
  put(-116, 1.6, 33.4, 0.4, 3.2, 0.4, hex(0xf2d48a), 0, true);
  collider(-112, 28, 12, 10, "z+", false);
  labels.push({ text: "城隍小廟", x: -112, y: 8, z: 28 });

  // 超商
  put(-22, 2, 132, 12, 4, 8, CREAM, 0, true);
  put(-22, 3.4, 127.6, 10, 0.2, 1.6, hex(0x2f9e6b), 0, false);
  windowBand(-22, 2.2, 132, 12, 8, "z-");
  collider(-22, 132, 12, 8, "z-", true);
  labels.push({ text: "屏東超商", x: -22, y: 6, z: 132 });

  const highway = new MeshBuilder();
  const hw = [];
  for (let i = 0; i <= 40; i++) {
    const t = i / 40;
    const z = -160 - 700 * t;
    hw.push({ x: highwayX(t), z, y: bridgeHeight(t) });
  }
  function ribbon(builder, points, halfW, yBias, color) {
    for (let i = 0; i < points.length - 1; i++) {
      const p = points[i];
      const q = points[i + 1];
      const dx = q.x - p.x;
      const dz = q.z - p.z;
      const len = Math.hypot(dx, dz) || 1;
      const lx = -dz / len;
      const lz = dx / len;
      const y0 = p.y + yBias;
      const y1 = q.y + yBias;
      const a = [p.x + lx * halfW, y0, p.z + lz * halfW];
      const b = [p.x - lx * halfW, y0, p.z - lz * halfW];
      const c = [q.x - lx * halfW, y1, q.z - lz * halfW];
      const d = [q.x + lx * halfW, y1, q.z + lz * halfW];
      builder.quad([a, b, c, d], color, 0, 0);
      builder.quad([a, d, c, b], color, 0, 0);
    }
  }
  ribbon(highway, hw, 7, 0.08, ROAD);
  ribbon(highway, hw, 0.12, 0.14, LINE);
  for (let i = 1; i < hw.length; i += 2) {
    roadSegs.push({ x0: hw[i - 1].x, z0: hw[i - 1].z, x1: hw[i].x, z1: hw[i].z });
    if (i % 4 === 0) {
      addTree(hw[i].x - 12, hw[i].z, 1.1, true);
      if (hw[i].y < 0.4) addTree(hw[i].x + 11, hw[i].z + 4, 1, true);
    }
    if (hw[i].y > 1) {
      put(hw[i].x - 6.5, hw[i].y + 0.6, hw[i].z, 0.15, 1.1, 0.15, hex(0xd7dde6), 0, true);
      put(hw[i].x + 6.5, hw[i].y + 0.6, hw[i].z, 0.15, 1.1, 0.15, hex(0xd7dde6), 0, true);
    }
  }
  // Midway rest stop, still on land west of the water.
  const rest = hw[12];
  put(rest.x - 14, rest.y + 1.6, rest.z, 8, 3.2, 6, CREAM, 0, true);
  put(rest.x - 14, rest.y + 3.3, rest.z, 9, 0.2, 7, hex(0xd64545), 0, true);
  collider(rest.x - 14, rest.z, 8, 6, "x+", false);

  const ocean = new MeshBuilder();
  const coastLand = new MeshBuilder();
  const sea = hex(0x1f7ea8);
  const scrub = hex(0xb7c98a);
  for (let i = 0; i < hw.length - 1; i++) {
    const p = hw[i];
    const q = hw[i + 1];
    const y = -0.45;
    ocean.quad(
      [[p.x + 16, y, p.z], [q.x + 16, y, q.z], [q.x + 130, y, q.z], [p.x + 130, y, p.z]],
      sea, 0, 0,
    );
    ocean.quad(
      [[p.x + 16, y, p.z], [p.x + 130, y, p.z], [q.x + 130, y, q.z], [q.x + 16, y, q.z]],
      sea, 0, 0,
    );
    const g = 0.01;
    coastLand.quad(
      [[p.x - 46, g, p.z], [q.x - 46, g, q.z], [q.x - 8, g, q.z], [p.x - 8, g, p.z]],
      scrub, 0, 0,
    );
    coastLand.quad(
      [[p.x - 46, g, p.z], [p.x - 8, g, p.z], [q.x - 8, g, q.z], [q.x - 46, g, q.z]],
      scrub, 0, 0,
    );
  }
  ocean.box(210, -0.5, -990, 300, 0.3, 280, sea, 0, 0);
  const beach = new MeshBuilder();
  beach.box(48, 0.02, -980, 70, 0.12, 180, SAND, 0, 0);
  const kentingGround = new MeshBuilder();
  kentingGround.box(-10, -0.2, -980, 150, 0.4, 220, hex(0xcfe0b0), 0, 0);

  // 墾丁
  put(0, 0.08, -930, 14, 0.1, 160, ROAD, 0, true);
  roadSegs.push({ x0: 0, z0: -860, x1: 0, z1: -1040 });
  addBuilding(-22, -940, 16, 12, 3, "walkup", hex(0xf7e6c8), "x+");
  addBuilding(-24, -980, 14, 12, 2, "shop", CREAM, "x+");
  addBuilding(-18, -1020, 18, 12, 4, "walkup", hex(0xf3d2a4), "z+");
  put(20, 1.1, -968, 8, 2.2, 4, hex(0xf0b429), 0, true);
  putRot(20, 2.4, -968, 9, 0.12, 5, 0, -0.2, hex(0xd64545), 0);
  for (let i = 0; i < 8; i++) addTree(36 + (i % 4) * 8, -930 - Math.floor(i / 4) * 40, 1.15, true);
  put(8, 2.4, -900, 0.3, 4.8, 0.3, WHITE, 0, true);
  put(8, 5, -900, 4.5, 1.4, 0.2, hex(0x1f4e9a), 0, true);
  labels.push({ text: "墾丁", x: 8, y: 8, z: -910 });
  labels.push({ text: "黑鮪魚季", x: 20, y: 5, z: -968 });

  // Graph
  const nodes = [];
  const adj = [];
  function addNode(x, z) {
    const i = nodes.length;
    nodes.push({ x, z });
    adj.push([]);
    return i;
  }
  function link(i, j) {
    if (i == null || j == null) return;
    adj[i].push(j);
    adj[j].push(i);
  }
  const gindex = new Map();
  for (const x of XS) {
    for (const z of ZS) {
      gindex.set(`${x},${z}`, addNode(x, z));
    }
  }
  for (let i = 0; i < XS.length; i++) {
    for (let j = 0; j < ZS.length; j++) {
      const id = gindex.get(`${XS[i]},${ZS[j]}`);
      if (i + 1 < XS.length) link(id, gindex.get(`${XS[i + 1]},${ZS[j]}`));
      if (j + 1 < ZS.length) link(id, gindex.get(`${XS[i]},${ZS[j + 1]}`));
    }
  }
  let prev = gindex.get("0,-150");
  for (let i = 1; i <= 16; i++) {
    const t = i / 16;
    const z = -160 - 700 * t;
    prev = linkReturn(prev, addNode(highwayX(t), z));
  }
  function linkReturn(a, b) { link(a, b); return b; }
  const k0 = addNode(0, -940);
  link(prev, k0);
  const k1 = addNode(24, -980);
  const k2 = addNode(-16, -1020);
  link(k0, k1); link(k1, k2); link(k2, k0);

  // Sidewalks
  for (const x of XS) {
    for (let z = -145; z <= 145; z += 8) {
      sidewalks.push({ x: x + 9, z });
      sidewalks.push({ x: x - 9, z });
    }
  }
  for (const z of ZS) {
    for (let x = -145; x <= 145; x += 8) sidewalks.push({ x, z: z + 9 });
  }

  const interactables = [
    { id: "home-door", type: "door", name: "租屋處", x: 25, z: 116, to: "home" },
    { id: "shop-door", type: "door", name: "星村店面", x: -100, z: -84, to: "shop" },
    { id: "convenience", type: "work", name: "屏東超商", x: -22, z: 126, job: "store" },
    { id: "delivery", type: "delivery", name: "外送櫃台", x: 64, z: -78 },
    { id: "ring", type: "minigame", name: "套圈圈", x: 132, z: -78, game: "ring" },
    { id: "balloon", type: "minigame", name: "射氣球", x: 60, z: -132, game: "balloon" },
    { id: "temple", type: "temple", name: "城隍小廟", x: -112, z: 34 },
    { id: "tag1", type: "tag", name: "圍牆", x: -70, z: 18 },
    { id: "tag2", type: "tag", name: "後巷牆", x: 22, z: -68 },
    { id: "tag3", type: "tag", name: "公園牆", x: 58, z: 18 },
    { id: "crate", type: "crate", name: "鳳梨酥箱", x: 104, z: -132 },
    { id: "tuna", type: "tuna", name: "黑鮪魚攤", x: 20, z: -968 },
  ];
  for (const n of NPCS) {
    interactables.push({ id: n.id, type: "npc", name: n.name, x: n.x, z: n.z, tint: n.tint });
  }

  // Mark graffiti walls visually.
  put(-70, 1.4, 18, 0.3, 2.4, 3.2, hex(0xd7d0c4), 0, true);
  put(22, 1.4, -68, 3.2, 2.4, 0.3, hex(0xd7d0c4), 0, true);
  put(58, 1.4, 18, 0.3, 2.4, 3.2, hex(0xd7d0c4), 0, true);
  colliders.push({ minX: -70.4, maxX: -69.6, minZ: 16.2, maxZ: 19.8 });
  colliders.push({ minX: 20.2, maxX: 23.8, minZ: -68.4, maxZ: -67.6 });
  colliders.push({ minX: 57.6, maxX: 58.4, minZ: 16.2, maxZ: 19.8 });

  const interiors = {
    home: buildHome(renderer),
    jail: buildJail(renderer),
    shop: buildShop(renderer),
  };

  const chunks = [];
  for (const dual of duals.values()) {
    const mesh = renderer.createMesh(dual.hi);
    const lod = renderer.createMesh(dual.lo) || mesh;
    if (!mesh) continue;
    chunks.push({ mesh, lod, min: mesh.min, max: mesh.max });
  }

  function big(builder) {
    const mesh = renderer.createMesh(builder);
    if (!mesh) return null;
    return { mesh, min: mesh.min, max: mesh.max };
  }

  const grid = new ColliderGrid(colliders, 24);
  const clearWalks = sidewalks.filter((s) => !pointBlocked(grid, s.x, s.z, 0.6));
  const interiorGrids = {
    home: new ColliderGrid(interiors.home.colliders, 8),
    jail: new ColliderGrid(interiors.jail.colliders, 8),
    shop: new ColliderGrid(interiors.shop.colliders, 8),
  };

  return {
    chunks,
    big: [big(cityGround), big(park), big(cityRoads), big(highway), big(coastLand), big(kentingGround), big(beach)].filter(Boolean),
    water: [big(ocean), big(pondMesh())].filter(Boolean),
    colliders,
    covers,
    grid,
    interiorGrids,
    interiors,
    npcs: NPCS,
    parked,
    interactables,
    sidewalks: clearWalks.length ? clearWalks : sidewalks,
    roadSegs,
    graph: { nodes, adj },
    labels,
    spawn: PLACES.spawn,
  };

  function pondMesh() {
    const b = new MeshBuilder();
    b.disc(104, 0.12, 58, 13.2, 16, WATER, 0, 0);
    return b;
  }
}

function buildHome(renderer) {
  const b = new MeshBuilder();
  const x = 2000, z = 2000;
  b.box(x, 0.05, z, 8, 0.1, 6.2, hex(0xc9843a), 0, 0);
  b.box(x, 1.6, z + 3, 8.2, 3.2, 0.2, hex(0xf3e6d0), 0, 0);
  b.box(x, 1.6, z - 3, 8.2, 3.2, 0.2, hex(0xf3e6d0), 0, 0);
  b.box(x - 4, 1.6, z, 0.2, 3.2, 6.2, hex(0xf3e6d0), 0, 0);
  b.box(x + 4, 1.6, z, 0.2, 3.2, 6.2, hex(0xf3e6d0), 0, 0);
  b.box(x, 3.2, z, 8.2, 0.16, 6.2, hex(0xf7f1e6), 0, 0);
  b.box(x - 1.6, 0.45, z - 0.4, 1.7, 0.55, 2.3, hex(0xf4f1ea), 0, 0);
  b.box(x - 1.6, 0.8, z - 0.9, 1.5, 0.25, 0.9, hex(0xd64545), 0, 0);
  b.box(x + 1.5, 0.45, z + 0.8, 1.2, 0.7, 0.8, hex(0x8d5a3c), 0, 0);
  b.box(x + 3.7, 1.7, z, 0.1, 1.2, 1.4, hex(0xffe1a8), 1, 0);
  const colliders = [
    { minX: x - 4.2, maxX: x + 4.2, minZ: z + 2.8, maxZ: z + 3.3 },
    { minX: x - 4.2, maxX: x - 0.8, minZ: z - 3.3, maxZ: z - 2.7 },
    { minX: x + 0.8, maxX: x + 4.2, minZ: z - 3.3, maxZ: z - 2.7 },
    { minX: x - 4.3, maxX: x - 3.8, minZ: z - 3.2, maxZ: z + 3.2 },
    { minX: x + 3.8, maxX: x + 4.3, minZ: z - 3.2, maxZ: z + 3.2 },
    { minX: x - 2.4, maxX: x - 0.8, minZ: z - 1.4, maxZ: z + 0.6 },
  ];
  return {
    mesh: renderer.createMesh(b),
    colliders,
    spawn: { x, y: 0, z: z + 0.4, yaw: Math.PI },
    exit: { x, z: z - 2.5 },
    outside: { x: 25, z: 114, yaw: Math.PI },
  };
}

function buildJail(renderer) {
  const b = new MeshBuilder();
  const x = 3000, z = 3000;
  b.box(x, 0.05, z, 6, 0.1, 6, hex(0xc8c2b6), 0, 0);
  b.box(x, 1.6, z + 2.9, 6.2, 3.2, 0.2, hex(0xd9d3c7), 0, 0);
  b.box(x, 1.6, z - 2.9, 6.2, 3.2, 0.2, hex(0xd9d3c7), 0, 0);
  b.box(x - 2.9, 1.6, z, 0.2, 3.2, 6, hex(0xd9d3c7), 0, 0);
  b.box(x + 2.9, 1.6, z, 0.2, 3.2, 6, hex(0xd9d3c7), 0, 0);
  b.box(x, 3.2, z, 6.2, 0.16, 6, hex(0xb7b1a4), 0, 0);
  for (let i = -2; i <= 2; i++) b.cylinder(x - 1.2 + i * 0.45, 1.5, z - 1.2, 0.05, 2.8, 6, hex(0x22262c), 0, 0, "y");
  b.box(x + 1.3, 0.45, z + 0.8, 1.6, 0.4, 0.6, hex(0x6b4a32), 0, 0);
  b.box(x, 2.6, z, 0.4, 0.12, 0.4, hex(0xffe1a8), 2, 0);
  const colliders = [
    { minX: x - 3.1, maxX: x + 3.1, minZ: z + 2.6, maxZ: z + 3.2 },
    { minX: x - 3.1, maxX: x + 3.1, minZ: z - 3.2, maxZ: z - 2.6 },
    { minX: x - 3.2, maxX: x - 2.6, minZ: z - 3, maxZ: z + 3 },
    { minX: x + 2.6, maxX: x + 3.2, minZ: z - 3, maxZ: z + 3 },
  ];
  return {
    mesh: renderer.createMesh(b),
    colliders,
    spawn: { x, y: 0, z, yaw: 0 },
    exit: { x, z: z - 2.3 },
    outside: { x: -28, z: 64, yaw: Math.PI },
  };
}

function buildShop(renderer) {
  const b = new MeshBuilder();
  const x = 4000, z = 4000;
  b.box(x, 0.05, z, 10, 0.1, 8, hex(0xe7d3b0), 0, 0);
  b.box(x, 1.8, z + 3.9, 10.2, 3.6, 0.2, hex(0xf7efe2), 0, 0);
  b.box(x, 1.8, z - 3.9, 10.2, 3.6, 0.2, hex(0xf7efe2), 0, 0);
  b.box(x - 5, 1.8, z, 0.2, 3.6, 8, hex(0xf7efe2), 0, 0);
  b.box(x + 5, 1.8, z, 0.2, 3.6, 8, hex(0xf7efe2), 0, 0);
  b.box(x, 3.6, z, 10.2, 0.16, 8, hex(0xf4f1ea), 0, 0);
  b.box(x, 1.05, z + 1.2, 4.6, 1.1, 0.8, hex(0x8d5a3c), 0, 0);
  b.box(x, 2.4, z + 3.6, 3, 0.8, 0.1, hex(0xffe1a8), 1, 0);
  const colliders = [
    { minX: x - 5.2, maxX: x + 5.2, minZ: z + 3.6, maxZ: z + 4.2 },
    { minX: x - 5.2, maxX: x - 1.2, minZ: z - 4.2, maxZ: z - 3.5 },
    { minX: x + 1.2, maxX: x + 5.2, minZ: z - 4.2, maxZ: z - 3.5 },
    { minX: x - 5.3, maxX: x - 4.7, minZ: z - 4, maxZ: z + 4 },
    { minX: x + 4.7, maxX: x + 5.3, minZ: z - 4, maxZ: z + 4 },
    { minX: x - 2.4, maxX: x + 2.4, minZ: z + 0.7, maxZ: z + 1.8 },
  ];
  return {
    mesh: renderer.createMesh(b),
    colliders,
    spawn: { x, y: 0, z: z - 1.5, yaw: 0 },
    exit: { x, z: z - 3.4 },
    outside: { x: -100, z: -84, yaw: 0 },
    counter: { x, z: z + 0.2 },
  };
}
