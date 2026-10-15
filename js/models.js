import { MeshBuilder, beginMats, compose, hex, mat } from "./engine.js";

function mesh(renderer, build) {
  const b = new MeshBuilder();
  build(b);
  return renderer.createMesh(b);
}

export function createLibrary(renderer) {
  const lib = {};
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
  lib.ring = mesh(renderer, (b) => {
    const seg = 18;
    for (let i = 0; i < seg; i++) {
      const a = (i / seg) * Math.PI * 2;
      b.box(Math.cos(a) * 1.15, 0.06, Math.sin(a) * 1.15, 0.28, 0.08, 0.16, hex(0xffb703), 2, 1);
    }
  });
  return lib;
}

const WHITE = [1, 1, 1];

export function drawProp(renderer, mesh, x, y, z, yaw = 0, s = 1, tint = null) {
  beginMats();
  const m = mat();
  compose(m, x, y, z, yaw, 0, 0, s, s, s);
  renderer.draw(mesh, m, tint || WHITE, 1, 0);
}

export function prepareFrame() {
  beginMats();
}
