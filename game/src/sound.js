// Solmar Heat — all sound is synthesized with WebAudio. Written fresh for round 4.
// No audio files: engine hum, siren, gunshots, chimes and wind are oscillators
// and filtered noise, started on the first user gesture.
export function createSound() {
  const snd = {
    ctx: null,
    master: null,
    engineOsc: null,
    engineOsc2: null,
    engineGain: null,
    sirenOsc: null,
    sirenGain: null,
    windSrc: null,
    sirenOn: false,
    lastFlip: 0,
    sirenHigh: false,
  };

  snd.ensure = () => {
    if (snd.ctx) {
      if (snd.ctx.state === 'suspended') snd.ctx.resume();
      return;
    }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      snd.ctx = new AC();
      snd.master = snd.ctx.createGain();
      snd.master.gain.value = 0.5;
      snd.master.connect(snd.ctx.destination);

      // Engine: two detuned saws through a lowpass.
      snd.engineGain = snd.ctx.createGain();
      snd.engineGain.gain.value = 0;
      const lp = snd.ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 420;
      snd.engineOsc = snd.ctx.createOscillator();
      snd.engineOsc.type = 'sawtooth';
      snd.engineOsc.frequency.value = 55;
      snd.engineOsc2 = snd.ctx.createOscillator();
      snd.engineOsc2.type = 'sawtooth';
      snd.engineOsc2.frequency.value = 82;
      snd.engineOsc.connect(lp);
      snd.engineOsc2.connect(lp);
      lp.connect(snd.engineGain);
      snd.engineGain.connect(snd.master);
      snd.engineOsc.start();
      snd.engineOsc2.start();

      // Siren: a square wave flipped between two tones in update().
      snd.sirenGain = snd.ctx.createGain();
      snd.sirenGain.gain.value = 0;
      snd.sirenOsc = snd.ctx.createOscillator();
      snd.sirenOsc.type = 'square';
      snd.sirenOsc.frequency.value = 660;
      snd.sirenOsc.connect(snd.sirenGain);
      snd.sirenGain.connect(snd.master);
      snd.sirenOsc.start();

      // Wind / surf bed: looped brown noise, very quiet.
      const len = snd.ctx.sampleRate * 2;
      const buf = snd.ctx.createBuffer(1, len, snd.ctx.sampleRate);
      const data = buf.getChannelData(0);
      let last = 0;
      for (let i = 0; i < len; i++) {
        const white = Math.random() * 2 - 1;
        last = (last + 0.02 * white) / 1.02;
        data[i] = last * 3.2;
      }
      const src = snd.ctx.createBufferSource();
      src.buffer = buf;
      src.loop = true;
      const windGain = snd.ctx.createGain();
      windGain.gain.value = 0.05;
      const windLp = snd.ctx.createBiquadFilter();
      windLp.type = 'lowpass';
      windLp.frequency.value = 320;
      src.connect(windLp);
      windLp.connect(windGain);
      windGain.connect(snd.master);
      src.start();
      snd.windSrc = src;
    } catch (e) {
      snd.ctx = null;
    }
  };

  snd.setMuted = (m) => {
    if (snd.master) snd.master.gain.value = m ? 0 : 0.5;
  };

  // Called every frame: speed01 0..1, throttle 0..1.
  snd.engine = (speed01, throttle) => {
    if (!snd.ctx || !snd.engineOsc) return;
    const t = snd.ctx.currentTime;
    snd.engineOsc.frequency.setTargetAtTime(52 + speed01 * 130, t, 0.08);
    snd.engineOsc2.frequency.setTargetAtTime(78 + speed01 * 195, t, 0.08);
    snd.engineGain.gain.setTargetAtTime(0.02 + speed01 * 0.05 + throttle * 0.03, t, 0.1);
  };

  // Called every frame: on when cops chase, level 0..1 by nearest cop distance.
  snd.siren = (on, level, now) => {
    if (!snd.ctx || !snd.sirenOsc) return;
    if (on && !snd.sirenOn) {
      snd.sirenOn = true;
      snd.lastFlip = now;
    }
    if (!on) {
      snd.sirenOn = false;
      snd.sirenGain.gain.setTargetAtTime(0, snd.ctx.currentTime, 0.1);
      return;
    }
    if (now - snd.lastFlip > 0.42) {
      snd.lastFlip = now;
      snd.sirenHigh = !snd.sirenHigh;
      snd.sirenOsc.frequency.setTargetAtTime(snd.sirenHigh ? 880 : 660, snd.ctx.currentTime, 0.02);
    }
    snd.sirenGain.gain.setTargetAtTime(0.05 * level, snd.ctx.currentTime, 0.2);
  };

  snd.shot = () => {
    if (!snd.ctx) return;
    const t = snd.ctx.currentTime;
    const len = Math.floor(snd.ctx.sampleRate * 0.14);
    const buf = snd.ctx.createBuffer(1, len, snd.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = snd.ctx.createBufferSource();
    src.buffer = buf;
    const f = snd.ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.setValueAtTime(3200, t);
    f.frequency.exponentialRampToValueAtTime(300, t + 0.12);
    const g = snd.ctx.createGain();
    g.gain.setValueAtTime(0.5, t);
    g.gain.exponentialRampToValueAtTime(0.01, t + 0.13);
    src.connect(f);
    f.connect(g);
    g.connect(snd.master);
    src.start();
  };

  snd.chime = (notes = [880, 1318]) => {
    if (!snd.ctx) return;
    const t0 = snd.ctx.currentTime;
    notes.forEach((freq, i) => {
      const o = snd.ctx.createOscillator();
      o.type = 'sine';
      o.frequency.value = freq;
      const g = snd.ctx.createGain();
      g.gain.setValueAtTime(0.0001, t0 + i * 0.09);
      g.gain.exponentialRampToValueAtTime(0.22, t0 + i * 0.09 + 0.02);
      g.gain.exponentialRampToValueAtTime(0.001, t0 + i * 0.09 + 0.35);
      o.connect(g);
      g.connect(snd.master);
      o.start(t0 + i * 0.09);
      o.stop(t0 + i * 0.09 + 0.4);
    });
  };

  snd.thud = () => {
    if (!snd.ctx) return;
    const t = snd.ctx.currentTime;
    const o = snd.ctx.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(120, t);
    o.frequency.exponentialRampToValueAtTime(40, t + 0.15);
    const g = snd.ctx.createGain();
    g.gain.setValueAtTime(0.4, t);
    g.gain.exponentialRampToValueAtTime(0.01, t + 0.18);
    o.connect(g);
    g.connect(snd.master);
    o.start(t);
    o.stop(t + 0.2);
  };

  return snd;
}
