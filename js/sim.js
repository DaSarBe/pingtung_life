import { angleDiff, clamp, dist2, mulberry32, pointBlocked, resolveCircle } from "./engine.js";
import { festivalState } from "./shift.js";

const SHIRTS = [
  [0.86, 0.27, 0.24],
  [0.2, 0.45, 0.78],
  [0.95, 0.78, 0.25],
  [0.3, 0.65, 0.45],
  [0.75, 0.4, 0.62],
  [0.9, 0.55, 0.3],
  [0.4, 0.55, 0.7],
  [0.55, 0.35, 0.28],
];
const LINES = ["吃飽未？", "哩賀！", "多謝啦", "安怎？", "天氣真好", "慢慢行啊", "屏東就是這款", "來去夜市啦", "來呷涼的"];
const FLEE = ["驚啦！", "警察來啦！", "擋路啊！", "哇賽！"];

function nearestNode(graph, x, z) {
  let best = 0;
  let bestD = Infinity;
  const nodes = graph.nodes;
  for (let i = 0; i < nodes.length; i++) {
    const d = dist2(x, z, nodes[i].x, nodes[i].z);
    if (d < bestD) {
      bestD = d;
      best = i;
    }
  }
  return best;
}

function astar(graph, start, goal) {
  if (start === goal) return [goal];
  const nodes = graph.nodes;
  const open = [start];
  const inOpen = new Set([start]);
  const gScore = new Map([[start, 0]]);
  const prev = new Map();
  const heur = (i) => Math.hypot(nodes[i].x - nodes[goal].x, nodes[i].z - nodes[goal].z);
  const fScore = new Map([[start, heur(start)]]);
  while (open.length) {
    let bi = 0;
    for (let i = 1; i < open.length; i++) {
      if ((fScore.get(open[i]) ?? 1e9) < (fScore.get(open[bi]) ?? 1e9)) bi = i;
    }
    const cur = open.splice(bi, 1)[0];
    inOpen.delete(cur);
    if (cur === goal) break;
    for (const nb of graph.adj[cur]) {
      const step = Math.hypot(nodes[nb].x - nodes[cur].x, nodes[nb].z - nodes[cur].z);
      const ng = (gScore.get(cur) ?? 1e9) + step;
      if (ng < (gScore.get(nb) ?? 1e9)) {
        gScore.set(nb, ng);
        fScore.set(nb, ng + heur(nb));
        prev.set(nb, cur);
        if (!inOpen.has(nb)) {
          open.push(nb);
          inOpen.add(nb);
        }
      }
    }
  }
  if (!prev.has(goal) && goal !== start) return [start];
  const path = [];
  let c = goal;
  while (c != null) {
    path.push(c);
    if (c === start) break;
    c = prev.get(c);
  }
  path.reverse();
  return path;
}

function buildLoops() {
  const xs = [-150, -100, -50, 0, 50, 100, 150];
  const zs = [-150, -100, -50, 0, 50, 100, 150];
  const loops = [];
  for (const z of [-100, -50, 0, 50, 100]) {
    const east = xs.map((x) => ({ x, z }));
    const west = xs.slice().reverse().map((x) => ({ x, z: z + 3.2 }));
    loops.push(east.concat(west));
  }
  for (const x of [-100, 0, 100]) {
    const north = zs.map((z) => ({ x, z }));
    const south = zs.slice().reverse().map((z) => ({ x: x + 3.2, z }));
    loops.push(north.concat(south));
  }
  return loops;
}

export function createSim(world) {
  const rng = mulberry32(0x51a3);
  const loops = buildLoops();
  const peds = [];
  const pedTarget = 18;
  for (let i = 0; i < pedTarget; i++) peds.push(spawnPed(world, rng));
  const traffic = [];
  for (let i = 0; i < 14; i++) {
    const loop = i % loops.length;
    const pt = loops[loop][(i * 3) % loops[loop].length];
    const car = i % 4 === 0;
    traffic.push({
      loop,
      i: (i * 3) % loops[loop].length,
      x: pt.x,
      z: pt.z,
      y: 0,
      yaw: 0,
      speed: 0,
      max: car ? 12 : 9,
      type: car ? "car" : "scooter",
      tint: SHIRTS[i % SHIRTS.length],
      phase: rng() * 6,
    });
  }
  return {
    world,
    rng,
    loops,
    peds,
    traffic,
    police: [],
    roadblocks: [],
    heli: null,
    paradeZ: -140,
    nearParade: false,
    barks: [],
    caught: false,
    horn: 0,
    pedTarget,
    seenPlayer: false,
  };
}

function spawnPed(world, rng) {
  const s = world.sidewalks[(rng() * world.sidewalks.length) | 0];
  return {
    x: s.x + (rng() - 0.5) * 2,
    z: s.z + (rng() - 0.5) * 2,
    yaw: rng() * Math.PI * 2,
    speed: 0,
    walk: 0.7 + rng() * 0.6,
    phase: rng() * 8,
    tint: SHIRTS[(rng() * SHIRTS.length) | 0],
    tx: s.x,
    tz: s.z,
    flee: 0,
    cool: 0,
    barkIn: 3 + rng() * 8,
  };
}

function steer(ent, tx, tz, dt, maxSpeed, turn) {
  const desired = Math.atan2(tx - ent.x, tz - ent.z);
  ent.yaw += clamp(angleDiff(desired, ent.yaw), -turn * dt, turn * dt);
  const accel = maxSpeed > ent.speed ? 10 : 14;
  ent.speed = clamp(ent.speed + Math.sign(maxSpeed - ent.speed) * accel * dt, 0, maxSpeed);
  ent.x += Math.sin(ent.yaw) * ent.speed * dt;
  ent.z += Math.cos(ent.yaw) * ent.speed * dt;
}

function relocateFar(ent, player, rng, world) {
  const d = dist2(ent.x, ent.z, player.x, player.z);
  if (d < 200 * 200) return false;
  const s = world.sidewalks[(rng() * world.sidewalks.length) | 0];
  if (dist2(s.x, s.z, player.x, player.z) > 160 * 160) return false;
  if (dist2(s.x, s.z, player.x, player.z) < 40 * 40) return false;
  ent.x = s.x;
  ent.z = s.z;
  ent.tx = s.x;
  ent.tz = s.z;
  return true;
}

export function inCover(world, x, z) {
  for (const c of world.covers) {
    if (x >= c.minX && x <= c.maxX && z >= c.minZ && z <= c.maxZ) return true;
  }
  return false;
}

function hasLos(world, ax, az, bx, bz) {
  const steps = 7;
  for (let i = 1; i < steps; i++) {
    const t = i / steps;
    const x = ax + (bx - ax) * t;
    const z = az + (bz - az) * t;
    if (pointBlocked(world.grid, x, z, 0.3)) return false;
  }
  return true;
}

function desiredUnits(stars) {
  if (stars <= 0) return 0;
  if (stars === 1) return 1;
  if (stars === 2) return 2;
  if (stars === 3) return 2;
  return 3;
}

function spawnUnit(sim, player, stars, index) {
  const graph = sim.world.graph;
  const origin = nearestNode(graph, player.x, player.z);
  let pick = origin;
  let best = -1;
  for (let i = 0; i < graph.nodes.length; i++) {
    const n = graph.nodes[i];
    const d = Math.hypot(n.x - player.x, n.z - player.z);
    if (d > 42 && d < 110) {
      const score = d + ((i * 17 + index * 5) % 13);
      if (score > best) {
        best = score;
        pick = i;
      }
    }
  }
  const n = graph.nodes[pick];
  let kind = "foot";
  if (stars >= 2 && index === 0) kind = "scooter";
  if (stars >= 3 && index === 0) kind = "car";
  if (stars >= 4 && index === 1) kind = "car";
  if (stars >= 4 && index === 2) kind = "foot";
  return {
    kind,
    x: n.x,
    z: n.z,
    yaw: 0,
    speed: 0,
    phase: 0,
    path: [],
    pathI: 0,
    retarget: 0,
    tint: kind === "foot" ? [0.15, 0.28, 0.62] : [0.96, 0.96, 0.98],
    flank: index === 1 && stars >= 4,
  };
}

function placeRoadblock(sim, player) {
  const graph = sim.world.graph;
  const aheadX = player.x + Math.sin(player.yaw) * 55;
  const aheadZ = player.z + Math.cos(player.yaw) * 55;
  const node = graph.nodes[nearestNode(graph, aheadX, aheadZ)];
  const side = player.yaw + Math.PI / 2;
  const sx = Math.sin(side);
  const sz = Math.cos(side);
  sim.roadblocks = [
    { x: node.x + sx * 2.2, z: node.z + sz * 2.2, yaw: side, kind: "car" },
    { x: node.x - sx * 2.2, z: node.z - sz * 2.2, yaw: side, kind: "car" },
  ];
}

export function updateSim(sim, game, dt) {
  const state = game.state;
  const world = sim.world;
  sim.caught = false;
  sim.seenPlayer = false;
  sim.horn = Math.max(0, sim.horn - dt);
  const player = { x: state.x, z: state.z, yaw: state.yaw };
  const fest = festivalState(state.time);
  if (fest.parade && !state.inside && state.z > -200) {
    sim.paradeZ += dt * 5.5;
    if (sim.paradeZ > 155) sim.paradeZ = -150;
    sim.nearParade = dist2(state.x, state.z, 0, sim.paradeZ) < 38 * 38;
  } else {
    sim.nearParade = false;
  }

  const scare = state.wanted > 0 || game.speed > 8 || sim.horn > 0;
  for (const ped of sim.peds) {
    ped.phase += dt * (3 + ped.speed * 2);
    ped.cool = Math.max(0, ped.cool - dt);
    relocateFar(ped, player, sim.rng, world);
    if (scare && dist2(ped.x, ped.z, player.x, player.z) < 12 * 12) ped.flee = 1.6;
    if (ped.flee > 0) {
      ped.flee -= dt;
      const away = Math.atan2(ped.x - player.x, ped.z - player.z);
      ped.yaw = away;
      ped.speed = 4.2;
      ped.x += Math.sin(ped.yaw) * ped.speed * dt;
      ped.z += Math.cos(ped.yaw) * ped.speed * dt;
      if (ped.barkIn > 0.2) {
        ped.barkIn = 0;
        pushBark(sim, ped.x, ped.z + 0.2, FLEE[(sim.rng() * FLEE.length) | 0]);
      }
    } else {
      if (dist2(ped.x, ped.z, ped.tx, ped.tz) < 2.2) {
        const s = world.sidewalks[(sim.rng() * world.sidewalks.length) | 0];
        if (dist2(s.x, s.z, ped.x, ped.z) < 40 * 40) {
          ped.tx = s.x;
          ped.tz = s.z;
        }
      }
      steer(ped, ped.tx, ped.tz, dt, ped.walk, 3);
      ped.barkIn -= dt;
      if (ped.barkIn <= 0 && dist2(ped.x, ped.z, player.x, player.z) < 7 * 7 && sim.rng() < 0.55) {
        pushBark(sim, ped.x, ped.z, LINES[(sim.rng() * LINES.length) | 0]);
        ped.barkIn = 8 + sim.rng() * 8;
      } else if (ped.barkIn <= 0) ped.barkIn = 4 + sim.rng() * 6;
    }
    const resolved = resolveCircle(world.grid, ped.x, ped.z, 0.3);
    ped.x = resolved.x;
    ped.z = resolved.z;
  }

  for (const v of sim.traffic) {
    const loop = sim.loops[v.loop];
    const target = loop[v.i];
    if (dist2(v.x, v.z, player.x, player.z) > 210 * 210) {
      const near = loop.findIndex((p) => dist2(p.x, p.z, player.x, player.z) < 120 * 120 && dist2(p.x, p.z, player.x, player.z) > 45 * 45);
      if (near >= 0) {
        v.i = near;
        v.x = loop[near].x;
        v.z = loop[near].z;
      }
    }
    let max = v.max;
    if (dist2(v.x, v.z, player.x, player.z) < 8 * 8) max *= 0.45;
    steer(v, target.x, target.z, dt, max, 2.4);
    if (dist2(v.x, v.z, target.x, target.z) < 6) v.i = (v.i + 1) % loop.length;
    const resolved = resolveCircle(world.grid, v.x, v.z, v.type === "car" ? 1.1 : 0.7);
    if (resolved.hit) v.speed *= 0.6;
    v.x = resolved.x;
    v.z = resolved.z;
    v.phase += v.speed * dt;
  }

  const stars = state.wanted | 0;
  const want = state.inside ? 0 : desiredUnits(stars);
  while (sim.police.length < want) sim.police.push(spawnUnit(sim, player, stars, sim.police.length));
  if (sim.police.length > want) sim.police.length = want;

  if (stars >= 3 && !state.inside) {
    if (sim.roadblocks.length === 0 || sim.blockAge == null || sim.blockAge > 12) {
      placeRoadblock(sim, player);
      sim.blockAge = 0;
    }
    sim.blockAge += dt;
  } else {
    sim.roadblocks = [];
    sim.blockAge = 0;
  }

  if (stars >= 5 && !state.inside) {
    if (!sim.heli) sim.heli = { x: player.x, y: 28, z: player.z - 8, yaw: 0, spin: 0, see: true };
    const cover = inCover(world, player.x, player.z);
    const hx = player.x + (cover ? 18 : 6);
    const hz = player.z + (cover ? -14 : 4);
    sim.heli.x += (hx - sim.heli.x) * Math.min(1, dt * 0.8);
    sim.heli.z += (hz - sim.heli.z) * Math.min(1, dt * 0.8);
    sim.heli.y = 26;
    sim.heli.yaw = Math.atan2(player.x - sim.heli.x, player.z - sim.heli.z);
    sim.heli.spin += dt * 18;
    sim.heli.see = !cover;
    if (sim.heli.see) sim.seenPlayer = true;
  } else sim.heli = null;

  for (const cop of sim.police) {
    cop.phase += dt * 6;
    cop.retarget -= dt;
    const see = hasLos(world, cop.x, cop.z, player.x, player.z) && dist2(cop.x, cop.z, player.x, player.z) < 70 * 70;
    if (see) {
      sim.seenPlayer = true;
      cop.lastX = player.x;
      cop.lastZ = player.z;
    }
    const goalX = cop.flank ? player.x + Math.cos(player.yaw) * 18 : (cop.lastX ?? player.x);
    const goalZ = cop.flank ? player.z - Math.sin(player.yaw) * 18 : (cop.lastZ ?? player.z);
    const direct = see && dist2(cop.x, cop.z, player.x, player.z) < 28 * 28;
    if (direct) {
      const max = cop.kind === "foot" ? 4.8 : cop.kind === "car" ? 28 : 26;
      steer(cop, player.x, player.z, dt, max, cop.kind === "foot" ? 4 : 2.1);
    } else {
      if (cop.retarget <= 0 || !cop.path.length) {
        const graph = world.graph;
        const a = nearestNode(graph, cop.x, cop.z);
        const b = nearestNode(graph, goalX, goalZ);
        cop.path = astar(graph, a, b);
        cop.pathI = Math.min(1, cop.path.length - 1);
        cop.retarget = 0.65;
      }
      const node = world.graph.nodes[cop.path[cop.pathI] ?? cop.path[0]];
      if (node) {
        const max = cop.kind === "foot" ? 4.6 : cop.kind === "car" ? 24 : 22;
        steer(cop, node.x, node.z, dt, max, cop.kind === "foot" ? 4 : 1.8);
        if (dist2(cop.x, cop.z, node.x, node.z) < 8) cop.pathI = Math.min(cop.path.length - 1, cop.pathI + 1);
      }
    }
    const radius = cop.kind === "car" ? 1.15 : cop.kind === "scooter" ? 0.7 : 0.35;
    const resolved = resolveCircle(world.grid, cop.x, cop.z, radius);
    cop.x = resolved.x;
    cop.z = resolved.z;
    const touch = dist2(cop.x, cop.z, player.x, player.z);
    if (!state.inside && state.chapter !== "under_end" && state.chapter !== "honest_end") {
      if (cop.kind === "foot" && touch < 1.45 * 1.45 && game.speed < 7) sim.caught = true;
      if (cop.kind !== "foot" && touch < 2.5 * 2.5 && game.speed < 6 && cop.speed < 8) sim.caught = true;
    }
  }

  for (let i = sim.barks.length - 1; i >= 0; i--) {
    sim.barks[i].t -= dt;
    if (sim.barks[i].t <= 0) sim.barks.splice(i, 1);
  }
}

function pushBark(sim, x, z, text) {
  if (sim.barks.length > 2) sim.barks.shift();
  sim.barks.push({ x, y: 2.1, z, text, t: 2.4 });
}

export function honk(sim) {
  sim.horn = 0.8;
}
