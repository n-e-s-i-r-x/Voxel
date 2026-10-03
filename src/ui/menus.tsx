import React, { useMemo, useState } from "react";
import { G, useGame, PRESETS } from "../game/game";

function Embers({ n = 26 }: { n?: number }) {
  const parts = useMemo(() => Array.from({ length: n }).map((_, i) => ({
    left: Math.random() * 100,
    size: 2 + Math.random() * 5,
    t: 7 + Math.random() * 14,
    d: Math.random() * 12,
    o: 0.3 + Math.random() * 0.6,
    dx: (Math.random() - 0.5) * 120,
    key: i,
  })), [n]);
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {parts.map(p => (
        <span key={p.key} className="ember-particle" style={{
          left: `${p.left}%`, width: p.size, height: p.size,
          ["--t" as any]: `${p.t}s`, ["--d" as any]: `${p.d}s`, ["--o" as any]: p.o, ["--dx" as any]: `${p.dx}px`,
        }} />
      ))}
    </div>
  );
}
function Sigil({ size = 90 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" style={{ filter: "drop-shadow(0 0 18px rgba(224,123,47,0.5))" }}>
      <circle cx="50" cy="50" r="46" fill="none" stroke="#8a6c34" strokeWidth="2.5" />
      <circle cx="50" cy="50" r="39" fill="none" stroke="#55452f" strokeWidth="1.2" />
      <path d="M50 18c8 12 20 18 20 34a20 20 0 1 1-40 0c0-16 12-22 20-34z" fill="none" stroke="#e07b2f" strokeWidth="3" />
      <path d="M50 34c4.5 7 10 10 10 18a10 10 0 1 1-20 0c0-8 5.5-11 10-18z" fill="#e07b2f" opacity="0.85">
        <animate attributeName="opacity" values="0.85;0.5;0.85" dur="2.2s" repeatCount="indefinite" />
      </path>
      <path d="M20 78h60M26 84h48" stroke="#8a6c34" strokeWidth="2" />
    </svg>
  );
}

// ---------------- first boot ----------------
export function BootWizard() {
  const { g } = useGame();
  const [step, setStep] = useState(0);
  const [name, setName] = useState("");
  const [seed, setSeed] = useState("");
  const [diff, setDiff] = useState(1);
  const [preset, setPreset] = useState("Balanced");
  const s = g.settings;
  const set = (patch: any) => { Object.assign(g.settings, patch); G.saveSettings(); G.notify(); };
  const steps = ["Welcome", "Platform", "Graphics", "Preferences", "New World"];
  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center overflow-hidden" style={{ background: "radial-gradient(120% 100% at 50% 0%, #241a12 0%, #14100c 55%, #0a0806 100%)" }}>
      <Embers n={30} />
      <div className="absolute inset-0 vignette" />
      <div className="relative w-[680px] max-w-[95vw] anim-fade-up" key={step}>
        <div className="flex items-center gap-3 mb-6">
          {steps.map((st, i) => (
            <React.Fragment key={st}>
              <div className={`flex items-center gap-2 ${i <= step ? "text-[#e3d3a8]" : "text-[#55452f]"}`}>
                <span className={`w-7 h-7 flex items-center justify-center border font-display text-[12px] font-bold ${i < step ? "bg-[#e07b2f] border-[#e07b2f] text-[#14100c]" : i === step ? "border-[#e07b2f] text-[#ff9a3c]" : "border-[#3a2f24]"}`}>{i + 1}</span>
                <span className="font-display text-[11px] tracking-[0.15em] uppercase hidden md:block">{st}</span>
              </div>
              {i < steps.length - 1 && <div className={`flex-1 h-px ${i < step ? "bg-[#8a6c34]" : "bg-[#2a2118]"}`} />}
            </React.Fragment>
          ))}
        </div>
        <div className="panel-iron notch p-7">
          {step === 0 && (
            <div className="text-center py-4">
              <div className="flex justify-center mb-4"><Sigil /></div>
              <h1 className="font-display text-[42px] font-black tracking-[0.22em] text-[#e3d3a8] title-glow">EMBERFALL</h1>
              <p className="text-[15px] text-[#a8915f] italic mt-2">An endless medieval wild. Cold nights, older tombs.</p>
              <div className="rule-gold my-5" />
              <p className="text-[13.5px] text-[#c9b584] leading-relaxed max-w-[440px] mx-auto">Before you wake on the shore of a world that has never been mapped, a short rite: choose how you will walk it, how it will look, and where you will bleed first.</p>
              <button className="btn btn-ember mt-6 !px-10 !py-3 !text-[15px]" onClick={() => setStep(1)}>Begin the Rite</button>
            </div>
          )}
          {step === 1 && (
            <div>
              <h2 className="font-display text-[20px] font-bold tracking-[0.15em] uppercase text-[#e3d3a8] mb-1">How do you walk?</h2>
              <p className="text-[13px] text-[#a8915f] mb-5">This decides your controls, HUD and defaults. You can change it later.</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {([
                  ["pc", "PC", "Keyboard & mouse", "Pointer-lock aiming, hotbar keys, rebinding, F3 debug."],
                  ["mobile", "MOBILE", "Touch", "Twin-stick touch controls, tap buttons, sized for thumbs."],
                ] as const).map(([k, big, sub, desc]) => (
                  <button key={k} onClick={() => { set({ platform: k }); }}
                    className={`text-left p-5 border transition-all ${s.platform === k ? "border-[#e07b2f] bg-[#e07b2f]/10 shadow-[0_0_25px_rgba(224,123,47,0.25)]" : "border-[#3a2f24] bg-black/20 hover:border-[#8a6c34]"}`}>
                    <div className="flex items-center gap-3 mb-2">
                      {k === "pc" ? (
                        <svg width="34" height="34" viewBox="0 0 34 34" fill="none" stroke={s.platform === k ? "#ff9a3c" : "#a8915f"} strokeWidth="1.8">
                          <rect x="3" y="7" width="28" height="13" rx="2" /><path d="M7 11h2M11 11h2M15 11h2M19 11h2M23 11h2M7 15h2M11 15h12M25 15h2M12 25h10M17 20v5" />
                        </svg>
                      ) : (
                        <svg width="34" height="34" viewBox="0 0 34 34" fill="none" stroke={s.platform === k ? "#ff9a3c" : "#a8915f"} strokeWidth="1.8">
                          <rect x="10" y="3" width="14" height="28" rx="3" /><circle cx="17" cy="26" r="1.6" /><path d="M14 7h6" />
                        </svg>
                      )}
                      <div>
                        <div className="font-display text-[22px] font-black tracking-[0.2em] text-[#e3d3a8]">{big}</div>
                        <div className="text-[12px] text-[#a8915f]">{sub}</div>
                      </div>
                    </div>
                    <p className="text-[12.5px] text-[#c9b584]">{desc}</p>
                  </button>
                ))}
              </div>
              <div className="flex justify-between mt-6">
                <button className="btn" onClick={() => setStep(0)}>Back</button>
                <button className="btn btn-ember" onClick={() => setStep(2)}>Continue</button>
              </div>
            </div>
          )}
          {step === 2 && (
            <div>
              <h2 className="font-display text-[20px] font-bold tracking-[0.15em] uppercase text-[#e3d3a8] mb-1">How finely drawn?</h2>
              <p className="text-[13px] text-[#a8915f] mb-5">Every preset changes real rendering: distance, fog, particles, water.</p>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {Object.entries(PRESETS).map(([pname, p]) => (
                  <button key={pname} onClick={() => { setPreset(pname); G.applyPreset(pname); }}
                    className={`p-4 border text-left transition-all ${preset === pname ? "border-[#e07b2f] bg-[#e07b2f]/10" : "border-[#3a2f24] bg-black/20 hover:border-[#8a6c34]"}`}>
                    <div className="font-display font-bold text-[15px] tracking-widest uppercase text-[#e3d3a8]">{pname}</div>
                    <div className="text-[11.5px] text-[#a8915f] mt-1">view {(p.renderDist ?? 6) * 16}m · particles {Math.round((p.particles ?? 1) * 100)}%</div>
                  </button>
                ))}
              </div>
              <div className="flex justify-between mt-6">
                <button className="btn" onClick={() => setStep(1)}>Back</button>
                <button className="btn btn-ember" onClick={() => setStep(3)}>Continue</button>
              </div>
            </div>
          )}
          {step === 3 && (
            <div>
              <h2 className="font-display text-[20px] font-bold tracking-[0.15em] uppercase text-[#e3d3a8] mb-4">Tune the senses</h2>
              <div className="flex flex-col gap-4">
                <PrefSlider label="Render distance" v={s.renderDist} min={2} max={14} set={(n) => set({ renderDist: n })} fmt={(n) => `${n * 16} m`} />
                <PrefSlider label="Master volume" v={s.volMaster} min={0} max={1} step={0.05} set={(n) => set({ volMaster: n })} fmt={(n) => `${Math.round(n * 100)}%`} />
                <PrefSlider label="Music" v={s.volMusic} min={0} max={1} step={0.05} set={(n) => set({ volMusic: n })} fmt={(n) => `${Math.round(n * 100)}%`} />
                <PrefSlider label={s.platform === "mobile" ? "Touch look sensitivity" : "Mouse sensitivity"} v={s.sens} min={0.2} max={3} step={0.05} set={(n) => set({ sens: n })} fmt={(n) => n.toFixed(2)} />
                <PrefSlider label="Field of view" v={s.fov} min={55} max={110} set={(n) => { set({ fov: n }); if (G.renderer) G.renderer.fov = n; }} fmt={(n) => `${n}°`} />
              </div>
              <div className="flex justify-between mt-6">
                <button className="btn" onClick={() => setStep(2)}>Back</button>
                <button className="btn btn-ember" onClick={() => setStep(4)}>Continue</button>
              </div>
            </div>
          )}
          {step === 4 && (
            <div>
              <h2 className="font-display text-[20px] font-bold tracking-[0.15em] uppercase text-[#e3d3a8] mb-1">Name your fate</h2>
              <p className="text-[13px] text-[#a8915f] mb-4">Forge a world now, or enter the title hall to manage worlds later.</p>
              <div className="flex flex-col gap-3">
                <div>
                  <label className="text-[12px] tracking-widest uppercase text-[#a8915f]">World name</label>
                  <input className="input-dark mt-1" value={name} onChange={(e) => setName(e.target.value)} placeholder="The Ashen Vale" maxLength={24} />
                </div>
                <div>
                  <label className="text-[12px] tracking-widest uppercase text-[#a8915f]">Seed (same seed = same world, forever)</label>
                  <div className="flex gap-2 mt-1">
                    <input className="input-dark" value={seed} onChange={(e) => setSeed(e.target.value)} placeholder="leave blank for fate's own number" />
                    <button className="btn btn-sm" title="Random seed" onClick={() => setSeed(String(Math.floor(Math.random() * 999999999)))}>Dice</button>
                  </div>
                </div>
                <div>
                  <label className="text-[12px] tracking-widest uppercase text-[#a8915f]">Difficulty</label>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-1">
                    {["Pilgrim", "Wanderer", "Adventurer", "Veteran"].map((d, i) => (
                      <button key={d} onClick={() => setDiff(i)} className={`p-2 border text-center ${diff === i ? "border-[#e07b2f] bg-[#e07b2f]/10" : "border-[#3a2f24] bg-black/20"}`}>
                        <div className="font-display text-[13px] font-bold tracking-wider text-[#e3d3a8] uppercase">{d}</div>
                        <div className="text-[10.5px] text-[#a8915f] mt-0.5">{["no hostile spawns", "gentler blows", "the intended trial", "grave danger"][i]}</div>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              <div className="flex justify-between mt-6">
                <button className="btn" onClick={() => setStep(3)}>Back</button>
                <div className="flex gap-2">
                  <button className="btn" onClick={() => { G.setBooted(); G.notify(); }}>Title Hall</button>
                  <button className="btn btn-ember !px-8" onClick={() => { G.setBooted(); G.newWorld(name, seed, diff); }}>Forge & Wake</button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
function PrefSlider({ label, v, min, max, step = 1, set, fmt }: { label: string; v: number; min: number; max: number; step?: number; set: (n: number) => void; fmt: (n: number) => string }) {
  return (
    <div className="flex items-center gap-4">
      <span className="text-[13px] text-[#c9b584] w-44">{label}</span>
      <input type="range" min={min} max={max} step={step} value={v} onChange={(e) => set(+e.target.value)} className="flex-1" />
      <span className="text-[13px] font-bold text-[#ff9a3c] w-16 text-right">{fmt(v)}</span>
    </div>
  );
}

// ---------------- title ----------------
export function TitleMenu() {
  const { g } = useGame();
  const worlds = g.worldList();
  const latest = worlds[0];
  return (
    <div className="absolute inset-0 z-30 overflow-hidden">
      <div className="absolute inset-0" style={{ background: "linear-gradient(90deg, rgba(10,8,6,0.92) 0%, rgba(10,8,6,0.55) 42%, rgba(10,8,6,0.15) 70%, rgba(10,8,6,0.4) 100%)" }} />
      <div className="absolute inset-0 vignette" />
      <Embers n={22} />
      <div className="relative h-full flex flex-col justify-center pl-[6vw] pr-[4vw] py-8 gap-6 md:flex-row md:items-center md:justify-between">
        <div className="max-w-[560px] anim-fade-up">
          <div className="flex items-center gap-4 mb-3">
            <Sigil size={72} />
            <div>
              <div className="font-display text-[13px] tracking-[0.5em] text-[#a8915f] uppercase">A Dark Medieval Survival</div>
              <h1 className="font-display text-[54px] md:text-[76px] font-black leading-[0.95] tracking-[0.08em] text-[#e3d3a8] title-glow">EMBER<span className="text-[#e07b2f]">FALL</span></h1>
            </div>
          </div>
          <div className="rule-gold max-w-[420px] mb-4" />
          <p className="text-[15px] text-[#c9b584] leading-relaxed max-w-[440px]">
            An infinite world of pinefells, mirefens and cragspines — seeded, endless, and indifferent.
            Raise a fire, wall a house, parry the wolf's lunge, and go down into the barrows where the old kings still hold court.
          </p>
          <div className="flex flex-wrap gap-x-5 gap-y-1 mt-4 text-[12px] text-[#8a7a55]">
            <span><b className="text-[#c9b584]">∞</b> procedural lands</span>
            <span><b className="text-[#c9b584]">2</b> realms</span>
            <span><b className="text-[#c9b584]">1</b> king to kill</span>
          </div>
        </div>
        <div className="w-[360px] max-w-[92vw] flex flex-col gap-2 anim-fade-up" style={{ animationDelay: "120ms" }}>
          {latest && (
            <button className="btn btn-ember !py-3.5 !text-[15px] text-left" onClick={() => G.loadWorld(latest.name)}>
              <span className="block">Continue — {latest.name}</span>
              <span className="block text-[11px] font-body normal-case tracking-normal opacity-80">Day {latest.day} · Level {latest.level}</span>
            </button>
          )}
          <button className="btn !py-3" onClick={() => { G.screen = "create"; G.notify(); }}>New Expedition</button>
          {worlds.length > (latest ? 1 : 0) && (
            <div className="panel-iron p-3 mt-1">
              <div className="font-display text-[11px] tracking-[0.25em] uppercase text-[#a8915f] mb-2">Hall of Worlds</div>
              <div className="flex flex-col gap-1.5 max-h-[180px] overflow-y-auto scroll-dark">
                {worlds.filter(w => w !== latest).map(w => (
                  <div key={w.name} className="flex items-center gap-2 group">
                    <button className="btn btn-sm flex-1 text-left truncate" onClick={() => G.loadWorld(w.name)}>{w.name}</button>
                    <button className="btn btn-sm btn-blood !px-2" title="Delete" onClick={() => G.deleteWorld(w.name)}>✕</button>
                  </div>
                ))}
              </div>
            </div>
          )}
          <div className="grid grid-cols-2 gap-2 mt-1">
            <button className="btn" onClick={() => { G.panel = "settings"; G.notify(); }}>Settings</button>
            <button className="btn" onClick={() => { G.panel = "credits"; G.notify(); }}>Credits</button>
          </div>
          <div className="text-[11px] text-[#6e5a3a] mt-2 leading-relaxed">
            {g.settings.platform === "pc"
              ? "WASD walk · mouse aim · LMB mine/attack · RMB use/block · E interact · I pack · C craft · Esc pause · F3 debug"
              : "Left stick walks · right side steers your gaze · buttons for blade, block and breath"}
          </div>
        </div>
      </div>
      <div className="absolute bottom-3 left-0 right-0 text-center text-[11px] text-[#55452f] tracking-[0.3em] font-display uppercase">Emberfall · world-seed engine v1 · every acre procedural</div>
    </div>
  );
}

// ---------------- create ----------------
export function CreateScreen() {
  const { g } = useGame();
  const [name, setName] = useState("");
  const [seed, setSeed] = useState("");
  const [diff, setDiff] = useState(1);
  return (
    <div className="absolute inset-0 z-30 flex items-center justify-center overflow-hidden">
      <div className="absolute inset-0" style={{ background: "linear-gradient(180deg, rgba(10,8,6,0.7), rgba(10,8,6,0.9))" }} />
      <Embers n={16} />
      <div className="panel-iron notch w-[520px] max-w-[94vw] p-7 relative anim-fade-up">
        <h2 className="font-display text-[24px] font-bold tracking-[0.15em] uppercase text-[#e3d3a8]">New Expedition</h2>
        <div className="rule-gold my-4" />
        <div className="flex flex-col gap-3.5">
          <div>
            <label className="text-[12px] tracking-widest uppercase text-[#a8915f]">World name</label>
            <input className="input-dark mt-1" value={name} onChange={(e) => setName(e.target.value)} placeholder="The Ashen Vale" maxLength={24} />
          </div>
          <div>
            <label className="text-[12px] tracking-widest uppercase text-[#a8915f]">Seed</label>
            <div className="flex gap-2 mt-1">
              <input className="input-dark" value={seed} onChange={(e) => setSeed(e.target.value)} placeholder="word or number — blank for fate" />
              <button className="btn btn-sm" onClick={() => setSeed(String(Math.floor(Math.random() * 999999999)))}>Dice</button>
            </div>
            <p className="text-[11px] text-[#6e5a3a] mt-1">The same seed always raises the same mountains.</p>
          </div>
          <div>
            <label className="text-[12px] tracking-widest uppercase text-[#a8915f]">Difficulty</label>
            <div className="grid grid-cols-4 gap-2 mt-1">
              {["Pilgrim", "Wanderer", "Adventurer", "Veteran"].map((d, i) => (
                <button key={d} onClick={() => setDiff(i)} className={`p-2 border text-center ${diff === i ? "border-[#e07b2f] bg-[#e07b2f]/10" : "border-[#3a2f24] bg-black/20"}`}>
                  <div className="font-display text-[12px] font-bold tracking-wider text-[#e3d3a8] uppercase">{d}</div>
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className="flex justify-between mt-6">
          <button className="btn" onClick={() => { G.screen = "menu"; G.notify(); }}>Back</button>
          <button className="btn btn-ember !px-8" onClick={() => G.newWorld(name, seed, diff)}>Forge World</button>
        </div>
      </div>
    </div>
  );
}

// ---------------- loading ----------------
const LOADING_FLAVOR = [
  "Carving riverbeds with a cold finger…",
  "Teaching wolves to hunger…",
  "Burying kings beneath their hills…",
  "Lighting lanterns in villages not yet named…",
  "Waking the wights, reluctantly…",
  "Counting every grain of every beach…",
  "Hanging the moon on its nail…",
];
export function LoadingScreen() {
  const { g } = useGame();
  const pct = Math.round(g.loadingProg * 100);
  return (
    <div className="absolute inset-0 z-40 flex items-center justify-center" style={{ background: "radial-gradient(100% 100% at 50% 40%, #1d1712, #0a0806)" }}>
      <Embers n={18} />
      <div className="text-center w-[420px] max-w-[88vw]">
        <div className="flex justify-center mb-5"><Sigil size={70} /></div>
        <div className="font-display text-[22px] font-bold tracking-[0.25em] uppercase text-[#e3d3a8]">{g.loadingMsg || "Raising the world"}</div>
        <div className="h-3 mt-5 bg-black border border-[#3a2f24] shadow-[0_0_0_1px_#000]">
          <div className="h-full transition-all duration-150" style={{ width: `${pct}%`, background: "linear-gradient(90deg, #96501a, #e07b2f)" }} />
        </div>
        <div className="flex justify-between text-[12px] text-[#a8915f] mt-1.5">
          <span className="italic">{LOADING_FLAVOR[Math.floor(g.loadingProg * LOADING_FLAVOR.length) % LOADING_FLAVOR.length]}</span>
          <span className="font-bold text-[#ff9a3c]">{pct}%</span>
        </div>
      </div>
    </div>
  );
}
