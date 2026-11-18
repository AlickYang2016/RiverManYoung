import { useCallback, useEffect, useRef, useState } from "react";
import type { LandmarkId, Operator } from "../data/types";
import { LANDMARKS } from "../content";
import type { OsakaHandle, OsakaMode, ServiceInfo, Stats, TrainStatus } from "../engine";
import preview from "./preview.jpg";

const PREVIEW_ALT = "The Osaka-Umeda miniature on its base, seen from the south-east: JR Osaka Station's glass roof in the middle, the Hankyu terminal's nine tracks to the right, HEP FIVE's red wheel, the Umeda Sky Building at the back left.";

/*
 * The page round the miniature, in the folio's morning-light manner (docs/ART-DIRECTION.md): words in the shade on the left, set
 * like a book's front matter — the title, a 目次 of landmarks, the caption of the one chosen — and the controls as printed words
 * on one bottom line, no containers. The 3D is code-split: this shell paints first, the engine and three.js load behind it.
 *
 * Every control does what it says: day / night, play / pause, speed, which railway's trains are shown, follow a train, reset,
 * full screen, the opening again. Keys: N night, Space trains, R reset, F full screen, 1–7 landmarks, Esc back.
 */

type Phase = { kind: "loading"; p: number; what: string } | { kind: "ready" } | { kind: "fallback"; why: string };

const SPEEDS = [0.5, 1, 2, 4] as const;
const speedLabel = (s: number) => (s === 0.5 ? "½×" : `${s}×`);
const clock = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
const trainWhen = (t: TrainStatus | undefined) => (!t ? "" : t.onBase ? "on the model now" : t.nextIn === 0 ? "at the edge of the model" : `next in ${clock(t.nextIn)}`);

export function OsakaApp({ mode, debug, skipIntro, initial, night: startNight }: { mode: OsakaMode; debug: boolean; skipIntro: boolean; initial: string | null; night: boolean }) {
  const stage = useRef<HTMLDivElement>(null);
  const label = useRef<HTMLDivElement>(null);
  const engine = useRef<OsakaHandle | null>(null);
  const [phase, setPhase] = useState<Phase>({ kind: "loading", p: 0, what: "" });
  const [selected, setSelected] = useState<LandmarkId | null>(null);
  const [night, setNight] = useState(startNight);
  const [playing, setPlaying] = useState(true);
  const [speed, setSpeed] = useState(1);
  const [ops, setOps] = useState<Record<Operator, boolean>>({ jr: true, hankyu: true });
  const [services, setServices] = useState<ServiceInfo[]>([]);
  const [following, setFollowing] = useState<number | null>(null);
  const [underground, setUnderground] = useState(false);
  const [menu, setMenu] = useState(false);
  const [status, setStatus] = useState<TrainStatus[]>([]);
  const [intro, setIntro] = useState(false);
  const [about, setAbout] = useState(false);
  const [stats, setStats] = useState<Stats | null>(null);
  const undergroundRef = useRef(false);
  undergroundRef.current = underground;
  const reduced = typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;

  useEffect(() => {
    const host = stage.current;
    if (!host) return;
    let cancelled = false;
    let handle: OsakaHandle | null = null;
    void import("../engine")
      .then(async ({ createOsaka, webglAvailable }) => {
        if (!webglAvailable()) throw new Error("This browser cannot draw WebGL 2, which the miniature needs.");
        const h = await createOsaka(host, {
          mode,
          reducedMotion: reduced,
          intro: mode === "explore" && !skipIntro,
          onProgress: (p, what) => !cancelled && setPhase({ kind: "loading", p, what }),
          onSelect: (id) => setSelected(id),
          onLabel: (x, y, vis) => {
            const el = label.current;
            if (!el) return;
            el.style.transform = `translate3d(${Math.round(x)}px, ${Math.round(y)}px, 0)`;
            el.style.opacity = vis ? "1" : "0";
          },
          onStats: debug ? (s) => setStats(s) : undefined,
          onIntroEnd: () => setIntro(false),
          onUnderground: (on) => setUnderground(on),
        });
        if (cancelled) {
          h.dispose();
          return;
        }
        handle = h;
        engine.current = h;
        setServices(h.services);
        setPlaying(!reduced || mode === "showcase");
        if (startNight) h.setNight(true);
        setPhase({ kind: "ready" });
        (window as unknown as { __osaka?: OsakaHandle }).__osaka = h;
        if (initial && LANDMARKS.some((l) => l.id === initial)) h.focus(initial as LandmarkId);
        else if (mode === "explore" && !skipIntro && !reduced) {
          setIntro(true);
          void h.playIntro();
        }
      })
      .catch((err: unknown) => {
        console.error("[osaka]", err);
        if (!cancelled) setPhase({ kind: "fallback", why: err instanceof Error ? err.message : String(err) });
      });
    return () => {
      cancelled = true;
      handle?.dispose();
      engine.current = null;
    };
  }, [mode, debug, skipIntro, initial, reduced, startNight]);

  const toggleNight = useCallback(() => {
    setNight((n) => {
      engine.current?.setNight(!n);
      return !n;
    });
  }, []);
  const togglePlay = useCallback(() => {
    setPlaying((p) => {
      engine.current?.setPlaying(!p);
      return !p;
    });
  }, []);
  const choose = useCallback((id: LandmarkId | null) => {
    setFollowing(null);
    setMenu(false);
    engine.current?.focus(id);
  }, []);
  const reset = useCallback(() => {
    setFollowing(null);
    engine.current?.resetView();
  }, []);
  const fullscreen = useCallback(() => {
    const el = document.documentElement;
    if (document.fullscreenElement) void document.exitFullscreen();
    else void el.requestFullscreen?.().catch(() => {});
  }, []);
  const follow = useCallback((i: number | null) => {
    setFollowing(i);
    setMenu(false);
    engine.current?.follow(i);
  }, []);

  // while the follow menu is open, say which trains are on the base and when the others come
  useEffect(() => {
    if (!menu) return;
    const tick = () => setStatus(engine.current?.trains() ?? []);
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [menu]);

  useEffect(() => {
    if (mode !== "explore") return;
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === "n" || e.key === "N") toggleNight();
      else if (e.key === " ") {
        e.preventDefault();
        togglePlay();
      } else if (e.key === "r" || e.key === "R") reset();
      else if (e.key === "f" || e.key === "F") fullscreen();
      else if (e.key === "u" || e.key === "U") engine.current?.setUnderground(!undergroundRef.current);
      else if (e.key === "Escape") {
        if (about) setAbout(false);
        else if (following !== null) follow(null);
        else choose(null);
      } else if (/^[1-7]$/.test(e.key)) choose(LANDMARKS[Number(e.key) - 1]!.id);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [mode, toggleNight, togglePlay, reset, fullscreen, choose, follow, following, about]);

  const info = LANDMARKS.find((l) => l.id === selected) ?? null;
  const ready = phase.kind === "ready";

  if (mode === "showcase") {
    return (
      <div className="osaka osaka--showcase" data-ready={ready || undefined}>
        <div className="osaka-stage" ref={stage} />
        <a className="osaka-showcase-cap" href="./" target="_top">
          <span className="osaka-showcase-title">Osaka Umeda</span>
          <span className="osaka-showcase-sub">A miniature railway city in motion — explore</span>
        </a>
        {phase.kind === "loading" && <div className="osaka-dawn" style={{ ["--p" as string]: phase.p }} />}
        {phase.kind === "fallback" && <img className="osaka-still" src={preview} alt={PREVIEW_ALT} />}
      </div>
    );
  }

  return (
    <div className="osaka" data-night={night || undefined} data-ready={ready || undefined}>
      <div className="osaka-stage" ref={stage} />

      <header className="osaka-head">
        <a className="osaka-back" href="../../">Alexis Yang · Folio</a>
        <h1>Osaka Umeda</h1>
        <p className="osaka-sub">A miniature railway city in motion</p>
        <p className="osaka-ja" lang="ja">大阪・梅田 — 動く鉄道模型の街</p>
      </header>

      {phase.kind !== "fallback" && (
        <nav className="osaka-index" aria-label="Landmarks">
          <p className="osaka-eyebrow">目次 · Landmarks</p>
          <ol>
            {LANDMARKS.map((l, i) => (
              <li key={l.id}>
                <button type="button" aria-pressed={selected === l.id} onClick={() => choose(selected === l.id ? null : l.id)} disabled={!ready}>
                  <span className="osaka-n">{String(i + 1).padStart(2, "0")}</span>
                  <span className="osaka-name">{l.name}</span>
                  <span className="osaka-name-ja" lang="ja">{l.nameJa}</span>
                </button>
              </li>
            ))}
          </ol>
        </nav>
      )}

      <section className="osaka-caption" aria-live="polite">
        {info && (
          <>
            <p className="osaka-eyebrow">{info.kind}</p>
            <h2>
              {info.name} <span lang="ja">{info.nameJa}</span>
            </h2>
            <p>{info.blurb}</p>
            <ul>
              {info.facts.map((f) => (
                <li key={f}>{f}</li>
              ))}
            </ul>
            <button type="button" className="osaka-word" onClick={() => choose(null)}>
              Back to the whole district
            </button>
          </>
        )}
        {!info && following !== null && services[following] && (
          <>
            <p className="osaka-eyebrow">Following</p>
            <h2>
              {services[following]!.label} <span lang="ja">{services[following]!.labelJa}</span>
            </h2>
            <p>
              {services[following]!.stock}, {services[following]!.cars} cars. When it leaves the model at the edge of the base, the
              camera waits for the next one.
            </p>
            <button type="button" className="osaka-word" onClick={() => follow(null)}>
              Stop following
            </button>
          </>
        )}
      </section>

      <div className="osaka-label" ref={label} aria-hidden="true">
        {info && (
          <span>
            {info.name}
            <i lang="ja">{info.nameJa}</i>
          </span>
        )}
      </div>

      {phase.kind !== "fallback" && (
        <div className="osaka-hands" role="toolbar" aria-label="Controls">
          <span className="osaka-group" aria-label="Time of day">
            <button type="button" className="osaka-word" aria-pressed={!night} onClick={() => night && toggleNight()} disabled={!ready}>
              Day
            </button>
            <button type="button" className="osaka-word" aria-pressed={night} onClick={() => !night && toggleNight()} disabled={!ready}>
              Night
            </button>
          </span>
          <span className="osaka-group" aria-label="Trains">
            <button type="button" className="osaka-word" onClick={togglePlay} disabled={!ready}>
              {playing ? "Pause trains" : "Run trains"}
            </button>
            {SPEEDS.map((s) => (
              <button key={s} type="button" className="osaka-word osaka-speed" aria-pressed={speed === s} aria-label={`Speed ${s} times`} disabled={!ready} onClick={() => (setSpeed(s), engine.current?.setSpeed(s))}>
                {speedLabel(s)}
              </button>
            ))}
          </span>
          <span className="osaka-group" aria-label="Show trains of">
            {(["jr", "hankyu"] as const).map((op) => (
              <button key={op} type="button" className={`osaka-word osaka-op osaka-op--${op}`} aria-pressed={ops[op]} disabled={!ready} onClick={() => setOps((o) => (engine.current?.setOperatorVisible(op, !o[op]), { ...o, [op]: !o[op] }))}>
                {op === "jr" ? "JR" : "Hankyu"}
              </button>
            ))}
          </span>
          <span className="osaka-group">
            <button type="button" className="osaka-word" aria-pressed={underground} disabled={!ready} title="See through the street to the Umekita line and its underground platforms 21–24" onClick={() => engine.current?.setUnderground(!underground)}>
              Underground
            </button>
          </span>
          <span className="osaka-group osaka-follow">
            <button type="button" className="osaka-word" aria-expanded={menu} disabled={!ready || !services.length} onClick={() => setMenu((x) => !x)}>
              {following === null ? "Follow a train" : "Following…"}
            </button>
            {menu && (
              <ul className="osaka-menu" role="menu">
                {services.map((s) => (
                  <li key={s.id} role="none">
                    <button type="button" role="menuitem" className={`osaka-op--${s.op}`} onClick={() => follow(s.index)}>
                      {s.label}
                      <i>
                        {s.stock} · {s.cars} cars · {trainWhen(status[s.index])}
                      </i>
                    </button>
                  </li>
                ))}
                {following !== null && (
                  <li role="none">
                    <button type="button" role="menuitem" onClick={() => follow(null)}>
                      Stop following
                    </button>
                  </li>
                )}
              </ul>
            )}
          </span>
          <span className="osaka-group">
            <button type="button" className="osaka-word" onClick={reset} disabled={!ready}>
              Reset view
            </button>
            {typeof document !== "undefined" && document.fullscreenEnabled && (
              <button type="button" className="osaka-word" onClick={fullscreen}>
                Full screen
              </button>
            )}
            {!reduced && (
              <button type="button" className="osaka-word" disabled={!ready || intro} onClick={() => (setIntro(true), choose(null), void engine.current?.playIntro())}>
                Opening
              </button>
            )}
          </span>
        </div>
      )}

      <footer className="osaka-credit">
        <span>Map data © OpenStreetMap contributors · building heights in part MLIT PLATEAU · timetable illustrative, not live</span>
        <button type="button" className="osaka-word" onClick={() => setAbout(true)}>
          About the data
        </button>
      </footer>

      {intro && (
        <button type="button" className="osaka-word osaka-skip" onClick={() => (engine.current?.skipIntro(), setIntro(false))}>
          Skip the opening
        </button>
      )}

      {phase.kind === "loading" && (
        <div className="osaka-loading" role="status">
          <div className="osaka-dawn" style={{ ["--p" as string]: phase.p }} />
          <p>Building the district{phase.what ? ` · ${phase.what}` : ""}</p>
        </div>
      )}

      {phase.kind === "fallback" && (
        <div className="osaka-fallback">
          <img className="osaka-still" src={preview} alt={PREVIEW_ALT} />
          <p className="osaka-eyebrow">The 3D model could not start — this is a still of it</p>
          <p>{phase.why}</p>
          <p>
            Osaka Umeda is a 1.6 × 1.5 km model of the district round JR Osaka and Hankyu Osaka-Umeda stations, drawn from
            OpenStreetMap footprints and PLATEAU building heights: JR Osaka's glass roof, Hankyu's nine-track terminal, Grand Front and
            Grand Green Osaka, the Umeda Sky Building and HEP FIVE's red wheel, with the trains that call there — Loop Line and Special
            Rapid, the Thunderbird, Super Hakuto, Kounotori, Hamakaze, Haruka and Kuroshio, Hankyu's three lines — each at its own
            platform on an illustrative timetable. It needs a browser that can draw WebGL 2.
          </p>
        </div>
      )}

      {about && <About onClose={() => setAbout(false)} />}

      {debug && stats && (
        <pre className="osaka-debug">
          {`${stats.fps} fps · ${stats.ms} ms render · ${stats.calls} calls · ${(stats.triangles / 1000).toFixed(0)}k tris\npixel ratio ${stats.pixelRatio} · shadows ${stats.shadows ? "on" : "off"} · quality step ${stats.level}`}
        </pre>
      )}
    </div>
  );
}

function About({ onClose }: { onClose: () => void }) {
  return (
    <div className="osaka-sheet" role="dialog" aria-modal="true" aria-label="About the data" onClick={onClose}>
      <div className="osaka-sheet-body" onClick={(e) => e.stopPropagation()}>
        <p className="osaka-eyebrow">About the data</p>
        <h2>What is measured, what is drawn</h2>
        <p>
          The streets, every building footprint, the tracks and the platforms are OpenStreetMap (© OpenStreetMap contributors, ODbL),
          fetched on {" "}
          <time>27 October 2026</time> and projected to metres round JR Osaka's Toki-no-Hiroba. About half of the buildings carry
          the height measured by MLIT's Project PLATEAU; the rest use a published figure, their storey count, or — labelled as such
          in the data — an estimate from their footprint.
        </p>
        <p>
          The landmarks are built in code on those footprints. JR Osaka's great roof is placed between the North and South Gate
          buildings, whose facing walls stand 98.5 m apart in the data (the published span is about 100 m); its height and curve,
          and the station's floor levels, are estimates. Trains run where OSM says the tracks are, keeping left as Japanese
          railways do, on a timetable made up to show them — not live running information. Each series is modelled in Blender to
          its published dimensions and painted in its livery as photographed, and stops at the platform it uses at Osaka: the Haruka
          and Kuroshio underground at Umekita (21–24), whose tunnel's depths are estimates. There is no Shinkansen: it calls at
          Shin-Osaka, 3.5 km north of the model.
        </p>
        <p>Nothing here is taken from Google Maps or any proprietary 3D model.</p>
        <button type="button" className="osaka-word" onClick={onClose} autoFocus>
          Close
        </button>
      </div>
    </div>
  );
}
