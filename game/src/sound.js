// All sound is synthesized with WebAudio: an engine hum tied to speed, a
// two-tone siren, gunshots from filtered noise, a pickup chime and a surf and
// wind ambience bed. No audio files are loaded.

export function createSound(state) {
  let ctx = null;
  let master = null;
  let engineOscA = null;
  let engineOscB = null;
  let engineGain = null;
  let engineFilter = null;
  let sirenOsc = null;
  let sirenGain = null;
  let sirenLfo = null;
  let ambGain = null;
  let noiseBuf = null;

  function ensure() {
    if (ctx) {
      if (ctx.state === 'suspended') ctx.resume();
      return true;
    }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = state.muted ? 0 : 0.9;
      master.connect(ctx.destination);

      // Shared white-noise buffer for gunshots and ambience.
      const len = ctx.sampleRate;
      noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
      const data = noiseBuf.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;

      // Engine: two detuned saws through a lowpass, gain by speed.
      engineOscA = ctx.createOscillator();
      engineOscA.type = 'sawtooth';
      engineOscA.frequency.value = 52;
      engineOscB = ctx.createOscillator();
      engineOscB.type = 'square';
      engineOscB.frequency.value = 104;
      engineFilter = ctx.createBiquadFilter();
      engineFilter.type = 'lowpass';
      engineFilter.frequency.value = 420;
      engineGain = ctx.createGain();
      engineGain.gain.value = 0.0;
      engineOscA.connect(engineFilter);
      engineOscB.connect(engineFilter);
      engineFilter.connect(engineGain);
      engineGain.connect(master);
      engineOscA.start();
      engineOscB.start();

      // Siren: a triangle wave whose pitch wails on an LFO.
      sirenOsc = ctx.createOscillator();
      sirenOsc.type = 'triangle';
      sirenOsc.frequency.value = 780;
      sirenLfo = ctx.createOscillator();
      sirenLfo.type = 'sine';
      sirenLfo.frequency.value = 0.85;
      const lfoGain = ctx.createGain();
      lfoGain.gain.value = 170;
      sirenLfo.connect(lfoGain);
      lfoGain.connect(sirenOsc.frequency);
      sirenGain = ctx.createGain();
      sirenGain.gain.value = 0;
      sirenOsc.connect(sirenGain);
      sirenGain.connect(master);
      sirenOsc.start();
      sirenLfo.start();

      // Surf and wind: looped noise through a slow-breathing bandpass.
      const ambSrc = ctx.createBufferSource();
      ambSrc.buffer = noiseBuf;
      ambSrc.loop = true;
      const ambFilter = ctx.createBiquadFilter();
      ambFilter.type = 'bandpass';
      ambFilter.frequency.value = 480;
      ambFilter.Q.value = 0.6;
      ambGain = ctx.createGain();
      ambGain.gain.value = 0.035;
      const swell = ctx.createOscillator();
      swell.type = 'sine';
      swell.frequency.value = 0.09;
      const swellGain = ctx.createGain();
      swellGain.gain.value = 0.02;
      swell.connect(swellGain);
      swellGain.connect(ambGain.gain);
      ambSrc.connect(ambFilter);
      ambFilter.connect(ambGain);
      ambGain.connect(master);
      ambSrc.start();
      swell.start();
      return true;
    } catch (err) {
      ctx = null;
      return false;
    }
  }

  function burst(dur, filterFreq, peak) {
    if (!ctx || !noiseBuf) return;
    const src = ctx.createBufferSource();
    src.buffer = noiseBuf;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(filterFreq, ctx.currentTime);
    filter.frequency.exponentialRampToValueAtTime(120, ctx.currentTime + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(peak, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
    src.connect(filter);
    filter.connect(g);
    g.connect(master);
    src.start();
    src.stop(ctx.currentTime + dur + 0.05);
  }

  function tone(freq, dur, peak, type = 'sine') {
    if (!ctx) return;
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.value = freq;
    const g = ctx.createGain();
    g.gain.setValueAtTime(peak, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
    o.connect(g);
    g.connect(master);
    o.start();
    o.stop(ctx.currentTime + dur + 0.05);
  }

  return {
    ensure,
    gunshot() {
      if (!ensure()) return;
      burst(0.14, 2600, 0.5);
      tone(90, 0.1, 0.4, 'triangle');
    },
    rivalShot() {
      if (!ensure()) return;
      burst(0.12, 1800, 0.22);
    },
    chime() {
      if (!ensure()) return;
      tone(880, 0.16, 0.22);
      setTimeout(() => tone(1318, 0.22, 0.2), 90);
    },
    setMuted(muted) {
      state.muted = muted;
      if (master) master.gain.value = muted ? 0 : 0.9;
    },
    update(speed, wanted) {
      if (!ctx) return;
      const driving = speed > 0.5;
      const target = driving ? 0.028 + Math.min(0.075, speed * 0.0028) : 0.012;
      engineGain.gain.setTargetAtTime(target, ctx.currentTime, 0.1);
      const f = 48 + Math.min(120, speed * 5.5);
      engineOscA.frequency.setTargetAtTime(f, ctx.currentTime, 0.08);
      engineOscB.frequency.setTargetAtTime(f * 2.02, ctx.currentTime, 0.08);
      engineFilter.frequency.setTargetAtTime(320 + speed * 22, ctx.currentTime, 0.1);
      sirenGain.gain.setTargetAtTime(wanted > 0 ? 0.035 : 0, ctx.currentTime, 0.3);
    },
  };
}
