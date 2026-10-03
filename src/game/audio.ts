// Emberfall procedural audio — everything synthesized with WebAudio, no external assets.
export interface Ambience {
  wind: number; rain: number; cave: boolean; night: boolean; forest: boolean; village: boolean; underwater: boolean;
}

export class AudioSys {
  ctx: AudioContext | null = null;
  master: GainNode | null = null;
  musicG: GainNode | null = null;
  sfxG: GainNode | null = null;
  noiseBuf: AudioBuffer | null = null;
  vols = { master: 0.8, music: 0.55, sfx: 0.9 };
  private windSrc: AudioNode | null = null;
  private windG: GainNode | null = null;
  private rainSrc: AudioNode | null = null;
  private rainG: GainNode | null = null;
  private waterSrc: AudioNode | null = null;
  private waterG: GainNode | null = null;
  private musicT = 6;
  private ambT = 0;
  private started = false;

  init(): void {
    if (this.started) { this.ctx?.resume(); return; }
    this.started = true;
    try {
      const AC = window.AudioContext || (window as any).webkitAudioContext;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.connect(this.ctx.destination);
      this.musicG = this.ctx.createGain();
      this.musicG.connect(this.master);
      this.sfxG = this.ctx.createGain();
      this.sfxG.connect(this.master);
      // shared noise buffer
      const len = this.ctx.sampleRate * 2;
      this.noiseBuf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const d = this.noiseBuf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      // wind loop
      this.windG = this.ctx.createGain();
      this.windG.gain.value = 0;
      this.windSrc = this.loopNoise(300, 0.8);
      this.windSrc.connect(this.windG); this.windG.connect(this.sfxG);
      // rain loop
      this.rainG = this.ctx.createGain();
      this.rainG.gain.value = 0;
      this.rainSrc = this.loopNoise(1600, 0.5, 3200);
      this.rainSrc.connect(this.rainG); this.rainG.connect(this.sfxG);
      // underwater rumble
      this.waterG = this.ctx.createGain();
      this.waterG.gain.value = 0;
      this.waterSrc = this.loopNoise(140, 0.9);
      this.waterSrc.connect(this.waterG); this.waterG.connect(this.sfxG);
      this.applyVols();
    } catch (e) { console.warn("audio init failed", e); }
  }
  private loopNoise(freq: number, q: number, hp = 0): AudioNode {
    const src = this.ctx!.createBufferSource();
    src.buffer = this.noiseBuf; src.loop = true;
    const bp = this.ctx!.createBiquadFilter();
    bp.type = hp ? "highpass" : "bandpass";
    bp.frequency.value = freq; bp.Q.value = q;
    src.connect(bp);
    src.start();
    return bp;
  }
  setVolumes(master: number, music: number, sfx: number): void {
    this.vols = { master, music, sfx };
    this.applyVols();
  }
  private applyVols(): void {
    if (!this.ctx) return;
    this.master!.gain.value = this.vols.master;
    this.musicG!.gain.value = this.vols.music * 0.5;
    this.sfxG!.gain.value = this.vols.sfx;
  }

  // ---------- one-shot helpers ----------
  private env(dur: number, a: number, r: number, peak = 1): GainNode | null {
    if (!this.ctx) return null;
    const g = this.ctx.createGain();
    const t = this.ctx.currentTime;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t + a + dur + r);
    g.connect(this.sfxG!);
    return g;
  }
  private noiseBurst(dur: number, freq: number, q: number, peak = 0.5, type: BiquadFilterType = "bandpass"): void {
    if (!this.ctx) return;
    const g = this.env(dur, 0.005, dur * 0.6, peak);
    if (!g) return;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuf; src.loop = true;
    const f = this.ctx.createBiquadFilter();
    f.type = type; f.frequency.value = freq; f.Q.value = q;
    src.connect(f); f.connect(g);
    src.start(); src.stop(this.ctx.currentTime + dur + 0.3);
  }
  private tone(freq: number, dur: number, type: OscillatorType, peak = 0.3, slide = 0): void {
    if (!this.ctx) return;
    const g = this.env(dur, 0.008, dur * 0.5, peak);
    if (!g) return;
    const o = this.ctx.createOscillator();
    o.type = type; o.frequency.value = freq;
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, freq + slide), this.ctx.currentTime + dur);
    o.connect(g); o.start(); o.stop(this.ctx.currentTime + dur + 0.3);
  }
  /** Karplus-Strong plucked string — the lute voice of Emberfall. */
  pluck(freq: number, dur = 1.6, peak = 0.25, dest?: AudioNode): void {
    if (!this.ctx) return;
    const sr = this.ctx.sampleRate;
    const n = Math.floor(sr * dur);
    const buf = this.ctx.createBuffer(1, n, sr);
    const d = buf.getChannelData(0);
    const p = Math.max(2, Math.round(sr / freq));
    for (let i = 0; i < p; i++) d[i] = (Math.random() * 2 - 1) * 0.9;
    for (let i = p; i < n; i++) d[i] = 0.994 * 0.5 * (d[i - p] + d[i - p - 1]);
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const g = this.ctx.createGain();
    g.gain.value = peak;
    src.connect(g); g.connect(dest || this.musicG!);
    src.start();
  }

  // ---------- SFX vocabulary ----------
  step(surface: string, sprint: boolean): void {
    const base = surface === "stone" ? 240 : surface === "wood" ? 180 : surface === "sand" ? 420 : 320;
    this.noiseBurst(0.07, base + Math.random() * 80, 1.2, sprint ? 0.3 : 0.2);
    if (surface === "stone") this.tone(90 + Math.random() * 30, 0.05, "triangle", 0.1);
  }
  dig(): void { this.noiseBurst(0.06, 500 + Math.random() * 300, 1.5, 0.25); this.tone(70, 0.05, "square", 0.06); }
  breakBlock(mat: string): void {
    const f = mat === "stone" ? 300 : mat === "wood" ? 240 : mat === "metal" ? 900 : 400;
    this.noiseBurst(0.18, f, 1, 0.5);
    this.noiseBurst(0.3, f * 0.5, 0.8, 0.3, "lowpass");
  }
  place(): void { this.tone(120, 0.08, "sine", 0.3, -40); this.noiseBurst(0.06, 300, 1, 0.2); }
  swing(): void { this.noiseBurst(0.14, 900, 0.7, 0.18); }
  hitMob(crit: boolean): void {
    this.noiseBurst(0.09, 220, 1, crit ? 0.55 : 0.4);
    this.tone(crit ? 160 : 110, 0.1, "sawtooth", crit ? 0.3 : 0.2, -50);
  }
  hurt(): void { this.tone(140, 0.25, "sawtooth", 0.35, -70); this.noiseBurst(0.2, 200, 0.8, 0.3); }
  parry(perfect: boolean): void {
    this.tone(perfect ? 1400 : 900, 0.25, "square", perfect ? 0.35 : 0.22, -300);
    this.tone(perfect ? 2100 : 1200, 0.4, "sine", perfect ? 0.25 : 0.12, -200);
    this.noiseBurst(0.08, 3000, 2, 0.3, "highpass");
  }
  shieldHit(): void { this.tone(300, 0.12, "square", 0.25, -80); this.noiseBurst(0.1, 700, 1.5, 0.3); }
  eat(): void { for (let i = 0; i < 3; i++) setTimeout(() => this.noiseBurst(0.06, 500 + Math.random() * 400, 1, 0.3), i * 120); }
  drink(): void { this.tone(300, 0.1, "sine", 0.2, 120); setTimeout(() => this.tone(360, 0.12, "sine", 0.2, 100), 120); }
  uiClick(): void { this.tone(700, 0.05, "square", 0.12, -200); }
  uiOpen(): void { this.tone(240, 0.12, "triangle", 0.2, 60); }
  chestOpen(): void { this.tone(180, 0.25, "sawtooth", 0.15, 80); this.noiseBurst(0.3, 500, 0.7, 0.15); }
  doorCreak(): void { this.tone(120, 0.5, "sawtooth", 0.12, 60); this.tone(95, 0.55, "sawtooth", 0.1, -30); }
  levelup(): void {
    const notes = [392, 494, 587, 784];
    notes.forEach((f, i) => setTimeout(() => this.pluck(f, 1.2, 0.3, this.sfxG!), i * 130));
  }
  adv(): void { this.pluck(523, 1.0, 0.28, this.sfxG!); setTimeout(() => this.pluck(659, 1.2, 0.28, this.sfxG!), 140); }
  coin(): void { this.tone(1500, 0.12, "square", 0.15, 400); this.tone(2200, 0.2, "sine", 0.12, -300); }
  pickup(): void { this.tone(600, 0.08, "sine", 0.18, 300); }
  craft(): void { this.noiseBurst(0.1, 800, 1, 0.25); setTimeout(() => this.noiseBurst(0.12, 600, 1, 0.25), 120); }
  smelt(): void { this.noiseBurst(0.4, 300, 0.6, 0.2, "lowpass"); }
  thunder(): void {
    this.noiseBurst(1.4, 90, 0.4, 0.7, "lowpass");
    setTimeout(() => this.noiseBurst(1.0, 60, 0.4, 0.5, "lowpass"), 200);
  }
  splash(): void { this.noiseBurst(0.3, 800, 0.6, 0.35); }
  howl(): void {
    if (!this.ctx) return;
    const g = this.env(1.4, 0.2, 0.5, 0.14);
    if (!g) return;
    const o = this.ctx.createOscillator();
    o.type = "sawtooth";
    const t = this.ctx.currentTime;
    o.frequency.setValueAtTime(220, t);
    o.frequency.linearRampToValueAtTime(392, t + 0.5);
    o.frequency.linearRampToValueAtTime(330, t + 1.2);
    const f = this.ctx.createBiquadFilter(); f.type = "lowpass"; f.frequency.value = 900;
    o.connect(f); f.connect(g); o.start(); o.stop(t + 1.8);
  }
  growl(): void { this.tone(90, 0.3, "sawtooth", 0.22, -20); this.noiseBurst(0.25, 180, 0.8, 0.2); }
  wightMoan(): void { this.tone(150, 0.9, "sawtooth", 0.12, -60); this.tone(153, 0.9, "sawtooth", 0.1, -55); }
  batScreech(): void { this.tone(1800, 0.15, "square", 0.08, -800); }
  bossRoar(): void {
    this.tone(70, 1.2, "sawtooth", 0.4, -25);
    this.noiseBurst(1.0, 150, 0.5, 0.5, "lowpass");
    setTimeout(() => this.tone(55, 1.0, "sawtooth", 0.35, -15), 250);
  }
  portal(): void { this.tone(200, 1.2, "sine", 0.25, 500); this.tone(300, 1.2, "sine", 0.2, 700); }
  sleep(): void { this.pluck(262, 1.5, 0.2, this.sfxG!); setTimeout(() => this.pluck(196, 2, 0.2, this.sfxG!), 300); }

  // ---------- ambience ----------
  update(dt: number, a: Ambience, tension: number): void {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const setG = (g: GainNode | null, v: number) => { if (g) g.gain.setTargetAtTime(v, t, 0.4); };
    setG(this.windG, a.wind * 0.16);
    setG(this.rainG, a.rain * 0.22);
    setG(this.waterG, a.underwater ? 0.5 : 0);
    this.ambT -= dt;
    if (this.ambT <= 0) {
      this.ambT = 1.5 + Math.random() * 3;
      if (a.cave && Math.random() < 0.6) {
        // dripping water
        setTimeout(() => { this.tone(900 + Math.random() * 700, 0.15, "sine", 0.07, -400); }, Math.random() * 800);
      }
      if (a.forest && !a.night && !a.rain && Math.random() < 0.5) {
        const f = 2200 + Math.random() * 1400;
        setTimeout(() => { this.tone(f, 0.08, "sine", 0.05, f * 0.2); setTimeout(() => this.tone(f * 1.1, 0.1, "sine", 0.04, -f * 0.1), 120); }, Math.random() * 600);
      }
      if (a.night && !a.rain && !a.cave && Math.random() < 0.6) {
        setTimeout(() => {
          for (let i = 0; i < 3; i++) setTimeout(() => this.tone(4200, 0.03, "sine", 0.025), i * 70);
        }, Math.random() * 800);
      }
      if (a.village && !a.night && Math.random() < 0.3) {
        setTimeout(() => this.tone(500 + Math.random() * 200, 0.15, "triangle", 0.04, -60), Math.random() * 500);
      }
      if (a.night && !a.cave && Math.random() < 0.08) this.howl();
      if (tension > 0 && Math.random() < 0.15) this.growl();
    }
  }

  /** Procedural medieval music — sparse lute phrases over a drone. */
  musicTick(dt: number, tension: number, night: boolean): void {
    if (!this.ctx) return;
    this.musicT -= dt;
    if (this.musicT > 0) return;
    this.musicT = tension > 0 ? 8 + Math.random() * 6 : 16 + Math.random() * 22;
    const scale = tension > 0 ? [146.8, 174.6, 196, 220, 261.6, 293.7] : [220, 261.63, 293.66, 329.63, 392, 440, 523.25];
    const notes = 4 + Math.floor(Math.random() * (tension > 0 ? 6 : 5));
    let t = 0.05;
    // drone
    if (this.ctx && (night || tension > 0 || Math.random() < 0.5)) {
      const g = this.ctx.createGain();
      const now = this.ctx.currentTime;
      g.gain.setValueAtTime(0.0001, now);
      g.gain.exponentialRampToValueAtTime(tension > 0 ? 0.06 : 0.045, now + 2);
      g.gain.exponentialRampToValueAtTime(0.0001, now + (tension > 0 ? 6 : 10));
      g.connect(this.musicG!);
      const o = this.ctx.createOscillator();
      o.type = "triangle"; o.frequency.value = tension > 0 ? 73.4 : 110;
      o.connect(g); o.start(now); o.stop(now + 11);
    }
    for (let i = 0; i < notes; i++) {
      const f = scale[Math.floor(Math.random() * scale.length)];
      setTimeout(() => this.pluck(f, 1.8, tension > 0 ? 0.16 : 0.14), t * 1000);
      if (Math.random() < 0.25) setTimeout(() => this.pluck(f / 2, 2.2, 0.1), (t + 0.06) * 1000);
      t += tension > 0 ? 0.22 + Math.random() * 0.2 : 0.45 + Math.random() * 0.75;
    }
  }
}
