/* 屏東人生的城市。
 * 只用瀏覽器內建的 WebGL。屏東火車站、夜市、千禧公園、勝利星村、
 * 太平洋百貨、縣政府與六堆、屏東大學、高屏溪、檳榔園、東港漁港在同一張路上。
 * 第三人稱走動或騎車。街上有行人、車流，通緝時警察會追。
 */
(function () {
  'use strict';

  var B = { minX: -78, maxX: 78, minZ: -78, maxZ: 78 };
  var DISTRICT = {
    home: { x: -56, z: 16, r: 5.2 },
    station: { x: -40, z: 30, r: 17 },
    market: { x: 0, z: 56, r: 12 },
    park: { x: -40, z: -48, r: 13 },
    star: { x: -58, z: -18, r: 11 },
    mall: { x: 46, z: 28, r: 11 },
    gov: { x: 46, z: -28, r: 13 },
    uni: { x: 40, z: -52, r: 12 },
    river: { x: 0, z: -66, r: 14 },
    farm: { x: -58, z: 50, r: 8 },
    port: { x: 56, z: 58, r: 11 }
  };
  var PLACE_NAME = {
    home: '雅房', station: '屏東火車站', market: '屏東夜市', park: '千禧公園',
    star: '勝利星村', mall: '太平洋百貨', gov: '縣政府、六堆', uni: '屏東大學',
    river: '高屏溪', farm: '檳榔園', port: '東港漁港', road: '街上'
  };
  var SPAWN = {
    home: { x: -56, z: 16.4, ry: 0.42 },
    station: { x: -36, z: 36, ry: Math.PI },
    market: { x: 0, z: 48, ry: Math.PI },
    park: { x: -40, z: -40, ry: 0 },
    star: { x: -52, z: -18, ry: Math.PI / 2 },
    mall: { x: 40, z: 36, ry: Math.PI },
    gov: { x: 40, z: -20, ry: Math.PI / 2 },
    uni: { x: 34, z: -44, ry: 0 },
    river: { x: -16, z: -60, ry: 0 },
    farm: { x: -50, z: 44, ry: Math.PI },
    port: { x: 48, z: 54, ry: Math.PI / 2 }
  };

  var canvas = null;
  var fallback = null;
  var gl = null;
  var program = null;
  var geos = {};
  var locs = {};
  var active = false;
  var frameId = 0;
  var period = 'morning';
  var clock = 7 * 60;
  var dirty = true;
  var placed = false;
  var paused = false;
  var tired = false;
  var rideMode = 'walk';
  var speedMul = 1;
  var carrying = false;
  var parts = [];
  var blockers = [];
  var spots = [];
  var sink = parts;
  var actorParts = [];
  var liveParts = [];
  var actor = { x: -56, z: 16.4, ry: 0, moving: false };
  var cam = { yaw: Math.PI, pitch: 0.48, dist: 8.6 };
  var camFocus = { x: -56, z: 16.4 };
  var scratch = {
    proj: new Float32Array(16), view: new Float32Array(16), viewProj: new Float32Array(16),
    inv: new Float32Array(16), model: new Float32Array(16), mvp: new Float32Array(16), normal: new Float32Array(9)
  };
  var hasView = false;
  var keys = {};
  var joy = { x: 0, y: 0 };
  var clickTarget = null;
  var clickStuck = 0;
  var glide = null;
  var lastDistrict = '';
  var lastNow = 0;
  var walkSend = 0;
  var pointers = {};
  var press = null;
  var BODY = 0.42;
  var hidden = {};
  var wantStars = 0;
  var police = [];
  var heatSend = 0;
  var ticketCool = 0;
  var cameraCool = 0;
  var prevPos = { x: actor.x, z: actor.z };
  var checks = [];
  var checkAt = 0;
  var lightPhase = 0;
  var npcs = [];
  var traffic = [];
  var sirenOsc = null;
  var sirenGain = null;
  var audioCtx = null;

  function hex(value) {
    return [((value >> 16) & 255) / 255, ((value >> 8) & 255) / 255, (value & 255) / 255];
  }
  function clamp(n, a, b) { return Math.max(a, Math.min(b, n)); }
  function lerp(a, b, t) { return a + (b - a) * t; }

  function lookAt(eye, target, out) {
    var zx = eye[0] - target[0], zy = eye[1] - target[1], zz = eye[2] - target[2];
    var zl = Math.hypot(zx, zy, zz) || 1;
    zx /= zl; zy /= zl; zz /= zl;
    var xx = zz, xy = 0, xz = -zx;
    var xl = Math.hypot(xx, xy, xz) || 1;
    xx /= xl; xy /= xl; xz /= xl;
    var yx = zy * xz - zz * xy, yy = zz * xx - zx * xz, yz = zx * xy - zy * xx;
    out[0] = xx; out[1] = yx; out[2] = zx; out[3] = 0;
    out[4] = xy; out[5] = yy; out[6] = zy; out[7] = 0;
    out[8] = xz; out[9] = yz; out[10] = zz; out[11] = 0;
    out[12] = -(xx * eye[0] + xy * eye[1] + xz * eye[2]);
    out[13] = -(yx * eye[0] + yy * eye[1] + yz * eye[2]);
    out[14] = -(zx * eye[0] + zy * eye[1] + zz * eye[2]);
    out[15] = 1;
  }

  function perspective(fov, aspect, near, far, out) {
    var f = 1 / Math.tan(fov / 2);
    var nf = 1 / (near - far);
    out[0] = f / aspect; out[1] = 0; out[2] = 0; out[3] = 0;
    out[4] = 0; out[5] = f; out[6] = 0; out[7] = 0;
    out[8] = 0; out[9] = 0; out[10] = (far + near) * nf; out[11] = -1;
    out[12] = 0; out[13] = 0; out[14] = 2 * far * near * nf; out[15] = 0;
  }

  function multiply(a, b, out) {
    for (var c = 0; c < 4; c += 1) {
      for (var r = 0; r < 4; r += 1) {
        out[c * 4 + r] = a[r] * b[c * 4] + a[4 + r] * b[c * 4 + 1] + a[8 + r] * b[c * 4 + 2] + a[12 + r] * b[c * 4 + 3];
      }
    }
  }

  function invert4(m, out) {
    var a00 = m[0], a01 = m[1], a02 = m[2], a03 = m[3];
    var a10 = m[4], a11 = m[5], a12 = m[6], a13 = m[7];
    var a20 = m[8], a21 = m[9], a22 = m[10], a23 = m[11];
    var a30 = m[12], a31 = m[13], a32 = m[14], a33 = m[15];
    var b00 = a00 * a11 - a01 * a10, b01 = a00 * a12 - a02 * a10, b02 = a00 * a13 - a03 * a10;
    var b03 = a01 * a12 - a02 * a11, b04 = a01 * a13 - a03 * a11, b05 = a02 * a13 - a03 * a12;
    var b06 = a20 * a31 - a21 * a30, b07 = a20 * a32 - a22 * a30, b08 = a20 * a33 - a23 * a30;
    var b09 = a21 * a32 - a22 * a31, b10 = a21 * a33 - a23 * a31, b11 = a22 * a33 - a23 * a32;
    var det = b00 * b11 - b01 * b10 + b02 * b09 + b03 * b08 - b04 * b07 + b05 * b06;
    if (!det) return false;
    det = 1 / det;
    out[0] = (a11 * b11 - a12 * b10 + a13 * b09) * det;
    out[1] = (a02 * b10 - a01 * b11 - a03 * b09) * det;
    out[2] = (a31 * b05 - a32 * b04 + a33 * b03) * det;
    out[3] = (a22 * b04 - a21 * b05 - a23 * b03) * det;
    out[4] = (a12 * b08 - a10 * b11 - a13 * b07) * det;
    out[5] = (a00 * b11 - a02 * b08 + a03 * b07) * det;
    out[6] = (a32 * b02 - a30 * b05 - a33 * b01) * det;
    out[7] = (a20 * b05 - a22 * b02 + a23 * b01) * det;
    out[8] = (a10 * b10 - a11 * b08 + a13 * b06) * det;
    out[9] = (a01 * b08 - a00 * b10 - a03 * b06) * det;
    out[10] = (a30 * b04 - a31 * b02 + a33 * b00) * det;
    out[11] = (a21 * b02 - a20 * b04 - a23 * b00) * det;
    out[12] = (a11 * b07 - a10 * b09 - a12 * b06) * det;
    out[13] = (a00 * b09 - a01 * b07 + a02 * b06) * det;
    out[14] = (a31 * b01 - a30 * b03 - a32 * b00) * det;
    out[15] = (a20 * b03 - a21 * b01 + a22 * b00) * det;
    return true;
  }

  function modelOf(x, y, z, rx, ry, rz, sx, sy, sz, out) {
    var cx = Math.cos(rx), sxr = Math.sin(rx);
    var cy = Math.cos(ry), syr = Math.sin(ry);
    var cz = Math.cos(rz), szr = Math.sin(rz);
    var r00 = cy * cz + syr * sxr * szr;
    var r01 = cz * syr * sxr - cy * szr;
    var r02 = cx * syr;
    var r10 = cx * szr;
    var r11 = cx * cz;
    var r12 = -sxr;
    var r20 = cy * sxr * szr - cz * syr;
    var r21 = syr * szr + cy * cz * sxr;
    var r22 = cy * cx;
    out[0] = r00 * sx; out[1] = r10 * sx; out[2] = r20 * sx; out[3] = 0;
    out[4] = r01 * sy; out[5] = r11 * sy; out[6] = r21 * sy; out[7] = 0;
    out[8] = r02 * sz; out[9] = r12 * sz; out[10] = r22 * sz; out[11] = 0;
    out[12] = x; out[13] = y; out[14] = z; out[15] = 1;
  }

  function normalFromModel(m, out) {
    var a00 = m[0], a01 = m[1], a02 = m[2];
    var a10 = m[4], a11 = m[5], a12 = m[6];
    var a20 = m[8], a21 = m[9], a22 = m[10];
    var b01 = a22 * a11 - a12 * a21;
    var b11 = -a22 * a10 + a12 * a20;
    var b21 = a21 * a10 - a11 * a20;
    var det = a00 * b01 + a01 * b11 + a02 * b21;
    if (!det) det = 1;
    det = 1 / det;
    out[0] = b01 * det; out[1] = b11 * det; out[2] = b21 * det;
    out[3] = (-a22 * a01 + a02 * a21) * det;
    out[4] = (a22 * a00 - a02 * a20) * det;
    out[5] = (-a21 * a00 + a01 * a20) * det;
    out[6] = (a12 * a01 - a02 * a11) * det;
    out[7] = (-a12 * a00 + a02 * a10) * det;
    out[8] = (a11 * a00 - a01 * a10) * det;
  }

  function pushTri(pos, nrm, a, b, c, n) {
    pos.push(a[0], a[1], a[2], b[0], b[1], b[2], c[0], c[1], c[2]);
    nrm.push(n[0], n[1], n[2], n[0], n[1], n[2], n[0], n[1], n[2]);
  }

  function buildBox() {
    var p = [
      [-0.5, -0.5, -0.5], [0.5, -0.5, -0.5], [0.5, 0.5, -0.5], [-0.5, 0.5, -0.5],
      [-0.5, -0.5, 0.5], [0.5, -0.5, 0.5], [0.5, 0.5, 0.5], [-0.5, 0.5, 0.5]
    ];
    var faces = [
      [4, 5, 6, 7, [0, 0, 1]], [1, 0, 3, 2, [0, 0, -1]],
      [3, 7, 6, 2, [0, 1, 0]], [0, 1, 5, 4, [0, -1, 0]],
      [1, 2, 6, 5, [1, 0, 0]], [4, 7, 3, 0, [-1, 0, 0]]
    ];
    var pos = [], nrm = [];
    faces.forEach(function (face) {
      pushTri(pos, nrm, p[face[0]], p[face[1]], p[face[2]], face[4]);
      pushTri(pos, nrm, p[face[0]], p[face[2]], p[face[3]], face[4]);
    });
    return { pos: new Float32Array(pos), nrm: new Float32Array(nrm), count: pos.length / 3 };
  }

  function buildSphere(lat, lon) {
    var pos = [], nrm = [];
    for (var y = 0; y < lat; y += 1) {
      for (var x = 0; x < lon; x += 1) {
        var u0 = y / lat, u1 = (y + 1) / lat, v0 = x / lon, v1 = (x + 1) / lon;
        var p0 = (u0 - 0.5) * Math.PI, p1 = (u1 - 0.5) * Math.PI;
        var t0 = v0 * Math.PI * 2, t1 = v1 * Math.PI * 2;
        var corners = [
          [Math.cos(p0) * Math.sin(t0), Math.sin(p0), Math.cos(p0) * Math.cos(t0)],
          [Math.cos(p0) * Math.sin(t1), Math.sin(p0), Math.cos(p0) * Math.cos(t1)],
          [Math.cos(p1) * Math.sin(t1), Math.sin(p1), Math.cos(p1) * Math.cos(t1)],
          [Math.cos(p1) * Math.sin(t0), Math.sin(p1), Math.cos(p1) * Math.cos(t0)]
        ];
        pushTri(pos, nrm, corners[0], corners[1], corners[2], corners[0]);
        pushTri(pos, nrm, corners[0], corners[2], corners[3], corners[0]);
      }
    }
    return { pos: new Float32Array(pos), nrm: new Float32Array(nrm), count: pos.length / 3 };
  }

  function buildCylinder(seg) {
    var pos = [], nrm = [];
    for (var i = 0; i < seg; i += 1) {
      var a0 = (i / seg) * Math.PI * 2, a1 = ((i + 1) / seg) * Math.PI * 2;
      var x0 = Math.sin(a0), z0 = Math.cos(a0), x1 = Math.sin(a1), z1 = Math.cos(a1);
      var b0 = [x0, -0.5, z0], b1 = [x1, -0.5, z1], t0 = [x0, 0.5, z0], t1 = [x1, 0.5, z1];
      pushTri(pos, nrm, b0, t0, t1, [x0, 0, z0]);
      pushTri(pos, nrm, b0, t1, b1, [x1, 0, z1]);
      pushTri(pos, nrm, [0, 0.5, 0], t1, t0, [0, 1, 0]);
      pushTri(pos, nrm, [0, -0.5, 0], b0, b1, [0, -1, 0]);
    }
    return { pos: new Float32Array(pos), nrm: new Float32Array(nrm), count: pos.length / 3 };
  }

  function uploadGeo(name, geo) {
    var posBuf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, posBuf);
    gl.bufferData(gl.ARRAY_BUFFER, geo.pos, gl.STATIC_DRAW);
    var nrmBuf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, nrmBuf);
    gl.bufferData(gl.ARRAY_BUFFER, geo.nrm, gl.STATIC_DRAW);
    geos[name] = { pos: posBuf, nrm: nrmBuf, count: geo.count };
  }

  function compile() {
    var vsSource = [
      'attribute vec3 aPos;', 'attribute vec3 aNormal;',
      'uniform mat4 uMvp;', 'uniform mat4 uModel;', 'uniform mat3 uNormal;',
      'varying vec3 vN;', 'varying vec3 vWorld;',
      'void main() {',
      '  vec4 world = uModel * vec4(aPos, 1.0);',
      '  vWorld = world.xyz;',
      '  vN = uNormal * aNormal;',
      '  gl_Position = uMvp * vec4(aPos, 1.0);',
      '}'
    ].join('\n');
    var fsSource = [
      'precision mediump float;',
      'varying vec3 vN;', 'varying vec3 vWorld;',
      'uniform vec3 uColor;', 'uniform vec3 uLightDir;', 'uniform vec3 uSun;',
      'uniform vec3 uAmbient;', 'uniform vec3 uCam;', 'uniform vec3 uFogColor;',
      'uniform float uFogNear;', 'uniform float uFogFar;',
      'void main() {',
      '  vec3 n = normalize(vN);',
      '  float ndl = clamp(dot(n, uLightDir), 0.0, 1.0);',
      '  float hemi = n.y * 0.22 + 0.78;',
      '  vec3 col = uColor * (uAmbient * hemi + uSun * ndl);',
      '  float dist = length(vWorld - uCam);',
      '  float fog = clamp((dist - uFogNear) / (uFogFar - uFogNear), 0.0, 1.0);',
      '  gl_FragColor = vec4(mix(col, uFogColor, fog), 1.0);',
      '}'
    ].join('\n');
    function shader(type, source) {
      var sh = gl.createShader(type);
      gl.shaderSource(sh, source);
      gl.compileShader(sh);
      return sh;
    }
    program = gl.createProgram();
    gl.attachShader(program, shader(gl.VERTEX_SHADER, vsSource));
    gl.attachShader(program, shader(gl.FRAGMENT_SHADER, fsSource));
    gl.bindAttribLocation(program, 0, 'aPos');
    gl.bindAttribLocation(program, 1, 'aNormal');
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) return false;
    gl.useProgram(program);
    ['uMvp', 'uModel', 'uNormal', 'uColor', 'uLightDir', 'uSun', 'uAmbient', 'uCam', 'uFogColor', 'uFogNear', 'uFogFar'].forEach(function (name) {
      locs[name] = gl.getUniformLocation(program, name);
    });
    return true;
  }

  function add(geo, x, y, z, sx, sy, sz, color, rx, ry, rz, anim, phase) {
    sink.push({
      geo: geo, x: x, y: y, z: z, sx: sx, sy: sy, sz: sz,
      rx: rx || 0, ry: ry || 0, rz: rz || 0, color: color, anim: anim || '', phase: phase || 0
    });
  }
  function box(x, y, z, sx, sy, sz, color, rx, ry, rz) { add('box', x, y, z, sx, sy, sz, color, rx, ry, rz); }
  function ball(x, y, z, r, color) { add('sphere', x, y, z, r, r, r, color); }
  function tube(x, y, z, radius, height, color, rx, ry, rz) { add('cyl', x, y, z, radius, height, radius, color, rx, ry, rz); }
  function block(x, z, sx, sz) {
    blockers.push({ minX: x - sx / 2, maxX: x + sx / 2, minZ: z - sz / 2, maxZ: z + sz / 2 });
  }
  function solid(x, y, z, sx, sy, sz, color) { box(x, y, z, sx, sy, sz, color); block(x, z, sx, sz); }
  function marker(x, y, z) {
    add('sphere', x, y, z, 0.26, 0.26, 0.26, hex(0xf2c14e), 0, 0, 0, 'bob', x + z);
    tube(x, y - 0.5, z, 0.05, 0.6, hex(0xf2c14e));
  }
  function spot(id, x, z) {
    if (hidden[id]) return;
    spots.push({ id: id, x: x, z: z });
    marker(x, 1.55, z);
  }
  function nightish() { return period === 'night' || period === 'evening'; }

  function house(x, z, w, d, h, color, roof) {
    solid(x, h / 2, z, w, h, d, color);
    box(x, h + 0.16, z, w + 0.36, 0.28, d + 0.36, roof || hex(0x8d3b32));
    box(x, h + 0.32, z, w * 0.55, 0.1, d * 0.55, hex(0x6d5844));
    if (d < 1.2 || h < 2) {
      if (nightish()) box(x, h * 0.62, z + d / 2 + 0.02, 0.28, 0.28, 0.06, hex(0xffe08a));
      return;
    }
    var face = z + d / 2 + 0.05;
    box(x, h * 0.26, face, Math.min(0.7, w * 0.28), h * 0.42, 0.08, hex(0x6a3b2a));
    if (w > 2.4) {
      box(x - w * 0.28, h * 0.62, face, 0.42, 0.38, 0.06, hex(0xd7eaf6));
      box(x + w * 0.28, h * 0.62, face, 0.42, 0.38, 0.06, hex(0xd7eaf6));
    }
    if (nightish()) box(x, h * 0.62, face, 0.32, 0.32, 0.07, hex(0xffe08a));
  }
  function palm(x, z, h) {
    tube(x, h * 0.45, z, 0.08, h * 0.9, hex(0x6b4423));
    tube(x, h * 0.2, z, 0.11, h * 0.28, hex(0x5a381c));
    ball(x, h + 0.02, z, 0.16, hex(0x1d5c34));
    for (var leaf = 0; leaf < 6; leaf += 1) {
      var ang = leaf / 6 * Math.PI * 2;
      box(x + Math.sin(ang) * 0.42, h + 0.18, z + Math.cos(ang) * 0.42, 0.62, 0.05, 0.16, hex(leaf % 2 ? 0x1c7a42 : 0x3d9a58), 0.55, ang, 0);
    }
  }
  function stall(x, z, color) {
    solid(x, 0.4, z, 2.05, 0.62, 1.15, hex(0xf6e2c4));
    tube(x - 0.95, 0.85, z - 0.4, 0.045, 1.35, hex(0x6b4423));
    tube(x + 0.95, 0.85, z - 0.4, 0.045, 1.35, hex(0x6b4423));
    tube(x - 0.95, 0.85, z + 0.4, 0.045, 1.35, hex(0x6b4423));
    tube(x + 0.95, 0.85, z + 0.4, 0.045, 1.35, hex(0x6b4423));
    box(x, 1.42, z, 2.45, 0.08, 1.55, color, 0.18, 0, 0);
    box(x, 1.08, z + 0.62, 1.15, 0.32, 0.06, hex(0xfff6e8));
  }
  function parkedBike(id, x, z) {
    if (hidden[id]) return;
    vehicle(x, z, 0, 'scooter', hex(0xf08a3c));
    spot(id, x, z + 1.35);
  }
  function parkedCar(id, x, z) {
    if (hidden[id]) return;
    vehicle(x, z, 0, 'car', hex(0xc81e36));
    spot(id, x, z + 1.7);
  }

  function buildCity() {
    box(0, -0.2, 0, 170, 0.2, 170, hex(0x3e6b45));
    box(0, 0.02, 0, 150, 0.04, 10, hex(0x3a424c));
    box(0, 0.02, 0, 10, 0.04, 150, hex(0x3a424c));
    box(0, 0.045, 0, 150, 0.02, 0.16, hex(0xe6d48a));
    box(0, 0.045, 0, 0.16, 0.02, 150, hex(0xe6d48a));
    box(68, 0.02, 0, 8, 0.04, 140, hex(0x3a424c));
    box(-68, 0.02, 0, 8, 0.04, 140, hex(0x3a424c));
    box(0, 0.02, 64, 140, 0.04, 8, hex(0x3a424c));
    box(0, 0.02, -68, 140, 0.04, 8, hex(0x4d5c66));
    box(0, -0.05, -76, 160, 0.12, 14, hex(0x2f6f92));
    box(0, 0.08, -70, 8, 0.08, 10, hex(0x6d5844));

    for (var i = -60; i <= 60; i += 16) {
      if (Math.abs(i) > 10) {
        palm(i, 12, 2.4);
        palm(i, -12, 2.2);
      }
    }

    house(-40, 27, 13, 5.5, 3.1, hex(0xe7e0d4), hex(0x24527a));
    box(-40, 0.12, 33, 14, 0.16, 2.4, hex(0x9aa0a6));
    spot('train', -40, 35.2);
    stall(-52, 22.6, hex(0xe7b15a));
    spot('breakfast', -52, 24.4);
    spot('bus', -22, 34);
    solid(-22, 1.1, 24, 3.4, 2.2, 2.6, hex(0x1a1a1a));
    box(-22, 2.3, 24, 3.6, 0.18, 2.8, hex(0xf2c14e));
    spot('bike-shop', -22, 26.4);
    solid(24, 0.2, 24, 4.2, 0.12, 3.2, hex(0x2c3138));
    box(24, 2.5, 24, 4.6, 0.16, 3.4, hex(0xd7263d));
    solid(24, 0.55, 24, 0.4, 0.9, 0.4, hex(0xf4f4f4));
    spot('gas', 24, 26.6);
    house(28, 42, 6, 4, 2.4, hex(0xe8e8ea), hex(0xc81e36));
    spot('car-shop', 28, 45.2);

    house(-56, 14.6, 5.4, 0.28, 1.6, hex(0xe7d3b8));
    solid(-58.6, 0.8, 16.4, 0.28, 1.6, 3.8, hex(0xe7d3b8));
    solid(-53.4, 0.8, 16.4, 0.28, 1.6, 3.8, hex(0xe7d3b8));
    solid(-58.05, 0.8, 18.4, 1.7, 1.6, 0.28, hex(0xe7d3b8));
    solid(-53.95, 0.8, 18.4, 1.7, 1.6, 0.28, hex(0xe7d3b8));
    box(-56, 0.05, 16.2, 4.6, 0.06, 3.2, hex(0xc49a6c));
    solid(-57.2, 0.28, 15.2, 1.2, 0.32, 0.7, hex(0xf7f1e6));
    spot('sleep', -57.2, 15.2);
    spot('rest', -54.8, 15.4);

    house(-46, 22, 3.2, 2.4, 2.2, hex(0xf7f1e4), hex(0xef8d22));
    box(-46, 2.15, 22, 3.4, 0.16, 2.6, hex(0x0b8f62));
    spot('mart', -46, 24.2);

    [[-62, -10], [-62, -18], [-62, -26]].forEach(function (item) {
      house(item[0], item[1], 3.2, 2.6, 1.7, hex(0xd7c4a4), hex(0x4a6b4a));
    });
    spot('photo', -54, -18);

    box(-40, 0.04, -48, 16, 0.05, 14, hex(0x2f8a4a));
    palm(-46, -44, 2.8);
    palm(-34, -52, 2.5);
    palm(-44, -54, 2.1);
    solid(-36, 0.28, -44, 1.2, 0.1, 0.4, hex(0x8d6848));
    spot('sit', -36, -44);
    spot('stroll', -44, -52);

    house(48, -22, 7, 5, 6.5, hex(0xc9bfb0), hex(0x8d3b32));
    house(30, -34, 8, 5, 2.2, hex(0xf0e2cf), hex(0x8d3b32));
    spot('drop-note', 44, -16);
    spot('chun', 30, -30.6);
    house(42, -54, 8, 5, 4.2, hex(0xd8deee), hex(0x24527a));
    house(32, -48, 4, 3, 2.4, hex(0xf7f1e4), hex(0x8d6848));
    spot('ade', 36, -46);
    spot('canteen', 32, -45.2);

    house(46, 26, 8, 6, 7.2, hex(0xf3efe8), hex(0x24527a));
    spot('mall', 46, 30.4);

    [[-8, 54, 0x8c2f2f, 'meat'], [2, 54, 0xef8d22, 'tea'], [12, 54, 0x0b8f62, 'ring']].forEach(function (item) {
      stall(item[0], item[1], hex(item[2]));
      spot(item[3], item[0], item[1] + 1.5);
    });
    spot('xia', -2, 58);
    house(18, 60, 3.2, 2.4, 1.8, hex(0x3a2a28), hex(0x1a1a1a));
    spot('gamble', 18, 62.2);
    if (nightish()) {
      for (var lamp = -10; lamp <= 14; lamp += 4) ball(lamp, 2.3, 52, 0.14, hex(lamp % 8 ? 0xffb703 : 0xff5a36));
    }

    palm(-62, 46, 3.2);
    palm(-54, 52, 2.8);
    palm(-64, 54, 2.4);
    house(-58, 44, 3.4, 2.6, 1.6, hex(0x6b8f4e), hex(0x4a6b32));
    spot('farm', -54, 44);

    box(58, 0.1, 60, 8, 0.12, 6, hex(0x8d7a62));
    box(62, 0.08, 66, 6, 0.08, 3, hex(0x6d8494));
    house(52, 54, 3.6, 2.4, 1.8, hex(0xd7e3ea), hex(0x24527a));
    spot('port', 54, 56.2);

    spot('long', -16, -60);
    spot('race', -8, -62);
    spot('box-drop', 12, -60);
    parkedBike('hot-1', -32, 38);
    parkedBike('hot-2', 14, 18);
    parkedBike('hot-3', -8, 50);
    parkedCar('hot-car', 40, 40);
    spot('box-take', 16, 48);

    [[36, 4], [-36, 4]].forEach(function (cam) {
      tube(cam[0], 1.1, cam[1], 0.08, 2.2, hex(0x666));
      box(cam[0], 2.2, cam[1], 0.5, 0.28, 0.2, hex(0xf2c14e));
    });
  }

  function seedLife() {
    npcs = [
      { id: 'xia', still: true, x: -2, z: 59.2, tx: -2, tz: 59.2, color: hex(0xf2a3b5) },
      { id: 'ade', still: true, x: 36, z: -47.4, tx: 36, tz: -47.4, color: hex(0x8fb7e8) },
      { id: 'chun', still: true, x: 30, z: -31.8, tx: 30, tz: -31.8, color: hex(0xe7c98a) },
      { id: 'long', still: true, x: -16, z: -61.4, tx: -16, tz: -61.4, color: hex(0x222222) }
    ];
    var shirts = [0xf7f1e4, 0x87b8d8, 0xf0c36a, 0xd7a08a, 0xc9d6b8, 0xe7eef8, 0xf2c1a8, 0xb9c4d4];
    for (var n = 0; n < 8; n += 1) {
      var horizontal = n % 2 === 0;
      npcs.push({
        id: 'ped-' + n,
        x: horizontal ? -40 + n * 10 : (n % 4 === 0 ? -14 : 14),
        z: horizontal ? (n % 4 === 0 ? 16 : -16) : -30 + (n % 5) * 12,
        tx: horizontal ? 40 : (n % 4 === 0 ? -14 : 14),
        tz: horizontal ? (n % 4 === 0 ? 16 : -16) : 30,
        color: hex(shirts[n]),
        knock: 0
      });
    }
    traffic = [];
    var ring = [[-68, -60], [68, -60], [68, 60], [-68, 60]];
    for (var t = 0; t < 4; t += 1) {
      traffic.push({ path: ring, i: t, x: ring[t][0], z: ring[t][1], speed: 7 + t, kind: t % 2 ? 'car' : 'scooter', color: hex(t % 2 ? 0x24527a : 0xf08a3c), ry: 0 });
    }
    traffic.push({ ping: true, axis: 'x', fixed: 4, min: -58, max: 58, pos: -20, dir: 1, speed: 9, kind: 'scooter', color: hex(0xef8d22), x: -20, z: 4, ry: 0 });
    traffic.push({ ping: true, axis: 'x', fixed: -4, min: -58, max: 58, pos: 24, dir: -1, speed: 8, kind: 'car', color: hex(0xc81e36), x: 24, z: -4, ry: 0 });
    traffic.push({ ping: true, axis: 'z', fixed: 4, min: -55, max: 55, pos: 10, dir: 1, speed: 8.5, kind: 'scooter', color: hex(0xf2c14e), x: 4, z: 10, ry: 0 });
    traffic.push({ ping: true, axis: 'z', fixed: -4, min: -55, max: 55, pos: -16, dir: -1, speed: 7.5, kind: 'car', color: hex(0x1a1a1a), x: -4, z: -16, ry: 0 });
  }

  function rebuild() {
    parts = [];
    blockers = [];
    spots = [];
    sink = parts;
    buildCity();
    dirty = false;
    layoutMap();
  }

  function currentDistrict() {
    if (Math.abs(actor.x + 56) < 4.2 && Math.abs(actor.z - 16) < 3.6 && actor.z < 18.6) return 'home';
    var found = 'road';
    var best = 1e9;
    Object.keys(DISTRICT).forEach(function (id) {
      if (id === 'home') return;
      var d = DISTRICT[id];
      var dist = Math.hypot(actor.x - d.x, actor.z - d.z);
      var limit = d.r + (lastDistrict === id ? 2.2 : 0);
      if (dist <= limit && dist < best) { best = dist; found = id; }
    });
    return found;
  }

  function hits(x, z) {
    if (x < B.minX || x > B.maxX || z < B.minZ || z > B.maxZ) return true;
    for (var i = 0; i < blockers.length; i += 1) {
      var b = blockers[i];
      if (x > b.minX - BODY && x < b.maxX + BODY && z > b.minZ - BODY && z < b.maxZ + BODY) return true;
    }
    return false;
  }
  function moveTo(nx, nz) {
    if (!hits(nx, actor.z)) actor.x = nx;
    if (!hits(actor.x, nz)) actor.z = nz;
  }

  function wish() {
    var ix = (keys.KeyD || keys.ArrowRight ? 1 : 0) - (keys.KeyA || keys.ArrowLeft ? 1 : 0) + joy.x;
    var iz = (keys.KeyS || keys.ArrowDown ? 1 : 0) - (keys.KeyW || keys.ArrowUp ? 1 : 0) + joy.y;
    if (Math.hypot(ix, iz) > 0.2) {
      clickTarget = null;
      var fX = -Math.sin(cam.yaw), fZ = -Math.cos(cam.yaw);
      var rX = Math.cos(cam.yaw), rZ = -Math.sin(cam.yaw);
      var x = rX * ix + fX * (-iz);
      var z = rZ * ix + fZ * (-iz);
      var len = Math.hypot(x, z) || 1;
      return { x: x / len, z: z / len, power: Math.min(1, Math.hypot(ix, iz)) };
    }
    if (clickTarget) {
      var dx = clickTarget.x - actor.x, dz = clickTarget.z - actor.z;
      var dist = Math.hypot(dx, dz);
      if (dist < 0.45) { clickTarget = null; return null; }
      return { x: dx / dist, z: dz / dist, power: 1 };
    }
    return null;
  }

  function placeActor(x, z, ry) {
    actor.x = x; actor.z = z; actor.ry = ry || 0;
    cam.yaw = actor.ry + Math.PI;
    camFocus.x = x; camFocus.z = z;
    clickTarget = null;
    glide = null;
    lastDistrict = currentDistrict();
    prevPos.x = x; prevPos.z = z;
  }

  function followPath(agent, dt) {
    var target = agent.path[agent.i];
    var dx = target[0] - agent.x, dz = target[1] - agent.z;
    var dist = Math.hypot(dx, dz) || 0.001;
    if (dist < 1.4) agent.i = (agent.i + 1) % agent.path.length;
    var step = Math.min(dist, agent.speed * dt);
    agent.x += dx / dist * step;
    agent.z += dz / dist * step;
    agent.ry = Math.atan2(dx, dz);
  }

  function stepLife(dt) {
    npcs.forEach(function (npc) {
      if (npc.knock > 0) npc.knock -= dt;
      if (npc.still) return;
      var dx = npc.tx - npc.x, dz = npc.tz - npc.z;
      var dist = Math.hypot(dx, dz);
      if (dist < 0.8) {
        npc.tx = npc.x + (Math.random() * 24 - 12);
        npc.tz = npc.z + (Math.random() * 24 - 12);
        npc.tx = clamp(npc.tx, -62, 62);
        npc.tz = clamp(npc.tz, -62, 62);
        if (Math.abs(npc.tx) < 9) npc.tx = npc.tx < 0 ? -14 : 14;
        if (Math.abs(npc.tz) < 9) npc.tz = npc.tz < 0 ? -14 : 14;
        return;
      }
      var step = Math.min(dist, 1.6 * dt);
      var nx = npc.x + dx / dist * step;
      var nz = npc.z + dz / dist * step;
      if (!hits(nx, nz)) { npc.x = nx; npc.z = nz; npc.ry = Math.atan2(dx, dz); }
      else { npc.tx = npc.x; npc.tz = npc.z; }
    });
    traffic.forEach(function (car) {
      if (car.ping) {
        car.pos += car.dir * car.speed * dt;
        if (car.pos > car.max || car.pos < car.min) car.dir *= -1;
        if (car.axis === 'x') { car.x = car.pos; car.z = car.fixed; car.ry = car.dir > 0 ? Math.PI / 2 : -Math.PI / 2; }
        else { car.z = car.pos; car.x = car.fixed; car.ry = car.dir > 0 ? 0 : Math.PI; }
      } else followPath(car, dt);
      var dist = Math.hypot(car.x - actor.x, car.z - actor.z);
      if (dist < 1.35 && actor.moving && window.PingGame && window.PingGame.noteBump) {
        window.PingGame.noteBump();
        actor.x -= Math.cos(actor.ry) * 0.4;
        actor.z -= Math.sin(actor.ry) * 0.2;
      }
    });
  }

  function checkLaws(dt) {
    ticketCool -= dt;
    cameraCool -= dt;
    lightPhase = Math.floor(lastNow / 5000) % 2;
    if (rideMode !== 'walk' && ticketCool <= 0) {
      var ew = (prevPos.x - 8) * (actor.x - 8) < 0 || (prevPos.x + 8) * (actor.x + 8) < 0;
      var ns = (prevPos.z - 8) * (actor.z - 8) < 0 || (prevPos.z + 8) * (actor.z + 8) < 0;
      if (ew && Math.abs(actor.z) < 11 && lightPhase === 0 && window.PingGame) {
        ticketCool = 8;
        window.PingGame.noteRedLight();
      } else if (ns && Math.abs(actor.x) < 11 && lightPhase === 1 && window.PingGame) {
        ticketCool = 8;
        window.PingGame.noteRedLight();
      }
    }
    if (rideMode === 'car' && cameraCool <= 0) {
      [[36, 4], [-36, 4]].forEach(function (camPos) {
        if (Math.hypot(actor.x - camPos[0], actor.z - camPos[1]) < 3.2 && window.PingGame) {
          cameraCool = 12;
          window.PingGame.noteCamera();
        }
      });
    }
    var nearest = 999;
    police.forEach(function (cop) {
      var dx = actor.x - cop.x, dz = actor.z - cop.z;
      var dist = Math.hypot(dx, dz) || 0.001;
      if (dist < nearest) nearest = dist;
      var step = Math.min(dist, (7.6 + wantStars * 1.9) * dt);
      var nx = cop.x + dx / dist * step;
      var nz = cop.z + dz / dist * step;
      if (!hits(nx, cop.z)) cop.x = nx;
      if (!hits(cop.x, nz)) cop.z = nz;
      cop.ry = Math.atan2(dx, dz);
    });
    if (police.length && window.PingGame && window.PingGame.policeTouch) {
      heatSend += dt;
      if (heatSend > 0.25) {
        heatSend = 0;
        window.PingGame.policeTouch(nearest);
      }
    }
  }

  function step(dt) {
    if (paused) return;
    actor.moving = false;
    if (glide) {
      actor.moving = true;
      var gx = glide.x - actor.x, gz = glide.z - actor.z;
      var gd = Math.hypot(gx, gz);
      if (gd < 0.6) {
        actor.x = glide.x; actor.z = glide.z;
        var dest = glide.place;
        glide = null;
        lastDistrict = dest;
        if (window.PingGame && window.PingGame.arrive) window.PingGame.arrive(dest);
      } else {
        var gs = Math.min(gd, 42 * dt);
        actor.x += gx / gd * gs;
        actor.z += gz / gd * gs;
        actor.ry = Math.atan2(gx, gz);
      }
      prevPos.x = actor.x; prevPos.z = actor.z;
      return;
    }
    var dir = wish();
    var beforeX = actor.x, beforeZ = actor.z;
    if (dir) {
      actor.moving = true;
      var rideMul = rideMode === 'car' ? 1.9 : rideMode === 'scooter' ? 1.48 : 1;
      if (carrying) rideMul *= 0.82;
      var speed = (tired ? 4.4 : 8.4) * rideMul * speedMul * dir.power;
      moveTo(actor.x + dir.x * speed * dt, actor.z + dir.z * speed * dt);
      actor.ry = Math.atan2(dir.x, dir.z);
      if (clickTarget) {
        var left = Math.hypot(clickTarget.x - actor.x, clickTarget.z - actor.z);
        if (left > clickStuck - 0.03) clickTarget.idle = (clickTarget.idle || 0) + dt;
        else clickTarget.idle = 0;
        clickStuck = left;
        if (clickTarget.idle > 0.9) clickTarget = null;
      }
    }
    var moved = Math.hypot(actor.x - beforeX, actor.z - beforeZ);
    walkSend += moved;
    if (walkSend > 0.75 && window.PingGame && window.PingGame.noteWalk) {
      var chunk = walkSend;
      walkSend = 0;
      window.PingGame.noteWalk(chunk);
    }
    stepLife(dt);
    checkLaws(dt);
    if (checks.length && checkAt < checks.length) {
      var gate = checks[checkAt];
      if (Math.hypot(actor.x - gate[0], actor.z - gate[1]) < 2.4) {
        checkAt += 1;
        if (window.PingGame && window.PingGame.noteCheck) window.PingGame.noteCheck(checkAt, checks.length);
      }
    }
    prevPos.x = actor.x; prevPos.z = actor.z;
    var district = currentDistrict();
    if (district !== lastDistrict) {
      lastDistrict = district;
      if (window.PingGame && window.PingGame.noteDistrict) window.PingGame.noteDistrict(district);
    }
  }

  function nearestSpot() {
    var best = null, bestD = 2.55;
    spots.forEach(function (item) {
      var dist = Math.hypot(actor.x - item.x, actor.z - item.z);
      if (dist < bestD) { bestD = dist; best = item; }
    });
    return best;
  }
  function nearestPed() {
    var best = null, bestD = 1.55;
    npcs.forEach(function (npc) {
      if (npc.still || npc.knock > 0) return;
      var dist = Math.hypot(actor.x - npc.x, actor.z - npc.z);
      if (dist < bestD) { bestD = dist; best = npc; }
    });
    return best;
  }

  function syncPrompt() {
    var btn = document.getElementById('interact');
    if (!btn) return;
    if (paused || glide) { btn.hidden = true; return; }
    var item = nearestSpot();
    var ped = item ? null : nearestPed();
    var id = item ? item.id : ped ? 'shove' : '';
    if (!id) { btn.hidden = true; return; }
    var info = window.PingGame && window.PingGame.preview ? window.PingGame.preview(id) : { ok: true, title: id, detail: '' };
    btn.hidden = false;
    btn.dataset.pick = id;
    btn.textContent = (!info.ok && info.reason) ? info.title : (info.detail ? info.title + ' · ' + info.detail : info.title);
    btn.classList.toggle('locked', !info.ok);
    btn.title = info.reason || '';
  }

  function mapPercent(x, z) {
    return { left: ((x - B.minX) / (B.maxX - B.minX)) * 100, top: ((z - B.minZ) / (B.maxZ - B.minZ)) * 100 };
  }
  function layoutMap() {
    var pins = {
      'mm-station': [-40, 30], 'mm-market': [0, 56], 'mm-park': [-40, -48], 'mm-star': [-58, -18],
      'mm-mall': [46, 28], 'mm-gov': [46, -28], 'mm-uni': [40, -52], 'mm-river': [0, -66],
      'mm-farm': [-58, 48], 'mm-port': [56, 58]
    };
    Object.keys(pins).forEach(function (id) {
      var el = document.getElementById(id);
      if (!el) return;
      var p = mapPercent(pins[id][0], pins[id][1]);
      el.style.left = p.left + '%';
      el.style.top = p.top + '%';
    });
  }
  function syncMap() {
    var dot = document.getElementById('mm-player');
    if (!dot) return;
    var p = mapPercent(actor.x, actor.z);
    dot.style.left = p.left + '%';
    dot.style.top = p.top + '%';
  }

  function skyColor() {
    var h = ((clock % 1440) + 1440) % 1440 / 60;
    var night = [0.07, 0.1, 0.18], dawn = [0.93, 0.62, 0.46], day = [0.55, 0.78, 0.92], dusk = [0.86, 0.42, 0.32];
    if (h < 5 || h >= 20) return night;
    if (h < 7) return [lerp(night[0], dawn[0], (h - 5) / 2), lerp(night[1], dawn[1], (h - 5) / 2), lerp(night[2], dawn[2], (h - 5) / 2)];
    if (h < 16) return day;
    if (h < 18.5) return [lerp(day[0], dusk[0], (h - 16) / 2.5), lerp(day[1], dusk[1], (h - 16) / 2.5), lerp(day[2], dusk[2], (h - 16) / 2.5)];
    return [lerp(dusk[0], night[0], (h - 18.5) / 1.5), lerp(dusk[1], night[1], (h - 18.5) / 1.5), lerp(dusk[2], night[2], (h - 18.5) / 1.5)];
  }
  function lights() {
    if (nightish()) return { dir: [0.3, 0.8, 0.45], sun: [0.55, 0.62, 0.82], amb: [0.2, 0.22, 0.3] };
    return { dir: [0.45, 0.82, 0.32], sun: [1, 0.96, 0.88], amb: [0.34, 0.36, 0.32] };
  }

  function resize() {
    if (!canvas || !gl) return;
    var w = canvas.clientWidth || 1, h = canvas.clientHeight || 1;
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    var pw = Math.max(1, Math.floor(w * dpr)), ph = Math.max(1, Math.floor(h * dpr));
    if (canvas.width !== pw || canvas.height !== ph) {
      canvas.width = pw; canvas.height = ph;
      gl.useProgram(program);
      gl.enable(gl.DEPTH_TEST);
    }
  }

  function drawParts(list, t, viewProj, model, mvp, normal) {
    list.forEach(function (part) {
      var y = part.y, x = part.x;
      if (part.anim === 'bob') y += Math.sin(t * 3.1 + part.phase) * (list === actorParts && actor.moving ? 0.06 : 0.035);
      modelOf(x, y, part.z, part.rx, part.ry, part.rz, part.sx, part.sy, part.sz, model);
      multiply(viewProj, model, mvp);
      normalFromModel(model, normal);
      var geo = geos[part.geo];
      gl.bindBuffer(gl.ARRAY_BUFFER, geo.pos);
      gl.enableVertexAttribArray(0);
      gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 0, 0);
      gl.bindBuffer(gl.ARRAY_BUFFER, geo.nrm);
      gl.enableVertexAttribArray(1);
      gl.vertexAttribPointer(1, 3, gl.FLOAT, false, 0, 0);
      gl.uniformMatrix4fv(locs.uMvp, false, mvp);
      gl.uniformMatrix4fv(locs.uModel, false, model);
      gl.uniformMatrix3fv(locs.uNormal, false, normal);
      gl.uniform3f(locs.uColor, part.color[0], part.color[1], part.color[2]);
      gl.drawArrays(gl.TRIANGLES, 0, geo.count);
    });
  }

  function at(x, z, ry, lx, lz) {
    return {
      x: x + lx * Math.cos(ry) + lz * Math.sin(ry),
      z: z - lx * Math.sin(ry) + lz * Math.cos(ry)
    };
  }
  function person(listX, listZ, ry, shirt, lift, swing) {
    lift = lift || 0;
    var step = Math.sin(swing || 0);
    var legL = at(listX, listZ, ry, -0.08, step * 0.12);
    var legR = at(listX, listZ, ry, 0.08, -step * 0.12);
    box(legL.x, 0.36 + lift, legL.z, 0.1, 0.48, 0.12, hex(0x2c3444), 0, ry, 0);
    box(legR.x, 0.36 + lift, legR.z, 0.1, 0.48, 0.12, hex(0x2c3444), 0, ry, 0);
    var shoeL = at(listX, listZ, ry, -0.08, 0.08 + step * 0.12);
    var shoeR = at(listX, listZ, ry, 0.08, 0.08 - step * 0.12);
    box(shoeL.x, 0.07 + lift, shoeL.z, 0.11, 0.08, 0.18, hex(0x1b1a17), 0, ry, 0);
    box(shoeR.x, 0.07 + lift, shoeR.z, 0.11, 0.08, 0.18, hex(0x1b1a17), 0, ry, 0);
    box(listX, 0.92 + lift, listZ, 0.38, 0.44, 0.22, shirt, 0, ry, 0);
    var armL = at(listX, listZ, ry, -0.24, -step * 0.08);
    var armR = at(listX, listZ, ry, 0.24, step * 0.08);
    box(armL.x, 0.86 + lift, armL.z, 0.08, 0.4, 0.09, hex(0xefc2a2), 0, ry, 0);
    box(armR.x, 0.86 + lift, armR.z, 0.08, 0.4, 0.09, hex(0xefc2a2), 0, ry, 0);
    ball(listX, 1.28 + lift, listZ, 0.15, hex(0xefc2a2));
    ball(listX, 1.4 + lift, listZ, 0.145, hex(0x2a211c));
  }
  function wheelAt(x, z, ry, lx, lz, radius) {
    var p = at(x, z, ry, lx, lz);
    tube(p.x, radius, p.z, radius, 0.1, hex(0x1b1a17), 0, ry, Math.PI / 2);
    tube(p.x, radius, p.z, radius * 0.45, 0.12, hex(0xc5c8ce), 0, ry, Math.PI / 2);
  }
  function vehicle(x, z, ry, mode, paint, siren) {
    if (mode !== 'car') {
      var deck = at(x, z, ry, 0, -0.02);
      box(deck.x, 0.34, deck.z, 0.32, 0.1, 1.05, paint, 0, ry, 0);
      var seat = at(x, z, ry, 0, -0.16);
      box(seat.x, 0.5, seat.z, 0.28, 0.1, 0.42, hex(0x2a211c), 0, ry, 0);
      var fork = at(x, z, ry, 0, 0.46);
      box(fork.x, 0.52, fork.z, 0.06, 0.42, 0.08, hex(0x2a2a2a), 0.45, ry, 0);
      var bar = at(x, z, ry, 0, 0.58);
      box(bar.x, 0.74, bar.z, 0.5, 0.05, 0.06, hex(0x222222), 0, ry, 0);
      wheelAt(x, z, ry, 0, -0.42, 0.18);
      wheelAt(x, z, ry, 0, 0.5, 0.18);
      var lamp = at(x, z, ry, 0, 0.7);
      ball(lamp.x, 0.4, lamp.z, 0.06, hex(0xfff1c9));
      if (siren) {
        var top = at(x, z, ry, 0, -0.05);
        ball(top.x, 0.78, top.z, 0.07, siren);
      }
      return;
    }
    box(x, 0.38, z, 0.92, 0.28, 1.85, paint, 0, ry, 0);
    var cabin = at(x, z, ry, 0, -0.08);
    box(cabin.x, 0.68, cabin.z, 0.78, 0.32, 0.85, hex(0xd7e7f5), 0, ry, 0);
    var hood = at(x, z, ry, 0, 0.55);
    box(hood.x, 0.48, hood.z, 0.8, 0.12, 0.5, paint, 0, ry, 0);
    wheelAt(x, z, ry, -0.42, -0.62, 0.2);
    wheelAt(x, z, ry, 0.42, -0.62, 0.2);
    wheelAt(x, z, ry, -0.42, 0.62, 0.2);
    wheelAt(x, z, ry, 0.42, 0.62, 0.2);
    var lampL = at(x, z, ry, -0.28, 0.9);
    var lampR = at(x, z, ry, 0.28, 0.9);
    ball(lampL.x, 0.42, lampL.z, 0.07, hex(0xfff6d8));
    ball(lampR.x, 0.42, lampR.z, 0.07, hex(0xfff6d8));
    var tailL = at(x, z, ry, -0.3, -0.9);
    var tailR = at(x, z, ry, 0.3, -0.9);
    box(tailL.x, 0.42, tailL.z, 0.12, 0.08, 0.06, hex(0xd7263d), 0, ry, 0);
    box(tailR.x, 0.42, tailR.z, 0.12, 0.08, 0.06, hex(0xd7263d), 0, ry, 0);
  }
  function trafficMesh(car) {
    vehicle(car.x, car.z, car.ry, car.kind, car.color);
  }

  function draw(now) {
    resize();
    var dt = lastNow ? Math.min(0.05, (now - lastNow) / 1000) : 0.016;
    lastNow = now;
    if (dirty) rebuild();
    step(dt);
    if (sirenOsc) sirenOsc.frequency.value = 480 + (Math.sin(now / 140) * 0.5 + 0.5) * 420;
    camFocus.x = lerp(camFocus.x, actor.x, 0.14);
    camFocus.z = lerp(camFocus.z, actor.z, 0.14);
    var sky = skyColor();
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.clearColor(sky[0], sky[1], sky[2], 1);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    var aspect = canvas.width / Math.max(1, canvas.height);
    perspective(0.9, aspect, 0.12, 190, scratch.proj);
    var cp = Math.cos(cam.pitch);
    var eye = [
      camFocus.x + Math.sin(cam.yaw) * cp * cam.dist,
      Math.sin(cam.pitch) * cam.dist + 1.3,
      camFocus.z + Math.cos(cam.yaw) * cp * cam.dist
    ];
    lookAt(eye, [camFocus.x, 1.1, camFocus.z], scratch.view);
    multiply(scratch.proj, scratch.view, scratch.viewProj);
    hasView = invert4(scratch.viewProj, scratch.inv);
    var light = lights();
    var len = Math.hypot(light.dir[0], light.dir[1], light.dir[2]) || 1;
    gl.uniform3f(locs.uLightDir, light.dir[0] / len, light.dir[1] / len, light.dir[2] / len);
    gl.uniform3f(locs.uSun, light.sun[0], light.sun[1], light.sun[2]);
    gl.uniform3f(locs.uAmbient, light.amb[0], light.amb[1], light.amb[2]);
    gl.uniform3f(locs.uCam, eye[0], eye[1], eye[2]);
    gl.uniform3f(locs.uFogColor, sky[0], sky[1], sky[2]);
    gl.uniform1f(locs.uFogNear, 24);
    gl.uniform1f(locs.uFogFar, 78);

    liveParts = [];
    sink = liveParts;
    var green = lightPhase === 1;
    box(-1.2, 2.3, -1.2, 0.25, 0.7, 0.25, green ? hex(0x21c15e) : hex(0xd7263d));
    box(1.2, 2.3, 1.2, 0.25, 0.7, 0.25, green ? hex(0xd7263d) : hex(0x21c15e));
    var blink = Math.sin(now / 140) > 0 ? hex(0xd7263d) : hex(0x2f6fe0);
    npcs.forEach(function (npc) {
      person(npc.x, npc.z + (npc.knock > 0 ? 0.4 : 0), npc.ry || 0, npc.color, npc.knock > 0 ? 0.2 : 0, npc.still ? 0 : now * 0.01);
    });
    traffic.forEach(trafficMesh);
    police.forEach(function (cop) {
      vehicle(cop.x, cop.z, cop.ry, 'scooter', hex(0xf4f7fb), blink);
      person(cop.x, cop.z, cop.ry, hex(0x1d4e89), 0.22, 0);
    });
    checks.forEach(function (gate, index) {
      if (index >= checkAt) ball(gate[0], 1.8, gate[1], 0.45, hex(index === checkAt ? 0x21c15e : 0xf2c14e));
    });
    actorParts = [];
    sink = actorParts;
    var lift = rideMode === 'car' ? 0.42 : rideMode === 'scooter' ? 0.28 : 0;
    if (rideMode !== 'walk') vehicle(actor.x, actor.z, actor.ry, rideMode, rideMode === 'car' ? hex(0xc81e36) : hex(0xf08a3c));
    person(actor.x, actor.z, actor.ry, hex(0xe7eef8), lift, rideMode === 'walk' && actor.moving ? now * 0.012 : 0);
    if (carrying) box(actor.x, 1.05 + lift, actor.z, 0.28, 0.28, 0.28, hex(0xc4a574), 0, actor.ry, 0);
    sink = parts;
    var t = now * 0.001;
    drawParts(parts, t, scratch.viewProj, scratch.model, scratch.mvp, scratch.normal);
    drawParts(liveParts, t, scratch.viewProj, scratch.model, scratch.mvp, scratch.normal);
    drawParts(actorParts, t, scratch.viewProj, scratch.model, scratch.mvp, scratch.normal);
    syncPrompt();
    syncMap();
  }

  function frame(now) {
    if (!active || !gl) return;
    draw(now);
    frameId = window.requestAnimationFrame(frame);
  }
  function setActive(on) {
    active = !!on;
    if (active && gl && !frameId) frameId = window.requestAnimationFrame(frame);
    if (!active && frameId) { window.cancelAnimationFrame(frameId); frameId = 0; }
  }
  function show(place, nextPeriod, x, z, ry, force) {
    nextPeriod = nextPeriod || 'morning';
    if (nextPeriod !== period) { period = nextPeriod; dirty = true; }
    if (!gl) return;
    if (force || !placed) {
      var spawn = SPAWN[place] || SPAWN.home;
      placeActor(typeof x === 'number' ? x : spawn.x, typeof z === 'number' ? z : spawn.z, typeof ry === 'number' ? ry : spawn.ry);
      placed = true;
    }
    setActive(true);
    resize();
  }

  function rayFrom(clientX, clientY) {
    if (!canvas || !hasView) return null;
    var rect = canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return null;
    var ndcX = ((clientX - rect.left) / rect.width) * 2 - 1;
    var ndcY = -((clientY - rect.top) / rect.height) * 2 + 1;
    function unproject(ndcZ) {
      var m = scratch.inv;
      var iw = m[3] * ndcX + m[7] * ndcY + m[11] * ndcZ + m[15];
      if (!iw) return null;
      return [
        (m[0] * ndcX + m[4] * ndcY + m[8] * ndcZ + m[12]) / iw,
        (m[1] * ndcX + m[5] * ndcY + m[9] * ndcZ + m[13]) / iw,
        (m[2] * ndcX + m[6] * ndcY + m[10] * ndcZ + m[14]) / iw
      ];
    }
    var near = unproject(-1), far = unproject(1);
    if (!near || !far) return null;
    var dx = far[0] - near[0], dy = far[1] - near[1], dz = far[2] - near[2];
    var len = Math.hypot(dx, dy, dz) || 1;
    return { origin: near, dir: [dx / len, dy / len, dz / len] };
  }
  function groundPoint(clientX, clientY) {
    var ray = rayFrom(clientX, clientY);
    if (!ray || Math.abs(ray.dir[1]) < 1e-5) return null;
    var t = (0.02 - ray.origin[1]) / ray.dir[1];
    if (t < 0) return null;
    return { x: ray.origin[0] + ray.dir[0] * t, z: ray.origin[2] + ray.dir[2] * t };
  }
  function typingTarget(event) {
    var tag = event.target && event.target.tagName;
    return tag === 'INPUT' || tag === 'TEXTAREA';
  }
  function bindKeys() {
    window.addEventListener('keydown', function (event) {
      if (typingTarget(event)) return;
      if (event.code === 'Space' || event.code === 'Enter' || event.code === 'KeyE') {
        if (paused) return;
        var btn = document.getElementById('interact');
        if (btn && !btn.hidden && window.PingGame) {
          event.preventDefault();
          window.PingGame.perform(btn.dataset.pick);
        }
        return;
      }
      if (['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].indexOf(event.code) >= 0) {
        keys[event.code] = true;
        event.preventDefault();
      }
    });
    window.addEventListener('keyup', function (event) { keys[event.code] = false; });
    window.addEventListener('blur', function () { keys = {}; joy.x = 0; joy.y = 0; });
  }
  function bindStick() {
    var stick = document.getElementById('stick');
    var nub = document.getElementById('stick-nub');
    if (!stick || !nub) return;
    var activeId = null, origin = { x: 0, y: 0 };
    function setNub(dx, dy) { nub.style.transform = 'translate(' + dx + 'px,' + dy + 'px)'; }
    stick.addEventListener('pointerdown', function (event) {
      activeId = event.pointerId;
      var rect = stick.getBoundingClientRect();
      origin = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
      stick.setPointerCapture(event.pointerId);
      event.preventDefault();
    });
    stick.addEventListener('pointermove', function (event) {
      if (event.pointerId !== activeId) return;
      var dx = event.clientX - origin.x, dy = event.clientY - origin.y;
      var len = Math.hypot(dx, dy) || 1, max = 40, scale = Math.min(max, len);
      joy.x = dx / len * scale / max;
      joy.y = dy / len * scale / max;
      setNub(dx / len * scale, dy / len * scale);
    });
    function endStick(event) {
      if (event.pointerId !== activeId) return;
      activeId = null; joy.x = 0; joy.y = 0; setNub(0, 0);
    }
    stick.addEventListener('pointerup', endStick);
    stick.addEventListener('pointercancel', endStick);
  }
  function bindCanvas() {
    canvas.addEventListener('pointerdown', function (event) {
      if (!Object.keys(pointers).length) press = { x: event.clientX, y: event.clientY, moved: 0 };
      else press = null;
      pointers[event.pointerId] = { x: event.clientX, y: event.clientY };
      if (canvas.setPointerCapture) canvas.setPointerCapture(event.pointerId);
    });
    canvas.addEventListener('pointermove', function (event) {
      if (!pointers[event.pointerId]) return;
      var dx = event.clientX - pointers[event.pointerId].x;
      var dy = event.clientY - pointers[event.pointerId].y;
      pointers[event.pointerId] = { x: event.clientX, y: event.clientY };
      if (press) press.moved += Math.hypot(dx, dy);
      if (!press || press.moved > 8) {
        cam.yaw -= dx * 0.008;
        cam.pitch = clamp(cam.pitch + dy * 0.005, 0.28, 1.05);
      }
    });
    function endPointer(event) {
      var was = press;
      delete pointers[event.pointerId];
      if (!Object.keys(pointers).length) press = null;
      if (was && was.moved < 8 && !paused && !glide) {
        var point = groundPoint(event.clientX, event.clientY);
        if (!point) return;
        var near = null, best = 2.2;
        spots.forEach(function (item) {
          var dist = Math.hypot(point.x - item.x, point.z - item.z);
          if (dist < best) { best = dist; near = item; }
        });
        if (near && Math.hypot(actor.x - point.x, actor.z - point.z) < 2.1 && window.PingGame) {
          window.PingGame.perform(near.id);
          return;
        }
        clickTarget = near ? { x: near.x, z: near.z } : point;
        clickStuck = 0;
      }
    }
    canvas.addEventListener('pointerup', endPointer);
    canvas.addEventListener('pointercancel', endPointer);
    canvas.addEventListener('wheel', function (event) {
      event.preventDefault();
      cam.dist = clamp(cam.dist * (event.deltaY > 0 ? 1.08 : 0.92), 7, 20);
    }, { passive: false });
    var interact = document.getElementById('interact');
    if (interact) {
      interact.addEventListener('click', function () {
        if (interact.dataset.pick && window.PingGame) window.PingGame.perform(interact.dataset.pick);
      });
    }
  }

  function setSiren(on) {
    try {
      var AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      if (on) {
        if (!audioCtx) audioCtx = new AC();
        if (audioCtx.state === 'suspended') audioCtx.resume();
        if (sirenOsc) return;
        sirenOsc = audioCtx.createOscillator();
        sirenGain = audioCtx.createGain();
        sirenOsc.type = 'square';
        sirenOsc.frequency.value = 620;
        sirenGain.gain.value = 0.025;
        sirenOsc.connect(sirenGain);
        sirenGain.connect(audioCtx.destination);
        sirenOsc.start();
      } else if (sirenOsc) {
        sirenOsc.stop();
        sirenOsc = null;
      }
    } catch (err) { sirenOsc = null; }
  }

  function mount() {
    canvas = document.getElementById('world');
    fallback = document.getElementById('world-fallback');
    if (!canvas) return;
    try {
      gl = canvas.getContext('webgl', { antialias: true, alpha: false, preserveDrawingBuffer: true }) || canvas.getContext('experimental-webgl');
    } catch (err) { gl = null; }
    if (!gl || !compile()) {
      gl = null;
      if (fallback) fallback.hidden = false;
      return;
    }
    uploadGeo('box', buildBox());
    uploadGeo('sphere', buildSphere(8, 10));
    uploadGeo('cyl', buildCylinder(10));
    gl.enable(gl.DEPTH_TEST);
    seedLife();
    bindCanvas();
    bindStick();
    bindKeys();
    if (window.ResizeObserver) new ResizeObserver(function () { resize(); }).observe(canvas.parentElement || canvas);
    window.addEventListener('resize', resize);
  }
  mount();

  window.PingWorld = {
    show: show,
    setActive: setActive,
    ready: function () { return !!gl; },
    setPaused: function (on) { paused = !!on; if (on) { keys = {}; clickTarget = null; } },
    setTired: function (on) { tired = !!on; },
    setRide: function (mode, mul) { rideMode = mode === 'car' || mode === 'scooter' ? mode : 'walk'; speedMul = mul || 1; },
    setCarry: function (on) { carrying = !!on; },
    setClock: function (mins) {
      clock = mins;
      var next = mins >= 19 * 60 || mins < 5 * 60 ? 'night' : mins < 9 * 60 ? 'morning' : mins < 16 * 60 ? 'afternoon' : 'evening';
      if (next !== period) { period = next; dirty = true; }
    },
    setWanted: function (stars) {
      wantStars = stars || 0;
      var count = stars >= 3 ? 2 : stars > 0 ? 1 : 0;
      while (police.length < count) police.push({ x: actor.x - 16 - police.length * 6, z: actor.z - 12, ry: 0 });
      while (police.length > count) police.pop();
      setSiren(stars > 0);
    },
    setChecks: function (list) { checks = list || []; checkAt = 0; },
    hideProp: function (id) { hidden[id] = true; dirty = true; },
    shove: function () {
      var ped = nearestPed();
      if (!ped) return;
      ped.knock = 1.4;
      ped.x += Math.sin(actor.ry) * 1.2;
      ped.z += Math.cos(actor.ry) * 1.2;
    },
    policeDistance: function () {
      var best = 999;
      police.forEach(function (cop) {
        var dist = Math.hypot(cop.x - actor.x, cop.z - actor.z);
        if (dist < best) best = dist;
      });
      return best;
    },
    glideTo: function (place) {
      var dest = SPAWN[place];
      if (!dest) return;
      clickTarget = null;
      glide = { x: dest.x, z: dest.z, place: place };
    },
    readPose: function () { return { x: actor.x, z: actor.z, ry: actor.ry, place: currentDistrict() }; },
    spawn: function (place) { return SPAWN[place] || SPAWN.home; },
    placeName: function (id) { return PLACE_NAME[id] || '街上'; },
    snapshot: function () {
      return {
        npcs: npcs.length,
        traffic: traffic.length,
        police: police.length,
        spots: spots.length,
        place: currentDistrict(),
        pose: { x: actor.x, z: actor.z }
      };
    }
  };
})();
