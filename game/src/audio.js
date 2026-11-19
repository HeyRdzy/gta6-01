// Every sound in Solmar Heat is synthesised with WebAudio — no audio files.
// Engine hum, police siren, gunshots, pickups and mission jingles are all oscillators
// and filtered noise built at runtime.

/** Build the sound bank. Nothing plays until ensure() runs from a user gesture. */
export function createSoundBank() {
  let context = null;
  let master = null;
  let engineOsc = null;
  let engineGain = null;
  let sirenOsc = null;
  let sirenGain = null;
  let sirenLfo = null;
  let muted = false;

  function ensure() {
    if (context) {
      if (context.state === 'suspended') context.resume();
      return;
    }
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return;
      context = new AudioContext();
      master = context.createGain();
      master.gain.value = 0.5;
      master.connect(context.destination);
    } catch {
      context = null;
    }
  }

  function tone(frequency, duration, type, volume, slideTo) {
    if (!context || !master || muted) return;
    try {
      const osc = context.createOscillator();
      const gain = context.createGain();
      osc.type = type || 'sine';
      osc.frequency.setValueAtTime(frequency, context.currentTime);
      if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), context.currentTime + duration);
      gain.gain.setValueAtTime(volume, context.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + duration);
      osc.connect(gain);
      gain.connect(master);
      osc.start();
      osc.stop(context.currentTime + duration + 0.02);
    } catch {
      // Audio is decoration: a failure here must never break the game.
    }
  }

  function noiseBurst(duration, volume, filterFrequency) {
    if (!context || !master || muted) return;
    try {
      const length = Math.max(1, Math.floor(context.sampleRate * duration));
      const buffer = context.createBuffer(1, length, context.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < length; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / length);
      const source = context.createBufferSource();
      source.buffer = buffer;
      const filter = context.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = filterFrequency || 1800;
      const gain = context.createGain();
      gain.gain.value = volume;
      source.connect(filter);
      filter.connect(gain);
      gain.connect(master);
      source.start();
    } catch {
      // Audio is decoration: a failure here must never break the game.
    }
  }

  return {
    ensure,
    toggleMute() {
      muted = !muted;
      if (master) master.gain.value = muted ? 0 : 0.5;
      return muted;
    },

    /** Start the engine hum; setEngineSpeed changes its pitch with the car's speed. */
    startEngine() {
      ensure();
      if (!context || !master || engineOsc) return;
      try {
        engineOsc = context.createOscillator();
        engineOsc.type = 'sawtooth';
        engineOsc.frequency.value = 55;
        engineGain = context.createGain();
        engineGain.gain.value = 0.0;
        const filter = context.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = 420;
        engineOsc.connect(filter);
        filter.connect(engineGain);
        engineGain.connect(master);
        engineOsc.start();
      } catch {
        engineOsc = null;
      }
    },
    setEngineSpeed(ratio, driving) {
      if (!engineOsc || !engineGain || !context) return;
      const target = driving ? 0.05 + Math.min(1, ratio) * 0.09 : 0.0;
      engineGain.gain.setTargetAtTime(target, context.currentTime, 0.1);
      engineOsc.frequency.setTargetAtTime(55 + Math.min(1, ratio) * 110, context.currentTime, 0.1);
    },
    stopEngine() {
      if (!engineOsc) return;
      try {
        engineOsc.stop();
      } catch {
        // Already stopped.
      }
      engineOsc = null;
      engineGain = null;
    },

    /** The two-tone police siren, on or off. */
    setSiren(on) {
      ensure();
      if (!context || !master) return;
      if (on && !sirenOsc) {
        try {
          sirenOsc = context.createOscillator();
          sirenOsc.type = 'triangle';
          sirenOsc.frequency.value = 750;
          sirenLfo = context.createOscillator();
          sirenLfo.type = 'square';
          sirenLfo.frequency.value = 0.55;
          const lfoGain = context.createGain();
          lfoGain.gain.value = 220;
          sirenLfo.connect(lfoGain);
          lfoGain.connect(sirenOsc.frequency);
          sirenGain = context.createGain();
          sirenGain.gain.value = 0.045;
          sirenOsc.connect(sirenGain);
          sirenGain.connect(master);
          sirenOsc.start();
          sirenLfo.start();
        } catch {
          sirenOsc = null;
        }
      } else if (!on && sirenOsc) {
        try {
          sirenOsc.stop();
          if (sirenLfo) sirenLfo.stop();
        } catch {
          // Already stopped.
        }
        sirenOsc = null;
        sirenLfo = null;
        sirenGain = null;
      }
    },

    gunshot() {
      noiseBurst(0.14, 0.5, 2400);
      tone(160, 0.1, 'square', 0.18, 60);
    },
    enemyShot() {
      noiseBurst(0.12, 0.22, 1600);
    },
    crash() {
      noiseBurst(0.3, 0.5, 700);
      tone(90, 0.25, 'sine', 0.3, 40);
    },
    pickup() {
      tone(660, 0.09, 'sine', 0.25);
      window.setTimeout(() => tone(880, 0.12, 'sine', 0.25), 90);
      window.setTimeout(() => tone(1320, 0.16, 'sine', 0.22), 180);
    },
    missionComplete() {
      [523, 659, 784, 1046].forEach((frequency, index) => {
        window.setTimeout(() => tone(frequency, 0.22, 'triangle', 0.28), index * 130);
      });
    },
    missionStart() {
      tone(392, 0.14, 'triangle', 0.25);
      window.setTimeout(() => tone(523, 0.18, 'triangle', 0.25), 140);
    },
    busted() {
      tone(220, 0.5, 'sawtooth', 0.25, 110);
    },
    click() {
      tone(800, 0.05, 'square', 0.12);
    },
  };
}
