import { useEffect, useRef } from "react";
import { THEME } from "../theme";
import { SceneManager } from "../scene/SceneManager";

export function Canvas3D({ designState, activeStage }) {
  const mountRef = useRef(null);
  const smRef = useRef(null);
  const primary = designState?.primary;
  const foldProgress = Number(primary?.foldProgress ?? 0);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;
    const sm = new SceneManager();
    sm.init(mount);
    smRef.current = sm;
    return () => {
      sm.dispose();
      smRef.current = null;
    };
  }, []);

  useEffect(() => {
    const sm = smRef.current;
    if (!sm) return;
    sm.setActiveStage(activeStage);
    sm.rebuildPackaging({ designState, activeStage, foldProgress });
  }, [designState, designState?.primary, designState?.transitCarton, activeStage, foldProgress]);

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        background: THEME.canvasBg,
        minHeight: 0,
        zIndex: 0,
      }}
    >
      <div ref={mountRef} style={{ position: "absolute", inset: 0, minHeight: 0 }} />
      <div
        style={{
          position: "absolute",
          right: 10,
          bottom: 10,
          pointerEvents: "none",
          color: THEME.textTertiary,
          opacity: 0.4,
          fontSize: 9,
          fontFamily: THEME.fontMono,
        }}
      >
        HookePak v0.1.0
      </div>
    </div>
  );
}
