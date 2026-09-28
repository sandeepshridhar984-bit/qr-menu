"use client";

import { useEffect, useMemo, useRef, useState } from "react";

export const TEMPLATE_EFFECTS = [
  { id: "fade", label: "Fade" },
  { id: "slide", label: "Slide" },
  { id: "zoom", label: "Zoom" },
  { id: "flip", label: "Flip" },
  { id: "wipe", label: "Wipe" },
  { id: "spin", label: "Spin" },
  { id: "rise", label: "Rise" },
  { id: "blur", label: "Blur" },
];

export const SCENE_COLORS = ["#E8542B", "#E3A21A", "#6B7C4F", "#B23A48", "#8a5a2b", "#2E2420", "#4C6B8A", "#7A4E9E", "#3A7D63", "#C46A2E"];

// Plays a list of scenes in a phone-shaped frame:
//   scenes = [{ media, mediaType: "image"|"video"|"", caption, duration, transition }]
// A scene with no media shows a solid colour with its caption, exactly like
// the original template file does before any shot is added.
export default function TemplatePlayer({ scenes, width = 190, autoPlay = false, showControls = true }) {
  const [t, setT] = useState(0);
  const [playing, setPlaying] = useState(autoPlay);
  const tRef = useRef(0);
  const lastRef = useRef(null);
  const videoRefs = useRef({});

  const total = useMemo(() => scenes.reduce((sum, s) => sum + (Number(s.duration) || 1), 0), [scenes]);
  const starts = useMemo(() => {
    const out = [];
    let acc = 0;
    scenes.forEach((s) => { out.push(acc); acc += Number(s.duration) || 1; });
    return out;
  }, [scenes]);

  // Always land on a real scene if scenes were added/removed while paused.
  useEffect(() => {
    if (tRef.current >= total) { tRef.current = 0; setT(0); }
  }, [total]);

  useEffect(() => {
    if (!playing || total <= 0) return;
    let raf;
    lastRef.current = null;
    function loop(ts) {
      if (lastRef.current == null) lastRef.current = ts;
      const dt = (ts - lastRef.current) / 1000;
      lastRef.current = ts;
      tRef.current += dt;
      if (tRef.current >= total) tRef.current = 0;
      setT(tRef.current);
      raf = requestAnimationFrame(loop);
    }
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [playing, total]);

  let activeIdx = scenes.length - 1;
  for (let i = 0; i < scenes.length; i++) {
    if (t >= starts[i] && t < starts[i] + (Number(scenes[i].duration) || 1)) { activeIdx = i; break; }
  }

  // Clips play only while their scene is on screen.
  useEffect(() => {
    Object.entries(videoRefs.current).forEach(([key, el]) => {
      if (!el) return;
      const i = Number(key);
      if (i === activeIdx && playing) { el.play?.().catch(() => {}); }
      else { el.pause?.(); if (i !== activeIdx) { try { el.currentTime = 0; } catch {} } }
    });
  }, [activeIdx, playing]);

  const active = scenes[activeIdx];
  const mm = (n) => `0:${String(Math.floor(n)).padStart(2, "0")}`;

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="tp-phone" style={{ width }}>
        {scenes.map((s, i) => (
          <div key={i} className={`tp-scene tp-${s.transition || "fade"} ${i === activeIdx ? "tp-active" : ""}`}>
            <div className="absolute inset-0" style={{ background: SCENE_COLORS[i % SCENE_COLORS.length] }} />
            {s.media && s.mediaType === "video" && (
              <video
                ref={(el) => { videoRefs.current[i] = el; }}
                src={s.media}
                className="tp-media"
                muted
                loop
                playsInline
                preload="metadata"
              />
            )}
            {s.media && s.mediaType !== "video" && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={s.media} alt="" className="tp-media" />
            )}
          </div>
        ))}
        {active?.caption && (
          <div className="absolute bottom-0 inset-x-0 z-10 bg-gradient-to-t from-black/70 to-transparent px-3 pt-8 pb-3 text-center text-white text-[13px] font-semibold leading-snug">
            {active.caption}
          </div>
        )}
      </div>

      {showControls && (
        <>
          <div className="flex items-center gap-2.5 text-xs text-clay">
            <button
              type="button"
              onClick={() => setPlaying((p) => !p)}
              className="w-8 h-8 rounded-full bg-sprout text-white flex items-center justify-center text-sm"
              aria-label={playing ? "Pause preview" : "Play preview"}
            >
              {playing ? "❚❚" : "▶"}
            </button>
            <span>{mm(t)} / {mm(total)}</span>
          </div>
          <div className="flex gap-[3px] h-2" style={{ width }}>
            {scenes.map((s, i) => {
              const dur = Number(s.duration) || 1;
              const local = Math.min(Math.max((t - starts[i]) / dur, 0), 1);
              return (
                <div key={i} className="relative rounded overflow-hidden bg-ink/10" style={{ flexGrow: dur, flexBasis: 0 }}>
                  <div className="absolute inset-y-0 left-0 bg-sprout rounded" style={{ width: `${local * 100}%` }} />
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
