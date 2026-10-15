import { MeshBuilder, beginMats, compose, hex, mat, multiply } from "./engine.js";

const SKIN = hex(0xf0c7a4);
const SKIN2 = hex(0xd9a57c);
const PANTS = hex(0x2c3a55);
const SHOE = hex(0x2a2422);
const HAIR = hex(0x2b211c);
const SEAT = hex(0x2a2428);
const TIRE = hex(0x1a1c20);
const RIM = hex(0xc5ccd4);
const GLASS = hex(0x9fd0e4);
const DARK = hex(0x23262c);
const CHROME = hex(0xd5dbe3);
const LIGHT = hex(0xffe7a8);
const RED = hex(0xd64545);
const BLUE = hex(0x2a62c8);

function mesh(renderer, build) {
  const b = new MeshBuilder();
  build(b);
  return renderer.createMesh(b);
}

export function createLibrary(renderer) {
  const lib = {};
  lib.wheel = mesh(renderer, (b) => {
    b.cylinder(0, 0, 0, 0.32, 0.16, 10, TIRE, 0, 0, "x");
    b.cylinder(0, 0, 0, 0.16, 0.18, 8, RIM, 0, 0, "x");
  });
  lib.scooterWheel = mesh(renderer, (b) => {
    b.cylinder(0, 0, 0, 0.28, 0.1, 10, TIRE, 0, 0, "x");
    b.cylinder(0, 0, 0, 0.12, 0.12, 8, RIM, 0, 0, "x");
  });
  lib.scooter = mesh(renderer, (b) => {
    b.box(0, 0.46, 0.02, 0.28, 0.08, 1.15, hex(0xf4f1ea), 0, 1);
    b.box(0, 0.62, 0.28, 0.36, 0.32, 0.72, hex(0xf7f4ee), 0, 1);
    b.box(0, 0.5, 0.62, 0.22, 0.16, 0.28, hex(0xf7f4ee), 0, 1);
    b.box(0, 0.78, -0.22, 0.3, 0.1, 0.48, SEAT, 0, 0);
    b.cylinder(0, 0.95, 0.48, 0.035, 0.55, 6, DARK, 0, 0, "y");
    b.cylinder(0, 1.2, 0.48, 0.03, 0.46, 6, DARK, 0, 0, "x");
    b.box(0, 0.58, 0.78, 0.16, 0.1, 0.06, LIGHT, 2, 0);
    b.box(0, 0.48, -0.62, 0.18, 0.1, 0.08, RED, 1, 0);
    b.box(0, 0.42, -0.48, 0.16, 0.12, 0.16, hex(0xc9a227), 0, 0);
  });
  lib.car = mesh(renderer, (b) => {
    b.box(0, 0.42, 0.05, 1.68, 0.46, 3.7, hex(0xf7f7f5), 0, 1);
    b.boxRot(0, 0.68, 1.15, 1.52, 0.18, 1.15, 0, -0.22, hex(0xf7f7f5), 0, 1);
    b.box(0, 0.95, -0.28, 1.46, 0.48, 1.65, hex(0xf7f7f5), 0, 1);
    b.box(0, 0.98, -0.22, 1.28, 0.36, 1.4, GLASS, 0, 0);
    b.box(0, 0.36, 1.82, 1.5, 0.22, 0.28, hex(0xf7f7f5), 0, 1);
    b.box(0, 0.4, 1.98, 1.35, 0.16, 0.1, LIGHT, 2, 0);
    b.box(0, 0.38, 1.9, 0.7, 0.16, 0.08, hex(0x2a2e34), 0, 0);
    b.box(0, 0.4, -1.9, 1.4, 0.18, 0.16, RED, 1, 0);
    b.box(0, 0.28, 0, 1.74, 0.14, 3.5, DARK, 0, 0);
    b.box(-0.78, 0.72, 0.35, 0.08, 0.16, 0.28, hex(0xd5dbe3), 0, 0);
    b.box(0.78, 0.72, 0.35, 0.08, 0.16, 0.28, hex(0xd5dbe3), 0, 0);
    b.box(0, 1.26, -0.25, 0.55, 0.06, 0.9, DARK, 0, 0);
  });
  lib.policeStripe = mesh(renderer, (b) => {
    b.box(0, 0.74, 0, 1.74, 0.08, 2.4, BLUE, 0, 0);
  });
  lib.lightRed = mesh(renderer, (b) => b.box(0, 0, 0, 0.22, 0.12, 0.14, RED, 2, 0));
  lib.lightBlue = mesh(renderer, (b) => b.box(0, 0, 0, 0.22, 0.12, 0.14, BLUE, 2, 0));

  lib.head = mesh(renderer, (b) => {
    b.sphere(0, 0, 0, 0.16, 10, SKIN, 0, 0);
    b.sphere(0, 0.07, -0.01, 0.17, 8, HAIR, 0, 0);
    b.sphere(-0.055, 0.02, 0.13, 0.026, 6, hex(0x1c1a18), 0, 0);
    b.sphere(0.055, 0.02, 0.13, 0.026, 6, hex(0x1c1a18), 0, 0);
    b.box(0, -0.02, 0.15, 0.05, 0.03, 0.04, hex(0xc9846a), 0, 0);
  });
  lib.torso = mesh(renderer, (b) => {
    b.box(0, 0.06, 0, 0.42, 0.34, 0.22, hex(0xffffff), 0, 1);
    b.box(0, -0.16, 0, 0.34, 0.22, 0.2, hex(0xffffff), 0, 1);
    b.sphere(0, 0.28, 0, 0.08, 6, SKIN2, 0, 0);
  });
  lib.arm = mesh(renderer, (b) => {
    b.box(0, -0.16, 0, 0.09, 0.28, 0.09, hex(0xffffff), 0, 1);
    b.box(0, -0.38, 0, 0.08, 0.26, 0.08, SKIN2, 0, 0);
  });
  lib.leg = mesh(renderer, (b) => {
    b.box(0, -0.2, 0, 0.12, 0.36, 0.13, PANTS, 0, 0);
    b.box(0, -0.48, 0.02, 0.11, 0.28, 0.12, PANTS, 0, 0);
    b.box(0, -0.66, 0.06, 0.13, 0.08, 0.24, SHOE, 0, 0);
  });
  lib.hat = mesh(renderer, (b) => {
    b.cylinder(0, 0.08, 0, 0.12, 0.12, 8, BLUE, 0, 0, "y");
    b.cylinder(0, 0.02, 0, 0.2, 0.04, 8, BLUE, 0, 0, "y");
  });
  lib.person = mesh(renderer, (b) => {
    b.sphere(0, 1.58, 0, 0.16, 8, SKIN, 0, 0);
    b.sphere(0, 1.66, -0.01, 0.16, 8, HAIR, 0, 0);
    b.sphere(-0.05, 1.6, 0.12, 0.025, 5, hex(0x1c1a18), 0, 0);
    b.sphere(0.05, 1.6, 0.12, 0.025, 5, hex(0x1c1a18), 0, 0);
    b.box(0, 1.22, 0, 0.4, 0.32, 0.22, hex(0xffffff), 0, 1);
    b.box(0, 0.98, 0, 0.32, 0.2, 0.18, hex(0xffffff), 0, 1);
    b.box(-0.24, 1.02, 0, 0.09, 0.42, 0.09, SKIN2, 0, 0);
    b.box(0.24, 1.02, 0, 0.09, 0.42, 0.09, SKIN2, 0, 0);
    b.box(-0.1, 0.52, 0, 0.12, 0.62, 0.13, PANTS, 0, 0);
    b.box(0.1, 0.52, 0, 0.12, 0.62, 0.13, PANTS, 0, 0);
    b.box(-0.1, 0.12, 0.05, 0.13, 0.08, 0.22, SHOE, 0, 0);
    b.box(0.1, 0.12, 0.05, 0.13, 0.08, 0.22, SHOE, 0, 0);
  });
  lib.heliBody = mesh(renderer, (b) => {
    b.box(0, 0, 0.1, 1.3, 0.7, 2.1, hex(0xf4f7fb), 0, 0);
    b.box(0, 0.05, 0.15, 1.05, 0.48, 1.2, GLASS, 0, 0);
    b.box(0, 0.05, -1.7, 0.28, 0.28, 1.8, DARK, 0, 0);
    b.box(0, 0.15, -2.55, 0.7, 0.08, 0.28, DARK, 0, 0);
    b.box(-0.45, -0.5, 0.1, 0.08, 0.28, 1.3, DARK, 0, 0);
    b.box(0.45, -0.5, 0.1, 0.08, 0.28, 1.3, DARK, 0, 0);
    b.box(0, 0.42, 0.2, 0.2, 0.16, 0.2, DARK, 0, 0);
  });
  lib.rotor = mesh(renderer, (b) => {
    b.box(0, 0, 0, 6.2, 0.05, 0.22, hex(0x22262c), 0, 0);
    b.box(0, 0, 0, 0.22, 0.05, 6.2, hex(0x22262c), 0, 0);
  });
  lib.tailRotor = mesh(renderer, (b) => {
    b.box(0, 0, 0, 0.08, 1.1, 0.12, hex(0x22262c), 0, 0);
  });
  lib.shadow = mesh(renderer, (b) => b.disc(0, 0, 0, 1, 12, hex(0x14120f), 0, 0));
  lib.chevron = mesh(renderer, (b) => {
    b.cone(0, 0.55, 0, 0.7, 1.35, 4, hex(0xffb703), 2, 0);
    b.cone(0, 1.35, 0, 0.42, 0.7, 4, hex(0xffe08a), 2, 0);
  });
  lib.beam = mesh(renderer, (b) => {
    b.box(0, 4.8, 0, 0.16, 9.6, 0.16, hex(0xffe08a), 2, 0);
    b.box(0, 9.7, 0, 0.46, 0.46, 0.46, hex(0xfff6df), 2, 0);
  });
  lib.arch = mesh(renderer, (b) => {
    b.box(-1.6, 1.5, 0, 0.18, 3, 0.18, hex(0xfff1c2), 2, 0);
    b.box(1.6, 1.5, 0, 0.18, 3, 0.18, hex(0xfff1c2), 2, 0);
    b.box(0, 3.05, 0, 3.5, 0.16, 0.16, hex(0xffd15c), 2, 0);
  });
  lib.crate = mesh(renderer, (b) => {
    b.box(0, 0.28, 0, 0.55, 0.5, 0.55, hex(0xc9843a), 0, 0);
    b.box(0, 0.28, 0, 0.58, 0.1, 0.1, hex(0xf2d48a), 0, 0);
  });
  lib.boat = mesh(renderer, (b) => {
    b.box(0, 0.4, 0, 2.2, 0.5, 6.2, hex(0x8c2f2f), 0, 0);
    b.box(0, 0.75, 0, 1.6, 0.35, 5.4, hex(0xf3d27a), 0, 0);
    b.prismRoof(0, 1.05, -0.2, 1.8, 0.9, 2.4, hex(0xd6453d), 0, 0);
    b.box(0, 1.7, -0.2, 0.12, 0.7, 0.12, hex(0xf6e27a), 2, 0);
    b.box(0, 0.9, 2.4, 1.8, 1.1, 0.12, hex(0xf7e7a1), 1, 0);
  });
  lib.sphere = mesh(renderer, (b) => b.sphere(0, 0, 0, 0.35, 8, LIGHT, 2, 0));
  lib.ring = mesh(renderer, (b) => {
    const seg = 18;
    for (let i = 0; i < seg; i++) {
      const a = (i / seg) * Math.PI * 2;
      b.box(Math.cos(a) * 1.15, 0.06, Math.sin(a) * 1.15, 0.28, 0.08, 0.16, hex(0xffb703), 2, 1);
    }
  });
  lib.cone = mesh(renderer, (b) => b.cone(0, 0.6, 0, 0.8, 1.2, 6, hex(0xffb703), 2, 0));
  return lib;
}

const WHITE = [1, 1, 1];

function drawAt(renderer, mesh, x, y, z, yaw = 0, pitch = 0, roll = 0, tint = null, s = 1) {
  beginMats();
  const m = mat();
  compose(m, x, y, z, yaw, pitch, roll, s, s, s);
  renderer.draw(mesh, m, tint || WHITE, 1, 0);
}

export function drawShadow(renderer, lib, x, y, z, sx, sz) {
  beginMats();
  const m = mat();
  compose(m, x, y, z, 0, 0, 0, sx, 1, sz);
  renderer.draw(lib.shadow, m, WHITE, 0.35, 1);
}

export function drawScooter(renderer, lib, x, y, z, yaw, roll, spin, tint) {
  drawShadow(renderer, lib, x, y + 0.05, z, 0.9, 1.3);
  drawAt(renderer, lib.scooter, x, y, z, yaw, 0, roll, tint);
  const m = mat();
  const parent = mat();
  compose(parent, x, y, z, yaw, 0, roll);
  const wheels = [[0.55, spin], [-0.55, spin]];
  for (const [oz, sp] of wheels) {
    const local = mat();
    compose(local, 0, 0.28, oz, 0, sp, 0);
    multiply(m, parent, local);
    renderer.draw(lib.scooterWheel, m, WHITE, 1, 0);
  }
}

export function drawCar(renderer, lib, x, y, z, yaw, spin, tint, police = false, blink = 0) {
  drawShadow(renderer, lib, x, y + 0.05, z, 1.3, 2.2);
  drawAt(renderer, lib.car, x, y, z, yaw, 0, 0, tint);
  const parent = mat();
  compose(parent, x, y, z, yaw, 0, 0);
  const spots = [
    [0.72, 0.32, 1.25],
    [-0.72, 0.32, 1.25],
    [0.72, 0.32, -1.25],
    [-0.72, 0.32, -1.25],
  ];
  for (const [ox, oy, oz] of spots) {
    const local = mat();
    const m = mat();
    compose(local, ox, oy, oz, 0, spin, 0);
    multiply(m, parent, local);
    renderer.draw(lib.wheel, m, WHITE, 1, 0);
  }
  if (police) {
    const stripe = mat();
    multiply(stripe, parent, compose(mat(), 0, 0, 0, 0, 0, 0));
    renderer.draw(lib.policeStripe, parent, WHITE, 1, 0);
    const redOn = blink > 0;
    const lamp = mat();
    const local = mat();
    compose(local, redOn ? -0.22 : 0.22, 1.38, -0.2, 0, 0, 0);
    multiply(lamp, parent, local);
    renderer.draw(redOn ? lib.lightRed : lib.lightBlue, lamp, WHITE, 1, 0);
  }
}

export function drawRider(renderer, lib, x, y, z, yaw, tint) {
  drawShadow(renderer, lib, x, y + 0.04, z, 0.55, 0.7);
  beginMats();
  const parent = mat();
  compose(parent, x, y, z, yaw, 0, 0);
  const put = (mesh, ox, oy, oz, pitch) => {
    const local = mat();
    const m = mat();
    compose(local, ox, oy, oz, 0, pitch, 0);
    multiply(m, parent, local);
    renderer.draw(mesh, m, tint, 1, 0);
  };
  put(lib.torso, 0, 0.86, 0.04, 1.05);
  put(lib.head, 0, 1.12, 0.36, 0.22);
  put(lib.arm, -0.18, 1.02, 0.26, -0.9);
  put(lib.arm, 0.18, 1.02, 0.26, -0.9);
  put(lib.leg, -0.11, 0.74, 0.14, -0.7);
  put(lib.leg, 0.11, 0.74, 0.14, -0.7);
}

export function drawPerson(renderer, lib, x, y, z, yaw, phase, moving, tint, hat = false) {
  const swing = Math.sin(phase) * (moving ? 0.7 : 0.05);
  const bob = moving ? Math.abs(Math.sin(phase)) * 0.04 : 0;
  drawShadow(renderer, lib, x, y + 0.04, z, 0.45, 0.45);
  const parent = mat();
  compose(parent, x, y + bob, z, yaw, 0, 0);
  const put = (mesh, ox, oy, oz, pitch) => {
    const local = mat();
    const m = mat();
    compose(local, ox, oy, oz, 0, pitch, 0);
    multiply(m, parent, local);
    renderer.draw(mesh, m, tint, 1, 0);
  };
  put(lib.torso, 0, 1.16, 0, 0);
  put(lib.head, 0, 1.58, 0, 0);
  put(lib.arm, -0.26, 1.32, 0, swing);
  put(lib.arm, 0.26, 1.32, 0, -swing);
  put(lib.leg, -0.1, 0.9, 0, -swing);
  put(lib.leg, 0.1, 0.9, 0, swing);
  if (hat) put(lib.hat, 0, 1.72, 0, 0);
}

export function drawPersonStatic(renderer, lib, x, y, z, yaw, tint) {
  drawShadow(renderer, lib, x, y + 0.04, z, 0.45, 0.45);
  drawAt(renderer, lib.person, x, y, z, yaw, 0, 0, tint);
}

export function drawHeli(renderer, lib, x, y, z, yaw, spin) {
  drawAt(renderer, lib.heliBody, x, y, z, yaw, 0, 0, null);
  const parent = mat();
  compose(parent, x, y, z, yaw, 0, 0);
  const rotor = mat();
  const local = mat();
  compose(local, 0, 0.55, 0.2, spin, 0, 0);
  multiply(rotor, parent, local);
  renderer.draw(lib.rotor, rotor, WHITE, 1, 0);
  const tail = mat();
  const tlocal = mat();
  compose(tlocal, 0.38, 0.15, -2.55, 0, spin * 1.6, 0);
  multiply(tail, parent, tlocal);
  renderer.draw(lib.tailRotor, tail, WHITE, 1, 0);
}

export function drawProp(renderer, mesh, x, y, z, yaw = 0, s = 1, tint = null) {
  drawAt(renderer, mesh, x, y, z, yaw, 0, 0, tint, s);
}

export function prepareFrame() {
  beginMats();
}
