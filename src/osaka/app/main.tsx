import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "@fontsource/shippori-mincho/latin-500.css";
import "@fontsource/zen-kaku-gothic-new/latin-400.css";
import "@fontsource/zen-kaku-gothic-new/latin-500.css";
import { OsakaApp } from "./OsakaApp";
import "./osaka.css";

/*
 * Entry for projects/osaka-umeda/: the full page, or (?mode=showcase) the turning preview a home page can embed in an iframe.
 * Only the Latin faces load here; Japanese names fall back to the system's Mincho and Gothic, which every Japanese-capable
 * system has, rather than registering hundreds of CJK slices for a dozen words.
 */

const params = new URLSearchParams(location.search);
const mode = params.get("mode") === "showcase" ? "showcase" : "explore";
const root = document.getElementById("osaka-root");
if (root) createRoot(root).render(<StrictMode><OsakaApp mode={mode} debug={params.has("debug")} skipIntro={params.has("nointro") || params.has("landmark")} initial={params.get("landmark")} night={params.get("time") === "night"} /></StrictMode>);
