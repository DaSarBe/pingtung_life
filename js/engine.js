// Small WebGL2 renderer for stylized low-poly scenes.
// One lit shader, chunk meshes, frustum culling. No external engine.

export const DEG = Math.PI / 180;

export function clamp(v, a, b) {
  return v < a ? a : v > b ? b : v;
}

export function lerp(a, b, t) {
  return a + (b - a) * t;
}

export function damp(a, b, lambda, dt) {
  return lerp(a, b, 1 - Math.exp(-lambda * dt));
}

export function wrapAngle(a) {
  const t = Math.PI * 2;
  a = a % t;
  if (a > Math.PI) a -= t;
  if (a < -Math.PI) a += t;
  return a;
}

export function angleDiff(target, current) {
  return wrapAngle(target - current);
}

export function dampAngle(current, target, lambda, dt) {
  return current + angleDiff(target, current) * (1 - Math.exp(-lambda * dt));
}

export function dist2(ax, az, bx, bz) {
  const dx = ax - bx;
  const dz = az - bz;
  return dx * dx + dz * dz;
}

export function hex(n) {
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function rng() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function faceNormal(a, b, c) {
  const ux = b[0] - a[0];
  const uy = b[1] - a[1];
  const uz = b[2] - a[2];
  const vx = c[0] - a[0];
  const vy = c[1] - a[1];
  const vz = c[2] - a[2];
  let nx = uy * vz - uz * vy;
  let ny = uz * vx - ux * vz;
  let nz = ux * vy - uy * vx;
  const len = Math.hypot(nx, ny, nz) || 1;
  return [nx / len, ny / len, nz / len];
}

export function identity(m) {
  m[0] = 1; m[1] = 0; m[2] = 0; m[3] = 0;
  m[4] = 0; m[5] = 1; m[6] = 0; m[7] = 0;
  m[8] = 0; m[9] = 0; m[10] = 1; m[11] = 0;
  m[12] = 0; m[13] = 0; m[14] = 0; m[15] = 1;
  return m;
}

export function compose(m, x, y, z, yaw, pitch, roll, sx = 1, sy = 1, sz = 1) {
  const cy = Math.cos(yaw), syaw = Math.sin(yaw);
  const cp = Math.cos(pitch), sp = Math.sin(pitch);
  const cr = Math.cos(roll), sr = Math.sin(roll);
  const a00 = cy * cr + syaw * sp * sr;
  const a01 = -cy * sr + syaw * sp * cr;
  const a02 = syaw * cp;
  const a10 = cp * sr;
  const a11 = cp * cr;
  const a12 = -sp;
  const a20 = -syaw * cr + cy * sp * sr;
  const a21 = syaw * sr + cy * sp * cr;
  const a22 = cy * cp;
  m[0] = a00 * sx; m[1] = a10 * sx; m[2] = a20 * sx; m[3] = 0;
  m[4] = a01 * sy; m[5] = a11 * sy; m[6] = a21 * sy; m[7] = 0;
  m[8] = a02 * sz; m[9] = a12 * sz; m[10] = a22 * sz; m[11] = 0;
  m[12] = x; m[13] = y; m[14] = z; m[15] = 1;
  return m;
}

export function multiply(out, a, b) {
  for (let c = 0; c < 4; c++) {
    const b0 = b[c * 4];
    const b1 = b[c * 4 + 1];
    const b2 = b[c * 4 + 2];
    const b3 = b[c * 4 + 3];
    out[c * 4] = a[0] * b0 + a[4] * b1 + a[8] * b2 + a[12] * b3;
    out[c * 4 + 1] = a[1] * b0 + a[5] * b1 + a[9] * b2 + a[13] * b3;
    out[c * 4 + 2] = a[2] * b0 + a[6] * b1 + a[10] * b2 + a[14] * b3;
    out[c * 4 + 3] = a[3] * b0 + a[7] * b1 + a[11] * b2 + a[15] * b3;
  }
  return out;
}

export function perspective(out, fovy, aspect, near, far) {
  const f = 1 / Math.tan(fovy / 2);
  const nf = 1 / (near - far);
  out.fill(0);
  out[0] = f / aspect;
  out[5] = f;
  out[10] = (far + near) * nf;
  out[11] = -1;
  out[14] = 2 * far * near * nf;
  return out;
}

export function lookAt(out, eye, target, up) {
  let zx = eye[0] - target[0];
  let zy = eye[1] - target[1];
  let zz = eye[2] - target[2];
  let len = Math.hypot(zx, zy, zz) || 1;
  zx /= len; zy /= len; zz /= len;
  let xx = up[1] * zz - up[2] * zy;
  let xy = up[2] * zx - up[0] * zz;
  let xz = up[0] * zy - up[1] * zx;
  len = Math.hypot(xx, xy, xz) || 1;
  xx /= len; xy /= len; xz /= len;
  const yx = zy * xz - zz * xy;
  const yy = zz * xx - zx * xz;
  const yz = zx * xy - zy * xx;
  out[0] = xx; out[1] = yx; out[2] = zx; out[3] = 0;
  out[4] = xy; out[5] = yy; out[6] = zy; out[7] = 0;
  out[8] = xz; out[9] = yz; out[10] = zz; out[11] = 0;
  out[12] = -(xx * eye[0] + xy * eye[1] + xz * eye[2]);
  out[13] = -(yx * eye[0] + yy * eye[1] + yz * eye[2]);
  out[14] = -(zx * eye[0] + zy * eye[1] + zz * eye[2]);
  out[15] = 1;
  return out;
}

function normalizePlane(p) {
  const len = Math.hypot(p[0], p[1], p[2]) || 1;
  p[0] /= len; p[1] /= len; p[2] /= len; p[3] /= len;
  return p;
}

export function frustumPlanes(m, out) {
  // Column-major VP. Rows are (m[r], m[4+r], m[8+r], m[12+r]).
  const r0 = [m[0], m[4], m[8], m[12]];
  const r1 = [m[1], m[5], m[9], m[13]];
  const r2 = [m[2], m[6], m[10], m[14]];
  const r3 = [m[3], m[7], m[11], m[15]];
  const add = (a, b, sign) => normalizePlane([
    a[0] + sign * b[0], a[1] + sign * b[1], a[2] + sign * b[2], a[3] + sign * b[3],
  ]);
  out[0] = add(r3, r0, 1);
  out[1] = add(r3, r0, -1);
  out[2] = add(r3, r1, 1);
  out[3] = add(r3, r1, -1);
  out[4] = add(r3, r2, 1);
  out[5] = add(r3, r2, -1);
  return out;
}

export function aabbVisible(planes, min, max) {
  for (let i = 0; i < 6; i++) {
    const p = planes[i];
    const x = p[0] >= 0 ? max[0] : min[0];
    const y = p[1] >= 0 ? max[1] : min[1];
    const z = p[2] >= 0 ? max[2] : min[2];
    if (p[0] * x + p[1] * y + p[2] * z + p[3] < 0) return false;
  }
  return true;
}

export function projectToScreen(vp, x, y, z, width, height) {
  const cx = vp[0] * x + vp[4] * y + vp[8] * z + vp[12];
  const cy = vp[1] * x + vp[5] * y + vp[9] * z + vp[13];
  const cw = vp[3] * x + vp[7] * y + vp[11] * z + vp[15];
  if (cw <= 0.05) return null;
  const nx = cx / cw;
  const ny = cy / cw;
  if (nx < -1.3 || nx > 1.3 || ny < -1.3 || ny > 1.3) return null;
  return {
    x: (nx * 0.5 + 0.5) * width,
    y: (-ny * 0.5 + 0.5) * height,
  };
}

export class MeshBuilder {
  constructor() {
    this.pos = [];
    this.nrm = [];
    this.col = [];
    this.glow = [];
    this.tint = [];
    this.idx = [];
    this.min = [1e9, 1e9, 1e9];
    this.max = [-1e9, -1e9, -1e9];
  }

  get count() {
    return this.idx.length;
  }

  vert(x, y, z, nx, ny, nz, r, g, b, glow, tint) {
    this.pos.push(x, y, z);
    this.nrm.push(nx, ny, nz);
    this.col.push(r, g, b);
    this.glow.push(glow);
    this.tint.push(tint);
    if (x < this.min[0]) this.min[0] = x;
    if (y < this.min[1]) this.min[1] = y;
    if (z < this.min[2]) this.min[2] = z;
    if (x > this.max[0]) this.max[0] = x;
    if (y > this.max[1]) this.max[1] = y;
    if (z > this.max[2]) this.max[2] = z;
  }

  quad(verts, color, glow = 0, tint = 0) {
    const n = faceNormal(verts[0], verts[1], verts[2]);
    const b = this.pos.length / 3;
    for (let i = 0; i < 4; i++) {
      const v = verts[i];
      this.vert(v[0], v[1], v[2], n[0], n[1], n[2], color[0], color[1], color[2], glow, tint);
    }
    this.idx.push(b, b + 1, b + 2, b, b + 2, b + 3);
  }

  tri(a, b, c, color, glow = 0, tint = 0) {
    const n = faceNormal(a, b, c);
    const base = this.pos.length / 3;
    this.vert(a[0], a[1], a[2], n[0], n[1], n[2], color[0], color[1], color[2], glow, tint);
    this.vert(b[0], b[1], b[2], n[0], n[1], n[2], color[0], color[1], color[2], glow, tint);
    this.vert(c[0], c[1], c[2], n[0], n[1], n[2], color[0], color[1], color[2], glow, tint);
    this.idx.push(base, base + 1, base + 2);
  }

  box(x, y, z, sx, sy, sz, color, glow = 0, tint = 0) {
    const hx = sx / 2, hy = sy / 2, hz = sz / 2;
    const p = [
      [x - hx, y - hy, z - hz], [x + hx, y - hy, z - hz], [x + hx, y + hy, z - hz], [x - hx, y + hy, z - hz],
      [x - hx, y - hy, z + hz], [x + hx, y - hy, z + hz], [x + hx, y + hy, z + hz], [x - hx, y + hy, z + hz],
    ];
    this.quad([p[4], p[5], p[6], p[7]], color, glow, tint);
    this.quad([p[1], p[0], p[3], p[2]], color, glow, tint);
    this.quad([p[3], p[7], p[6], p[2]], color, glow, tint);
    this.quad([p[0], p[1], p[5], p[4]], color, glow, tint);
    this.quad([p[5], p[1], p[2], p[6]], color, glow, tint);
    this.quad([p[0], p[4], p[7], p[3]], color, glow, tint);
  }

  boxRot(x, y, z, sx, sy, sz, yaw, pitch, color, glow = 0, tint = 0) {
    const hx = sx / 2, hy = sy / 2, hz = sz / 2;
    const local = [
      [-hx, -hy, -hz], [hx, -hy, -hz], [hx, hy, -hz], [-hx, hy, -hz],
      [-hx, -hy, hz], [hx, -hy, hz], [hx, hy, hz], [-hx, hy, hz],
    ];
    const cp = Math.cos(pitch), sp = Math.sin(pitch);
    const cy = Math.cos(yaw), syaw = Math.sin(yaw);
    const p = local.map(([px, py, pz]) => {
      const y1 = py * cp - pz * sp;
      const z1 = py * sp + pz * cp;
      const x2 = px * cy + z1 * syaw;
      const z2 = -px * syaw + z1 * cy;
      return [x + x2, y + y1, z + z2];
    });
    this.quad([p[4], p[5], p[6], p[7]], color, glow, tint);
    this.quad([p[1], p[0], p[3], p[2]], color, glow, tint);
    this.quad([p[3], p[7], p[6], p[2]], color, glow, tint);
    this.quad([p[0], p[1], p[5], p[4]], color, glow, tint);
    this.quad([p[5], p[1], p[2], p[6]], color, glow, tint);
    this.quad([p[0], p[4], p[7], p[3]], color, glow, tint);
  }

  cylinder(x, y, z, r, h, seg, color, glow = 0, tint = 0, axis = "y") {
    const rings = [[], []];
    for (let i = 0; i <= seg; i++) {
      const a = (i % seg) / seg * Math.PI * 2;
      const c = Math.cos(a);
      const s = Math.sin(a);
      let dx = 0, dy = 0, dz = 0, nx = 0, ny = 0, nz = 0;
      if (axis === "y") {
        dx = c * r; dy = 0; dz = s * r; nx = c; nz = s;
      } else if (axis === "x") {
        dx = 0; dy = c * r; dz = s * r; ny = c; nz = s;
      } else {
        dx = c * r; dy = s * r; dz = 0; nx = c; ny = s;
      }
      const sign = [-1, 1];
      for (let k = 0; k < 2; k++) {
        const o = (k === 0 ? -h / 2 : h / 2);
        const px = x + dx + (axis === "x" ? o : 0);
        const py = y + dy + (axis === "y" ? o : 0);
        const pz = z + dz + (axis === "z" ? o : 0);
        rings[k].push([px, py, pz, nx, ny, nz]);
      }
    }
    for (let i = 0; i < seg; i++) {
      const a = rings[0][i];
      const b = rings[0][i + 1];
      const c = rings[1][i + 1];
      const d = rings[1][i];
      const base = this.pos.length / 3;
      const push = (v) => this.vert(v[0], v[1], v[2], v[3], v[4], v[5], color[0], color[1], color[2], glow, tint);
      push(a); push(b); push(c); push(d);
      this.idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
    }
    const cap = (ring, outward) => {
      const centerOff = outward;
      let cx = x, cy = y, cz = z, nx = 0, ny = 0, nz = 0;
      if (axis === "y") { cy += outward * h / 2; ny = outward; }
      else if (axis === "x") { cx += outward * h / 2; nx = outward; }
      else { cz += outward * h / 2; nz = outward; }
      const base = this.pos.length / 3;
      this.vert(cx, cy, cz, nx, ny, nz, color[0], color[1], color[2], glow, tint);
      for (let i = 0; i < seg; i++) {
        const v = ring[i];
        this.vert(v[0], v[1], v[2], nx, ny, nz, color[0], color[1], color[2], glow, tint);
      }
      for (let i = 0; i < seg; i++) {
        const i1 = base + 1 + i;
        const i2 = base + 1 + ((i + 1) % seg);
        if (outward > 0) this.idx.push(base, i1, i2);
        else this.idx.push(base, i2, i1);
      }
    };
    cap(rings[0], -1);
    cap(rings[1], 1);
  }

  sphere(x, y, z, r, seg, color, glow = 0, tint = 0) {
    const stacks = Math.max(2, Math.round(seg / 2));
    const slices = seg;
    const grid = [];
    for (let i = 0; i <= stacks; i++) {
      const v = i / stacks;
      const phi = v * Math.PI;
      const row = [];
      for (let j = 0; j <= slices; j++) {
        const u = j / slices;
        const theta = u * Math.PI * 2;
        const nx = Math.sin(phi) * Math.cos(theta);
        const ny = Math.cos(phi);
        const nz = Math.sin(phi) * Math.sin(theta);
        row.push([x + nx * r, y + ny * r, z + nz * r, nx, ny, nz]);
      }
      grid.push(row);
    }
    for (let i = 0; i < stacks; i++) {
      for (let j = 0; j < slices; j++) {
        const a = grid[i][j];
        const b = grid[i + 1][j];
        const c = grid[i + 1][j + 1];
        const d = grid[i][j + 1];
        const base = this.pos.length / 3;
        const push = (v) => this.vert(v[0], v[1], v[2], v[3], v[4], v[5], color[0], color[1], color[2], glow, tint);
        push(a); push(b); push(c); push(d);
        this.idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
      }
    }
  }

  cone(x, y, z, r, h, seg, color, glow = 0, tint = 0) {
    const tip = [x, y + h / 2, z];
    const y0 = y - h / 2;
    for (let i = 0; i < seg; i++) {
      const a0 = i / seg * Math.PI * 2;
      const a1 = (i + 1) / seg * Math.PI * 2;
      const p0 = [x + Math.cos(a0) * r, y0, z + Math.sin(a0) * r];
      const p1 = [x + Math.cos(a1) * r, y0, z + Math.sin(a1) * r];
      this.tri(p0, p1, tip, color, glow, tint);
      this.tri([x, y0, z], p1, p0, color, glow, tint);
    }
  }

  prismRoof(x, y, z, sx, sy, sz, color, glow = 0, tint = 0) {
    const x0 = x - sx / 2, x1 = x + sx / 2;
    const y0 = y, y1 = y + sy;
    const z0 = z - sz / 2, z1 = z + sz / 2;
    const ridge0 = [x0, y1, z];
    const ridge1 = [x1, y1, z];
    const e00 = [x0, y0, z0], e10 = [x1, y0, z0];
    const e01 = [x0, y0, z1], e11 = [x1, y0, z1];
    this.quad([e00, e10, ridge1, ridge0], color, glow, tint);
    this.quad([e11, e01, ridge0, ridge1], color, glow, tint);
    this.tri(e00, ridge0, e01, color, glow, tint);
    this.tri(e10, e11, ridge1, color, glow, tint);
  }

  disc(x, y, z, r, seg, color, glow = 0, tint = 0) {
    const base = this.pos.length / 3;
    this.vert(x, y, z, 0, 1, 0, color[0], color[1], color[2], glow, tint);
    for (let i = 0; i < seg; i++) {
      const a = i / seg * Math.PI * 2;
      this.vert(x + Math.cos(a) * r, y, z + Math.sin(a) * r, 0, 1, 0, color[0], color[1], color[2], glow, tint);
    }
    for (let i = 0; i < seg; i++) {
      this.idx.push(base, base + 1 + i, base + 1 + ((i + 1) % seg));
    }
  }
}

const LIT_VS = `#version 300 es
layout(location=0) in vec3 aPos;
layout(location=1) in vec3 aNrm;
layout(location=2) in vec3 aCol;
layout(location=3) in float aGlow;
layout(location=4) in float aTint;
uniform mat4 uVP;
uniform mat4 uModel;
uniform vec3 uTint;
out vec3 vN;
out vec3 vCol;
out vec3 vWorld;
out float vGlow;
void main() {
  vec4 w = uModel * vec4(aPos, 1.0);
  vWorld = w.xyz;
  vN = mat3(uModel) * aNrm;
  vCol = mix(aCol, aCol * uTint, aTint);
  vGlow = aGlow;
  gl_Position = uVP * w;
}`;

const LIT_FS = `#version 300 es
precision highp float;
in vec3 vN;
in vec3 vCol;
in vec3 vWorld;
in float vGlow;
uniform vec3 uCam;
uniform vec3 uSunDir;
uniform vec3 uSunColor;
uniform vec3 uAmbient;
uniform vec3 uFogColor;
uniform float uFogDensity;
uniform float uNight;
uniform float uAlpha;
uniform float uUnlit;
out vec4 frag;
void main() {
  float dist = length(uCam - vWorld);
  float fog = clamp(1.0 - exp(-uFogDensity * dist), 0.0, 1.0);
  if (uUnlit > 0.5) {
    frag = vec4(mix(vCol, uFogColor, fog), uAlpha);
    return;
  }
  vec3 n = normalize(vN);
  vec3 sun = normalize(uSunDir);
  float wrap = clamp(dot(n, sun) * 0.62 + 0.38, 0.0, 1.0);
  float sky = n.y * 0.5 + 0.5;
  vec3 hemi = mix(vec3(0.42, 0.3, 0.22), vec3(0.55, 0.68, 0.86), sky);
  vec3 lit = vCol * (uAmbient + uSunColor * wrap + hemi * 0.16);
  float windowE = step(0.5, vGlow) * (1.0 - step(1.5, vGlow));
  float lampE = step(1.5, vGlow);
  lit += vCol * (windowE * uNight * 1.55 + lampE * (0.15 + uNight * 1.25));
  vec3 viewDir = normalize(uCam - vWorld);
  float rim = pow(1.0 - max(dot(n, viewDir), 0.0), 2.4);
  lit += rim * mix(vec3(0.2, 0.26, 0.34), vec3(1.0, 0.7, 0.4), uNight) * 0.1;
  lit = lit / (vec3(1.0) + lit * 0.18);
  frag = vec4(mix(lit, uFogColor, fog), uAlpha);
}`;

const SKY_VS = `#version 300 es
void main() {
  vec2 p = vec2((gl_VertexID << 1) & 2, gl_VertexID & 2);
  gl_Position = vec4(p * 2.0 - 1.0, 1.0, 1.0);
}`;

const WATER_VS = `#version 300 es
layout(location=0) in vec3 aPos;
layout(location=2) in vec3 aCol;
uniform mat4 uVP;
uniform float uTime;
out vec3 vCol;
out vec3 vWorld;
void main() {
  float wave = sin(aPos.x * 0.12 + uTime * 1.4) * 0.12 + sin(aPos.z * 0.09 + uTime) * 0.08;
  vec3 p = aPos + vec3(0.0, wave, 0.0);
  vWorld = p;
  vCol = aCol;
  gl_Position = uVP * vec4(p, 1.0);
}`;

const WATER_FS = `#version 300 es
precision highp float;
in vec3 vCol;
in vec3 vWorld;
uniform vec3 uCam;
uniform vec3 uFogColor;
uniform float uFogDensity;
uniform float uNight;
out vec4 frag;
void main() {
  vec3 viewDir = normalize(uCam - vWorld);
  float fres = pow(1.0 - max(viewDir.y, 0.0), 1.6);
  vec3 deep = mix(vec3(0.05, 0.28, 0.42), vec3(0.02, 0.08, 0.16), uNight);
  vec3 shallow = mix(vec3(0.35, 0.72, 0.78), vec3(0.15, 0.28, 0.4), uNight);
  vec3 col = mix(deep, shallow, fres);
  col = mix(col, vCol, 0.25);
  float dist = length(uCam - vWorld);
  float fog = clamp(1.0 - exp(-uFogDensity * dist), 0.0, 1.0);
  frag = vec4(mix(col, uFogColor, fog), 0.88);
}`;

function compile(gl, type, src) {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, src);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(shader) || "shader error";
    gl.deleteShader(shader);
    throw new Error(log);
  }
  return shader;
}

function program(gl, vs, fs) {
  const p = gl.createProgram();
  const v = compile(gl, gl.VERTEX_SHADER, vs);
  const f = compile(gl, gl.FRAGMENT_SHADER, fs);
  gl.attachShader(p, v);
  gl.attachShader(p, f);
  gl.linkProgram(p);
  gl.deleteShader(v);
  gl.deleteShader(f);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
    const log = gl.getProgramInfoLog(p) || "link error";
    gl.deleteProgram(p);
    throw new Error(log);
  }
  return p;
}

function glBuffer(gl, target, data, usage) {
  const buf = gl.createBuffer();
  gl.bindBuffer(target, buf);
  gl.bufferData(target, data, usage);
  return buf;
}

export function createRenderer(canvas) {
  const gl = canvas.getContext("webgl2", {
    antialias: true,
    alpha: false,
    depth: true,
    stencil: false,
    powerPreference: "high-performance",
    preserveDrawingBuffer: false,
  });
  if (!gl) throw new Error("這個瀏覽器不支援 WebGL2");

  const lit = program(gl, LIT_VS, LIT_FS);
  const litLoc = {
    vp: gl.getUniformLocation(lit, "uVP"),
    model: gl.getUniformLocation(lit, "uModel"),
    tint: gl.getUniformLocation(lit, "uTint"),
    cam: gl.getUniformLocation(lit, "uCam"),
    sunDir: gl.getUniformLocation(lit, "uSunDir"),
    sunColor: gl.getUniformLocation(lit, "uSunColor"),
    ambient: gl.getUniformLocation(lit, "uAmbient"),
    fogColor: gl.getUniformLocation(lit, "uFogColor"),
    fogDensity: gl.getUniformLocation(lit, "uFogDensity"),
    night: gl.getUniformLocation(lit, "uNight"),
    alpha: gl.getUniformLocation(lit, "uAlpha"),
    unlit: gl.getUniformLocation(lit, "uUnlit"),
  };
  return finishRenderer(gl, canvas, lit, litLoc);
}

function finishRenderer(gl, canvas, lit, litLoc) {
  const skySrc = `#version 300 es
precision highp float;
uniform vec3 uForward;
uniform vec3 uRight;
uniform vec3 uUp;
uniform vec2 uTan;
uniform vec2 uView;
uniform vec3 uTop;
uniform vec3 uHorizon;
uniform vec3 uGround;
uniform vec3 uSunDir;
uniform vec3 uSunColor;
uniform float uNight;
out vec4 frag;
float hash(vec3 p) {
  return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453);
}
void main() {
  vec2 ndc = (gl_FragCoord.xy / uView) * 2.0 - 1.0;
  vec3 rd = normalize(uForward + uRight * ndc.x * uTan.x + uUp * ndc.y * uTan.y);
  float h = rd.y;
  vec3 col = mix(uHorizon, uTop, clamp(h * 0.85 + 0.05, 0.0, 1.0));
  if (h < 0.02) col = mix(col, uGround, clamp((0.02 - h) * 2.2, 0.0, 1.0));
  vec3 sun = normalize(uSunDir);
  float sunD = max(dot(rd, sun), 0.0);
  col += uSunColor * (pow(sunD, 220.0) * 0.9 + pow(sunD, 18.0) * 0.12);
  vec3 moonDir = normalize(vec3(-sun.x, abs(sun.y) + 0.15, -sun.z));
  col += vec3(0.82, 0.88, 1.0) * pow(max(dot(rd, moonDir), 0.0), 140.0) * uNight;
  float n = hash(floor(rd * 48.0));
  col += step(0.993, n) * step(0.22, rd.y) * uNight;
  frag = vec4(col, 1.0);
}`;
  const sky = program(gl, SKY_VS, skySrc);
  const water = program(gl, WATER_VS, WATER_FS);
  const skyLoc = {
    forward: gl.getUniformLocation(sky, "uForward"),
    right: gl.getUniformLocation(sky, "uRight"),
    up: gl.getUniformLocation(sky, "uUp"),
    tan: gl.getUniformLocation(sky, "uTan"),
    view: gl.getUniformLocation(sky, "uView"),
    top: gl.getUniformLocation(sky, "uTop"),
    horizon: gl.getUniformLocation(sky, "uHorizon"),
    ground: gl.getUniformLocation(sky, "uGround"),
    sunDir: gl.getUniformLocation(sky, "uSunDir"),
    sunColor: gl.getUniformLocation(sky, "uSunColor"),
    night: gl.getUniformLocation(sky, "uNight"),
  };
  const waterLoc = {
    vp: gl.getUniformLocation(water, "uVP"),
    time: gl.getUniformLocation(water, "uTime"),
    cam: gl.getUniformLocation(water, "uCam"),
    fogColor: gl.getUniformLocation(water, "uFogColor"),
    fogDensity: gl.getUniformLocation(water, "uFogDensity"),
    night: gl.getUniformLocation(water, "uNight"),
  };

  const skyVao = gl.createVertexArray();
  const ident = identity(new Float32Array(16));
  const vp = new Float32Array(16);
  const view = new Float32Array(16);
  const proj = new Float32Array(16);
  const planes = [[0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]];
  const white = [1, 1, 1];
  let env = null;
  let aspect = 1;
  let viewW = 1;
  let viewH = 1;
  let dprScale = 1;
  const draws = { count: 0 };

  function createMesh(builder) {
    if (!builder || builder.idx.length === 0) return null;
    const vao = gl.createVertexArray();
    gl.bindVertexArray(vao);
    const attrib = (loc, data, size) => {
      const buf = glBuffer(gl, gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
      gl.enableVertexAttribArray(loc);
      gl.vertexAttribPointer(loc, size, gl.FLOAT, false, 0, 0);
      return buf;
    };
    attrib(0, new Float32Array(builder.pos), 3);
    attrib(1, new Float32Array(builder.nrm), 3);
    attrib(2, new Float32Array(builder.col), 3);
    attrib(3, new Float32Array(builder.glow), 1);
    attrib(4, new Float32Array(builder.tint), 1);
    glBuffer(gl, gl.ELEMENT_ARRAY_BUFFER, new Uint32Array(builder.idx), gl.STATIC_DRAW);
    gl.bindVertexArray(null);
    return {
      vao,
      count: builder.idx.length,
      min: builder.min.slice(),
      max: builder.max.slice(),
    };
  }

  function phoneLike() {
    const coarse = window.matchMedia("(pointer: coarse)").matches;
    const small = Math.min(window.screen.width, window.screen.height) <= 900;
    return coarse || small || window.innerWidth < 820;
  }

  function resize() {
    const base = phoneLike() ? 1.15 : 1.6;
    const dpr = Math.min(window.devicePixelRatio || 1, base) * dprScale;
    const w = Math.max(1, Math.floor(canvas.clientWidth * dpr));
    const h = Math.max(1, Math.floor(canvas.clientHeight * dpr));
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }
    viewW = w;
    viewH = h;
    aspect = w / h;
    gl.viewport(0, 0, w, h);
  }

  function adaptQuality(fps) {
    if (fps > 0 && fps < 28 && dprScale > 0.72) dprScale = Math.max(0.72, dprScale - 0.08);
    else if (fps > 55 && dprScale < 1) dprScale = Math.min(1, dprScale + 0.04);
  }

  function begin(camera, nextEnv) {
    env = nextEnv;
    resize();
    gl.viewport(0, 0, viewW, viewH);
    perspective(proj, camera.fov || 58 * DEG, aspect, 0.12, 780);
    lookAt(view, camera.eye, camera.target, [0, 1, 0]);
    multiply(vp, proj, view);
    frustumPlanes(vp, planes);
    draws.count = 0;

    const f = camera.forward;
    const r = camera.right;
    const u = camera.up;
    const fov = camera.fov || 58 * DEG;
    const tanY = Math.tan(fov / 2);
    const tanX = tanY * aspect;

    gl.disable(gl.DEPTH_TEST);
    gl.depthMask(false);
    gl.disable(gl.BLEND);
    gl.disable(gl.CULL_FACE);
    gl.useProgram(sky);
    gl.uniform3fv(skyLoc.forward, f);
    gl.uniform3fv(skyLoc.right, r);
    gl.uniform3fv(skyLoc.up, u);
    gl.uniform2f(skyLoc.tan, tanX, tanY);
    gl.uniform2f(skyLoc.view, viewW, viewH);
    gl.uniform3fv(skyLoc.top, env.skyTop);
    gl.uniform3fv(skyLoc.horizon, env.skyHorizon);
    gl.uniform3fv(skyLoc.ground, env.fogColor);
    gl.uniform3fv(skyLoc.sunDir, env.sunDir);
    gl.uniform3fv(skyLoc.sunColor, env.sunColor);
    gl.uniform1f(skyLoc.night, env.night);
    gl.bindVertexArray(skyVao);
    gl.drawArrays(gl.TRIANGLES, 0, 3);

    gl.enable(gl.DEPTH_TEST);
    gl.depthMask(true);
    gl.depthFunc(gl.LEQUAL);
    gl.enable(gl.CULL_FACE);
    gl.cullFace(gl.BACK);
    gl.clear(gl.DEPTH_BUFFER_BIT);
    gl.useProgram(lit);
    gl.uniformMatrix4fv(litLoc.vp, false, vp);
    gl.uniform3fv(litLoc.cam, camera.eye);
    gl.uniform3fv(litLoc.sunDir, env.sunDir);
    gl.uniform3fv(litLoc.sunColor, env.sunColor);
    gl.uniform3fv(litLoc.ambient, env.ambient);
    gl.uniform3fv(litLoc.fogColor, env.fogColor);
    gl.uniform1f(litLoc.fogDensity, env.fogDensity);
    gl.uniform1f(litLoc.night, env.night);
  }

  function draw(mesh, model, tint, alpha = 1, unlit = 0) {
    if (!mesh) return;
    const transparent = alpha < 0.999;
    if (transparent) {
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
      gl.depthMask(false);
      gl.disable(gl.CULL_FACE);
    }
    gl.uniformMatrix4fv(litLoc.model, false, model || ident);
    gl.uniform3fv(litLoc.tint, tint || white);
    gl.uniform1f(litLoc.alpha, alpha);
    gl.uniform1f(litLoc.unlit, unlit);
    gl.bindVertexArray(mesh.vao);
    gl.drawElements(gl.TRIANGLES, mesh.count, gl.UNSIGNED_INT, 0);
    draws.count++;
    if (transparent) {
      gl.depthMask(true);
      gl.disable(gl.BLEND);
      gl.enable(gl.CULL_FACE);
    }
  }

  function drawWater(mesh, time) {
    if (!mesh) return;
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    gl.depthMask(false);
    gl.disable(gl.CULL_FACE);
    gl.useProgram(water);
    gl.uniformMatrix4fv(waterLoc.vp, false, vp);
    gl.uniform1f(waterLoc.time, time);
    gl.uniform3fv(waterLoc.cam, env ? [0, 0, 0] : [0, 0, 0]);
    // camera is the last begin() eye; re-read from lit uniform path via stored env camera.
    gl.uniform3fv(waterLoc.cam, lastEye);
    gl.uniform3fv(waterLoc.fogColor, env.fogColor);
    gl.uniform1f(waterLoc.fogDensity, env.fogDensity);
    gl.uniform1f(waterLoc.night, env.night);
    gl.bindVertexArray(mesh.vao);
    gl.drawElements(gl.TRIANGLES, mesh.count, gl.UNSIGNED_INT, 0);
    draws.count++;
    gl.depthMask(true);
    gl.disable(gl.BLEND);
    gl.enable(gl.CULL_FACE);
    gl.useProgram(lit);
  }

  const lastEye = new Float32Array(3);

  function beginWrapped(camera, nextEnv) {
    lastEye[0] = camera.eye[0];
    lastEye[1] = camera.eye[1];
    lastEye[2] = camera.eye[2];
    begin(camera, nextEnv);
  }

  function beginAlpha() {
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    gl.depthMask(false);
    gl.disable(gl.CULL_FACE);
  }

  function endAlpha() {
    gl.depthMask(true);
    gl.disable(gl.BLEND);
    gl.enable(gl.CULL_FACE);
  }

  function visible(min, max) {
    return aabbVisible(planes, min, max);
  }

  function project(x, y, z) {
    return projectToScreen(vp, x, y, z, canvas.clientWidth, canvas.clientHeight);
  }

  function readCenterPixel() {
    const pix = new Uint8Array(4);
    gl.readPixels((viewW / 2) | 0, (viewH / 2) | 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pix);
    return pix;
  }

  return {
    gl,
    createMesh,
    begin: beginWrapped,
    draw,
    drawWater,
    beginAlpha,
    endAlpha,
    visible,
    project,
    resize,
    adaptQuality,
    readCenterPixel,
    draws,
    get dprScale() { return dprScale; },
  };
}

export class ColliderGrid {
  constructor(colliders, cell = 24) {
    this.cell = cell;
    this.map = new Map();
    for (const c of colliders) {
      const x0 = Math.floor(c.minX / cell);
      const x1 = Math.floor(c.maxX / cell);
      const z0 = Math.floor(c.minZ / cell);
      const z1 = Math.floor(c.maxZ / cell);
      for (let x = x0; x <= x1; x++) {
        for (let z = z0; z <= z1; z++) {
          const k = x + "," + z;
          let list = this.map.get(k);
          if (!list) {
            list = [];
            this.map.set(k, list);
          }
          list.push(c);
        }
      }
    }
  }

  query(x, z, rad) {
    const c0x = Math.floor((x - rad) / this.cell);
    const c1x = Math.floor((x + rad) / this.cell);
    const c0z = Math.floor((z - rad) / this.cell);
    const c1z = Math.floor((z + rad) / this.cell);
    const out = [];
    const seen = new Set();
    for (let cx = c0x; cx <= c1x; cx++) {
      for (let cz = c0z; cz <= c1z; cz++) {
        const list = this.map.get(cx + "," + cz);
        if (!list) continue;
        for (const c of list) {
          if (seen.has(c)) continue;
          seen.add(c);
          out.push(c);
        }
      }
    }
    return out;
  }
}

export function resolveCircle(grid, x, z, radius) {
  let hit = false;
  for (let pass = 0; pass < 2; pass++) {
    const list = grid.query(x, z, radius);
    for (const c of list) {
      const minX = c.minX - radius;
      const maxX = c.maxX + radius;
      const minZ = c.minZ - radius;
      const maxZ = c.maxZ + radius;
      if (x <= minX || x >= maxX || z <= minZ || z >= maxZ) continue;
      const penL = x - minX;
      const penR = maxX - x;
      const penD = z - minZ;
      const penU = maxZ - z;
      const m = Math.min(penL, penR, penD, penU);
      if (m === penL) x = minX;
      else if (m === penR) x = maxX;
      else if (m === penD) z = minZ;
      else z = maxZ;
      hit = true;
    }
  }
  return { x, z, hit };
}

export function pointBlocked(grid, x, z, radius) {
  const list = grid.query(x, z, radius);
  for (const c of list) {
    if (x > c.minX - radius && x < c.maxX + radius && z > c.minZ - radius && z < c.maxZ + radius) return true;
  }
  return false;
}

const MAT_POOL = Array.from({ length: 48 }, () => new Float32Array(16));
let matCursor = 0;

export function beginMats() {
  matCursor = 0;
}

export function mat() {
  const m = MAT_POOL[matCursor++];
  if (!m) throw new Error("matrix pool exhausted");
  return m;
}
