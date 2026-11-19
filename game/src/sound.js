// Synthesised sound for Solmar Heat v3: no audio files, everything is
// WebAudio oscillators and filtered noise. The engine now runs two
// detuned saws through a low-pass that opens with speed, the siren wails
// in stereo-ish alternation, and crashes get a noise burst under the thud.

export class BaySound {
  constructor() {
    this.ctx = null;
    this.muted = false;
    this.engineOsc = null;
    this.engineOsc2 = null;
    this.engineGain = null;
    this.engineFilter = null;
    this.sirenOsc = null;
    this.sirenGain = null;
    this.sirenHigh = false;
    this.sirenT = 0;
  }

  unlock() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AC();
    } catch (e) { this.ctx = null; }
  }

  _noiseBuffer(seconds) {
    const buf = this.ctx.createBuffer(1, this.ctx.sampleRate * seconds, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    return buf;
  }

  shot() {
    if (!this.ctx || this.muted) return;
    const src = this.ctx.createBufferSource();
    src.buffer = this._noiseBuffer(0.14);
    const f = this.ctx.createBiquadFilter();
    f.type = 'lowpass'; f.frequency.value = 1400;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.5, this.ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.14);
    src.connect(f); f.connect(g); g.connect(this.ctx.destination);
    src.start();
  }

  blip(freq = 880) {
    if (!this.ctx || this.muted) return;
    const o = this.ctx.createOscillator();
    o.type = 'sine'; o.frequency.value = freq;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.25, this.ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.18);
    o.connect(g); g.connect(this.ctx.destination);
    o.start(); o.stop(this.ctx.currentTime + 0.2);
  }

  jingle() {
    if (!this.ctx || this.muted) return;
    [523, 659, 784, 1046].forEach((f, i) => {
      setTimeout(() => this.blip(f), i * 110);
    });
  }

  thud() {
    if (!this.ctx || this.muted) return;
    const o = this.ctx.createOscillator();
    o.type = 'triangle'; o.frequency.setValueAtTime(120, this.ctx.currentTime);
    o.frequency.exponentialRampToValueAtTime(40, this.ctx.currentTime + 0.2);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.5, this.ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.22);
    o.connect(g); g.connect(this.ctx.destination);
    o.start(); o.stop(this.ctx.currentTime + 0.24);
    const src = this.ctx.createBufferSource();
    src.buffer = this._noiseBuffer(0.12);
    const f = this.ctx.createBiquadFilter();
    f.type = 'bandpass'; f.frequency.value = 300;
    const g2 = this.ctx.createGain();
    g2.gain.setValueAtTime(0.4, this.ctx.currentTime);
    g2.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.12);
    src.connect(f); f.connect(g2); g2.connect(this.ctx.destination);
    src.start();
  }

  engine(on, speed = 0) {
    if (!this.ctx || this.muted) { this.engineOff(); return; }
    if (!on) { this.engineOff(); return; }
    if (!this.engineOsc) {
      this.engineFilter = this.ctx.createBiquadFilter();
      this.engineFilter.type = 'lowpass';
      this.engineFilter.frequency.value = 500;
      this.engineGain = this.ctx.createGain();
      this.engineGain.gain.value = 0.05;
      this.engineOsc = this.ctx.createOscillator();
      this.engineOsc.type = 'sawtooth';
      this.engineOsc2 = this.ctx.createOscillator();
      this.engineOsc2.type = 'sawtooth';
      this.engineOsc.connect(this.engineFilter);
      this.engineOsc2.connect(this.engineFilter);
      this.engineFilter.connect(this.engineGain);
      this.engineGain.connect(this.ctx.destination);
      this.engineOsc.start();
      this.engineOsc2.start();
    }
    const rpm = 55 + Math.abs(speed) * 4.5;
    this.engineOsc.frequency.value = rpm;
    this.engineOsc2.frequency.value = rpm * 1.494;
    this.engineFilter.frequency.value = 420 + Math.abs(speed) * 26;
    this.engineGain.gain.value = 0.035 + Math.abs(speed) * 0.0016;
  }

  engineOff() {
    for (const key of ['engineOsc', 'engineOsc2']) {
      const o = this[key];
      if (o) { try { o.stop(); } catch (e) { /* already stopped */ } }
    }
    this.engineOsc = null;
    this.engineOsc2 = null;
    this.engineGain = null;
    this.engineFilter = null;
  }

  siren(on) {
    if (!this.ctx || this.muted) { this.sirenOff(); return; }
    if (!on) { this.sirenOff(); return; }
    if (!this.sirenOsc) {
      this.sirenOsc = this.ctx.createOscillator();
      this.sirenOsc.type = 'sine';
      this.sirenGain = this.ctx.createGain();
      this.sirenGain.gain.value = 0.045;
      this.sirenOsc.connect(this.sirenGain); this.sirenGain.connect(this.ctx.destination);
      this.sirenOsc.start();
    }
  }

  sirenOff() {
    if (this.sirenOsc) {
      try { this.sirenOsc.stop(); } catch (e) { /* already stopped */ }
      this.sirenOsc = null; this.sirenGain = null;
    }
  }

  /** Called every frame while the siren is on: wails between two tones. */
  sirenTick(dt) {
    if (!this.sirenOsc) return;
    this.sirenT += dt;
    if (this.sirenT > 0.45) {
      this.sirenT = 0;
      this.sirenHigh = !this.sirenHigh;
      this.sirenOsc.frequency.value = this.sirenHigh ? 920 : 620;
    }
  }

  setMuted(m) {
    this.muted = m;
    if (m) { this.engineOff(); this.sirenOff(); }
  }
}
