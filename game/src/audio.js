// Original sound and music for Solara City, synthesized live with
// WebAudio oscillators and noise — no audio files, no network.
// A laid-back synthwave bassline loops under the city; sirens, horns,
// gunshots, punches and cash chimes are one-shot synth effects.
export function createAudio() {
  let ctx = null;
  let master = null;
  let musicGain = null;
  let engineOsc = null;
  let engineGain = null;
  let musicTimer = null;
  let enabled = true;
  let musicOn = false;

  // A minor-key bassline + sparkle arpeggio, original to this game.
  const BASS_NOTES = [55, 55, 65.41, 49, 55, 55, 73.42, 82.41];
  const ARP_NOTES = [220, 261.63, 329.63, 392, 329.63, 261.63, 220, 164.81];
  let step = 0;

  function ensureContext() {
    if (ctx) return true;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.5;
      master.connect(ctx.destination);
      musicGain = ctx.createGain();
      musicGain.gain.value = 0.16;
      musicGain.connect(master);
      engineGain = ctx.createGain();
      engineGain.gain.value = 0;
      engineGain.connect(master);
      engineOsc = ctx.createOscillator();
      engineOsc.type = 'sawtooth';
      engineOsc.frequency.value = 55;
      const engineFilter = ctx.createBiquadFilter();
      engineFilter.type = 'lowpass';
      engineFilter.frequency.value = 320;
      engineOsc.connect(engineFilter);
      engineFilter.connect(engineGain);
      engineOsc.start();
    } catch (err) {
      return false;
    }
    return true;
  }

  function tone(freq, duration, type, volume, when = 0, slideTo = 0) {
    if (!ctx || !enabled) return;
    const t0 = ctx.currentTime + when;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (slideTo > 0) osc.frequency.exponentialRampToValueAtTime(slideTo, t0 + duration);
    gain.gain.setValueAtTime(0, t0);
    gain.gain.linearRampToValueAtTime(volume, t0 + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
    osc.connect(gain);
    gain.connect(master);
    osc.start(t0);
    osc.stop(t0 + duration + 0.05);
  }

  function noiseBurst(duration, volume, filterFreq) {
    if (!ctx || !enabled) return;
    const t0 = ctx.currentTime;
    const length = Math.max(1, Math.floor(ctx.sampleRate * duration));
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / length);
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = filterFreq;
    const gain = ctx.createGain();
    gain.gain.value = volume;
    src.connect(filter);
    filter.connect(gain);
    gain.connect(master);
    src.start(t0);
  }

  function musicStep() {
    if (!ctx || !enabled || !musicOn) return;
    const bass = BASS_NOTES[step % BASS_NOTES.length];
    const arp = ARP_NOTES[step % ARP_NOTES.length];
    tone(bass, 0.5, 'triangle', 0.5);
    tone(bass / 2, 0.5, 'sine', 0.35);
    tone(arp, 0.22, 'square', 0.06);
    if (step % 4 === 0) tone(arp * 2, 0.3, 'sine', 0.08);
    step += 1;
  }

  return {
    unlock() {
      if (!ensureContext()) return;
      if (ctx.state === 'suspended') ctx.resume();
      this.startMusic();
    },
    startMusic() {
      if (!ensureContext() || musicOn) return;
      musicOn = true;
      musicTimer = window.setInterval(musicStep, 260);
    },
    stopMusic() {
      musicOn = false;
      if (musicTimer) window.clearInterval(musicTimer);
      musicTimer = null;
    },
    setMuted(muted) { enabled = !muted; if (master) master.gain.value = muted ? 0 : 0.5; },
    setEngine(running, speed01) {
      if (!ctx) return;
      engineGain.gain.setTargetAtTime(running ? 0.05 + speed01 * 0.07 : 0, ctx.currentTime, 0.1);
      engineOsc.frequency.setTargetAtTime(50 + speed01 * 130, ctx.currentTime, 0.1);
    },
    horn() { tone(370, 0.35, 'square', 0.12); tone(466, 0.35, 'square', 0.1); },
    siren() {
      tone(700, 0.5, 'sine', 0.07, 0, 950);
      tone(950, 0.5, 'sine', 0.07, 0.5, 700);
    },
    gunshot() { noiseBurst(0.14, 0.5, 2600); tone(160, 0.1, 'square', 0.2, 0, 60); },
    punch() { noiseBurst(0.09, 0.4, 500); tone(90, 0.12, 'sine', 0.35, 0, 45); },
    cash() { tone(880, 0.12, 'sine', 0.2); tone(1318, 0.2, 'sine', 0.2, 0.1); },
    pickup() { tone(523, 0.1, 'triangle', 0.22); tone(784, 0.16, 'triangle', 0.22, 0.08); },
    crash() { noiseBurst(0.3, 0.5, 900); tone(70, 0.3, 'sine', 0.3, 0, 35); },
    click() { tone(1200, 0.05, 'square', 0.08); },
    missionDone() {
      [523, 659, 784, 1046].forEach((f, i) => tone(f, 0.28, 'triangle', 0.22, i * 0.12));
    },
    busted() { tone(392, 0.4, 'sawtooth', 0.15, 0, 196); tone(196, 0.7, 'sawtooth', 0.15, 0.35, 98); },
  };
}
