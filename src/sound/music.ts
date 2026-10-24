/*
 * The owner's own piano under the foley (owner 2026-10-24), in place of the leaves and birds (ambient.ts stays as the fallback).
 * public/sounds/music.json names the file and its playback trim.
 *
 * A 3½-minute piece is too long to decode whole (≈ 70 MB of samples on a phone), so it streams through an <audio> element routed
 * into the kit's master (createMediaElementSource), after the compressor like the room tone. start() fades it in from where it
 * last stopped, stop() fades it out and pauses (the page hidden, or muted), so a visitor who comes back hears the piece go on
 * rather than start over. At its end it rests GAP seconds and plays again from the top. Nothing is fetched before the first start().
 */

import type { Ambient } from "./ambient";

export type MusicManifest = { file: string; gainDb: number; duration: number };

/** Fade in when the music starts, out when it stops (s) */
export const FADE_IN = 2.5;
export const FADE_OUT = 1.2;
/** The rest between the end of the piece and its next playing (s) */
export const GAP = 6;

const db = (d: number) => Math.pow(10, d / 20);

/** Whether this browser can stream music through the kit (else the kit falls back to the room tone). */
export function canStream(ac: BaseAudioContext): ac is AudioContext {
  return typeof Audio === "function" && typeof (ac as AudioContext).createMediaElementSource === "function";
}

export function createMusic(ac: AudioContext, out: AudioNode, base: string, fetcher: (url: string) => Promise<Response>): Ambient {
  const room = ac.createGain();
  room.gain.value = 0;
  room.connect(out);
  const trim = ac.createGain();
  trim.connect(room);

  let el: HTMLAudioElement | null = null;
  let loading: Promise<HTMLAudioElement | null> | null = null;
  let wanted = false;
  let disposed = false;
  let pauseTimer: ReturnType<typeof setTimeout> | undefined;
  let gapTimer: ReturnType<typeof setTimeout> | undefined;

  function load() {
    loading ??= (async () => {
      try {
        const res = await fetcher(`${base}music.json`);
        if (!res.ok) return null;
        const m = (await res.json()) as MusicManifest;
        const a = new Audio();
        a.preload = "auto";
        a.src = base + m.file;
        trim.gain.value = db(m.gainDb);
        ac.createMediaElementSource(a).connect(trim);
        a.addEventListener("ended", () => {
          clearTimeout(gapTimer);
          gapTimer = setTimeout(() => {
            if (!wanted || disposed) return;
            a.currentTime = 0;
            a.play().catch(() => {});
          }, GAP * 1000);
        });
        el = a;
        return a;
      } catch {
        // no music: the foley still plays
        return null;
      }
    })();
    return loading;
  }

  function fade(to: number, d: number) {
    const t = ac.currentTime;
    room.gain.cancelScheduledValues(t);
    room.gain.setValueAtTime(room.gain.value, t);
    room.gain.linearRampToValueAtTime(to, t + d);
  }

  return {
    start() {
      if (disposed || wanted) return;
      wanted = true;
      clearTimeout(pauseTimer);
      fade(1, FADE_IN);
      void load().then((a) => {
        if (!a || !wanted || disposed) return;
        if (a.ended) a.currentTime = 0;
        a.play().catch(() => {});
      });
    },
    stop() {
      if (!wanted) return;
      wanted = false;
      fade(0, FADE_OUT);
      // a rest cut short ends here: the next start() plays from the top
      clearTimeout(gapTimer);
      clearTimeout(pauseTimer);
      pauseTimer = setTimeout(() => {
        if (!wanted) el?.pause();
      }, (FADE_OUT + 0.05) * 1000);
    },
    get playing() {
      return wanted;
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      wanted = false;
      clearTimeout(pauseTimer);
      clearTimeout(gapTimer);
      el?.pause();
      el?.removeAttribute("src");
      el?.load();
      trim.disconnect();
      room.disconnect();
    },
  };
}
