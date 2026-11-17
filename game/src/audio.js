// All sound, generated with the WebAudio API: no files, no network. The context is created (and
// resumed) only after the first user gesture, because browsers otherwise keep it suspended. The
// two continuous sounds — thrust and beam — are started and stopped by the game loop.

export function createAudio() {
  let ctx = null;
  let thrustLoop = null;
  let beamLoop = null;

  function ensure() {
    if (ctx === null) {
      try {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (AC) ctx = new AC();
      } catch {
        ctx = null;
      }
    }
    return ctx;
  }

  /** Call from inside a user gesture to create/resume the context. */
  function unlock() {
    const c = ensure();
    if (c && c.state === 'suspended') c.resume();
  }

  /** One short pitched tone sweeping from `f0` to `f1`. */
  function tone(f0, f1, dur, type, gain, delay = 0) {
    const c = ensure();
    if (c === null) return;
    const t0 = c.currentTime + delay;
    const osc = c.createOscillator();
    const g = c.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(Math.max(1, f0), t0);
    osc.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t0 + dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(gain, t0 + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g).connect(c.destination);
    osc.start(t0);
    osc.stop(t0 + dur + 0.03);
  }

  /** A short filtered noise burst that decays with the buffer. */
  function noise(dur, gain, filterFreq, filterType = 'lowpass') {
    const c = ensure();
    if (c === null) return;
    const t0 = c.currentTime;
    const len = Math.max(1, Math.floor(c.sampleRate * dur));
    const buf = c.createBuffer(1, len, c.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = c.createBufferSource();
    src.buffer = buf;
    const f = c.createBiquadFilter();
    f.type = filterType;
    f.frequency.value = filterFreq;
    const g = c.createGain();
    g.gain.value = gain;
    src.connect(f).connect(g).connect(c.destination);
    src.start(t0);
  }

  /** A looping filtered-noise rumble (the thrust). */
  function loopNoise(freq, level) {
    const c = ensure();
    const src = c.createBufferSource();
    const len = c.sampleRate;
    const buf = c.createBuffer(1, len, c.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i += 1) data[i] = Math.random() * 2 - 1;
    src.buffer = buf;
    src.loop = true;
    const f = c.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = freq;
    const g = c.createGain();
    g.gain.value = 0;
    src.connect(f).connect(g).connect(c.destination);
    src.start();
    g.gain.linearRampToValueAtTime(level, c.currentTime + 0.08);
    return {
      stop() {
        g.gain.linearRampToValueAtTime(0, c.currentTime + 0.06);
        try { src.stop(c.currentTime + 0.12); } catch { /* already stopped */ }
      },
    };
  }

  /** A looping oscillator hum (the beam). */
  function loopTone(freq, level, type) {
    const c = ensure();
    const osc = c.createOscillator();
    osc.type = type;
    osc.frequency.value = freq;
    const g = c.createGain();
    g.gain.value = 0;
    osc.connect(g).connect(c.destination);
    osc.start();
    g.gain.linearRampToValueAtTime(level, c.currentTime + 0.08);
    return {
      stop() {
        g.gain.linearRampToValueAtTime(0, c.currentTime + 0.06);
        try { osc.stop(c.currentTime + 0.12); } catch { /* already stopped */ }
      },
    };
  }

  function play(name) {
    if (ensure() === null) return;
    switch (name) {
      case 'start':
        tone(440, 660, 0.12, 'square', 0.05);
        tone(660, 990, 0.16, 'square', 0.05, 0.1);
        break;
      case 'capture':
        tone(880, 1320, 0.1, 'sine', 0.12);
        tone(1320, 1760, 0.09, 'sine', 0.07, 0.05);
        break;
      case 'impact':
        noise(0.24, 0.3, 900);
        tone(150, 70, 0.3, 'triangle', 0.22);
        break;
      case 'dock':
        tone(520, 520, 0.18, 'sine', 0.11);
        tone(780, 780, 0.18, 'sine', 0.09, 0.05);
        tone(1040, 1040, 0.28, 'sine', 0.07, 0.1);
        break;
      case 'burn':
        noise(0.3, 0.06, 2400, 'highpass');
        break;
      case 'over':
        tone(520, 420, 0.45, 'sawtooth', 0.07);
        tone(420, 180, 0.8, 'sawtooth', 0.07, 0.32);
        break;
      default:
        break;
    }
  }

  function setThrust(on) {
    if (ensure() === null) return;
    if (on && thrustLoop === null) thrustLoop = loopNoise(320, 0.09);
    else if (!on && thrustLoop !== null) {
      thrustLoop.stop();
      thrustLoop = null;
    }
  }

  function setBeam(on) {
    if (ensure() === null) return;
    if (on && beamLoop === null) {
      beamLoop = loopTone(220, 0.03, 'sine');
    } else if (!on && beamLoop !== null) {
      beamLoop.stop();
      beamLoop = null;
    }
  }

  return { unlock, play, setThrust, setBeam };
}
