import React, { useEffect, useRef } from "react";
import { G, useGame } from "./game/game";
import { HUD } from "./ui/hud";
import { Panels, DeathScreen } from "./ui/panels";
import { BootWizard, TitleMenu, CreateScreen, LoadingScreen } from "./ui/menus";

export default function App() {
  const { g } = useGame();
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (ref.current && !G.started) {
      G.started = true;
      G.attach(ref.current);
      G.notify();
    }
  }, []);

  const inWorld = g.screen === "play" || g.screen === "dead";

  return (
    <div className="fixed inset-0 bg-[#0d0a08] overflow-hidden">
      <canvas ref={ref} className="absolute inset-0" />
      {g.screen === "menu" && <TitleMenu />}
      {g.screen === "create" && <CreateScreen />}
      {g.screen === "loading" && <LoadingScreen />}
      {inWorld && <HUD />}
      {inWorld && g.panel && <Panels />}
      {g.screen === "dead" && <DeathScreen />}
      {(g.panel === "settings" || g.panel === "credits" || g.panel === "controls") && g.screen === "menu" && <Panels />}
      {!g.booted && g.screen !== "loading" && g.screen !== "play" && <BootWizard />}
    </div>
  );
}
