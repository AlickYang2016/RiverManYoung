import { lazy, Suspense, useEffect, useRef, useState, type ComponentType } from "react";
import type { StageMap, StageProps } from "../types";

/*
 * The three 3D stages, code-split: the shell paints from the entry chunk, each stage's module (BookView, the pouch, three,
 * planck) loads when its booklet is first shown. The host is full-bleed (the canvas fills the viewport; the book is framed into
 * the book box by the camera insets). While it loads, the shell shows the daybreak line in the book box (§1.6.13); the booklet
 * fades in last (opacity and a 6 px blur, app.css).
 */

const loaders: (() => Promise<unknown>)[] = [];
function stage(load: () => Promise<{ default: ComponentType<StageProps> }>): ComponentType<StageProps> {
  loaders.push(load);
  const Lazy = lazy(load);
  function Stage(props: StageProps) {
    const host = useRef<HTMLDivElement>(null);
    const [ready, setReady] = useState(false);
    // BookView marks its root data-ready once the first spread is painted (or at once in its flat fallback). A rebuild (a new
    // case) drops it for a moment: the booklet fades back out and in.
    useEffect(() => {
      const el = host.current;
      if (!el) return;
      // the host's attribute set here, at once (a mutation callback), as well as through React: the fade-in never waits for a commit
      const check = () => {
        const on = !!el.querySelector(".folio-book[data-ready]");
        el.toggleAttribute("data-ready", on);
        setReady(on);
      };
      check();
      const mo = new MutationObserver(check);
      mo.observe(el, { subtree: true, childList: true, attributes: true, attributeFilter: ["data-ready"] });
      return () => mo.disconnect();
    }, []);
    return (
      <div className="stage-host" ref={host} data-ready={ready || undefined}>
        <Suspense fallback={null}>
          <Lazy {...props} />
        </Suspense>
      </div>
    );
  }
  return Stage;
}

/**
 * sasshi (2026-10-25): the other booklets ahead, while one is open and settled (owner: "while they read the CV, have the cards and
 * postcards ready"): every stage's module (a module loads once, so the open one costs nothing), and the albums' photos, fetched at
 * idle priority so they never compete with the page. Their scenes are still built when shown; with the code and pictures here, and
 * the programs they share with the first booklet in the browser's shader cache, that is the short part.
 */
export function prefetchStages(photos: readonly string[]): void {
  for (const load of loaders) void load().catch(() => {});
  for (const src of new Set(photos)) {
    if (document.head.querySelector(`link[rel="prefetch"][href="${src}"]`)) continue;
    const l = document.createElement("link");
    l.rel = "prefetch";
    l.as = "image";
    l.href = src;
    document.head.append(l);
  }
}

export const STAGES: StageMap = {
  resume: stage(() => import("./ResumeStage")),
  cards: stage(() => import("./AlbumStage").then((m) => ({ default: m.CardsStage }))),
  postcards: stage(() => import("./AlbumStage").then((m) => ({ default: m.PostcardsStage }))),
};
