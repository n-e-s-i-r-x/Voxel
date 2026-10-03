import React, { useRef, useState } from "react";
import { G, useGame } from "../game/game";
import { iconFor, ITEMS, maxDur, stackName } from "../game/items";
import { B, BLOCKS } from "../game/blocks";

export function HUD() {
  const { g } = useGame();
  const p = g.player;
  const isTouch = g.settings.platform === "mobile";
  const boss = g.ents.boss && !g.ents.boss.dead ? g.ents.boss : null;
  const hearts = Math.ceil(p.maxhp / 2);
  // interact prompt
  let prompt = "";
  if (g.screen === "play" && !g.panel) {
    const mob = (g as any).aimMob?.call(g, 3.2);
    if (mob && (mob.persist || mob.type === "merchant")) prompt = `Speak with ${mob.name || mob.def.name}`;
    else {
      const hit = (g as any).aim?.call(g, 3.6);
      if (hit) {
        const bd = BLOCKS[hit.id];
        if (bd?.interact === "chest") prompt = "Open chest";
        else if (bd?.interact === "barrel") prompt = "Open barrel";
        else if (bd?.interact === "furnace") prompt = "Use furnace";
        else if (bd?.interact === "table") prompt = "Workbench";
        else if (bd?.interact === "bed") prompt = "Sleep";
        else if (bd?.interact === "door") prompt = "Door";
        else if (bd?.interact === "board") prompt = "Read quest board";
        else if (bd?.interact === "portal") prompt = "Enter the Green Gate";
      }
    }
  }
  const yawDeg = ((p.yaw * 180 / Math.PI) % 360 + 360) % 360;
  const biome = g.world ? g.world.biomeName(Math.floor(p.x), Math.floor(p.z)) : "";
  const lowHp = p.hp < p.maxhp * 0.3;
  return (
    <div className="absolute inset-0 pointer-events-none select-none" style={{ fontFamily: "var(--font-body)" }}>
      {/* damage / effects overlays */}
      {g.hurtT > 0 && <div className="absolute inset-0 vignette-red" style={{ opacity: g.hurtT * 2, animation: "hitFlash 0.45s ease-out both" }} />}
      <div className={`absolute inset-0 vignette transition-opacity duration-700 ${lowHp ? "opacity-100" : "opacity-40"}`} />
      {p.eyeUnder && <div className="absolute inset-0" style={{ background: "rgba(16,48,66,0.45)" }} />}
      {g.lightning > 0 && <div className="absolute inset-0" style={{ background: `rgba(235,240,255,${g.lightning * 0.5})` }} />}
      {g.huntersMoon && <div className="absolute inset-0" style={{ background: "rgba(150,30,15,0.12)" }} />}
      {g.sleepFade > 0 && <div className="absolute inset-0 bg-black transition-opacity" style={{ opacity: Math.min(1, g.sleepFade / 0.8) }} />}
      {p.chill > 0 && <div className="absolute inset-0" style={{ boxShadow: "inset 0 0 90px 20px rgba(120,180,220,0.35)" }} />}

      {/* crosshair */}
      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
        <svg width="22" height="22" viewBox="0 0 22 22" opacity={g.recoil > 0 ? 1 : 0.85}>
          <g stroke={g.recoil > 0.3 ? "#ff9a3c" : "#e3d3a8"} strokeWidth="1.6" opacity="0.9">
            <line x1="11" y1="3" x2="11" y2="8" /><line x1="11" y1="14" x2="11" y2="19" />
            <line x1="3" y1="11" x2="8" y2="11" /><line x1="14" y1="11" x2="19" y2="11" />
          </g>
        </svg>
      </div>

      {/* compass */}
      <div className="absolute top-3 left-1/2 -translate-x-1/2 w-[260px] h-7 overflow-hidden opacity-80">
        <div className="absolute inset-0" style={{ background: "linear-gradient(90deg, transparent, rgba(13,10,8,0.6) 20%, rgba(13,10,8,0.6) 80%, transparent)" }} />
        <CompassStrip yaw={yawDeg} />
        <div className="absolute left-1/2 top-0 w-[2px] h-full bg-[#e07b2f]" />
      </div>

      {/* biome + coords */}
      <div className="absolute top-12 left-1/2 -translate-x-1/2 text-center">
        <div className="font-display text-[13px] tracking-[0.2em] text-[#c9b584] uppercase" style={{ textShadow: "0 1px 2px #000" }}>{biome}{g.world?.dim === 1 ? " · The Hollows" : ""}</div>
        {g.settings.showCoords && (
          <div className="text-[11px] text-[#a8915f] mt-0.5" style={{ textShadow: "0 1px 2px #000" }}>
            {Math.floor(p.x)} / {Math.floor(p.y)} / {Math.floor(p.z)} · Day {g.day} · {clockStr(g.time)}
          </div>
        )}
      </div>

      {/* boss bar */}
      {boss && (
        <div className="absolute top-[86px] left-1/2 -translate-x-1/2 w-[420px] max-w-[80vw]">
          <div className="font-display text-center text-[13px] tracking-[0.25em] text-[#e3d3a8] mb-1" style={{ textShadow: "0 0 8px rgba(224,123,47,0.6), 0 1px 2px #000" }}>THE BARROW KING</div>
          <div className="h-3 bg-black/70 border border-[#3a2f24] shadow-[0_0_0_1px_#000]">
            <div className="h-full transition-all duration-200" style={{ width: `${(boss.hp / boss.maxhp) * 100}%`, background: "linear-gradient(180deg, #b03a26, #6e1f12)" }} />
          </div>
        </div>
      )}

      {/* toasts */}
      <div className="absolute top-16 right-3 flex flex-col gap-2 w-[300px] max-w-[70vw]">
        {g.toasts.map(t => (
          <div key={t.id} className="anim-toast panel-iron px-3 py-2 text-[13px] leading-snug"
            style={{
              color: t.kind === "danger" ? "#e8a08a" : t.kind === "quest" ? "#d4a63f" : t.kind === "adv" ? "#a8c47a" : t.kind === "level" ? "#ff9a3c" : t.kind === "crit" ? "#ff9a3c" : "#e3d3a8",
              borderLeft: `3px solid ${t.kind === "danger" ? "#96301f" : t.kind === "quest" ? "#d4a63f" : t.kind === "adv" ? "#7a8450" : "#e07b2f"}`,
            }}>
            {t.kind === "adv" && <span className="font-display text-[10px] tracking-[0.2em] text-[#a8915f] block">ADVANCEMENT</span>}
            {t.kind === "quest" && <span className="font-display text-[10px] tracking-[0.2em] text-[#a8915f] block">QUEST</span>}
            {t.text}
          </div>
        ))}
      </div>

      {/* status effects */}
      <div className="absolute bottom-[128px] left-1/2 -translate-x-1/2 flex gap-2">
        {p.bleed > 0 && <StatusIcon color="#96301f" label="Bleeding" d="M12 2c3 4 7 8.5 7 12a7 7 0 1 1-14 0c0-3.5 4-8 7-12z" />}
        {p.chill > 0 && <StatusIcon color="#7ab0d4" label="Chilled" d="M12 2v20M4 6l16 12M20 6L4 18M12 7l-3-3M12 7l3-3M12 17l-3 3M12 17l3 3" />}
        {p.wet > 0.5 && <StatusIcon color="#5a8aa8" label="Wet" d="M12 3c4 5 7 8.5 7 12a7 7 0 1 1-14 0c0-3.5 3-7 7-12z" />}
        {p.temp < 0.18 && <StatusIcon color="#8ac4e8" label="Freezing" d="M12 2v20M5 5l14 14M19 5L5 19" />}
        {p.temp > 0.85 && <StatusIcon color="#e07b2f" label="Sweltering" d="M12 3a5 5 0 0 1 5 5c0 3-2 4-2 7H9c0-3-2-4-2-7a5 5 0 0 1 5-5zM9 18h6M10 21h4" />}
      </div>

      {/* interact prompt */}
      {prompt && !isTouch && (
        <div className="absolute bottom-[150px] left-1/2 -translate-x-1/2 anim-fade flex items-center gap-2 text-[14px] text-[#e3d3a8]" style={{ textShadow: "0 1px 3px #000" }}>
          <span className="key-cap">E</span> {prompt}
        </div>
      )}

      {/* bars + hotbar */}
      <div className={`absolute bottom-2 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1.5 ${isTouch ? "mb-24" : ""}`} style={{ zIndex: 20 }}>
        {/* xp */}
        <div className="w-[380px] max-w-[78vw] h-[7px] bg-black/60 border border-[#3a2f24] relative">
          <div className="h-full" style={{ width: `${(p.xp / g.xpNeed(p.level)) * 100}%`, background: "linear-gradient(90deg, #7a8450, #a8c47a)" }} />
          <div className="absolute -top-[7px] left-1/2 -translate-x-1/2 font-display text-[11px] font-bold text-[#c9b584] px-1.5 bg-[#14100c] border border-[#3a2f24]" style={{ textShadow: "0 1px 0 #000" }}>
            {p.level}{p.pts > 0 && <span className="text-[#ff9a3c]"> · {p.pts} pts</span>}
          </div>
        </div>
        {/* hearts & hunger */}
        <div className="flex justify-between w-[380px] max-w-[78vw]">
          <div className="flex flex-wrap gap-[1px] max-w-[48%] justify-start">
            {Array.from({ length: hearts }).map((_, i) => {
              const fill = Math.max(0, Math.min(1, p.hp / 2 - i));
              return (
                <svg key={i} width="15" height="14" viewBox="0 0 24 22" style={{ filter: "drop-shadow(0 1px 1px #000)" }}>
                  <path d="M12 21C5 15 1 10.5 1 6.5A5.5 5.5 0 0 1 12 4a5.5 5.5 0 0 1 11 2.5c0 4-4 8.5-11 14.5z" fill="#241a12" stroke="#000" strokeWidth="1.4" />
                  {fill > 0 && <path d="M12 21C5 15 1 10.5 1 6.5A5.5 5.5 0 0 1 12 4a5.5 5.5 0 0 1 11 2.5c0 4-4 8.5-11 14.5z" fill={lowHp ? "#b03a26" : "#96301f"} stroke="none" opacity={fill >= 1 ? 1 : 0.5} style={lowHp ? { animation: "barPulse 0.8s infinite" } : undefined} />}
                </svg>
              );
            })}
          </div>
          <div className="flex flex-wrap gap-[1px] max-w-[48%] justify-end">
            {Array.from({ length: 10 }).map((_, i) => {
              const fill = Math.max(0, Math.min(1, p.hunger / 2 - i));
              return (
                <svg key={i} width="15" height="14" viewBox="0 0 24 22" style={{ filter: "drop-shadow(0 1px 1px #000)" }}>
                  <path d="M15 2a6 6 0 0 1 6 6c0 4-4 6-8 6l-6 6-3-3 6-6c0-4 2-9 5-9z" fill="#241a12" stroke="#000" strokeWidth="1.4" />
                  {fill > 0 && <path d="M15 2a6 6 0 0 1 6 6c0 4-4 6-8 6l-6 6-3-3 6-6c0-4 2-9 5-9z" fill="#a8703a" opacity={fill >= 1 ? 1 : 0.5} />}
                </svg>
              );
            })}
          </div>
        </div>
        {/* stamina */}
        <div className="w-[380px] max-w-[78vw] h-[6px] bg-black/60 border border-[#3a2f24]">
          <div className="h-full transition-all duration-150" style={{ width: `${(p.stamina / p.maxStamina) * 100}%`, background: p.stamina < 20 ? "linear-gradient(90deg,#96301f,#b03a26)" : "linear-gradient(90deg,#8a6c34,#d4a63f)" }} />
        </div>
        {/* hotbar */}
        <div className="flex gap-1 mt-0.5 pointer-events-auto">
          {p.inv.slice(0, 9).map((s, i) => (
            <div key={i} className={`slot !w-[46px] !h-[46px] ${i === p.sel ? "sel" : ""}`} onClick={() => { G.player.sel = i; G.notify(); }}>
              {s && <img src={iconFor(s.id)} alt="" />}
              {s && s.n > 1 && <span className="cnt">{s.n}</span>}
              {s && maxDur(s.id) > 0 && s.dur !== undefined && <span className="dur"><i style={{ width: `${(s.dur / maxDur(s.id)) * 100}%` }} /></span>}
              <span className="absolute left-1 top-0 text-[9px] text-[#6e5a3a] font-bold">{i + 1}</span>
            </div>
          ))}
        </div>
        {/* air meter */}
        {p.air < 9.5 && (
          <div className="w-[200px] h-[5px] bg-black/60 border border-[#3a2f24]">
            <div className="h-full" style={{ width: `${(p.air / 10) * 100}%`, background: "#5a8aa8" }} />
          </div>
        )}
      </div>

      {/* mining progress */}
      {(g as any).mineProg > 0.02 && (
        <div className="absolute left-1/2 top-[58%] -translate-x-1/2 w-16 h-[5px] bg-black/60 border border-[#3a2f24]">
          <div className="h-full bg-[#e07b2f]" style={{ width: `${Math.min(100, (g as any).mineProg * 100)}%` }} />
        </div>
      )}

      {/* top-left quick info */}
      <div className="absolute top-3 left-3 flex flex-col gap-1 text-[12px] text-[#c9b584]" style={{ textShadow: "0 1px 2px #000" }}>
        <div className="flex items-center gap-1.5">
          <CoinIcon /> <span className="font-bold">{p.coins}</span>
        </div>
        {g.weather.type !== "clear" && (
          <div className="text-[11px] text-[#8a9ab0]">{g.weather.type === "rain" ? "Rain" : g.weather.type === "storm" ? "Storm" : "Snowfall"}</div>
        )}
      </div>

      {/* top-right buttons */}
      <div className="absolute top-3 right-3 flex gap-1.5 pointer-events-auto" style={{ zIndex: 30 }}>
        <IconBtn onClick={() => G.openPanel("quests")} label="Quests" />
        <IconBtn onClick={() => G.openPanel("inv")} label="Pack" />
        <IconBtn onClick={() => G.openPanel("pause")} label="Menu" />
      </div>

      {/* debug */}
      {g.debug && <DebugPanel />}
      {isTouch && g.screen === "play" && !g.panel && <TouchControls />}
    </div>
  );
}

function clockStr(t: number): string {
  const mins = Math.floor(t * 24 * 60);
  const h = Math.floor(mins / 60), m = mins % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}
function StatusIcon({ color, label, d }: { color: string; label: string; d: string }) {
  return (
    <div className="flex items-center gap-1 bg-black/50 border border-[#3a2f24] px-1.5 py-0.5">
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.4"><path d={d} /></svg>
      <span className="text-[11px]" style={{ color }}>{label}</span>
    </div>
  );
}
function CoinIcon() {
  return <svg width="14" height="14" viewBox="0 0 14 14"><circle cx="7" cy="7" r="6" fill="#d4a63f" stroke="#8a6c34" strokeWidth="1.4" /><circle cx="7" cy="7" r="3" fill="none" stroke="#8a6c34" strokeWidth="1" /></svg>;
}
function IconBtn({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button className="btn btn-sm !px-2.5 !py-1.5 !text-[11px]" onClick={onClick}>{label}</button>
  );
}
function CompassStrip({ yaw }: { yaw: number }) {
  const dirs = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
  const items: { a: number; label: string; major: boolean }[] = [];
  for (let i = 0; i < 8; i++) items.push({ a: i * 45, label: dirs[i], major: i % 2 === 0 });
  for (let i = 0; i < 24; i++) if (i % 3 !== 0) items.push({ a: i * 15, label: "", major: false });
  const wrap = (a: number) => { let d = a - yaw; while (d > 180) d -= 360; while (d < -180) d += 360; return d; };
  return (
    <>
      {items.map((it, i) => {
        const d = wrap(it.a);
        if (Math.abs(d) > 70) return null;
        return (
          <div key={i} className="absolute top-0 h-full flex flex-col items-center justify-center" style={{ left: `calc(50% + ${d * 1.7}px)`, transform: "translateX(-50%)" }}>
            {it.label ? (
              <span className={`font-display ${it.major ? "text-[13px] font-bold text-[#e3d3a8]" : "text-[11px] text-[#a8915f]"}`}>{it.label}</span>
            ) : (
              <span className="w-[1px] h-2 bg-[#6e5a3a]" />
            )}
          </div>
        );
      })}
    </>
  );
}
function DebugPanel() {
  const { g } = useGame();
  const p = g.player, w = g.world;
  const rows: [string, any][] = [
    ["FPS", `${g.fps} (${(1000 / Math.max(1, g.fps)).toFixed(1)}ms)`],
    ["Res scale", (g as any).resScale?.toFixed(2)],
    ["Position", `${p.x.toFixed(1)} / ${p.y.toFixed(1)} / ${p.z.toFixed(1)}`],
    ["Chunk", `${Math.floor(p.x) >> 4}, ${Math.floor(p.z) >> 4} (dim ${w?.dim})`],
    ["Biome", w?.biomeName(Math.floor(p.x), Math.floor(p.z))],
    ["Seed", w?.seed],
    ["Loaded chunks", w?.chunks.size],
    ["Dirty meshes", w?.dirty.size],
    ["Gen queue", w?.queueLen],
    ["Entities", `${g.ents.mobs.length} mobs / ${g.ents.items.length} items / ${g.ents.particles.length} parts`],
    ["Day/time", `${g.day} ${clockStr(g.time)}`],
    ["Weather", g.weather.type],
    ["Drawn", g.drawnChunks],
  ];
  return (
    <div className="absolute top-14 left-3 panel-iron p-2.5 text-[11px] font-mono leading-relaxed text-[#a8c47a]">
      {rows.map(([k, v]) => <div key={k}><span className="text-[#a8915f]">{k}:</span> {String(v)}</div>)}
    </div>
  );
}

// ---------------- touch controls ----------------
function TouchControls() {
  const { g } = useGame();
  const s = g.settings.touchScale;
  const o = g.settings.touchOpacity;
  const lefty = g.settings.touchLefty;
  const joyRef = useRef<HTMLDivElement>(null);
  const [knob, setKnob] = useState({ x: 0, y: 0 });
  const joyId = useRef<number | null>(null);
  const lookId = useRef<number | null>(null);
  const lookLast = useRef({ x: 0, y: 0 });
  const [sneakOn, setSneakOn] = useState(false);
  const [sprintOn, setSprintOn] = useState(false);

  const joyDown = (e: React.PointerEvent) => {
    joyId.current = e.pointerId;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    joyMove(e);
  };
  const joyMove = (e: React.PointerEvent) => {
    if (joyId.current !== e.pointerId || !joyRef.current) return;
    const r = joyRef.current.getBoundingClientRect();
    let dx = (e.clientX - (r.left + r.width / 2)) / (r.width / 2);
    let dy = (e.clientY - (r.top + r.height / 2)) / (r.height / 2);
    const l = Math.hypot(dx, dy);
    if (l > 1) { dx /= l; dy /= l; }
    setKnob({ x: dx, y: dy });
    G.setJoy(dx, dy);
  };
  const joyUp = (e: React.PointerEvent) => {
    if (joyId.current !== e.pointerId) return;
    joyId.current = null;
    setKnob({ x: 0, y: 0 });
    G.setJoy(0, 0);
  };
  const lookDown = (e: React.PointerEvent) => {
    if (lookId.current !== null) return;
    lookId.current = e.pointerId;
    lookLast.current = { x: e.clientX, y: e.clientY };
  };
  const lookMove = (e: React.PointerEvent) => {
    if (lookId.current !== e.pointerId) return;
    G.addLook(e.clientX - lookLast.current.x, e.clientY - lookLast.current.y);
    lookLast.current = { x: e.clientX, y: e.clientY };
  };
  const lookUp = (e: React.PointerEvent) => { if (lookId.current === e.pointerId) lookId.current = null; };

  const btn = (name: string, label: string, style: React.CSSProperties, size = 58, hold = true) => (
    <div
      className="tbtn"
      style={{ width: size * s, height: size * s, opacity: o, ...style, fontSize: 11 * s }}
      onPointerDown={(e) => { e.stopPropagation(); (e.target as HTMLElement).setPointerCapture(e.pointerId); if (hold) G.setBtn(name, true); else { G.setBtn(name, true); setTimeout(() => G.setBtn(name, false), 80); } }}
      onPointerUp={() => hold && G.setBtn(name, false)}
      onPointerCancel={() => hold && G.setBtn(name, false)}
    >{label}</div>
  );
  const joySide = lefty ? { right: 18 } : { left: 18 };
  const btnSide = lefty ? { left: 12 } : { right: 12 };
  return (
    <div className="absolute inset-0 pointer-events-none">
      {/* look area */}
      <div className="absolute inset-0 pointer-events-auto" style={{ zIndex: 1 }}
        onPointerDown={lookDown} onPointerMove={lookMove} onPointerUp={lookUp} onPointerCancel={lookUp} />
      {/* joystick */}
      <div ref={joyRef} className="joy-base pointer-events-auto" style={{ ...joySide, bottom: 26, width: 128 * s, height: 128 * s, opacity: o, zIndex: 2 }}
        onPointerDown={joyDown} onPointerMove={joyMove} onPointerUp={joyUp} onPointerCancel={joyUp}>
        <div className="joy-knob" style={{ width: 54 * s, height: 54 * s, left: `calc(50% + ${knob.x * 34 * s}px - ${27 * s}px)`, top: `calc(50% + ${knob.y * 34 * s}px - ${27 * s}px)` }} />
      </div>
      {/* action buttons */}
      <div style={{ zIndex: 2 }} className="pointer-events-none">
        {btn("attack", "ATK", { ...btnSide, bottom: 40 }, 72)}
        {btn("use", "Use", { ...btnSide, bottom: 40 + 84 * s }, 54)}
        {btn("jump", "Jmp", lefty ? { left: 12 + 70 * s, bottom: 118 * s } : { right: 12 + 70 * s, bottom: 118 * s }, 54, false)}
        {btn("interact", "Talk", lefty ? { left: 12 + 132 * s, bottom: 40 } : { right: 12 + 76 * s, bottom: 40 }, 54, false)}
        <div className="tbtn pointer-events-auto" style={{ ...btnSide, bottom: 40 + 158 * s, width: 46 * s, height: 46 * s, opacity: o, fontSize: 10 * s }}
          onPointerDown={(e) => { e.stopPropagation(); const v = !sneakOn; setSneakOn(v); G.setBtn("sneak", v); }}>
          <span className={sneakOn ? "text-[#ff9a3c]" : ""}>Snk</span>
        </div>
        <div className="tbtn pointer-events-auto" style={{ ...btnSide, bottom: 40 + 214 * s, width: 46 * s, height: 46 * s, opacity: o, fontSize: 10 * s }}
          onPointerDown={(e) => { e.stopPropagation(); const v = !sprintOn; setSprintOn(v); G.setBtn("sprint", v); }}>
          <span className={sprintOn ? "text-[#ff9a3c]" : ""}>Run</span>
        </div>
        <div className="tbtn pointer-events-auto" style={{ left: "50%", transform: "translateX(-50%)", bottom: 130, width: 52 * s, height: 52 * s, opacity: o, fontSize: 10 * s, display: G.ents.mobs.some(m => m.aggroed && m.def.hostile && Math.hypot(m.x - G.player.x, m.z - G.player.z) < 16) ? "flex" : "none" }}
          onPointerDown={(e) => { e.stopPropagation(); G.setBtn("block", true); }}
          onPointerUp={() => G.setBtn("block", false)}>
          Blk
        </div>
      </div>
    </div>
  );
}
