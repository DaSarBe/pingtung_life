// Original procedural score. No samples, no third-party tracks.
// Two channels crossfade when the scene changes.

const SCENES = {
  title: { bpm: 84, scale: [60, 64, 67, 72, 76], lead: "0 2 4 2 3 2 1 0", bass: "0 0 3 0", drum: "soft" },
  day: { bpm: 80, scale: [60, 62, 64, 67, 69, 72], lead: "0 1 2 4 3 2 1 0", bass: "0 3 0 4", drum: "soft" },
  night: { bpm: 74, scale: [57, 60, 62, 64, 67, 69], lead: "0 2 3 2 4 3 1 0", bass: "0 0 3 1", drum: "soft" },
  market: { bpm: 118, scale: [67, 69, 71, 74, 76, 79], lead: "0 2 4 2 3 4 2 0 1 2 4 3", bass: "0 0 3 0 4 0", drum: "busy" },
  chase: { bpm: 152, scale: [50, 53, 55, 58, 60, 62], lead: "0 0 3 0 4 3 1 0", bass: "0 0 0 3", drum: "chase" },
  jail: { bpm: 52, scale: [48, 51, 55, 58, 60], lead: "0 r r 2 r r 1 r", bass: "0 r r r", drum: "none" },
  drive: { bpm: 108, scale: [57, 60, 62, 64, 67, 69], lead: "0 2 4 7 4 2 3 4", bass: "0 0 4 0 3 0", drum: "drive" },
  home: { bpm: 68, scale: [65, 69, 72, 74, 77, 81], lead: "0 2 4 2 3 1 2 0", bass: "0 r 3 r", drum: "none" },
  kenting: { bpm: 96, scale: [64, 67, 71, 72, 76, 79], lead: "0 2 4 5 4 2 3 2", bass: "0 4 0 3", drum: "soft" },
  festival: { bpm: 128, scale: [62, 66, 69, 74, 78], lead: "0 2 3 2 4 2 3 0 1 2 4 3", bass: "0 0 3 4", drum: "busy" },
};

function midi(m) {
  return 440 * Math.pow(2, (m - 69) / 12);
}

export function createAudio() {
  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  let ctx = null;
  let master = null;
  let musicBus = null;
  let sfxBus = null;
  let noise = null;
  let a = null;
  let b = null;
  let active = null;
  let current = "title";
  let pending = "title";
  let musicVol = 0.75;
  let sfxVol = 0.85;
  let mute = false;
  let siren = null;
  let hum = null;
  let started = false;

  function ensure() {
    if (ctx) return true;
    if (!AudioCtx) return false;
    ctx = new AudioCtx();
    master = ctx.createGain();
    master.gain.value = mute ? 0 : 1;
    master.connect(ctx.destination);
    musicBus = ctx.createGain();
    musicBus.gain.value = musicVol;
    musicBus.connect(master);
    sfxBus = ctx.createGain();
    sfxBus.gain.value = sfxVol;
    sfxBus.connect(master);
    const len = Math.floor(ctx.sampleRate * 0.4);
    noise = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = noise.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    a = makeChannel();
    b = makeChannel();
    siren = makeSiren();
    hum = makeHum();
    return true;
  }

  function makeChannel() {
    const gain = ctx.createGain();
    gain.gain.value = 0;
    gain.connect(musicBus);
    return { gain, scene: null, step: 0, next: 0, running: false };
  }

  function makeSiren() {
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    const f = ctx.createBiquadFilter();
    osc.type = "sawtooth";
    osc.frequency.value = 740;
    f.type = "bandpass";
    f.frequency.value = 900;
    f.Q.value = 4;
    g.gain.value = 0;
    osc.connect(f);
    f.connect(g);
    g.connect(sfxBus);
    osc.start();
    return { osc, gain: g };
  }

  function makeHum() {
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = "triangle";
    osc.frequency.value = 70;
    g.gain.value = 0;
    osc.connect(g);
    g.connect(sfxBus);
    osc.start();
    return { osc, gain: g };
  }

  function ramp(param, value, seconds) {
    const t = ctx.currentTime;
    param.cancelScheduledValues(t);
    param.setValueAtTime(param.value, t);
    param.linearRampToValueAtTime(value, t + seconds);
  }

  function tone(time, freq, dur, type, gainValue, dest, filterFreq) {
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    const f = ctx.createBiquadFilter();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, time);
    f.type = "lowpass";
    f.frequency.setValueAtTime(filterFreq, time);
    g.gain.setValueAtTime(0.0001, time);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, gainValue), time + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, time + dur);
    osc.connect(f);
    f.connect(g);
    g.connect(dest);
    osc.start(time);
    osc.stop(time + dur + 0.05);
  }

  function drum(time, kind, dest) {
    if (kind === "kick") {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(150, time);
      osc.frequency.exponentialRampToValueAtTime(48, time + 0.12);
      g.gain.setValueAtTime(0.5, time);
      g.gain.exponentialRampToValueAtTime(0.0001, time + 0.22);
      osc.connect(g);
      g.connect(dest);
      osc.start(time);
      osc.stop(time + 0.25);
      return;
    }
    const src = ctx.createBufferSource();
    src.buffer = noise;
    const f = ctx.createBiquadFilter();
    const g = ctx.createGain();
    f.type = kind === "hat" ? "highpass" : "bandpass";
    f.frequency.value = kind === "hat" ? 5000 : 900;
    const dur = kind === "hat" ? 0.05 : 0.14;
    const vol = kind === "hat" ? 0.08 : 0.18;
    g.gain.setValueAtTime(vol, time);
    g.gain.exponentialRampToValueAtTime(0.0001, time + dur);
    src.connect(f);
    f.connect(g);
    g.connect(dest);
    src.start(time);
    src.stop(time + dur);
  }

  function degrees(pattern) {
    return pattern.split(/\s+/).map((tok) => (tok === "r" ? null : Number(tok)));
  }

  function schedule(channel, time) {
    const def = SCENES[channel.scene] || SCENES.day;
    const lead = degrees(def.lead);
    const bass = degrees(def.bass);
    const eighth = 60 / def.bpm / 2;
    const leadDeg = lead[channel.step % lead.length];
    const bassStep = Math.floor(channel.step / 2);
    const bassDeg = bass[bassStep % bass.length];
    const beat = channel.step % 8;
    if (leadDeg != null) {
      const midiN = def.scale[Math.abs(leadDeg) % def.scale.length] + 12;
      const type = def.drum === "chase" ? "sawtooth" : "triangle";
      tone(time, midi(midiN), eighth * 1.6, type, def.drum === "chase" ? 0.05 : 0.07, channel.gain, def.drum === "chase" ? 900 : 1400);
    }
    if (channel.step % 2 === 0 && bassDeg != null) {
      const midiN = def.scale[Math.abs(bassDeg) % def.scale.length] - 12;
      tone(time, midi(midiN), eighth * 3, "sine", 0.09, channel.gain, 400);
    }
    if (def.drum === "busy" || def.drum === "drive" || def.drum === "chase") {
      if (beat % 2 === 0) drum(time, "kick", channel.gain);
      if (beat === 4) drum(time, "snare", channel.gain);
      if (def.drum !== "drive" || beat % 2 === 1) drum(time, "hat", channel.gain);
    } else if (def.drum === "soft" && beat % 4 === 0) {
      drum(time, "kick", channel.gain);
    }
    channel.step++;
    channel.next = time + eighth;
  }

  function startChannel(channel, scene) {
    channel.scene = scene;
    channel.step = 0;
    channel.next = ctx.currentTime + 0.05;
    channel.running = true;
  }

  async function resume() {
    if (!ensure()) return;
    if (ctx.state !== "running") {
      try { await ctx.resume(); } catch { /* autoplay */ }
    }
    started = ctx.state === "running";
    if (started && !active) setScene(pending || current, true);
  }

  function setScene(name, force = false) {
    pending = name;
    if (!SCENES[name]) name = "day";
    if (!force && name === current) return;
    current = name;
    if (!started || !ctx) return;
    const incoming = active === a ? b : a;
    const outgoing = active;
    startChannel(incoming, name);
    ramp(incoming.gain.gain, 1, force ? 0.05 : 1.35);
    if (outgoing && outgoing !== incoming) {
      ramp(outgoing.gain.gain, 0, 1.35);
      window.setTimeout(() => {
        if (active !== outgoing) outgoing.running = false;
      }, 1500);
    }
    active = incoming;
  }

  function update() {
    if (!started || !ctx) return;
    const horizon = ctx.currentTime + 0.25;
    for (const channel of [a, b]) {
      if (!channel || !channel.running) continue;
      let guard = 0;
      while (channel.next < horizon && guard++ < 8) schedule(channel, channel.next);
    }
  }

  function setMusicVolume(v) {
    musicVol = Math.max(0, Math.min(1, v));
    if (musicBus) ramp(musicBus.gain, musicVol, 0.08);
  }

  function setSfxVolume(v) {
    sfxVol = Math.max(0, Math.min(1, v));
    if (sfxBus) ramp(sfxBus.gain, sfxVol, 0.08);
  }

  function setMute(flag) {
    mute = !!flag;
    if (!ctx) return;
    ramp(master.gain, mute ? 0 : 1, 0.08);
  }

  function sfx(name) {
    if (!started || mute || sfxVol <= 0) return;
    const t = ctx.currentTime;
    if (name === "coin") {
      tone(t, midi(76), 0.08, "square", 0.08, sfxBus, 2000);
      tone(t + 0.08, midi(88), 0.14, "square", 0.08, sfxBus, 2200);
    } else if (name === "talk") {
      tone(t, midi(67), 0.07, "sine", 0.06, sfxBus, 1200);
    } else if (name === "pop") {
      tone(t, midi(90), 0.09, "triangle", 0.08, sfxBus, 2400);
    } else if (name === "spray") {
      drum(t, "hat", sfxBus);
      tone(t, 180, 0.18, "sawtooth", 0.03, sfxBus, 500);
    } else if (name === "horn") {
      tone(t, midi(70), 0.18, "sawtooth", 0.07, sfxBus, 900);
      tone(t + 0.16, midi(74), 0.2, "square", 0.05, sfxBus, 900);
    } else if (name === "yelp") {
      tone(t, midi(78), 0.12, "square", 0.05, sfxBus, 1600);
    } else if (name === "jail") {
      tone(t, midi(40), 0.4, "sine", 0.1, sfxBus, 300);
    } else if (name === "win") {
      tone(t, midi(72), 0.1, "triangle", 0.08, sfxBus, 1800);
      tone(t + 0.1, midi(76), 0.1, "triangle", 0.08, sfxBus, 1800);
      tone(t + 0.2, midi(79), 0.22, "triangle", 0.09, sfxBus, 1800);
    } else if (name === "lose") {
      tone(t, midi(64), 0.16, "sawtooth", 0.05, sfxBus, 700);
      tone(t + 0.14, midi(57), 0.28, "sawtooth", 0.05, sfxBus, 500);
    } else if (name === "click") {
      tone(t, midi(90), 0.04, "square", 0.04, sfxBus, 2000);
    }
  }

  function setChase(amount) {
    if (!siren) return;
    const target = mute ? 0 : Math.max(0, Math.min(1, amount)) * 0.045 * sfxVol;
    ramp(siren.gain.gain, target, 0.2);
  }

  function setEngine(speed) {
    if (!hum) return;
    const target = mute ? 0 : Math.max(0, Math.min(1, speed / 28)) * 0.04 * sfxVol;
    hum.osc.frequency.setTargetAtTime(55 + speed * 7, ctx.currentTime, 0.1);
    ramp(hum.gain.gain, target, 0.1);
  }

  function tickSiren() {
    if (!siren || !ctx) return;
    const wobble = Math.sin(ctx.currentTime * 7) * 0.5 + 0.5;
    siren.osc.frequency.setTargetAtTime(640 + wobble * 240, ctx.currentTime, 0.04);
  }

  return {
    resume,
    setScene,
    update,
    setMusicVolume,
    setSfxVolume,
    setMute,
    sfx,
    setChase,
    setEngine,
    tickSiren,
    get current() { return current; },
  };
}
