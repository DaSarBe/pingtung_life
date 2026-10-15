// 建築與場景模型（卡通低多邊形）。
// 幾何寫進既有的 MeshBuilder，重複的樹、路燈、燈籠先烤成模板再蓋章，
// 近景與遠景各一份，沿用 world.js 約 95 公尺的 LOD 切換。
// 這個渲染器沒有 GPU InstancedMesh，所以用合併頂點代替實例化，避免一物一 draw call。
//
// 匯出：
//   pickSceneDetail()
//   buildCityGround(builder, detail)
//   buildCityRoads(builder, xs, zs, detail)
//   buildParkGround(builder)
//   PARK_POND
//   createBuildingKit({ getDual, detail })
//     .tree(x, z, scale, kind)   kind: "palm" | "shade" | "flame" | true/false
//     .lamp(x, z)
//     .stall(x, z, kind)         kind 可省略，會依座標挑
//     .stallWire(x0, x1, z)      相鄰攤位之間的燈串，只在間距小時呼叫
//     .cart(x, z, i)
//     .building(x, z, w, d, floors, style, wall, face)
//     .station() .department() .park() .starVillage()
//     .police() .temple() .convenience() .tunaStand()

import { MeshBuilder, hex } from "./engine.js";

export const PARK_POND = { x: 125, z: 75, r: 7.5 };

const ROAD = hex(0x4b5362);
const LINE = hex(0xf7f4ee);
const ZEBRA = hex(0xfffaf2);
const WALK = hex(0xd7cebf);
const WALK2 = hex(0xc9bfae);
const GROUND = [hex(0xd5cec0), hex(0xe0d6c6), hex(0xcbbfae)];
const GRASS = hex(0x63a246);
const GRASS2 = hex(0x7eb85c);
const PATH = hex(0xe6d8bc);
const FLOWER_C = [hex(0xe25b6a), hex(0xf0b429), hex(0xf27bb0), hex(0xfff3c4)];
const CREAM = hex(0xfff6ea);
const PLASTER = hex(0xf6d7b4);
const WOOD = hex(0x8d5a3c);
const WOOD_DARK = hex(0x5c3a28);
const ROOF = hex(0xc44732);
const ROOF_DARK = hex(0x8e3428);
const TILE = hex(0xd7dde4);
const GLASS = hex(0x9fd4ea);
const WINDOW = hex(0xffe7b0);
const FRAME = hex(0x2a3340);
const CONCRETE = hex(0xc8c2b6);
const WHITE = hex(0xf7f4ee);
const BLUE = hex(0x1f4e9a);
const TEAL = hex(0x1f8a86);
const DARK = hex(0x2a2e34);
const INK = hex(0x1c2128);
const TRUNK = hex(0x6b4630);
const TRUNK2 = hex(0x8a6244);
const PALM = hex(0x2f8a48);
const PALM2 = hex(0x46a85a);
const LEAF = hex(0x3c8f46);
const LEAF2 = hex(0x2f7a3c);
const FLAME = hex(0xe25a32);
const FLAME2 = hex(0xf0a14a);
const GOLD = hex(0xf2d48a);
const RED = hex(0xd64545);
const LANTERN = hex(0xe23b3b);
const AWNINGS = [hex(0xd64545), hex(0xf0b429), hex(0x2a9d8f), hex(0xe07a5f), hex(0x3d7ea6), hex(0xc45c9a)];

export function pickSceneDetail() {
  if (typeof window === "undefined") return 2;
  const small = Math.min(window.innerWidth || 1200, window.innerHeight || 800) <= 820;
  const coarse = window.matchMedia?.("(pointer: coarse)")?.matches;
  return small || coarse ? 1 : 2;
}

function shade(c, m) {
  return [clamp01(c[0] * m), clamp01(c[1] * m), clamp01(c[2] * m)];
}

function mix(a, b, t) {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}

function clamp01(v) {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

function hash2(ix, iz) {
  const n = Math.sin(ix * 127.1 + iz * 311.7) * 43758.5453;
  return n - Math.floor(n);
}

function bake(draw) {
  const b = new MeshBuilder();
  draw(b);
  return b;
}

// 把烤好的模板蓋進目標網格（平移、繞 Y、等比縮放）。yaw 與 engine.boxRot 相同。
function stamp(target, proto, x, y, z, yaw = 0, s = 1) {
  if (!proto || proto.idx.length === 0) return;
  const cy = Math.cos(yaw);
  const sy = Math.sin(yaw);
  const base = target.pos.length / 3;
  const p = proto.pos;
  const nrm = proto.nrm;
  const col = proto.col;
  for (let i = 0, v = 0; i < p.length; i += 3, v++) {
    const px = p[i] * s;
    const py = p[i + 1] * s;
    const pz = p[i + 2] * s;
    const rx = px * cy + pz * sy;
    const rz = -px * sy + pz * cy;
    const nx = nrm[i];
    const ny = nrm[i + 1];
    const nz = nrm[i + 2];
    target.vert(
      rx + x, py + y, rz + z,
      nx * cy + nz * sy, ny, -nx * sy + nz * cy,
      col[i], col[i + 1], col[i + 2],
      proto.glow[v], proto.tint[v],
    );
  }
  const idx = proto.idx;
  for (let i = 0; i < idx.length; i++) target.idx.push(idx[i] + base);
}

function flat(b, x, z, sx, sz, y, color) {
  const hx = sx / 2;
  const hz = sz / 2;
  b.quad([
    [x - hx, y, z - hz],
    [x - hx, y, z + hz],
    [x + hx, y, z + hz],
    [x + hx, y, z - hz],
  ], color, 0, 0);
}

export function buildCityGround(builder, detail = 2) {
  const tile = detail >= 2 ? 40 : 57.5;
  const n = Math.round(460 / tile);
  const origin = -230;
  for (let ix = 0; ix < n; ix++) {
    for (let iz = 0; iz < n; iz++) {
      const color = GROUND[Math.floor(hash2(ix, iz) * 3) % 3];
      const x = origin + tile * (ix + 0.5);
      const z = origin + tile * (iz + 0.5);
      builder.box(x, -0.22, z, tile, 0.44, tile, color, 0, 0);
    }
  }
}

export function buildCityRoads(builder, xs, zs, detail = 2) {
  // 路面、人行道、路口各做一塊，彼此不重疊，標線明顯浮在路面上，避免共面摩爾紋。
  const half = 5.22;
  const walkIn = 5.28;
  const walkOut = 9.55;
  const walkW = walkOut - walkIn;
  const roadTop = 0.08;
  const markY = 0.125;
  const piece = detail >= 2 ? 18 : 28;

  for (const x of xs) {
    for (let i = 0; i < zs.length - 1; i++) {
      const a = zs[i] + half;
      const b = zs[i + 1] - half;
      layRun(builder, x, a, b, "z", half, walkIn, walkW, roadTop, markY, piece, detail);
    }
  }
  for (const z of zs) {
    for (let i = 0; i < xs.length - 1; i++) {
      const a = xs[i] + half;
      const b = xs[i + 1] - half;
      layRun(builder, z, a, b, "x", half, walkIn, walkW, roadTop, markY, piece, detail);
    }
  }

  for (const x of xs) {
    for (const z of zs) {
      builder.box(x, roadTop / 2, z, half * 2, roadTop, half * 2, ROAD, 0, 0);
      cornerPad(builder, x, z, 1, 1, walkIn, walkW);
      cornerPad(builder, x, z, 1, -1, walkIn, walkW);
      cornerPad(builder, x, z, -1, 1, walkIn, walkW);
      cornerPad(builder, x, z, -1, -1, walkIn, walkW);
    }
  }
}

function layRun(b, fixed, a, bEnd, axis, half, walkIn, walkW, roadTop, markY, piece, detail) {
  const len = bEnd - a;
  const n = Math.max(1, Math.ceil(len / piece));
  const walkY = 0.105;
  const walkH = 0.15;
  for (let i = 0; i < n; i++) {
    const t0 = a + (len * i) / n;
    const t1 = a + (len * (i + 1)) / n;
    const mid = (t0 + t1) / 2;
    const seg = t1 - t0;
    const walkColor = ((i + Math.round(fixed)) % 2 === 0) ? WALK : WALK2;
    if (axis === "z") {
      b.box(fixed, roadTop / 2, mid, half * 2, roadTop, seg, ROAD, 0, 0);
      b.box(fixed - (walkIn + walkW / 2), walkY, mid, walkW, walkH, seg, walkColor, 0, 0);
      b.box(fixed + (walkIn + walkW / 2), walkY, mid, walkW, walkH, seg, walkColor, 0, 0);
      flat(b, fixed - half + 0.42, mid, 0.1, seg * 0.9, markY, LINE);
      flat(b, fixed + half - 0.42, mid, 0.1, seg * 0.9, markY, LINE);
    } else {
      b.box(mid, roadTop / 2, fixed, seg, roadTop, half * 2, ROAD, 0, 0);
      b.box(mid, walkY, fixed - (walkIn + walkW / 2), seg, walkH, walkW, walkColor, 0, 0);
      b.box(mid, walkY, fixed + (walkIn + walkW / 2), seg, walkH, walkW, walkColor, 0, 0);
      flat(b, mid, fixed - half + 0.42, seg * 0.9, 0.1, markY, LINE);
      flat(b, mid, fixed + half - 0.42, seg * 0.9, 0.1, markY, LINE);
    }
    for (let t = t0 + 2.2; t < t1 - 1.2; t += 5.6) {
      if (axis === "z") flat(b, fixed, t, 0.18, 2.15, markY, LINE);
      else flat(b, t, fixed, 2.15, 0.18, markY, LINE);
    }
    if (detail >= 2) {
      if (i === 0) zebra(b, axis === "z" ? fixed : t0 + 2.4, axis === "z" ? t0 + 2.4 : fixed, axis, half, markY);
      if (i === n - 1) zebra(b, axis === "z" ? fixed : t1 - 2.4, axis === "z" ? t1 - 2.4 : fixed, axis, half, markY);
    }
  }
}

function cornerPad(b, x, z, sx, sz, walkIn, walkW) {
  const cx = x + sx * (walkIn + walkW / 2);
  const cz = z + sz * (walkIn + walkW / 2);
  b.box(cx, 0.105, cz, walkW, 0.15, walkW, WALK, 0, 0);
}

function zebra(b, x, z, axis, half, y) {
  const stripes = 4;
  const span = half * 2 - 1.6;
  const lift = y + 0.016;
  for (let i = 0; i < stripes; i++) {
    const u = (i - (stripes - 1) / 2) * 0.78;
    if (axis === "z") flat(b, x, z + u, span, 0.4, lift, ZEBRA);
    else flat(b, x + u, z, 0.4, span, lift, ZEBRA);
  }
}

export function buildParkGround(builder) {
  const lawns = [
    [75, 25], [75, 75], [125, 25], [125, 75],
  ];
  for (const [x, z] of lawns) {
    const color = z > 50 ? GRASS : GRASS2;
    builder.box(x, 0.025, z, 28.4, 0.05, 28.4, color, 0, 0);
    builder.box(x, 0.1, z, 2.1, 0.08, 16, PATH, 0, 0);
    builder.box(x, 0.1, z, 16, 0.08, 2.1, PATH, 0, 0);
  }
  const pond = PARK_POND;
  builder.disc(pond.x, 0.055, pond.z, pond.r + 1.15, 16, hex(0xc5bfb4), 0, 0);
  builder.disc(pond.x, 0.07, pond.z, pond.r - 0.35, 14, hex(0x2f86a8), 0, 0);
  flowerBed(builder, 64, 16, 3.2, 1.6);
  flowerBed(builder, 86, 36, 1.6, 3.2);
  flowerBed(builder, 114, 18, 3.4, 1.5);
  flowerBed(builder, 136, 36, 1.5, 3.2);
  flowerBed(builder, 64, 64, 3.2, 1.6);
  flowerBed(builder, 136, 86, 3.2, 1.6);
}

function flowerBed(b, x, z, w, d) {
  b.box(x, 0.08, z, w, 0.1, d, hex(0x6b4a32), 0, 0);
  b.box(x, 0.16, z, w * 0.86, 0.08, d * 0.8, hex(0x3e8a40), 0, 0);
}

function makeProps(detail) {
  const rich = detail >= 2;
  const palmHi = bake((b) => drawPalm(b, rich ? 7 : 5, true));
  const palmLo = bake((b) => {
    b.cylinder(0, 2.1, 0, 0.16, 4.2, 5, TRUNK, 0, 0, "y");
    b.cone(0, 4.5, 0, 1.15, 1.8, 5, PALM, 0, 0);
  });
  const shadeHi = bake((b) => drawShade(b, rich));
  const shadeLo = bake((b) => {
    b.cylinder(0, 1.15, 0, 0.16, 2.3, 5, TRUNK, 0, 0, "y");
    b.cone(0, 2.7, 0, 1.25, 2.1, 5, LEAF, 0, 0);
  });
  const flameHi = bake((b) => drawFlame(b, rich));
  const flameLo = bake((b) => {
    b.cylinder(0, 1.2, 0, 0.18, 2.4, 5, TRUNK, 0, 0, "y");
    b.cone(0, 3.1, 0, 1.7, 1.5, 5, FLAME, 0, 0);
  });
  const lampHi = bake((b) => drawLamp(b, true));
  const lampLo = bake((b) => drawLamp(b, false));
  const lantern = bake((b) => drawLantern(b, 0, 0, 0, LANTERN));
  return { palmHi, palmLo, shadeHi, shadeLo, flameHi, flameLo, lampHi, lampLo, lantern, rich };
}

function drawPalm(b, fronds, coconuts) {
  b.cylinder(0, 0.9, 0, 0.2, 1.8, 6, TRUNK2, 0, 0, "y");
  b.cylinder(0, 2.7, 0, 0.15, 1.9, 6, TRUNK, 0, 0, "y");
  b.cylinder(0, 4.15, 0, 0.11, 1.15, 5, shade(TRUNK, 0.85), 0, 0, "y");
  const pitch = 0.58;
  const half = 0.78;
  const cp = Math.cos(pitch);
  const sp = Math.sin(pitch);
  for (let i = 0; i < fronds; i++) {
    const yaw = (i / fronds) * Math.PI * 2;
    const sy = Math.sin(yaw);
    const cy = Math.cos(yaw);
    const color = i % 2 ? PALM2 : PALM;
    b.boxRot(sy * cp * half, 4.55 - sp * half, cy * cp * half, 0.16, 0.045, 1.56, yaw, pitch, color, 0, 0);
  }
  if (coconuts) {
    b.sphere(0.16, 4.35, 0.08, 0.1, 5, hex(0x6b8a3a), 0, 0);
    b.sphere(-0.1, 4.32, -0.12, 0.09, 5, hex(0x7a9a44), 0, 0);
  }
}

function drawShade(b, rich) {
  b.cylinder(0, 0.15, 0, 0.34, 0.22, 6, shade(TRUNK, 0.8), 0, 0, "y");
  b.cylinder(0, 1.25, 0, 0.16, 2.2, 6, TRUNK, 0, 0, "y");
  b.sphere(0, 2.85, 0, 1.15, rich ? 7 : 5, LEAF, 0, 0);
  b.sphere(0.45, 2.45, 0.2, 0.78, 5, LEAF2, 0, 0);
  b.sphere(-0.4, 2.55, -0.25, 0.7, 5, hex(0x4ea056), 0, 0);
  if (rich) b.sphere(0.1, 3.35, -0.15, 0.62, 5, hex(0x57b25e), 0, 0);
}

function drawFlame(b, rich) {
  b.cylinder(0, 1.15, 0, 0.18, 2.3, 6, TRUNK2, 0, 0, "y");
  b.sphere(0, 2.55, 0, 0.95, 6, LEAF2, 0, 0);
  b.sphere(0.7, 2.85, 0.15, 0.85, 6, FLAME, 0, 0);
  b.sphere(-0.65, 2.9, -0.1, 0.8, 6, FLAME2, 0, 0);
  b.sphere(0.05, 3.25, -0.45, 0.7, 5, hex(0xd94b3a), 0, 0);
  if (rich) {
    b.boxRot(0.9, 2.4, 0.2, 0.12, 0.08, 1.1, 0.4, 0.5, TRUNK, 0, 0);
    b.boxRot(-0.85, 2.45, -0.1, 0.12, 0.08, 1.05, 2.4, 0.45, TRUNK, 0, 0);
  }
}

function drawLamp(b, rich) {
  const pole = hex(0x343a44);
  b.cylinder(0, 0.08, 0, 0.22, 0.14, 6, hex(0x23272e), 0, 0, "y");
  b.cylinder(0, 1.65, 0, rich ? 0.075 : 0.08, 3.2, rich ? 6 : 4, pole, 0, 0, "y");
  b.box(0, 3.28, 0.42, 0.08, 0.08, 0.84, pole, 0, 0);
  b.box(0.28, 3.22, 0.78, 0.08, 0.22, 0.08, pole, 0, 0);
  b.box(-0.28, 3.22, 0.78, 0.08, 0.22, 0.08, pole, 0, 0);
  b.box(0, 3.08, 0.78, 0.62, 0.1, 0.36, hex(0x1c2128), 0, 0);
  b.box(0, 3.0, 0.78, 0.4, 0.06, 0.22, WINDOW, 2, 0);
  if (rich) b.box(0, 1.9, 0.08, 0.04, 0.7, 0.28, hex(0xf4e1a8), 0, 0);
}

function drawLantern(b, x, y, z, color) {
  b.box(x, y + 0.22, z, 0.045, 0.18, 0.045, INK, 0, 0);
  b.cylinder(x, y, z, 0.13, 0.26, 6, color, 2, 0, "y");
  b.cylinder(x, y + 0.16, z, 0.15, 0.06, 6, GOLD, 1, 0, "y");
  b.cylinder(x, y - 0.15, z, 0.1, 0.05, 5, shade(color, 0.75), 1, 0, "y");
}

export function createBuildingKit({ getDual, detail = 2 }) {
  const props = makeProps(detail);
  const rich = detail >= 2;
  let seed = 0x51a7;
  const rnd = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };

  function at(x, z) {
    return getDual(x, z);
  }

  function putBoth(x, z, drawHi, drawLo) {
    const d = at(x, z);
    drawHi(d.hi);
    (drawLo || drawHi)(d.lo);
  }

  function tree(x, z, scale = 1, kind = "shade") {
    let name = kind === true ? "palm" : kind === false ? "shade" : kind;
    if (name === "shade" && rnd() > 0.82) name = "flame";
    const table = {
      palm: [props.palmHi, props.palmLo],
      flame: [props.flameHi, props.flameLo],
      shade: [props.shadeHi, props.shadeLo],
    };
    const pair = table[name] || table.shade;
    const d = at(x, z);
    const yaw = rnd() * Math.PI * 2;
    stamp(d.hi, pair[0], x, 0, z, yaw, scale);
    stamp(d.lo, pair[1], x, 0, z, yaw, scale);
  }

  function lamp(x, z) {
    const d = at(x, z);
    stamp(d.hi, props.lampHi, x, 0, z, 0, 1);
    stamp(d.lo, props.lampLo, x, 0, z, 0, 1);
  }

  function building(x, z, w, d, floors, style, wall, face) {
    if (style === "shop") drawShop(x, z, w, d, floors, wall, face);
    else if (style === "wood") drawHouse(x, z, w, d, wall, face);
    else drawWalkup(x, z, w, d, floors, wall, face);
  }

  function drawShop(x, z, w, d, floors, wall, face) {
    const fh = 3.15;
    const porch = 1.7;
    const upper = Math.max(1, floors - 1);
    const uh = upper * fh;
    const paint = mix(wall, CREAM, 0.25);
    const awning = AWNINGS[Math.floor(rnd() * AWNINGS.length)];
    const orient = frontOf(face, w, d);
    putBoth(x, z, (b) => {
      const solidDepth = orient.depth - porch;
      const shift = porch / 2;
      const sx = orient.axis === "z" ? orient.span : solidDepth;
      const sz = orient.axis === "z" ? solidDepth : orient.span;
      const cx = x - orient.outX * shift;
      const cz = z - orient.outZ * shift;
      b.box(cx, fh / 2, cz, sx, fh, sz, paint, 0, 0);
      b.box(x, fh + uh / 2 - 0.05, z, w, uh + 0.1, d, paint, 0, 0);
      trimFloors(b, x, z, w, d, upper, fh, fh, face, shade(paint, 0.78));
      cornice(b, x, fh + uh, z, w, d, shade(paint, 0.7));
      roofCap(b, x, fh + uh + 0.15, z, w, d);
      columns(b, x, z, orient, fh, shade(wall, 0.82));
      storefront(b, x, z, orient, porch, fh, awning);
      windowsOn(b, x, z, w, d, upper, face, fh, rich);
      bladeSign(b, x, z, orient, fh + 1.15, awning);
    }, (b) => {
      b.box(x, (fh + uh) / 2, z, w, fh + uh, d, paint, 0, 0);
      roofCap(b, x, fh + uh + 0.15, z, w, d);
      windowBand(b, x, z, w, d, face, fh + uh * 0.45);
    });
  }

  function drawWalkup(x, z, w, d, floors, wall, face) {
    const fh = 3.15;
    const h = floors * fh;
    const paint = mix(wall, CREAM, 0.12);
    const band = mix(paint, hex(0xf7efe2), 0.35);
    putBoth(x, z, (b) => {
      b.box(x, 0.2, z, w + 0.18, 0.4, d + 0.18, shade(paint, 0.72), 0, 0);
      b.box(x, h / 2, z, w, h, d, paint, 0, 0);
      for (let f = 1; f < floors; f++) {
        facadeStrip(b, x, z, w, d, face, f * fh, w, d, band);
      }
      cornice(b, x, h, z, w, d, shade(paint, 0.62));
      parapet(b, x, h + 0.28, z, w, d, shade(paint, 0.8));
      b.box(x - w * 0.22, h + 0.85, z - d * 0.12, 1.5, 1.15, 1.5, hex(0xb7c3cc), 0, 0);
      b.box(x + w * 0.24, h + 0.55, z + d * 0.18, 0.7, 0.7, 0.7, hex(0x9aa6b0), 0, 0);
      windowsOn(b, x, z, w, d, floors, face, 0, rich);
      door(b, x, z, w, d, face, shade(FRAME, 1));
      if (rich && floors > 2) balcony(b, x, z, w, d, face, fh * 2 + 0.15);
      if ((face === "z+" || face === "z-") && d > 8) windowsOn(b, x, z, w, d, Math.min(floors, 3), "x+", 0, false);
      else if ((face === "x+" || face === "x-") && w > 8) windowsOn(b, x, z, w, d, Math.min(floors, 3), "z+", 0, false);
    }, (b) => {
      b.box(x, h / 2, z, w, h, d, paint, 0, 0);
      parapet(b, x, h + 0.22, z, w, d, shade(paint, 0.8));
      windowBand(b, x, z, w, d, face, h * 0.55);
    });
  }

  function drawHouse(x, z, w, dpt, wall, face) {
    const paint = mix(wall, hex(0xf0d2b0), 0.62);
    const h = 2.7;
    putBoth(x, z, (b) => {
      b.box(x, 0.18, z, w + 0.3, 0.36, dpt + 0.3, shade(WOOD, 0.7), 0, 0);
      b.box(x, h / 2 + 0.28, z, w, h, dpt, paint, 0, 0);
      plankLines(b, x, z, w, dpt, face, h);
      b.prismRoof(x, h + 0.28, z, w + 0.85, 1.25, dpt + 0.85, ROOF, 0, 0);
      b.box(x, h + 1.58, z, w + 0.2, 0.08, 0.16, GOLD, 0, 0);
      porchRoof(b, x, z, w, dpt, face, h);
      houseWindows(b, x, z, w, dpt, face, paint);
      b.box(x + w * 0.28, h + 1.15, z - dpt * 0.18, 0.42, 0.7, 0.42, hex(0x6e5048), 0, 0);
    }, (b) => {
      b.box(x, h / 2, z, w, h, dpt, paint, 0, 0);
      b.prismRoof(x, h, z, w + 0.7, 1.15, dpt + 0.7, ROOF, 0, 0);
    });
  }

  function stall(x, z, kind) {
    const resolved = kind || stallKind(x, z);
    const yaw = z < -28 ? 0 : Math.PI;
    const colors = {
      grill: [hex(0xd64545), hex(0xfff1d2)],
      drink: [hex(0x1f8a86), hex(0xe7fff8)],
      fruit: [hex(0xf0a202), hex(0xfff6df)],
      cloth: [hex(0xd45d8b), hex(0xfff0f6)],
      snack: [hex(0xe07a3a), hex(0xfff3df)],
      balloon: [hex(0x7c5cbf), hex(0xf6f0ff)],
      ring: [hex(0x3d7ea6), hex(0xf3fbff)],
    };
    const pair = colors[resolved] || colors.snack;
    putBoth(x, z, (b) => {
      drawStall(b, x, z, yaw, pair[0], pair[1], resolved, rich);
      const spots = rich ? [[-1.15, 0.62], [1.15, 0.62], [-1.15, -0.78], [1.15, -0.78]] : [[-1.1, -0.7], [1.1, -0.7]];
      for (const [lx, lz] of spots) {
        stamp(b, props.lantern, x + localX(yaw, lx, lz), 1.78, z + localZ(yaw, lz, lx), 0, rich ? 1.35 : 1);
      }
    }, (b) => {
      b.box(x, 0.48, z, 2.2, 0.9, 1.05, WOOD, 0, 0);
      b.box(x, 2.15, z, 2.5, 0.1, 1.45, pair[0], 0, 0);
    });
  }

  function stallWire(x0, x1, z) {
    const mid = (x0 + x1) / 2;
    const span = x1 - x0;
    putBoth(mid, z, (b) => {
      b.box(mid, 2.72, z, span - 1.6, 0.04, 0.04, INK, 0, 0);
      for (let i = -1; i <= 1; i++) b.box(mid + i * (span * 0.18), 2.62, z, 0.12, 0.12, 0.12, GOLD, 2, 0);
    }, (b) => {
      b.box(mid, 2.7, z, span - 1.6, 0.05, 0.05, GOLD, 1, 0);
    });
  }

  function cart(x, z, i) {
    const color = AWNINGS[i % AWNINGS.length];
    putBoth(x, z, (b) => {
      b.box(x, 0.42, z, 1.15, 0.7, 0.78, WOOD, 0, 0);
      b.box(x, 0.82, z, 1.25, 0.08, 0.88, hex(0xc9843a), 0, 0);
      b.cylinder(x, 1.15, z, 0.035, 1.5, 5, INK, 0, 0, "y");
      b.box(x, 1.9, z, 1.7, 0.07, 1.35, color, 0, 0);
      b.box(x, 2.05, z, 0.7, 0.28, 0.06, CREAM, 0, 0);
      b.box(x, 1.55, z, 0.35, 0.08, 0.35, WINDOW, 2, 0);
    }, (b) => {
      b.box(x, 0.45, z, 1.15, 0.7, 0.78, WOOD, 0, 0);
      b.box(x, 1.85, z, 1.6, 0.08, 1.3, color, 0, 0);
    });
  }

  function station() {
    const x = 0;
    const z = 176;
    putBoth(x, z, (b) => drawStation(b, rich), (b) => {
      b.box(0, 4.7, 176, 78, 9.4, 16, CREAM, 0, 0);
      b.box(0, 9.7, 176, 80, 0.7, 18, ROOF_DARK, 0, 0);
      b.box(-30, 8, 171.35, 7.2, 16, 7.2, CREAM, 0, 0);
      b.box(0, 1.7, 194, 42, 3.2, 8, TILE, 0, 0);
      b.box(0, 8.4, 167.7, 22, 1.8, 0.4, RED, 0, 0);
    });
    if (rich) {
      tree(-22, 160, 1.05, "palm");
      tree(22, 160, 1.1, "palm");
      tree(34, 161, 0.95, "shade");
    }
  }

  function department() {
    putBoth(-25, -25, (b) => drawDepartment(b, rich), (b) => {
      b.box(-25, 9.6, -25, 32, 19.2, 26, hex(0xe7eef5), 0, 0);
      b.box(-25, 19.5, -18, 22, 1.5, 6, RED, 0, 0);
      b.box(-25, 6, -11.7, 26, 1.2, 0.25, GLASS, 1, 0);
    });
    if (rich) {
      tree(-36, -8, 0.85, "palm");
      tree(-14, -8, 0.85, "palm");
    }
  }

  function park() {
    tree(68, 30, 1.15, "flame");
    tree(84, 18, 0.95, "shade");
    tree(64, 34, 1.05, "palm");
    tree(86, 34, 1.0, "palm");
    tree(118, 20, 1.1, "palm");
    tree(134, 30, 1.05, "palm");
    tree(114, 34, 0.9, "shade");
    tree(66, 86, 1.0, "palm");
    tree(86, 64, 1.15, "shade");
    tree(136, 64, 1.05, "flame");
    tree(118, 88, 0.95, "palm");
    putBoth(75, 74, (b) => drawPavilion(b, 75, 74, rich), (b) => {
      b.box(75, 1.5, 74, 7.2, 3, 7.2, RED, 0, 0);
      b.box(75, 3.3, 74, 8.4, 0.35, 8.4, ROOF_DARK, 0, 0);
    });
    putBoth(PARK_POND.x, PARK_POND.z, (b) => {
      rim(b, PARK_POND.x, PARK_POND.z, PARK_POND.r + 0.15, rich ? 14 : 8);
      if (rich) {
        b.box(PARK_POND.x + 6.2, 0.45, PARK_POND.z, 1.4, 0.7, 0.45, WOOD, 0, 0);
        b.box(PARK_POND.x, 0.45, PARK_POND.z + 6.2, 0.45, 0.7, 1.4, WOOD, 0, 0);
      }
    }, (b) => {
      rim(b, PARK_POND.x, PARK_POND.z, PARK_POND.r + 0.15, 8);
    });
    putBoth(62, 14, (b) => {
      b.box(62, 1.35, 14, 0.28, 2.5, 0.28, WOOD_DARK, 0, 0);
      b.box(64.3, 1.35, 14, 0.28, 2.5, 0.28, WOOD_DARK, 0, 0);
      b.box(63.15, 2.55, 14, 3.1, 1.15, 0.18, hex(0x1f6b4a), 0, 0);
      b.box(63.15, 2.55, 14.08, 2.3, 0.55, 0.06, CREAM, 0, 0);
    });
    lamp(70, 18);
    lamp(82, 34);
    lamp(120, 18);
    lamp(132, 66);
  }

  function starVillage() {
    putBoth(-112, -112, (b) => {
      b.box(-114.2, 1.7, -112, 0.38, 3.4, 0.38, CREAM, 0, 0);
      b.box(-109.8, 1.7, -112, 0.38, 3.4, 0.38, CREAM, 0, 0);
      b.box(-112, 3.45, -112, 5.2, 0.28, 0.7, ROOF, 0, 0);
      b.prismRoof(-112, 3.55, -112, 5.6, 0.9, 1.5, ROOF_DARK, 0, 0);
      b.box(-112, 2.55, -111.7, 3.3, 0.9, 0.12, CREAM, 0, 0);
      b.box(-112, 2.55, -111.62, 2.2, 0.16, 0.06, RED, 0, 0);
    }, (b) => {
      b.box(-112, 1.8, -112, 5, 3.6, 0.6, ROOF, 0, 0);
    });
    tree(-124, -72, 1.25, "flame");
    tree(-120, -132, 1.05, "shade");
    tree(-78, -132, 0.95, "palm");
    if (rich) {
      putBoth(-112, -108, (b) => {
        for (let i = -1; i <= 1; i++) b.box(-112 + i * 0.8, 0.35, -108, 0.35, 0.55, 0.28, hex(0xc9843a), 0, 0);
      });
    }
  }

  function police() {
    const x = -28;
    const z = 74;
    putBoth(x, z, (b) => {
      b.box(x, 0.25, z, 20.4, 0.5, 14.4, shade(CONCRETE, 0.9), 0, 0);
      b.box(x, 4.9, z, 20, 9.2, 14, WHITE, 0, 0);
      b.box(x, 3.15, 66.85, 16, 0.55, 0.35, BLUE, 0, 0);
      b.box(x, 7.6, 66.85, 12, 0.28, 0.3, BLUE, 0, 0);
      cornice(b, x, 9.5, z, 20, 14, hex(0xd5dbe3));
      windowsOn(b, x, z, 20, 14, 2, "z-", 2.4, rich);
      b.box(x, 1.35, 66.55, 3.2, 2.5, 0.2, hex(0x163a78), 0, 0);
      b.box(x, 1.35, 66.4, 1.3, 2.1, 0.08, GLASS, 1, 0);
      b.box(x, 4.55, 66.7, 4.2, 1.5, 0.12, CREAM, 0, 0);
      b.cylinder(x, 5.5, 66.55, 0.55, 0.12, 8, GOLD, 1, 0, "z");
      b.box(-36.2, 3.4, 67.2, 0.16, 6.6, 0.16, INK, 0, 0);
      b.box(-36.2, 6.7, 67.2, 1.3, 0.8, 0.08, BLUE, 0, 0);
    }, (b) => {
      b.box(x, 4.8, z, 20, 9.6, 14, WHITE, 0, 0);
      b.box(x, 3.2, 67, 18, 0.8, 0.3, BLUE, 0, 0);
    });
  }

  function temple() {
    const x = -112;
    const z = 28;
    putBoth(x, z, (b) => {
      b.box(x, 0.35, z, 12.4, 0.7, 10.4, hex(0xd8c3a4), 0, 0);
      b.box(x, 2.5, z, 11.2, 3.6, 9.2, hex(0xc45c48), 0, 0);
      b.box(x, 2.3, z, 10.2, 2.6, 8.2, hex(0xf3e0c8), 0, 0);
      b.prismRoof(x, 4.35, z, 13.2, 1.7, 11.2, ROOF_DARK, 0, 0);
      b.prismRoof(x, 5.7, z, 8.4, 1.15, 7.2, ROOF, 0, 0);
      b.box(x, 6.95, z, 2.2, 0.45, 0.7, GOLD, 1, 0);
      for (const ox of [-4.6, 4.6]) {
        b.cylinder(x + ox, 2.3, 33.15, 0.28, 3.5, 6, RED, 0, 0, "y");
      }
      b.cylinder(x, 2.3, 33.15, 0.28, 3.5, 6, RED, 0, 0, "y");
      b.box(x, 4.15, 33.3, 10.4, 0.28, 1.3, ROOF_DARK, 0, 0);
      drawLantern(b, x - 3.2, 3.3, 33.5, LANTERN);
      drawLantern(b, x + 3.2, 3.3, 33.5, LANTERN);
      b.box(x, 3.4, 32.55, 2.2, 0.8, 0.1, GOLD, 1, 0);
      b.box(x, 0.28, 34.2, 6, 0.28, 1.6, hex(0xd8c3a4), 0, 0);
    }, (b) => {
      b.box(x, 2.2, z, 12, 4.4, 10, hex(0xc45c48), 0, 0);
      b.prismRoof(x, 4.4, z, 13, 1.8, 11, ROOF_DARK, 0, 0);
    });
  }

  function convenience() {
    const x = -22;
    const z = 132;
    putBoth(x, z, (b) => {
      b.box(x, 2.15, 133.05, 12, 4.1, 5.9, CREAM, 0, 0);
      b.box(x, 3.35, 129.85, 10.6, 0.16, 1.5, hex(0x2f9e6b), 0, 0);
      b.box(x - 5.4, 1.6, 129.2, 0.32, 3.2, 0.32, CREAM, 0, 0);
      b.box(x + 5.4, 1.6, 129.2, 0.32, 3.2, 0.32, CREAM, 0, 0);
      b.box(x, 2.15, 130.15, 8.4, 2.5, 0.16, GLASS, 1, 0);
      b.box(x, 1.25, 130.2, 1.5, 2.15, 0.18, hex(0x163226), 0, 0);
      b.box(x, 3.7, 129.55, 6.4, 1.05, 0.12, hex(0x14724c), 0, 0);
      b.box(x, 3.7, 129.45, 4.6, 0.42, 0.06, CREAM, 0, 0);
      b.box(x + 4.2, 0.7, 128.4, 0.7, 1.2, 0.4, hex(0x1c6b4a), 0, 0);
    }, (b) => {
      b.box(x, 2, z, 12, 4, 8, CREAM, 0, 0);
      b.box(x, 3.4, 128, 10, 0.25, 1.2, hex(0x2f9e6b), 0, 0);
    });
  }

  function tunaStand() {
    const x = 20;
    const z = -968;
    putBoth(x, z, (b) => {
      b.box(x, 0.55, z, 7.2, 1.0, 3.4, hex(0xf0b429), 0, 0);
      b.box(x, 1.15, z, 6.4, 0.16, 2.6, hex(0xc9843a), 0, 0);
      b.boxRot(x, 2.15, z, 8.2, 0.12, 4.2, 0, -0.18, RED, 0, 0);
      b.box(x, 2.7, z - 1.5, 3.4, 0.7, 0.1, CREAM, 0, 0);
      for (let i = -2; i <= 2; i++) b.box(x + i * 0.7, 1.4, z + 0.4, 0.4, 0.28, 0.55, i % 2 ? hex(0xd64545) : hex(0xf7f4ee), 0, 0);
      drawLantern(b, x - 2.6, 1.7, z + 1.2, LANTERN);
      drawLantern(b, x + 2.6, 1.7, z + 1.2, LANTERN);
    }, (b) => {
      b.box(x, 1.1, z, 8, 2.2, 4, hex(0xf0b429), 0, 0);
      b.box(x, 2.3, z, 8.4, 0.2, 4.4, RED, 0, 0);
    });
  }

  return {
    tree, lamp, building, stall, stallWire, cart, station, department, park, starVillage, police, temple, convenience, tunaStand,
  };
}

function frontOf(face, w, d) {
  if (face === "z+") return { axis: "z", outX: 0, outZ: 1, span: w, depth: d };
  if (face === "z-") return { axis: "z", outX: 0, outZ: -1, span: w, depth: d };
  if (face === "x+") return { axis: "x", outX: 1, outZ: 0, span: d, depth: w };
  return { axis: "x", outX: -1, outZ: 0, span: d, depth: w };
}

function localX(yaw, lx, lz = 0) {
  return lx * Math.cos(yaw) + lz * Math.sin(yaw);
}

function localZ(yaw, lz, lx = 0) {
  return -lx * Math.sin(yaw) + lz * Math.cos(yaw);
}

function stallKind(x, z) {
  if (z < -28 && Math.abs(x - 67) < 6) return "ring";
  if (z < -28 && Math.abs(x - 116) < 8) return "balloon";
  const kinds = ["grill", "drink", "fruit", "cloth", "snack"];
  return kinds[Math.abs(Math.round(x + z * 0.5)) % kinds.length];
}

function drawStall(b, x, z, yaw, awning, sign, kind, rich) {
  const p = (lx, ly, lz, sx, sy, sz, color, glow = 0) => {
    const swap = Math.abs(Math.sin(yaw)) > 0.5;
    b.box(x + localX(yaw, lx, lz), ly, z + localZ(yaw, lz, lx), swap ? sz : sx, sy, swap ? sx : sz, color, glow, 0);
  };
  p(0, 0.46, -0.08, 2.15, 0.88, 0.72, WOOD);
  p(0, 0.94, -0.02, 2.2, 0.08, 0.84, hex(0xd7a15a));
  p(-1.05, 1.15, -0.48, 0.1, 2.2, 0.1, INK);
  p(1.05, 1.15, -0.48, 0.1, 2.2, 0.1, INK);
  p(-1.05, 1.15, 0.48, 0.1, 2.2, 0.1, INK);
  p(1.05, 1.15, 0.48, 0.1, 2.2, 0.1, INK);
  p(0, 1.25, -0.4, 2.05, 1.7, 0.1, awning);
  p(0, 0.62, 0.32, 2.05, 0.7, 0.08, awning);
  const slope = (lz, pitch, color, y, width = 2.6) => {
    b.boxRot(x + localX(yaw, 0, lz), y, z + localZ(yaw, lz, 0), width, 0.08, 1.25, yaw, pitch, color, 0, 0);
  };
  slope(0.36, 0.5, awning, 2.32);
  slope(-0.36, -0.5, awning, 2.32);
  slope(0.36, 0.5, CREAM, 2.5, 0.62);
  slope(-0.36, -0.5, CREAM, 2.5, 0.62);
  p(0, 1.7, 0.05, 0.55, 0.06, 0.55, WINDOW, 2);
  p(0, 2.85, -0.95, 1.35, 1.05, 0.1, awning);
  p(0, 2.85, -1.02, 1.0, 0.42, 0.06, sign);
  if (rich) {
    for (let i = -2; i <= 2; i++) {
      p(i * 0.46, 1.92, 0.78, 0.28, 0.32, 0.06, i % 2 ? CREAM : shade(awning, 0.72));
    }
  }
  stallGoods(p, kind, rich);
}

function stallGoods(p, kind, rich) {
  if (kind === "grill") {
    for (let i = 0; i < (rich ? 4 : 2); i++) {
      p(-0.7 + i * 0.36, 1.16, 0.12, 0.06, 0.32, 0.06, hex(0xc9843a));
      p(-0.7 + i * 0.36, 1.28, 0.12, 0.16, 0.1, 0.1, hex(0x8a3d2c));
    }
    p(0.55, 1.08, 0.05, 0.4, 0.16, 0.3, hex(0x22262c));
  } else if (kind === "drink") {
    const cups = [hex(0xf2d2e4), hex(0xd7f3ea), hex(0xf7e7a8), hex(0xf0b429)];
    for (let i = 0; i < (rich ? 4 : 2); i++) p(-0.6 + i * 0.38, 1.12, 0.1, 0.18, 0.32, 0.18, cups[i % cups.length]);
  } else if (kind === "fruit") {
    const fruits = [hex(0xf0a202), hex(0xe23b3b), hex(0x7bc96f), hex(0xf2d48a)];
    for (let i = 0; i < (rich ? 4 : 2); i++) p(-0.6 + i * 0.38, 1.08, 0.08, 0.28, 0.22, 0.28, fruits[i]);
  } else if (kind === "cloth") {
    p(0, 1.45, -0.05, 1.5, 0.06, 0.06, INK);
    const shirts = [hex(0xf7f4ee), hex(0x3d7ea6), hex(0xd45d8b), hex(0xf0b429)];
    for (let i = 0; i < (rich ? 4 : 2); i++) p(-0.6 + i * 0.4, 1.2, 0.02, 0.28, 0.42, 0.08, shirts[i]);
  } else if (kind === "balloon") {
    const cols = [hex(0xe23b3b), hex(0xf0b429), hex(0x3d7ea6), hex(0x7bc96f), hex(0xf27bb0)];
    for (let i = 0; i < (rich ? 4 : 2); i++) {
      p(-0.45 + (i % 2) * 0.5, 1.7 + Math.floor(i / 2) * 0.35, 0.15, 0.28, 0.32, 0.28, cols[i]);
    }
    p(0.7, 1.35, 0.05, 0.08, 0.7, 0.08, INK);
  } else if (kind === "ring") {
    for (let i = 0; i < (rich ? 3 : 2); i++) p(-0.4 + i * 0.4, 1.15, 0.08, 0.22, 0.36, 0.22, hex(0xf7f4ee));
    p(0.7, 1.08, 0.1, 0.45, 0.08, 0.45, GOLD, 1);
  } else {
    for (let i = 0; i < (rich ? 3 : 2); i++) p(-0.45 + i * 0.4, 1.08, 0.08, 0.32, 0.16, 0.32, i % 2 ? hex(0xfff6df) : hex(0xe07a5f));
  }
}

function trimFloors(b, x, z, w, d, floors, fh, y0, face, color) {
  for (let f = 0; f <= floors; f++) facadeStrip(b, x, z, w, d, face, y0 + f * fh, w, d, color);
}

function facadeStrip(b, x, z, w, d, face, y, spanW, spanD, color) {
  const t = 0.12;
  if (face === "z+") b.box(x, y, z + d / 2 + 0.06, Math.min(spanW, w) * 0.96, t, 0.1, color, 0, 0);
  else if (face === "z-") b.box(x, y, z - d / 2 - 0.06, Math.min(spanW, w) * 0.96, t, 0.1, color, 0, 0);
  else if (face === "x+") b.box(x + w / 2 + 0.06, y, z, 0.1, t, Math.min(spanD, d) * 0.96, color, 0, 0);
  else b.box(x - w / 2 - 0.06, y, z, 0.1, t, Math.min(spanD, d) * 0.96, color, 0, 0);
}

function cornice(b, x, y, z, w, d, color) {
  b.box(x, y, z, w + 0.55, 0.28, d + 0.55, color, 0, 0);
}

function roofCap(b, x, y, z, w, d) {
  b.box(x, y + 0.18, z, w * 0.72, 0.36, d * 0.62, ROOF, 0, 0);
  b.box(x, y + 0.42, z, w * 0.4, 0.16, d * 0.28, ROOF_DARK, 0, 0);
}

function parapet(b, x, y, z, w, d, color) {
  b.box(x, y, z - d / 2, w, 0.45, 0.18, color, 0, 0);
  b.box(x, y, z + d / 2, w, 0.45, 0.18, color, 0, 0);
  b.box(x - w / 2, y, z, 0.18, 0.45, d, color, 0, 0);
  b.box(x + w / 2, y, z, 0.18, 0.45, d, color, 0, 0);
}

function columns(b, x, z, orient, h, color) {
  const count = orient.span > 9 ? 3 : 2;
  for (let i = 0; i < count; i++) {
    const u = count === 2 ? (i === 0 ? -1 : 1) * (orient.span / 2 - 0.32) : (i - 1) * (orient.span / 2 - 0.4);
    const px = x + orient.outX * (orient.depth / 2 - 0.22) + (orient.axis === "z" ? u : 0);
    const pz = z + orient.outZ * (orient.depth / 2 - 0.22) + (orient.axis === "x" ? u : 0);
    b.box(px, h / 2, pz, 0.32, h, 0.32, color, 0, 0);
  }
}

function storefront(b, x, z, orient, porch, fh, awning) {
  const wallDist = orient.depth / 2 - porch;
  const wx = x + orient.outX * wallDist;
  const wz = z + orient.outZ * wallDist;
  const span = orient.span * 0.72;
  if (orient.axis === "z") {
    b.box(wx, 1.35, wz, 1.4, 2.3, 0.16, FRAME, 0, 0);
    b.box(wx, 1.45, wz + orient.outZ * 0.08, 0.7, 1.5, 0.08, GLASS, 1, 0);
    b.box(wx - span * 0.28, 1.5, wz + orient.outZ * 0.06, span * 0.32, 1.5, 0.1, GLASS, 1, 0);
    b.box(wx + span * 0.28, 1.5, wz + orient.outZ * 0.06, span * 0.32, 1.5, 0.1, GLASS, 1, 0);
  } else {
    b.box(wx, 1.35, wz, 0.16, 2.3, 1.4, FRAME, 0, 0);
    b.box(wx + orient.outX * 0.08, 1.45, wz, 0.08, 1.5, 0.7, GLASS, 1, 0);
    b.box(wx + orient.outX * 0.06, 1.5, wz - span * 0.28, 0.1, 1.5, span * 0.32, GLASS, 1, 0);
    b.box(wx + orient.outX * 0.06, 1.5, wz + span * 0.28, 0.1, 1.5, span * 0.32, GLASS, 1, 0);
  }
  const ax = x + orient.outX * (orient.depth / 2 - 0.45);
  const az = z + orient.outZ * (orient.depth / 2 - 0.45);
  const awningDepth = porch + 0.85;
  if (orient.axis === "z") b.box(ax, fh - 0.02, az, orient.span * 0.92, 0.12, awningDepth, awning, 0, 0);
  else b.box(ax, fh - 0.02, az, awningDepth, 0.12, orient.span * 0.92, awning, 0, 0);
  const sx = x + orient.outX * (orient.depth / 2 + 0.05);
  const sz = z + orient.outZ * (orient.depth / 2 + 0.05);
  if (orient.axis === "z") b.box(sx, fh + 0.7, sz, Math.min(4.2, orient.span * 0.46), 0.9, 0.12, CREAM, 0, 0);
  else b.box(sx, fh + 0.7, sz, 0.12, 0.9, Math.min(4.2, orient.span * 0.46), CREAM, 0, 0);
}

function bladeSign(b, x, z, orient, y, color) {
  const px = x + (orient.axis === "z" ? orient.span * 0.38 : orient.outX * (orient.depth / 2 + 0.45));
  const pz = z + (orient.axis === "x" ? orient.span * 0.38 : orient.outZ * (orient.depth / 2 + 0.45));
  if (orient.axis === "z") b.box(px, y, pz, 0.12, 1.15, 0.7, color, 0, 0);
  else b.box(px, y, pz, 0.7, 1.15, 0.12, color, 0, 0);
}

function windowsOn(b, x, z, w, d, floors, face, y0, individuals) {
  const span = face === "z+" || face === "z-" ? w : d;
  const cols = Math.max(2, Math.min(individuals ? 4 : 3, Math.round(span / 3.4)));
  const fh = 3.15;
  for (let f = 0; f < floors; f++) {
    const y = y0 + f * fh + 1.7;
    if (!individuals) {
      windowBand(b, x, z, w, d, face, y);
      continue;
    }
    for (let c = 0; c < cols; c++) {
      const u = ((c + 0.5) / cols - 0.5) * span * 0.78;
      if (f === 0 && Math.abs(u) < 0.7) continue;
      putWindow(b, face, x, y, z, w, d, u, 0.78, 1.15);
    }
  }
}

function putWindow(b, face, x, y, z, w, d, u, ww, hh) {
  if (face === "z+" || face === "z-") {
    const s = face === "z+" ? 1 : -1;
    const zz = z + s * (d / 2 + 0.08);
    b.box(x + u, y, zz, ww + 0.16, hh + 0.16, 0.08, FRAME, 0, 0);
    b.box(x + u, y, zz + s * 0.05, ww * 0.68, hh * 0.68, 0.06, WINDOW, 1, 0);
    b.box(x + u, y - hh * 0.52, zz + s * 0.07, ww + 0.28, 0.08, 0.12, CREAM, 0, 0);
  } else {
    const s = face === "x+" ? 1 : -1;
    const xx = x + s * (w / 2 + 0.08);
    b.box(xx, y, z + u, 0.08, hh + 0.16, ww + 0.16, FRAME, 0, 0);
    b.box(xx + s * 0.05, y, z + u, 0.06, hh * 0.68, ww * 0.68, WINDOW, 1, 0);
    b.box(xx + s * 0.07, y - hh * 0.52, z + u, 0.12, 0.08, ww + 0.28, CREAM, 0, 0);
  }
}

function windowBand(b, x, z, w, d, face, y) {
  const span = (face === "z+" || face === "z-") ? w : d;
  putWindow(b, face, x, y, z, w, d, 0, Math.min(span * 0.62, 6.5), 1.05);
}

function door(b, x, z, w, d, face) {
  const ww = 1.15;
  const hh = 2.15;
  if (face === "z+" || face === "z-") {
    const s = face === "z+" ? 1 : -1;
    const zz = z + s * (d / 2 + 0.07);
    b.box(x, 1.15, zz, ww + 0.2, hh, 0.1, FRAME, 0, 0);
    b.box(x, 1.2, zz + s * 0.05, ww * 0.55, hh * 0.72, 0.06, GLASS, 1, 0);
    b.box(x, 2.45, zz + s * 0.16, 2.4, 0.12, 0.7, shade(ROOF, 0.9), 0, 0);
  } else {
    const s = face === "x+" ? 1 : -1;
    const xx = x + s * (w / 2 + 0.07);
    b.box(xx, 1.15, z, 0.1, hh, ww + 0.2, FRAME, 0, 0);
    b.box(xx + s * 0.05, 1.2, z, 0.06, hh * 0.72, ww * 0.55, GLASS, 1, 0);
    b.box(xx + s * 0.16, 2.45, z, 0.7, 0.12, 2.4, shade(ROOF, 0.9), 0, 0);
  }
}

function balcony(b, x, z, w, d, face, y) {
  const slab = 2.4;
  if (face === "z-") {
    b.box(x, y, z - d / 2 - 0.28, slab, 0.1, 0.6, shade(CONCRETE, 0.95), 0, 0);
    b.box(x, y + 0.4, z - d / 2 - 0.52, slab, 0.08, 0.08, FRAME, 0, 0);
  } else if (face === "z+") {
    b.box(x, y, z + d / 2 + 0.28, slab, 0.1, 0.6, shade(CONCRETE, 0.95), 0, 0);
    b.box(x, y + 0.4, z + d / 2 + 0.52, slab, 0.08, 0.08, FRAME, 0, 0);
  } else if (face === "x+") {
    b.box(x + w / 2 + 0.28, y, z, 0.6, 0.1, slab, shade(CONCRETE, 0.95), 0, 0);
    b.box(x + w / 2 + 0.52, y + 0.4, z, 0.08, 0.08, slab, FRAME, 0, 0);
  } else {
    b.box(x - w / 2 - 0.28, y, z, 0.6, 0.1, slab, shade(CONCRETE, 0.95), 0, 0);
    b.box(x - w / 2 - 0.52, y + 0.4, z, 0.08, 0.08, slab, FRAME, 0, 0);
  }
}

function plankLines(b, x, z, w, d, face, h) {
  const n = 3;
  for (let i = 0; i < n; i++) {
    const u = (i - (n - 1) / 2) * (face.startsWith("z") ? w : d) * 0.22;
    if (face === "z+" || face === "z-") {
      const s = face === "z+" ? 1 : -1;
      b.box(x + u, h / 2 + 0.3, z + s * (d / 2 + 0.04), 0.08, h * 0.7, 0.06, shade(WOOD, 0.75), 0, 0);
    } else {
      const s = face === "x+" ? 1 : -1;
      b.box(x + s * (w / 2 + 0.04), h / 2 + 0.3, z + u, 0.06, h * 0.7, 0.08, shade(WOOD, 0.75), 0, 0);
    }
  }
}

function porchRoof(b, x, z, w, d, face, h) {
  if (face === "z+") b.box(x, h * 0.72, z + d / 2 + 0.45, w * 0.55, 0.1, 1.0, ROOF_DARK, 0, 0);
  else if (face === "z-") b.box(x, h * 0.72, z - d / 2 - 0.45, w * 0.55, 0.1, 1.0, ROOF_DARK, 0, 0);
  else if (face === "x+") b.box(x + w / 2 + 0.45, h * 0.72, z, 1.0, 0.1, d * 0.55, ROOF_DARK, 0, 0);
  else b.box(x - w / 2 - 0.45, h * 0.72, z, 1.0, 0.1, d * 0.55, ROOF_DARK, 0, 0);
  const stepX = face === "x+" ? w / 2 + 0.35 : face === "x-" ? -w / 2 - 0.35 : 0;
  const stepZ = face === "z+" ? d / 2 + 0.35 : face === "z-" ? -d / 2 - 0.35 : 0;
  b.box(x + stepX, 0.16, z + stepZ, face.startsWith("x") ? 0.7 : 1.3, 0.28, face.startsWith("x") ? 1.3 : 0.7, shade(CONCRETE, 0.9), 0, 0);
}

function houseWindows(b, x, z, w, d, face) {
  putWindow(b, face, x - 0.7, 1.7, z, w, d, 0, 0.7, 0.85);
  putWindow(b, face, x + 0.85, 1.7, z, w, d, 0, 0.7, 0.85);
  const shutter = hex(0x2f6d4f);
  if (face === "z+" || face === "z-") {
    const s = face === "z+" ? 1 : -1;
    b.box(x - 1.2, 1.7, z + s * (d / 2 + 0.12), 0.1, 0.9, 0.06, shutter, 0, 0);
    b.box(x + 1.35, 1.7, z + s * (d / 2 + 0.12), 0.1, 0.9, 0.06, shutter, 0, 0);
  }
}

function drawStation(b, rich) {
  b.box(0, 0.07, 162.2, 62, 0.1, 10.6, hex(0xe4ddd0), 0, 0);
  b.box(0, 4.7, 176, 78, 9.2, 16, CREAM, 0, 0);
  b.box(12, 5.1, 167.72, 42, 6.4, 0.28, mix(CREAM, PLASTER, 0.45), 0, 0);
  cornice(b, 0, 9.35, 176, 78, 16, shade(CREAM, 0.72));
  b.prismRoof(0, 9.4, 176, 80, 1.65, 18, ROOF, 0, 0);
  b.box(0, 11.1, 176, 42, 0.14, 0.55, ROOF_DARK, 0, 0);
  b.box(-30, 8.2, 171.35, 7.2, 16.4, 7.2, CREAM, 0, 0);
  b.box(-30, 16.55, 171.35, 8, 0.4, 8, ROOF_DARK, 0, 0);
  b.prismRoof(-30, 16.7, 171.35, 8.2, 1.45, 8.2, ROOF, 0, 0);
  b.cylinder(-30, 12.5, 167.52, 1.55, 0.18, rich ? 10 : 8, WHITE, 0, 0, "z");
  b.cylinder(-30, 12.5, 167.4, 1.28, 0.1, rich ? 10 : 8, hex(0xf7f1e4), 0, 0, "z");
  b.box(-30, 12.85, 167.3, 0.1, 0.9, 0.06, INK, 0, 0);
  b.box(-30.28, 12.38, 167.3, 0.62, 0.08, 0.06, INK, 0, 0);
  b.box(8, 8.2, 167.45, 28, 1.9, 0.36, RED, 0, 0);
  b.box(8, 8.2, 167.22, 22, 0.7, 0.08, CREAM, 0, 0);
  b.box(0, 8.15, 167.24, 7.2, 0.14, 0.05, GOLD, 1, 0);
  for (const dx of [-8, 0, 8]) {
    b.box(dx, 1.7, 167.48, 2.35, 3.05, 0.22, hex(0x1d3f6e), 0, 0);
    b.box(dx, 1.85, 167.32, 1.45, 2.15, 0.08, GLASS, 1, 0);
  }
  if (rich) {
    for (const dx of [16, 24, 32]) putWindow(b, "z-", dx, 6.15, 176, 78, 16, 0, 2.15, 1.4);
    for (const dx of [-16, -8, 0, 8]) putWindow(b, "z-", dx, 6.15, 176, 78, 16, 0, 2.05, 1.3);
    putWindow(b, "z-", -31.3, 5.4, 171.35, 7.2, 7.2, 0, 1.15, 1.35);
    putWindow(b, "z-", -28.7, 5.4, 171.35, 7.2, 7.2, 0, 1.15, 1.35);
  } else {
    windowBand(b, 10, 176, 36, 16, "z-", 6.15);
  }
  b.box(0, 1.55, 194, 42, 2.7, 8, TILE, 0, 0);
  b.box(0, 3.15, 194, 44, 0.28, 9.2, hex(0xb7c5d4), 0, 0);
  for (const ox of [-16, -8, 0, 8, 16]) b.box(ox, 1.4, 190.2, 0.35, 2.6, 0.35, hex(0xd5dde8), 0, 0);
  if (rich) {
    for (let i = -8; i <= 8; i++) b.box(i * 4.6, 0.18, 199, 0.7, 0.12, 1.3, hex(0x6b5344), 0, 0);
  }
  b.box(-2.15, 0.28, 199, 0.12, 0.1, 70, hex(0xc5c0b6), 0, 0);
  b.box(2.15, 0.28, 199, 0.12, 0.1, 70, hex(0xc5c0b6), 0, 0);
  for (let i = -1; i <= 1; i++) {
    b.box(i * 16, 0.42, 160.5, 1.6, 0.45, 0.5, WOOD, 0, 0);
    b.box(i * 16, 0.72, 160.35, 1.5, 0.16, 0.12, RED, 0, 0);
  }
}

function drawDepartment(b, rich) {
  const x = -25;
  const z = -25;
  b.box(x, 0.35, z, 32.5, 0.7, 26.5, shade(WHITE, 0.82), 0, 0);
  b.box(x, 9.6, z, 32, 18.5, 26, hex(0xe7eef6), 0, 0);
  cornice(b, x, 19.05, z, 32, 26, hex(0xd5dee8));
  for (let f = 0; f < 6; f++) {
    const y = 2.15 + f * 3.05;
    const glow = f === 0 ? 0 : 1;
    const glass = f % 2 ? GLASS : hex(0xb9d6e6);
    b.box(x, y, -11.82, 28.4, 1.45, 0.18, glass, glow, 0);
    b.box(x, y + 1.15, -11.78, 28.4, 0.42, 0.16, WHITE, 0, 0);
    b.box(-8.82, y, z + 0.4, 0.18, 1.45, 20, glass, glow, 0);
    if (rich && f > 0) {
      for (let m = -3; m <= 3; m++) b.box(x + m * 3.7, y, -11.68, 0.08, 1.5, 0.06, hex(0xf7fbfe), 0, 0);
    }
  }
  b.box(x, 1.5, -11.7, 4.4, 2.7, 0.18, hex(0x16324e), 0, 0);
  b.box(x - 0.75, 1.45, -11.56, 1.2, 2.25, 0.08, GLASS, 1, 0);
  b.box(x + 0.75, 1.45, -11.56, 1.2, 2.25, 0.08, GLASS, 1, 0);
  b.box(x, 3.4, -10.15, 16, 0.14, 2.8, RED, 0, 0);
  b.box(x, 3.22, -9.0, 9, 0.08, 1.1, GOLD, 1, 0);
  b.box(x, 19.85, -16.2, 18, 1.25, 4.2, RED, 0, 0);
  b.box(x, 19.85, -14.2, 12, 0.38, 0.1, CREAM, 0, 0);
  b.cylinder(x + 6.4, 19.9, -16.1, 0.62, 0.16, 8, WHITE, 0, 0, "z");
  b.box(x + 9, 20.5, z + 2, 2.4, 1.5, 2.4, hex(0xd5dee8), 0, 0);
  b.box(-36, 0.45, -8.2, 1.15, 0.7, 1.15, hex(0x2f6d4f), 0, 0);
  b.box(-14, 0.45, -8.2, 1.15, 0.7, 1.15, hex(0x2f6d4f), 0, 0);
}

function drawPavilion(b, x, z, rich) {
  b.box(x, 0.18, z, 8.4, 0.28, 8.4, hex(0xe7dcc4), 0, 0);
  const posts = [[-2.6, -2.6], [2.6, -2.6], [-2.6, 2.6], [2.6, 2.6]];
  for (const [ox, oz] of posts) b.cylinder(x + ox, 1.7, z + oz, 0.18, 3.1, 6, RED, 0, 0, "y");
  b.box(x, 3.25, z, 7.6, 0.22, 7.6, ROOF_DARK, 0, 0);
  b.prismRoof(x, 3.35, z, 8.2, 1.15, 8.2, ROOF, 0, 0);
  b.box(x, 4.15, z, 4.2, 0.16, 4.2, ROOF_DARK, 0, 0);
  b.prismRoof(x, 4.2, z, 4.6, 0.8, 4.6, hex(0xd86a32), 0, 0);
  if (rich) {
    b.box(x, 0.48, z - 1.2, 2.2, 0.45, 0.45, WOOD, 0, 0);
    b.box(x, 0.48, z + 1.2, 2.2, 0.45, 0.45, WOOD, 0, 0);
    drawLantern(b, x - 2.6, 2.7, z - 2.6, LANTERN);
    drawLantern(b, x + 2.6, 2.7, z + 2.6, GOLD);
  }
}

function rim(b, x, z, r, seg) {
  for (let i = 0; i < seg; i++) {
    const a = (i / seg) * Math.PI * 2;
    b.box(x + Math.cos(a) * r, 0.18, z + Math.sin(a) * r, 0.55, 0.28, 0.7, hex(0xd9d3c6), 0, 0);
  }
}
