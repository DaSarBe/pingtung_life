// 車輛模型：圓角車身、共用輪子、夜晚燈、轉向與機車傾倒。
import { MeshBuilder, compose, faceNormal, multiply } from "./engine.js";

const WHITE = [1, 1, 1];
const TIRE = [0.12, 0.12, 0.13];
const RIM = [0.78, 0.82, 0.86];
const HUB = [0.55, 0.58, 0.62];
const GLASS = [0.28, 0.42, 0.52];
const SEAT = [0.16, 0.15, 0.17];
const DARK = [0.14, 0.15, 0.17];
const RUBBER = [0.18, 0.18, 0.19];
const PLATE = [0.9, 0.92, 0.86];
const PLATE_INK = [0.12, 0.22, 0.18];
const CHROME = [0.72, 0.76, 0.8];
const LIGHT = [1, 0.93, 0.72];
const RED = [0.86, 0.16, 0.12];
const BLUE = [0.16, 0.34, 0.82];
const TAXI = [0.95, 0.78, 0.16];
const POLICE = [0.94, 0.95, 0.97];
const WOOD = [0.62, 0.42, 0.24];

export const RIDE = {
  hip: [0, 0.8, -0.14],
  ankleL: [-0.16, 0.47, 0.24],
  ankleR: [0.16, 0.47, 0.24],
  pivot: [0, 0.62, 0.5],
  gripLocal: [[-0.26, 0.36, 0], [0.26, 0.36, 0]],
  wheelR: 0.27,
  frontAxle: [0, -0.35, 0.2],
  rearAxle: [0, 0.27, -0.62],
};

export function rideGrips(steer = 0) {
  const [px, py, pz] = RIDE.pivot;
  const c = Math.cos(steer);
  const s = Math.sin(steer);
  return RIDE.gripLocal.map(([x, y, z]) => [px + x * c + z * s, py + y, pz - x * s + z * c]);
}

const SEATS = {
  sedan: [-0.36, 0.5, 0.02],
  hatch: [-0.34, 0.52, 0.1],
  taxi: [-0.36, 0.5, 0.02],
  police: [-0.36, 0.5, 0.02],
  van: [-0.4, 0.74, 0.5],
  truck: [-0.4, 0.78, 1.12],
};

const WHEELS = {
  sedan: [
    { x: 0.8, y: 0.32, z: 1.28, steer: true },
    { x: -0.8, y: 0.32, z: 1.28, steer: true },
    { x: 0.8, y: 0.32, z: -1.22, steer: false },
    { x: -0.8, y: 0.32, z: -1.22, steer: false },
  ],
  hatch: [
    { x: 0.74, y: 0.31, z: 1.12, steer: true },
    { x: -0.74, y: 0.31, z: 1.12, steer: true },
    { x: 0.74, y: 0.31, z: -1.02, steer: false },
    { x: -0.74, y: 0.31, z: -1.02, steer: false },
  ],
  van: [
    { x: 0.9, y: 0.36, z: 1.45, steer: true },
    { x: -0.9, y: 0.36, z: 1.45, steer: true },
    { x: 0.9, y: 0.36, z: -1.35, steer: false },
    { x: -0.9, y: 0.36, z: -1.35, steer: false },
  ],
  truck: [
    { x: 0.86, y: 0.4, z: 1.45, steer: true, r: 0.4, w: 0.24 },
    { x: -0.86, y: 0.4, z: 1.45, steer: true, r: 0.4, w: 0.24 },
    { x: 0.96, y: 0.4, z: -1.25, steer: false, r: 0.4, w: 0.22 },
    { x: 0.74, y: 0.4, z: -1.25, steer: false, r: 0.4, w: 0.22 },
    { x: -0.96, y: 0.4, z: -1.25, steer: false, r: 0.4, w: 0.22 },
    { x: -0.74, y: 0.4, z: -1.25, steer: false, r: 0.4, w: 0.22 },
  ],
};

function clamp(v, a, b) {
  return v < a ? a : v > b ? b : v;
}

function shade(color, ny, y, y0, y1, glow) {
  if (glow >= 1.5) return color;
  const t = y1 > y0 ? (y - y0) / (y1 - y0) : 0.5;
  const up = ny * 0.5 + 0.5;
  let k = 0.56 + 0.22 * clamp(t, 0, 1) + 0.26 * up;
  if (ny < 0.25 && ny > -0.35) k *= 0.92;
  return [color[0] * k, color[1] * k, color[2] * k];
}

function q(b, verts, color, glow, tint, y0, y1) {
  const n = faceNormal(verts[0], verts[1], verts[2]);
  const base = b.pos.length / 3;
  for (const v of verts) {
    const c = shade(color, n[1], v[1], y0, y1, glow);
    b.vert(v[0], v[1], v[2], n[0], n[1], n[2], c[0], c[1], c[2], glow, tint);
  }
  b.idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
}

function t3(b, a, c, d, color, glow, tint, y0, y1) {
  const n = faceNormal(a, c, d);
  const base = b.pos.length / 3;
  for (const v of [a, c, d]) {
    const col = shade(color, n[1], v[1], y0, y1, glow);
    b.vert(v[0], v[1], v[2], n[0], n[1], n[2], col[0], col[1], col[2], glow, tint);
  }
  b.idx.push(base, base + 1, base + 2);
}

function outward(verts, center) {
  const n = faceNormal(verts[0], verts[1], verts[2]);
  let cx = 0;
  let cy = 0;
  let cz = 0;
  for (const v of verts) {
    cx += v[0];
    cy += v[1];
    cz += v[2];
  }
  const k = verts.length;
  const dot = n[0] * (cx / k - center[0]) + n[1] * (cy / k - center[1]) + n[2] * (cz / k - center[2]);
  if (dot >= 0) return verts;
  return verts.length === 4 ? [verts[0], verts[3], verts[2], verts[1]] : [verts[0], verts[2], verts[1]];
}

function qOut(b, verts, color, glow, tint, center, y0, y1) {
  q(b, outward(verts, center), color, glow, tint, y0, y1);
}

function triOut(b, verts, color, glow, tint, center, y0, y1) {
  const v = outward(verts, center);
  t3(b, v[0], v[1], v[2], color, glow, tint, y0, y1);
}

export function chamferBox(b, cx, cy, cz, sx, sy, sz, ch, color, glow = 0, tint = 0) {
  const hx = sx / 2;
  const hy = sy / 2;
  const hz = sz / 2;
  const c = Math.max(0.001, Math.min(ch, hx * 0.46, hy * 0.46, hz * 0.46));
  const x0 = cx - hx;
  const x1 = cx + hx;
  const y0 = cy - hy;
  const y1 = cy + hy;
  const z0 = cz - hz;
  const z1 = cz + hz;
  const ix0 = x0 + c;
  const ix1 = x1 - c;
  const iy0 = y0 + c;
  const iy1 = y1 - c;
  const iz0 = z0 + c;
  const iz1 = z1 - c;
  const center = [cx, cy, cz];
  const face = (verts) => qOut(b, verts, color, glow, tint, center, y0, y1);
  const tri = (verts) => triOut(b, verts, color, glow, tint, center, y0, y1);
  face([[ix0, y1, iz1], [ix1, y1, iz1], [ix1, y1, iz0], [ix0, y1, iz0]]);
  face([[ix0, y0, iz0], [ix1, y0, iz0], [ix1, y0, iz1], [ix0, y0, iz1]]);
  face([[ix0, iy0, z1], [ix1, iy0, z1], [ix1, iy1, z1], [ix0, iy1, z1]]);
  face([[ix1, iy0, z0], [ix0, iy0, z0], [ix0, iy1, z0], [ix1, iy1, z0]]);
  face([[x1, iy0, iz1], [x1, iy0, iz0], [x1, iy1, iz0], [x1, iy1, iz1]]);
  face([[x0, iy0, iz0], [x0, iy0, iz1], [x0, iy1, iz1], [x0, iy1, iz0]]);
  face([[ix0, y1, iz1], [ix1, y1, iz1], [ix1, iy1, z1], [ix0, iy1, z1]]);
  face([[ix1, y1, iz0], [ix0, y1, iz0], [ix0, iy1, z0], [ix1, iy1, z0]]);
  face([[ix1, y1, iz1], [ix1, y1, iz0], [x1, iy1, iz0], [x1, iy1, iz1]]);
  face([[ix0, y1, iz0], [ix0, y1, iz1], [x0, iy1, iz1], [x0, iy1, iz0]]);
  face([[ix0, iy0, z1], [ix1, iy0, z1], [ix1, y0, iz1], [ix0, y0, iz1]]);
  face([[ix1, iy0, z0], [ix0, iy0, z0], [ix0, y0, iz0], [ix1, y0, iz0]]);
  face([[x1, iy0, iz1], [x1, iy0, iz0], [ix1, y0, iz0], [ix1, y0, iz1]]);
  face([[x0, iy0, iz0], [x0, iy0, iz1], [ix0, y0, iz1], [ix0, y0, iz0]]);
  face([[ix1, iy0, z1], [x1, iy0, iz1], [x1, iy1, iz1], [ix1, iy1, z1]]);
  face([[x0, iy0, iz1], [ix0, iy0, z1], [ix0, iy1, z1], [x0, iy1, iz1]]);
  face([[x1, iy0, iz0], [ix1, iy0, z0], [ix1, iy1, z0], [x1, iy1, iz0]]);
  face([[ix0, iy0, z0], [x0, iy0, iz0], [x0, iy1, iz0], [ix0, iy1, z0]]);
  tri([[ix1, y1, iz1], [ix1, iy1, z1], [x1, iy1, iz1]]);
  tri([[ix1, y1, iz0], [x1, iy1, iz0], [ix1, iy1, z0]]);
  tri([[ix0, y1, iz1], [x0, iy1, iz1], [ix0, iy1, z1]]);
  tri([[ix0, y1, iz0], [ix0, iy1, z0], [x0, iy1, iz0]]);
  tri([[ix1, y0, iz1], [x1, iy0, iz1], [ix1, iy0, z1]]);
  tri([[ix1, y0, iz0], [ix1, iy0, z0], [x1, iy0, iz0]]);
  tri([[ix0, y0, iz1], [ix0, iy0, z1], [x0, iy0, iz1]]);
  tri([[ix0, y0, iz0], [x0, iy0, iz0], [ix0, iy0, z0]]);
}

export function tube(b, x, y, z, r, h, seg, color, glow, tint, axis = "y") {
  const ring = (side) => {
    const pts = [];
    const o = side * h / 2;
    for (let i = 0; i < seg; i++) {
      const a = (i / seg) * Math.PI * 2;
      const c = Math.cos(a);
      const s = Math.sin(a);
      if (axis === "y") pts.push([x + c * r, y + o, z + s * r]);
      else if (axis === "x") pts.push([x + o, y + c * r, z + s * r]);
      else pts.push([x + c * r, y + s * r, z + o]);
    }
    return pts;
  };
  const A = ring(-1);
  const B = ring(1);
  const center = [x, y, z];
  const y0 = y - Math.max(h / 2, r);
  const y1 = y + Math.max(h / 2, r);
  for (let i = 0; i < seg; i++) {
    const i2 = (i + 1) % seg;
    qOut(b, [A[i], A[i2], B[i2], B[i]], color, glow, tint, center, y0, y1);
  }
  for (const side of [-1, 1]) {
    const pts = side < 0 ? A : B;
    const cc = axis === "y" ? [x, y + side * h / 2, z] : axis === "x" ? [x + side * h / 2, y, z] : [x, y, z + side * h / 2];
    for (let i = 0; i < seg; i++) triOut(b, [cc, pts[i], pts[(i + 1) % seg]], color, glow, tint, center, y0, y1);
  }
}

export function ellipsoid(b, x, y, z, rx, ry, rz, slices, stacks, color, glow, tint) {
  const grid = [];
  for (let i = 0; i <= stacks; i++) {
    const phi = (i / stacks) * Math.PI;
    const row = [];
    for (let j = 0; j <= slices; j++) {
      const theta = (j / slices) * Math.PI * 2;
      const nx = Math.sin(phi) * Math.cos(theta);
      const ny = Math.cos(phi);
      const nz = Math.sin(phi) * Math.sin(theta);
      let nnx = nx / rx;
      let nny = ny / ry;
      let nnz = nz / rz;
      const nl = Math.hypot(nnx, nny, nnz) || 1;
      row.push([x + nx * rx, y + ny * ry, z + nz * rz, nnx / nl, nny / nl, nnz / nl]);
    }
    grid.push(row);
  }
  const y0 = y - ry;
  const y1 = y + ry;
  for (let i = 0; i < stacks; i++) {
    for (let j = 0; j < slices; j++) {
      const pts = [grid[i][j], grid[i + 1][j], grid[i + 1][j + 1], grid[i][j + 1]];
      const base = b.pos.length / 3;
      for (const v of pts) {
        const col = shade(color, v[4], v[1], y0, y1, glow);
        b.vert(v[0], v[1], v[2], v[3], v[4], v[5], col[0], col[1], col[2], glow, tint);
      }
      b.idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
    }
  }
}

function superRing(sec, n, power) {
  const pts = [];
  const e = 2 / power;
  const ox = sec.x || 0;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const c = Math.cos(a);
    const s = Math.sin(a);
    const x = Math.sign(c) * Math.pow(Math.abs(c), e) * sec.hx;
    const yy = Math.sign(s) * Math.pow(Math.abs(s), e) * sec.hy;
    pts.push([ox + x, sec.y + yy, sec.z]);
  }
  return pts;
}

function loft(b, sections, color, glow, tint, power = 3.2, n = 10) {
  const rings = sections.map((s) => superRing(s, n, power));
  let y0 = 1e9;
  let y1 = -1e9;
  for (const s of sections) {
    y0 = Math.min(y0, s.y - s.hy);
    y1 = Math.max(y1, s.y + s.hy);
  }
  for (let i = 0; i < rings.length - 1; i++) {
    const A = rings[i];
    const B = rings[i + 1];
    const mid = [
      ((sections[i].x || 0) + (sections[i + 1].x || 0)) / 2,
      (sections[i].y + sections[i + 1].y) / 2,
      (sections[i].z + sections[i + 1].z) / 2,
    ];
    for (let k = 0; k < n; k++) {
      const k2 = (k + 1) % n;
      qOut(b, [A[k], B[k], B[k2], A[k2]], color, glow, tint, mid, y0, y1);
    }
  }
  capRing(b, rings[0], sections[0], -1, color, glow, tint, y0, y1);
  capRing(b, rings[rings.length - 1], sections[sections.length - 1], 1, color, glow, tint, y0, y1);
}

function capRing(b, pts, sec, dir, color, glow, tint, y0, y1) {
  const c = [sec.x || 0, sec.y, sec.z];
  const inside = [c[0], c[1], c[2] - dir * 0.25];
  for (let k = 0; k < pts.length; k++) triOut(b, [c, pts[k], pts[(k + 1) % pts.length]], color, glow, tint, inside, y0, y1);
}

function fender(b, x, y, z, rIn, rOut, width, color, tint) {
  const seg = 6;
  const hx = width / 2;
  const y0 = y - rOut;
  const y1 = y + rOut;
  for (let i = 0; i < seg; i++) {
    const a0 = Math.PI * (0.08 + 0.84 * (i / seg));
    const a1 = Math.PI * (0.08 + 0.84 * ((i + 1) / seg));
    const p = (a, r) => [y + Math.sin(a) * r, z + Math.cos(a) * r];
    const o0 = p(a0, rOut);
    const o1 = p(a1, rOut);
    const i0 = p(a0, rIn);
    const i1 = p(a1, rIn);
    const center = [x, y + 0.05, z];
    qOut(b, [[x - hx, o0[0], o0[1]], [x + hx, o0[0], o0[1]], [x + hx, o1[0], o1[1]], [x - hx, o1[0], o1[1]]], color, 0, tint, center, y0, y1);
    qOut(b, [[x + hx, o0[0], o0[1]], [x + hx, i0[0], i0[1]], [x + hx, i1[0], i1[1]], [x + hx, o1[0], o1[1]]], color, 0, tint, [x + hx, y, z], y0, y1);
    qOut(b, [[x - hx, i0[0], i0[1]], [x - hx, o0[0], o0[1]], [x - hx, o1[0], o1[1]], [x - hx, i1[0], i1[1]]], color, 0, tint, [x - hx, y, z], y0, y1);
  }
}

function plate(b, x, y, z, nz) {
  chamferBox(b, x, y, z, 0.34, 0.12, 0.02, 0.006, PLATE, 0, 0);
  chamferBox(b, x, y, z + nz * 0.012, 0.24, 0.035, 0.012, 0.003, PLATE_INK, 0, 0);
}

function lamp(b, x, y, z, sx, sy, sz, color) {
  chamferBox(b, x, y, z, sx, sy, sz, Math.min(sx, sy, sz) * 0.28, color, 2, 0);
}

function mirror(b, x, y, z) {
  const side = Math.sign(x) || 1;
  chamferBox(b, x, y, z, 0.1, 0.07, 0.16, 0.012, CHROME, 0, 0);
  chamferBox(b, x + side * 0.01, y, z + 0.02, 0.07, 0.045, 0.1, 0.008, [0.18, 0.24, 0.3], 0, 0);
}

function wheelGeo(b, radius, width) {
  tube(b, 0, 0, 0, radius, width, 14, TIRE, 0, 0, "x");
  tube(b, 0, 0, 0, radius * 0.58, width * 1.05, 10, RIM, 0, 0, "x");
  tube(b, 0, 0, 0, radius * 0.2, width * 1.12, 8, HUB, 0, 0, "x");
  chamferBox(b, 0, 0, 0, width * 0.55, radius * 0.1, radius * 0.95, 0.01, RIM, 0, 0);
  chamferBox(b, 0, 0, 0, width * 0.55, radius * 0.95, radius * 0.1, 0.01, RIM, 0, 0);
}

function bakedWheels(b, wheels) {
  for (const w of wheels) {
    const r = w.r || 0.32;
    const wid = w.w || 0.18;
    tube(b, w.x, w.y, w.z, r, wid, 8, TIRE, 0, 0, "x");
    tube(b, w.x, w.y, w.z, r * 0.45, wid * 1.05, 6, RIM, 0, 0, "x");
  }
}

function addCabin(body, glass, spec) {
  const roof = spec.roof;
  chamferBox(body, 0, roof.y, roof.z, roof.sx, roof.sy, roof.sz, 0.04, WHITE, 0, 1);
  for (const p of spec.pillars) chamferBox(body, p[0], p[1], p[2], p[3], p[4], p[5], 0.015, WHITE, 0, 1);
  chamferBox(body, 0, spec.interior[0], spec.interior[1], spec.interior[2], spec.interior[3], spec.interior[4], 0.04, [0.1, 0.12, 0.15], 0, 0);
  for (const h of spec.headrests) chamferBox(body, h[0], h[1], h[2], 0.16, 0.16, 0.08, 0.02, SEAT, 0, 0);
  const g = spec.wind;
  qOut(glass, [
    [-g.w0, g.y0, g.z0],
    [g.w0, g.y0, g.z0],
    [g.w1, g.y1, g.z1],
    [-g.w1, g.y1, g.z1],
  ], GLASS, 1, 0, [0, (g.y0 + g.y1) / 2, (g.z0 + g.z1) / 2 + 0.2], 0, 2);
  const rw = spec.rear;
  qOut(glass, [
    [rw.w1, rw.y1, rw.z1],
    [-rw.w1, rw.y1, rw.z1],
    [-rw.w0, rw.y0, rw.z0],
    [rw.w0, rw.y0, rw.z0],
  ], GLASS, 1, 0, [0, (rw.y0 + rw.y1) / 2, (rw.z0 + rw.z1) / 2 - 0.2], 0, 2);
  const s = spec.side;
  qOut(glass, [[s.x, s.y0, s.z0], [s.x, s.y0, s.z1], [s.x, s.y1, s.z1], [s.x, s.y1, s.z0]], GLASS, 1, 0, [0, s.y0, 0], 0, 2);
  qOut(glass, [[-s.x, s.y0, s.z1], [-s.x, s.y0, s.z0], [-s.x, s.y1, s.z0], [-s.x, s.y1, s.z1]], GLASS, 1, 0, [0, s.y0, 0], 0, 2);
  lamp(body, spec.lightX, spec.lightY, spec.lightZ, spec.lightSx, spec.lightSy, 0.06, LIGHT);
  lamp(body, -spec.lightX, spec.lightY, spec.lightZ, spec.lightSx, spec.lightSy, 0.06, LIGHT);
  lamp(body, spec.tailX, spec.tailY, spec.tailZ, spec.tailSx, 0.1, 0.05, RED);
  lamp(body, -spec.tailX, spec.tailY, spec.tailZ, spec.tailSx, 0.1, 0.05, RED);
  chamferBox(body, 0, spec.grilleY, spec.grilleZ, spec.grilleSx, 0.12, 0.03, 0.008, DARK, 0, 0);
  plate(body, 0, spec.plateY, spec.plateZ, 1);
  plate(body, 0, spec.tailPlateY, spec.tailPlateZ, -1);
  mirror(body, spec.mirrorX, spec.mirrorY, spec.mirrorZ);
  mirror(body, -spec.mirrorX, spec.mirrorY, spec.mirrorZ);
  for (const w of spec.wheels) fender(body, w.x, w.y, w.z, (w.r || 0.32) * 0.92, (w.r || 0.32) + 0.1, (w.w || 0.18) + 0.08, WHITE, 1);
}

const SEDAN = {
  sections: [
    { z: -2.02, y: 0.48, hx: 0.56, hy: 0.14 },
    { z: -1.78, y: 0.54, hx: 0.68, hy: 0.2 },
    { z: -1.15, y: 0.58, hx: 0.7, hy: 0.26 },
    { z: 0.2, y: 0.56, hx: 0.7, hy: 0.26 },
    { z: 1.2, y: 0.54, hx: 0.68, hy: 0.24 },
    { z: 1.72, y: 0.5, hx: 0.62, hy: 0.18 },
    { z: 2.04, y: 0.46, hx: 0.5, hy: 0.12 },
  ],
  wheels: WHEELS.sedan,
  roof: { y: 1.36, z: -0.08, sx: 1.16, sy: 0.1, sz: 1.25 },
  pillars: [[-0.52, 1.16, 0.55, 0.07, 0.38, 0.1], [0.52, 1.16, 0.55, 0.07, 0.38, 0.1], [-0.5, 1.16, -0.72, 0.07, 0.36, 0.1], [0.5, 1.16, -0.72, 0.07, 0.36, 0.1]],
  interior: [0.82, -0.05, 1.05, 0.28, 1.15],
  headrests: [[-0.36, 1.02, -0.28], [0.36, 1.02, -0.28]],
  wind: { y0: 1.02, z0: 1.08, w0: 0.58, y1: 1.32, z1: 0.48, w1: 0.52 },
  rear: { y0: 1.0, z0: -0.98, w0: 0.52, y1: 1.28, z1: -0.48, w1: 0.46 },
  side: { x: 0.64, y0: 1.04, y1: 1.26, z0: -0.62, z1: 0.42 },
  lightX: 0.4, lightY: 0.5, lightZ: 2.08, lightSx: 0.22, lightSy: 0.1,
  tailX: 0.46, tailY: 0.58, tailZ: -2.06, tailSx: 0.24,
  grilleY: 0.46, grilleZ: 2.07, grilleSx: 0.46,
  plateY: 0.32, plateZ: 2.08, tailPlateY: 0.4, tailPlateZ: -2.06,
  mirrorX: 0.78, mirrorY: 1.02, mirrorZ: 0.42,
};

const HATCH = {
  sections: [
    { z: -1.7, y: 0.64, hx: 0.66, hy: 0.3 },
    { z: -1.4, y: 0.66, hx: 0.7, hy: 0.34 },
    { z: -0.15, y: 0.58, hx: 0.7, hy: 0.28 },
    { z: 0.85, y: 0.54, hx: 0.68, hy: 0.24 },
    { z: 1.5, y: 0.48, hx: 0.58, hy: 0.16 },
    { z: 1.78, y: 0.44, hx: 0.46, hy: 0.11 },
  ],
  wheels: WHEELS.hatch,
  roof: { y: 1.4, z: -0.15, sx: 1.18, sy: 0.1, sz: 1.15 },
  pillars: [[-0.52, 1.18, 0.42, 0.07, 0.4, 0.1], [0.52, 1.18, 0.42, 0.07, 0.4, 0.1], [-0.52, 1.2, -1.05, 0.08, 0.46, 0.1], [0.52, 1.2, -1.05, 0.08, 0.46, 0.1]],
  interior: [0.86, 0.02, 1.05, 0.3, 1.05],
  headrests: [[-0.34, 1.05, -0.15], [0.34, 1.05, -0.15]],
  wind: { y0: 1.02, z0: 0.95, w0: 0.56, y1: 1.34, z1: 0.38, w1: 0.5 },
  rear: { y0: 1.02, z0: -1.48, w0: 0.55, y1: 1.32, z1: -1.22, w1: 0.5 },
  side: { x: 0.64, y0: 1.05, y1: 1.28, z0: -0.85, z1: 0.32 },
  lightX: 0.38, lightY: 0.48, lightZ: 1.82, lightSx: 0.2, lightSy: 0.09,
  tailX: 0.48, tailY: 0.7, tailZ: -1.74, tailSx: 0.22,
  grilleY: 0.42, grilleZ: 1.8, grilleSx: 0.4,
  plateY: 0.3, plateZ: 1.82, tailPlateY: 0.48, tailPlateZ: -1.74,
  mirrorX: 0.76, mirrorY: 1.04, mirrorZ: 0.32,
};

const VAN = {
  sections: [
    { z: -2.15, y: 1.02, hx: 0.78, hy: 0.58 },
    { z: -0.8, y: 1.05, hx: 0.8, hy: 0.6 },
    { z: 0.55, y: 1.0, hx: 0.8, hy: 0.58 },
    { z: 1.4, y: 0.82, hx: 0.76, hy: 0.4 },
    { z: 1.9, y: 0.62, hx: 0.66, hy: 0.24 },
    { z: 2.12, y: 0.52, hx: 0.52, hy: 0.14 },
  ],
  wheels: WHEELS.van,
  roof: { y: 1.68, z: -0.35, sx: 1.5, sy: 0.08, sz: 2.5 },
  pillars: [[-0.7, 1.35, 0.85, 0.08, 0.5, 0.1], [0.7, 1.35, 0.85, 0.08, 0.5, 0.1], [-0.7, 1.35, -1.55, 0.08, 0.55, 0.1], [0.7, 1.35, -1.55, 0.08, 0.55, 0.1]],
  interior: [1.05, 0.15, 1.35, 0.4, 1.5],
  headrests: [[-0.4, 1.25, 0.15], [0.4, 1.25, 0.15]],
  wind: { y0: 1.15, z0: 1.55, w0: 0.7, y1: 1.58, z1: 1.05, w1: 0.66 },
  rear: { y0: 1.15, z0: -2.12, w0: 0.62, y1: 1.55, z1: -2.05, w1: 0.55 },
  side: { x: 0.82, y0: 1.2, y1: 1.52, z0: -1.2, z1: 0.7 },
  lightX: 0.46, lightY: 0.55, lightZ: 2.16, lightSx: 0.22, lightSy: 0.1,
  tailX: 0.58, tailY: 0.72, tailZ: -2.18, tailSx: 0.2,
  grilleY: 0.5, grilleZ: 2.14, grilleSx: 0.5,
  plateY: 0.36, plateZ: 2.16, tailPlateY: 0.5, tailPlateZ: -2.18,
  mirrorX: 0.92, mirrorY: 1.2, mirrorZ: 0.95,
};

function buildAuto(body, glass, spec, power) {
  loft(body, spec.sections, WHITE, 0, 1, power, 10);
  addCabin(body, glass, spec);
}

function buildTruck(body, glass) {
  loft(body, [
    { z: 0.55, y: 0.95, hx: 0.72, hy: 0.32 },
    { z: 1.15, y: 1.02, hx: 0.74, hy: 0.4 },
    { z: 1.75, y: 0.9, hx: 0.7, hy: 0.32 },
    { z: 2.2, y: 0.68, hx: 0.58, hy: 0.18 },
  ], WHITE, 0, 1, 3.4, 10);
  const spec = {
    wheels: WHEELS.truck,
    roof: { y: 1.55, z: 1.15, sx: 1.28, sy: 0.1, sz: 0.95 },
    pillars: [[-0.58, 1.32, 1.55, 0.08, 0.42, 0.1], [0.58, 1.32, 1.55, 0.08, 0.42, 0.1], [-0.56, 1.32, 0.72, 0.08, 0.4, 0.1], [0.56, 1.32, 0.72, 0.08, 0.4, 0.1]],
    interior: [1.05, 1.1, 1.15, 0.32, 0.7],
    headrests: [[-0.4, 1.28, 0.85]],
    wind: { y0: 1.12, z0: 1.72, w0: 0.6, y1: 1.48, z1: 1.35, w1: 0.55 },
    rear: { y0: 1.1, z0: 0.62, w0: 0.5, y1: 1.4, z1: 0.78, w1: 0.46 },
    side: { x: 0.7, y0: 1.14, y1: 1.4, z0: 0.85, z1: 1.4 },
    lightX: 0.4, lightY: 0.62, lightZ: 2.24, lightSx: 0.2, lightSy: 0.1,
    tailX: 0.55, tailY: 0.78, tailZ: -2.22, tailSx: 0.18,
    grilleY: 0.58, grilleZ: 2.22, grilleSx: 0.48,
    plateY: 0.4, plateZ: 2.24, tailPlateY: 0.62, tailPlateZ: -2.24,
    mirrorX: 0.86, mirrorY: 1.25, mirrorZ: 1.5,
  };
  addCabin(body, glass, spec);
  chamferBox(body, 0, 0.78, -0.85, 1.4, 0.12, 2.5, 0.03, WHITE, 0, 1);
  chamferBox(body, 0, 1.05, -2.05, 1.42, 0.5, 0.08, 0.02, WHITE, 0, 1);
  chamferBox(body, -0.7, 1.05, -0.85, 0.08, 0.5, 2.45, 0.02, WHITE, 0, 1);
  chamferBox(body, 0.7, 1.05, -0.85, 0.08, 0.5, 2.45, 0.02, WHITE, 0, 1);
  chamferBox(body, 0, 0.98, -0.7, 0.7, 0.32, 0.9, 0.03, WOOD, 0, 0);
}

function buildLod(b, spec, power) {
  loft(b, spec.sections.filter((_, i) => i % 2 === 0 || i === spec.sections.length - 1), WHITE, 0, 1, power, 6);
  chamferBox(b, 0, spec.roof.y, spec.roof.z, spec.roof.sx, spec.roof.sy, spec.roof.sz, 0.04, WHITE, 0, 1);
  const g = spec.wind;
  qOut(b, [[-g.w0, g.y0, g.z0], [g.w0, g.y0, g.z0], [g.w1, g.y1, g.z1], [-g.w1, g.y1, g.z1]], GLASS, 1, 0, [0, g.y0, g.z0], 0, 2);
  lamp(b, spec.lightX, spec.lightY, spec.lightZ, spec.lightSx, spec.lightSy, 0.06, LIGHT);
  lamp(b, -spec.lightX, spec.lightY, spec.lightZ, spec.lightSx, spec.lightSy, 0.06, LIGHT);
  lamp(b, spec.tailX, spec.tailY, spec.tailZ, spec.tailSx, 0.1, 0.05, RED);
  lamp(b, -spec.tailX, spec.tailY, spec.tailZ, spec.tailSx, 0.1, 0.05, RED);
  bakedWheels(b, spec.wheels);
}

function buildScooter(b, sport) {
  const paint = WHITE;
  chamferBox(b, 0, 0.4, 0.02, 0.38, 0.07, 0.92, 0.02, paint, 0, 1);
  chamferBox(b, 0, 0.405, 0.08, 0.28, 0.02, 0.55, 0.008, RUBBER, 0, 0);
  if (sport) {
    loft(b, [
      { z: -0.78, y: 0.58, hx: 0.2, hy: 0.2 },
      { z: -0.45, y: 0.7, hx: 0.22, hy: 0.28 },
      { z: -0.15, y: 0.62, hx: 0.18, hy: 0.2 },
    ], paint, 0, 1, 2.8, 8);
    chamferBox(b, 0, 1.05, 0.42, 0.32, 0.28, 0.04, 0.012, GLASS, 1, 0);
  } else {
    loft(b, [
      { z: -0.78, y: 0.52, hx: 0.22, hy: 0.18 },
      { z: -0.48, y: 0.6, hx: 0.24, hy: 0.26 },
      { z: -0.18, y: 0.5, hx: 0.2, hy: 0.16 },
    ], paint, 0, 1, 2.6, 8);
  }
  chamferBox(b, 0, 0.74, -0.32, sport ? 0.26 : 0.3, 0.08, 0.58, 0.02, SEAT, 0, 0);
  chamferBox(b, 0, 0.78, 0.62, 0.4, 0.46, 0.1, 0.025, paint, 0, 1);
  chamferBox(b, 0, 1.05, 0.52, 0.32, 0.22, 0.08, 0.02, paint, 0, 1);
  ellipsoid(b, 0, 0.8, 0.7, 0.1, 0.07, 0.05, 8, 6, LIGHT, 2, 0);
  lamp(b, 0, 0.58, -0.84, 0.16, 0.08, 0.04, RED);
  plate(b, 0, 0.42, -0.86, -1);
  tube(b, 0.16, 0.32, -0.35, 0.035, 0.32, 6, DARK, 0, 0, "z");
  fender(b, 0, RIDE.rearAxle[1], RIDE.rearAxle[2], 0.24, 0.36, 0.16, paint, 1);
  chamferBox(b, 0, 0.95, -0.55, 0.04, 0.16, 0.04, 0.008, DARK, 0, 0);
}

function buildFork(b) {
  tube(b, -0.06, -0.16, 0.1, 0.02, 0.42, 6, CHROME, 0, 0, "y");
  tube(b, 0.06, -0.16, 0.1, 0.02, 0.42, 6, CHROME, 0, 0, "y");
  fender(b, 0, RIDE.frontAxle[1], RIDE.frontAxle[2], 0.24, 0.34, 0.14, WHITE, 1);
  tube(b, 0, 0.36, 0, 0.025, 0.62, 8, DARK, 0, 0, "x");
  tube(b, -0.28, 0.36, 0, 0.03, 0.1, 6, SEAT, 0, 0, "x");
  tube(b, 0.28, 0.36, 0, 0.03, 0.1, 6, SEAT, 0, 0, "x");
  chamferBox(b, -0.24, 0.48, -0.02, 0.08, 0.05, 0.1, 0.01, CHROME, 0, 0);
  chamferBox(b, 0.24, 0.48, -0.02, 0.08, 0.05, 0.1, 0.01, CHROME, 0, 0);
  chamferBox(b, 0, 0.4, -0.04, 0.1, 0.06, 0.06, 0.01, DARK, 0, 0);
}

function buildBasket(b) {
  chamferBox(b, 0, 0.22, 0.34, 0.36, 0.04, 0.28, 0.01, [0.55, 0.58, 0.6], 0, 0);
  chamferBox(b, -0.16, 0.32, 0.34, 0.02, 0.16, 0.26, 0.006, [0.55, 0.58, 0.6], 0, 0);
  chamferBox(b, 0.16, 0.32, 0.34, 0.02, 0.16, 0.26, 0.006, [0.55, 0.58, 0.6], 0, 0);
  chamferBox(b, 0, 0.32, 0.46, 0.34, 0.16, 0.02, 0.006, [0.55, 0.58, 0.6], 0, 0);
}

function buildHeli(body, glass) {
  loft(body, [
    { z: -0.15, y: 0.15, hx: 0.55, hy: 0.38 },
    { z: 0.45, y: 0.18, hx: 0.62, hy: 0.42 },
    { z: 1.05, y: 0.12, hx: 0.42, hy: 0.28 },
  ], POLICE, 0, 0, 2.8, 10);
  tube(body, 0, 0.12, -1.55, 0.11, 2.1, 8, DARK, 0, 0, "z");
  chamferBox(body, 0, 0.28, -2.55, 0.08, 0.42, 0.28, 0.02, DARK, 0, 0);
  chamferBox(body, 0.22, 0.22, -2.55, 0.28, 0.08, 0.22, 0.015, DARK, 0, 0);
  chamferBox(body, -0.42, -0.42, 0.15, 0.05, 0.28, 1.15, 0.012, DARK, 0, 0);
  chamferBox(body, 0.42, -0.42, 0.15, 0.05, 0.28, 1.15, 0.012, DARK, 0, 0);
  chamferBox(body, 0, -0.58, 0.15, 0.9, 0.04, 1.35, 0.012, DARK, 0, 0);
  tube(body, 0, 0.62, 0.25, 0.08, 0.22, 8, DARK, 0, 0, "y");
  chamferBox(body, 0, 0.55, 0.15, 0.7, 0.08, 0.22, 0.015, DARK, 0, 0);
  qOut(glass, [[-0.48, 0.05, 0.95], [0.48, 0.05, 0.95], [0.36, 0.38, 0.55], [-0.36, 0.38, 0.55]], GLASS, 1, 0, [0, 0.2, 1.1], 0, 2);
  qOut(glass, [[0.62, -0.05, 0.15], [0.62, -0.05, 0.7], [0.62, 0.32, 0.55], [0.62, 0.32, 0.2]], GLASS, 1, 0, [0.8, 0.1, 0.3], 0, 2);
  qOut(glass, [[-0.62, -0.05, 0.7], [-0.62, -0.05, 0.15], [-0.62, 0.32, 0.2], [-0.62, 0.32, 0.55]], GLASS, 1, 0, [-0.8, 0.1, 0.3], 0, 2);
  lamp(body, 0, -0.15, 1.15, 0.16, 0.1, 0.08, LIGHT);
}

function buildRotor(b, span, thick) {
  chamferBox(b, 0, 0, 0, span, thick, 0.16, 0.01, DARK, 0, 0);
  chamferBox(b, 0, 0, 0, 0.16, thick, span, 0.01, DARK, 0, 0);
  tube(b, 0, 0, 0, 0.12, thick * 2.4, 8, [0.3, 0.32, 0.34], 0, 0, "y");
}

function mesh(renderer, build) {
  const b = new MeshBuilder();
  build(b);
  return renderer.createMesh(b);
}

function pair(renderer, build) {
  const body = new MeshBuilder();
  const glass = new MeshBuilder();
  build(body, glass);
  return {
    body: renderer.createMesh(body),
    glass: glass.idx.length ? renderer.createMesh(glass) : null,
  };
}

export function createVehicleLib(renderer) {
  const sedan = pair(renderer, (body, glass) => buildAuto(body, glass, SEDAN, 3.15));
  const hatch = pair(renderer, (body, glass) => buildAuto(body, glass, HATCH, 3.05));
  const van = pair(renderer, (body, glass) => buildAuto(body, glass, VAN, 4.2));
  const truck = pair(renderer, (body, glass) => buildTruck(body, glass));
  const lib = {
    shadow: mesh(renderer, (b) => {
      const seg = 14;
      const base = b.pos.length / 3;
      b.vert(0, 0, 0, 0, 1, 0, 0.07, 0.06, 0.05, 0, 0);
      for (let i = 0; i < seg; i++) {
        const a = (i / seg) * Math.PI * 2;
        b.vert(Math.cos(a), 0, Math.sin(a), 0, 1, 0, 0.07, 0.06, 0.05, 0, 0);
      }
      for (let i = 0; i < seg; i++) b.idx.push(base, base + 1 + i, base + 1 + ((i + 1) % seg));
    }),
    wheel: mesh(renderer, (b) => wheelGeo(b, 0.32, 0.18)),
    wheelTruck: mesh(renderer, (b) => wheelGeo(b, 0.4, 0.22)),
    wheelScooter: mesh(renderer, (b) => wheelGeo(b, RIDE.wheelR, 0.1)),
    step: mesh(renderer, (b) => buildScooter(b, false)),
    sport: mesh(renderer, (b) => buildScooter(b, true)),
    fork: mesh(renderer, (b) => buildFork(b)),
    basket: mesh(renderer, (b) => buildBasket(b)),
    scooterLod: mesh(renderer, (b) => {
      buildScooter(b, false);
      bakedWheels(b, [
        { x: 0, y: RIDE.rearAxle[1], z: RIDE.rearAxle[2], r: RIDE.wheelR, w: 0.1 },
        { x: 0, y: RIDE.wheelR, z: RIDE.pivot[2] + RIDE.frontAxle[2], r: RIDE.wheelR, w: 0.1 },
      ]);
    }),
    stripe: mesh(renderer, (b) => {
      chamferBox(b, 0, 0.78, -0.05, 1.42, 0.07, 1.85, 0.012, BLUE, 0, 0);
      chamferBox(b, 0, 1.48, -0.08, 0.62, 0.07, 0.28, 0.012, DARK, 0, 0);
    }),
    taxiSign: mesh(renderer, (b) => {
      chamferBox(b, 0, 1.52, -0.05, 0.42, 0.12, 0.16, 0.015, [0.95, 0.95, 0.96], 0, 0);
      chamferBox(b, 0, 1.52, -0.05, 0.28, 0.05, 0.17, 0.008, DARK, 0, 0);
      lamp(b, -0.14, 1.52, 0.05, 0.06, 0.06, 0.04, TAXI);
      lamp(b, 0.14, 1.52, 0.05, 0.06, 0.06, 0.04, TAXI);
    }),
    lampRed: mesh(renderer, (b) => chamferBox(b, 0, 0, 0, 0.2, 0.09, 0.12, 0.02, RED, 2, 0)),
    lampBlue: mesh(renderer, (b) => chamferBox(b, 0, 0, 0, 0.2, 0.09, 0.12, 0.02, BLUE, 2, 0)),
    halo: mesh(renderer, (b) => chamferBox(b, 0, 0, 0, 0.55, 0.22, 0.36, 0.06, WHITE, 2, 0)),
    beam: mesh(renderer, (b) => chamferBox(b, 0, 0, 0.45, 0.5, 0.16, 0.7, 0.04, LIGHT, 2, 0)),
    heli: null,
    heliGlass: null,
    rotor: mesh(renderer, (b) => buildRotor(b, 7.2, 0.045)),
    rotorDisc: mesh(renderer, (b) => {
      const seg = 18;
      const base = b.pos.length / 3;
      b.vert(0, 0, 0, 0, 1, 0, 0.65, 0.68, 0.72, 0, 0);
      for (let i = 0; i < seg; i++) {
        const a = (i / seg) * Math.PI * 2;
        b.vert(Math.cos(a) * 3.3, 0, Math.sin(a) * 3.3, 0, 1, 0, 0.65, 0.68, 0.72, 0, 0);
      }
      for (let i = 0; i < seg; i++) b.idx.push(base, base + 1 + i, base + 1 + ((i + 1) % seg));
    }),
    tailRotor: mesh(renderer, (b) => {
      chamferBox(b, 0, 0, 0, 0.04, 1.15, 0.1, 0.012, DARK, 0, 0);
      chamferBox(b, 0, 0, 0, 0.04, 0.1, 1.15, 0.012, DARK, 0, 0);
    }),
    sedanLod: mesh(renderer, (b) => buildLod(b, SEDAN, 3.2)),
    hatchLod: mesh(renderer, (b) => buildLod(b, HATCH, 3.1)),
    vanLod: mesh(renderer, (b) => buildLod(b, VAN, 4)),
    truckLod: mesh(renderer, (b) => {
      loft(b, [
        { z: 0.55, y: 0.95, hx: 0.72, hy: 0.32 },
        { z: 1.5, y: 0.95, hx: 0.74, hy: 0.38 },
        { z: 2.2, y: 0.68, hx: 0.58, hy: 0.18 },
      ], WHITE, 0, 1, 3.4, 6);
      chamferBox(b, 0, 1.55, 1.15, 1.28, 0.1, 0.95, 0.04, WHITE, 0, 1);
      chamferBox(b, 0, 0.78, -0.85, 1.4, 0.12, 2.5, 0.03, WHITE, 0, 1);
      chamferBox(b, -0.7, 1.05, -0.85, 0.08, 0.5, 2.45, 0.02, WHITE, 0, 1);
      chamferBox(b, 0.7, 1.05, -0.85, 0.08, 0.5, 2.45, 0.02, WHITE, 0, 1);
      chamferBox(b, 0, 1.05, -2.05, 1.42, 0.5, 0.08, 0.02, WHITE, 0, 1);
      lamp(b, 0.4, 0.62, 2.24, 0.2, 0.1, 0.06, LIGHT);
      lamp(b, -0.4, 0.62, 2.24, 0.2, 0.1, 0.06, LIGHT);
      lamp(b, 0.55, 0.78, -2.22, 0.18, 0.1, 0.05, RED);
      lamp(b, -0.55, 0.78, -2.22, 0.18, 0.1, 0.05, RED);
      bakedWheels(b, WHEELS.truck);
    }),
  };
  const heli = pair(renderer, (body, glass) => buildHeli(body, glass));
  lib.heli = heli.body;
  lib.heliGlass = heli.glass;
  lib.sedan = sedan;
  lib.hatch = hatch;
  lib.van = van;
  lib.truck = truck;
  lib.kind = {
    sedan: { body: sedan.body, glass: sedan.glass, lod: lib.sedanLod, wheels: WHEELS.sedan, wheelMesh: "wheel" },
    hatch: { body: hatch.body, glass: hatch.glass, lod: lib.hatchLod, wheels: WHEELS.hatch, wheelMesh: "wheel" },
    taxi: { body: sedan.body, glass: sedan.glass, lod: lib.sedanLod, wheels: WHEELS.sedan, wheelMesh: "wheel", sign: true },
    police: { body: sedan.body, glass: sedan.glass, lod: lib.sedanLod, wheels: WHEELS.sedan, wheelMesh: "wheel", police: true },
    van: { body: van.body, glass: van.glass, lod: lib.vanLod, wheels: WHEELS.van, wheelMesh: "wheel" },
    truck: { body: truck.body, glass: truck.glass, lod: lib.truckLod, wheels: WHEELS.truck, wheelMesh: "wheelTruck" },
  };
  return lib;
}

const STYLES = ["sedan", "hatch", "sedan", "taxi", "van", "hatch", "truck", "sedan"];

export function carStyle(key, police = false) {
  if (police) return "police";
  let h = 2166136261;
  const s = String(key ?? "car");
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return STYLES[(h >>> 0) % STYLES.length];
}

export function scooterSport(key) {
  let h = 2166136261;
  const s = String(key ?? "scooter");
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return (h >>> 0) % 5 === 0;
}

export function scooterBasket(key) {
  let h = 2166136261;
  const s = String(key ?? "scooter");
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return (h >>> 0) % 3 === 0;
}

export function paintOf(style, tint) {
  if (style === "taxi") return TAXI;
  if (style === "police") return POLICE;
  return tint || WHITE;
}

export function seatOf(style) {
  return SEATS[style] || SEATS.sedan;
}

const Mroot = new Float32Array(16);
const Mlocal = new Float32Array(16);
const Mworld = new Float32Array(16);
const Mpt = new Float32Array(16);

export function toWorld(x, y, z, yaw, roll, lx, ly, lz) {
  compose(Mpt, x, y, z, yaw, 0, roll || 0);
  return [
    Mpt[0] * lx + Mpt[4] * ly + Mpt[8] * lz + Mpt[12],
    Mpt[1] * lx + Mpt[5] * ly + Mpt[9] * lz + Mpt[13],
    Mpt[2] * lx + Mpt[6] * ly + Mpt[10] * lz + Mpt[14],
  ];
}

function shadow(renderer, lib, x, y, z, sx, sz) {
  compose(Mworld, x, y + 0.025, z, 0, 0, 0, sx, 1, sz);
  renderer.draw(lib.shadow, Mworld, WHITE, 0.32, 1);
}

function drawChild(renderer, mesh, x, y, z, yaw, pitch, roll, tint, alpha = 1) {
  if (!mesh) return;
  compose(Mlocal, x, y, z, yaw, pitch, roll);
  multiply(Mworld, Mroot, Mlocal);
  renderer.draw(mesh, Mworld, tint || WHITE, alpha, 0);
}

function flashLights(renderer, lib, y, z, blink, night) {
  const redOn = blink >= 0;
  drawChild(renderer, redOn ? lib.lampRed : lib.lampBlue, redOn ? -0.16 : 0.16, y, z, 0, 0, 0, WHITE);
  drawChild(renderer, lib.halo, redOn ? -0.16 : 0.16, y, z, 0, 0, 0, redOn ? RED : BLUE, 0.28 + night * 0.22);
}

export function drawScooter(renderer, lib, x, y, z, yaw, roll, spin, tint, opt = {}) {
  const dist = opt.dist ?? 0;
  const steer = opt.steer || 0;
  const police = !!opt.police;
  const key = opt.key || tintKey(tint);
  const sport = opt.sport != null ? opt.sport : (!police && scooterSport(key));
  const basket = opt.basket != null ? opt.basket : (!police && !sport && scooterBasket(key));
  const paint = police ? POLICE : (tint || RED);
  compose(Mroot, x, y, z, yaw, 0, roll || 0);
  if (opt.shadow !== false) shadow(renderer, lib, x, y, z, 0.7, 1.15);
  if (dist > 36) {
    renderer.draw(lib.scooterLod, Mroot, paint, 1, 0);
    return;
  }
  renderer.draw(sport ? lib.sport : lib.step, Mroot, paint, 1, 0);
  drawChild(renderer, lib.wheelScooter, RIDE.rearAxle[0], RIDE.rearAxle[1], RIDE.rearAxle[2], 0, spin, 0, WHITE);
  const [px, py, pz] = RIDE.pivot;
  drawChild(renderer, lib.fork, px, py, pz, steer, 0, 0, paint);
  const axle = RIDE.frontAxle;
  const c = Math.cos(steer);
  const s = Math.sin(steer);
  const ax = px + axle[0] * c + axle[2] * s;
  const az = pz - axle[0] * s + axle[2] * c;
  drawChild(renderer, lib.wheelScooter, ax, py + axle[1], az, steer, spin, 0, WHITE);
  if (basket) drawChild(renderer, lib.basket, px, py, pz, steer, 0, 0, WHITE);
  if (police) flashLights(renderer, lib, 1.12, 0.15, opt.blink || 0, opt.night || 0);
  if ((opt.night || 0) > 0.35 && dist < 28) {
    drawChild(renderer, lib.beam, 0, 0.8, 1.05, 0, 0, 0, LIGHT, 0.16 + opt.night * 0.12);
  }
}

export function drawCar(renderer, lib, x, y, z, yaw, spin, tint, police = false, blink = 0, opt = {}) {
  const style = police ? "police" : (opt.style || carStyle(opt.key || tintKey(tint), false));
  const spec = lib.kind[style] || lib.kind.sedan;
  const dist = opt.dist ?? 0;
  const steer = opt.steer || 0;
  const paint = paintOf(style, tint);
  const night = opt.night || 0;
  compose(Mroot, x, y, z, yaw, 0, 0);
  if (opt.shadow !== false) shadow(renderer, lib, x, y, z, style === "truck" || style === "van" ? 1.5 : 1.2, style === "truck" ? 2.6 : 2.15);
  const far = dist > 40;
  if (far) {
    renderer.draw(spec.lod, Mroot, paint, 1, 0);
    if (spec.sign) renderer.draw(lib.taxiSign, Mroot, WHITE, 1, 0);
    if (spec.police && dist < 75) flashLights(renderer, lib, 1.56, -0.08, blink, night);
    return;
  }
  renderer.draw(spec.body, Mroot, paint, 1, 0);
  const wheel = lib[spec.wheelMesh] || lib.wheel;
  for (const w of spec.wheels) {
    drawChild(renderer, wheel, w.x, w.y, w.z, w.steer ? steer : 0, spin || 0, 0, WHITE);
  }
  if (spec.police) {
    renderer.draw(lib.stripe, Mroot, WHITE, 1, 0);
    flashLights(renderer, lib, 1.56, -0.08, blink, night);
  }
  if (spec.sign) renderer.draw(lib.taxiSign, Mroot, WHITE, 1, 0);
  if (opt.beforeGlass) opt.beforeGlass();
  if (opt.glass !== false && spec.glass) renderer.draw(spec.glass, Mroot, WHITE, 0.55, 0);
  if (night > 0.35) {
    drawChild(renderer, lib.beam, 0.4, (spec.wheels[0].y || 0.4) + 0.2, spec.wheels[0].z + 0.9, 0, 0, 0, LIGHT, 0.12 + night * 0.1);
    drawChild(renderer, lib.beam, -0.4, (spec.wheels[0].y || 0.4) + 0.2, spec.wheels[0].z + 0.9, 0, 0, 0, LIGHT, 0.12 + night * 0.1);
  }
}

export function drawCarGlass(renderer, lib, x, y, z, yaw, tint, police = false, opt = {}) {
  const style = police ? "police" : (opt.style || carStyle(opt.key || tintKey(tint), false));
  const spec = lib.kind[style] || lib.kind.sedan;
  if (!spec.glass || (opt.dist ?? 0) > 40) return;
  compose(Mroot, x, y, z, yaw, 0, 0);
  renderer.draw(spec.glass, Mroot, WHITE, 0.55, 0);
}

export function drawHeli(renderer, lib, x, y, z, yaw, spin, opt = {}) {
  const blink = opt.blink != null ? opt.blink : Math.sin(spin);
  compose(Mroot, x, y, z, yaw, 0, 0);
  renderer.draw(lib.heli, Mroot, WHITE, 1, 0);
  if (lib.heliGlass) renderer.draw(lib.heliGlass, Mroot, WHITE, 0.5, 0);
  drawChild(renderer, lib.rotor, 0, 0.78, 0.25, spin, 0, 0, WHITE);
  drawChild(renderer, lib.rotorDisc, 0, 0.8, 0.25, 0, 0, 0, WHITE, 0.14);
  drawChild(renderer, lib.tailRotor, 0.28, 0.22, -2.55, 0, spin * 1.7, 0, WHITE);
  flashLights(renderer, lib, 0.68, 0.2, blink, opt.night || 0);
}

function tintKey(tint) {
  if (!tint) return "0";
  return `${tint[0].toFixed(3)}|${tint[1].toFixed(3)}|${tint[2].toFixed(3)}`;
}
