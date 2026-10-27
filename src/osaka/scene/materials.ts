import * as THREE from "three";

/*
 * The miniature's material library. A restrained palette, as a painted exhibition model would have: warm ivory and concrete, muted
 * blue glass, railway steel and ballast, quiet greens, Hankyu maroon the one deep colour.
 *
 * Buildings share one facade material: a MeshStandardMaterial whose fragment shader lays floors and bays in metres from the wall's
 * uv (distance along the footprint, height) and the building's aInfo (use, seed, top height, landmark), so every tower in the
 * district is one mesh, one draw call, and still reads as a building rather than a block: curtain walls on tall offices and hotels,
 * punched windows on mid-rises, balcony slabs on residential towers, a shopfront band at street level, a parapet line at the top,
 * a little darkening where the wall meets the street. At night (uNight) a deterministic share of windows lights up warm.
 */

export const PALETTE = {
  paving: 0xd9d5cc,
  pavingDeep: 0xcfcac0,
  asphalt: 0x5a5e63,
  roadLine: 0xf1efe8,
  grass: 0x93ad7d,
  pitch: 0x86a874,
  works: 0xbcae95,
  plinth: 0x2a2f35,
  plinthTrim: 0xe9e4d8,
  concrete: 0xc8c4ba,
  viaduct: 0xc3bfb5,
  ballast: 0x8d877c,
  rail: 0x8c847b,
  platform: 0xd2cfc7,
  tactile: 0xe2b23a,
  canopy: 0xe9e9e4,
  steelWhite: 0xf0efea,
  catenary: 0x4a4f55,
  hankyuMaroon: 0x5d1a26,
  hankyuIvory: 0xeee7d2,
  loopOrange: 0xec6a1e,
  rapidBlue: 0x2b5ca8,
  rapidBrown: 0x7b4a2c,
  stainless: 0xc9ccd0,
  hepRed: 0xd8262e,
} as const;

/** Uniforms every custom material reads, so day/night and the highlight change in one place. */
export type Shared = {
  night: { value: number };
  highlight: { value: number };
  time: { value: number };
};

export const createShared = (): Shared => ({ night: { value: 0 }, highlight: { value: 0 }, time: { value: 0 } });

/** Landmark ids → the small integer the facade shader compares against uHighlight (0 = none). */
export const LANDMARK_INDEX: Record<string, number> = {
  "jr-osaka": 1,
  "hankyu-umeda": 2,
  "grand-front": 3,
  "grand-green": 4,
  "sky-building": 5,
  "hep-five": 6,
  yodobashi: 7,
};

const FACADE_COMMON = /* glsl */ `
uniform float uNight;
uniform float uHighlight;
varying vec4 vInfo;
varying vec2 vFac;
varying vec3 vNrm;
float oh21(vec2 p) { p = fract(p * vec2(233.34, 851.73)); p += dot(p, p + 23.45); return fract(p.x * p.y); }
vec3 usePalette(float use, float seed) {
  // Osaka's street walls: tile in warm greys and browns, exposed concrete, ivory, the odd dark office
  vec3 c;
  float v = fract(seed * 17.31);
  if (use < 0.5) c = v < 0.3 ? vec3(0.62, 0.53, 0.45) : v < 0.65 ? vec3(0.71, 0.69, 0.65) : vec3(0.78, 0.75, 0.69);
  else if (use < 1.5) c = v < 0.25 ? vec3(0.44, 0.47, 0.5) : v < 0.7 ? vec3(0.66, 0.68, 0.69) : vec3(0.75, 0.73, 0.69);
  else if (use < 2.5) c = v < 0.35 ? vec3(0.7, 0.63, 0.55) : vec3(0.77, 0.73, 0.66);
  else if (use < 3.5) c = v < 0.3 ? vec3(0.66, 0.58, 0.5) : vec3(0.82, 0.8, 0.75);
  else if (use < 4.5) c = vec3(0.74, 0.69, 0.62);
  else c = vec3(0.6, 0.59, 0.56);
  return c * mix(0.9, 1.05, fract(seed * 5.71));
}
`;

const FACADE_BODY = /* glsl */ `
  float fUse = vInfo.x;
  float fSeed = vInfo.y;
  float fTop = vInfo.z;
  float fLm = vInfo.w;
  vec3 fCol = usePalette(fUse, fSeed);
  float fRough = 0.86;
  float fMetal = 0.0;
  vec3 fEmit = vec3(0.0);
  if (vNrm.y > 0.5) {
    // roof: concrete, a little darker than the walls, the odd green roof
    fCol = mix(vec3(0.70, 0.70, 0.68), vec3(0.78, 0.77, 0.74), fract(fSeed * 3.3));
    if (fract(fSeed * 9.7) > 0.93 && fTop < 40.0) fCol = vec3(0.55, 0.62, 0.50);
  } else if (vNrm.y > -0.5) {
    bool officeLike = fUse > 0.5 && fUse < 1.5 || fUse > 3.5 && fUse < 4.5 || fTop > 120.0 && fUse < 2.5;
    float curtain = (fTop > 55.0 && officeLike) ? 1.0 : 0.0;
    float resi = (fUse > 2.5 && fUse < 3.5) ? 1.0 : 0.0;
    float floorH = resi > 0.5 ? 3.05 : (fUse > 1.5 && fUse < 2.5) ? 4.4 : 3.9;
    float bay = curtain > 0.5 ? mix(1.6, 2.4, fract(fSeed * 3.7)) : mix(2.5, 3.8, fract(fSeed * 3.7));
    vec2 cc = vec2(vFac.x / bay, (vFac.y - 0.4) / floorH);
    vec2 ff = fract(cc);
    vec2 cell = floor(cc);
    float wx = curtain > 0.5 ? 0.9 : mix(0.42, 0.78, fract(fSeed * 11.1));
    float wy = curtain > 0.5 ? 0.82 : mix(0.42, 0.62, fract(fSeed * 5.3));
    // anti-aliased window mask, widening with distance (fwidth) so far facades turn to a soft tone, not moiré
    vec2 aa = fwidth(cc) * 1.2 + 1e-4;
    float inX = 1.0 - smoothstep(wx * 0.5 - aa.x, wx * 0.5 + aa.x, abs(ff.x - 0.5));
    float inY = 1.0 - smoothstep(wy * 0.5 - aa.y, wy * 0.5 + aa.y, abs(ff.y - 0.56));
    float win = inX * inY;
    float far = clamp(max(aa.x, aa.y) * 2.0 - 0.3, 0.0, 1.0);
    win = mix(win, wx * wy * 0.85, far);
    float parapet = step(fTop - vFac.y, 0.9);
    // street-level shopfronts (upper building:parts start above 4.6 m, so they never get one)
    float street = step(vFac.y, 4.6) * (fUse < 2.5 ? 1.0 : 0.0) * (1.0 - curtain * 0.3);
    win *= 1.0 - parapet;
    // residential: the slab edges and balcony rails read as pale horizontal bands
    if (resi > 0.5 && fTop > 20.0) {
      float band = 1.0 - smoothstep(0.12 - aa.y, 0.12 + aa.y, ff.y);
      fCol = mix(fCol, vec3(0.94, 0.93, 0.9), band * 0.8);
      win *= 1.0 - band;
    }
    vec3 glass = curtain > 0.5 ? mix(vec3(0.17, 0.24, 0.31), vec3(0.26, 0.33, 0.39), fract(fSeed * 2.9)) : vec3(0.2, 0.23, 0.26);
    fCol = mix(fCol, glass, win);
    fCol = mix(fCol, vec3(0.33, 0.35, 0.36), street * 0.75);
    fCol = mix(fCol, fCol * 1.12, parapet);
    fRough = mix(fRough, curtain > 0.5 ? 0.14 : 0.3, max(win, street * 0.6));
    fMetal = mix(0.0, 0.4, win * curtain);
    // night: a deterministic share of windows lit, warm in homes, cooler in offices; shopfronts all lit
    float hl = oh21(cell + vec2(fSeed * 37.0, fSeed * 11.0));
    float share = resi > 0.5 ? 0.4 : 0.3;
    float lit = step(hl, share) * mix(0.55, 1.0, fract(hl * 7.0));
    // far off, the lit windows average into a glow instead of sparkling cell by cell
    lit = mix(lit, share * 0.42, clamp(max(aa.x, aa.y) * 3.0 - 0.3, 0.0, 1.0));
    vec3 warm = resi > 0.5 ? vec3(1.0, 0.68, 0.36) : mix(vec3(1.0, 0.8, 0.55), vec3(0.88, 0.9, 0.95), curtain * 0.35);
    fEmit = uNight * (win * lit * warm * 1.05 + street * vec3(1.0, 0.74, 0.45) * 0.62 * (1.0 - far * 0.5));
    // the street darkens where the wall meets it
    fCol *= mix(0.74, 1.0, smoothstep(0.0, 3.5, vFac.y));
  }
  if (fLm > 0.5 && abs(fLm - uHighlight) < 0.5) {
    fCol = mix(fCol, vec3(1.0, 0.9, 0.72), 0.2 * (1.0 - 0.6 * uNight));
    fEmit += vec3(0.16, 0.12, 0.055) * (1.0 - 0.75 * uNight);
  }
  diffuseColor.rgb = fCol;
`;

/** The shared facade material for every OSM building (and the landmarks built from boxes). Needs aInfo + aFac attributes. */
export function facadeMaterial(shared: Shared, env: THREE.Texture | null): THREE.MeshStandardMaterial {
  const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.86, metalness: 0, envMap: env, envMapIntensity: 0.9 });
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uNight = shared.night;
    sh.uniforms.uHighlight = shared.highlight;
    sh.vertexShader = sh.vertexShader
      .replace("#include <common>", "#include <common>\nattribute vec4 aInfo;\nattribute vec2 aFac;\nvarying vec4 vInfo;\nvarying vec2 vFac;\nvarying vec3 vNrm;")
      .replace("#include <begin_vertex>", "#include <begin_vertex>\nvInfo = aInfo;\nvFac = aFac;\nvNrm = normal;");
    sh.fragmentShader = sh.fragmentShader
      .replace("#include <common>", "#include <common>\n" + FACADE_COMMON)
      .replace("#include <color_fragment>", "#include <color_fragment>\n" + FACADE_BODY)
      .replace("#include <roughnessmap_fragment>", "#include <roughnessmap_fragment>\nroughnessFactor = fRough;")
      .replace("#include <metalnessmap_fragment>", "#include <metalnessmap_fragment>\nmetalnessFactor = fMetal;")
      .replace("#include <emissivemap_fragment>", "#include <emissivemap_fragment>\ntotalEmissiveRadiance += fEmit;");
  };
  mat.customProgramCacheKey = () => "osaka-facade";
  return mat;
}

/** A plain material that glows at night (lamps, lit interiors): emissive = color × uNight × strength. */
export function nightGlow(color: number, strength: number, shared: Shared, base?: THREE.MeshStandardMaterialParameters): THREE.MeshStandardMaterial {
  const mat = new THREE.MeshStandardMaterial({ color: base?.color ?? 0x8a8a86, roughness: 0.6, ...base });
  const glow = new THREE.Color(color);
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uNight = shared.night;
    sh.uniforms.uGlow = { value: glow };
    sh.fragmentShader = sh.fragmentShader
      .replace("#include <common>", `#include <common>\nuniform float uNight;\nuniform vec3 uGlow;`)
      .replace("#include <emissivemap_fragment>", `#include <emissivemap_fragment>\ntotalEmissiveRadiance += uGlow * uNight * ${strength.toFixed(3)};`);
  };
  mat.customProgramCacheKey = () => `osaka-glow-${color}-${strength}`;
  return mat;
}

/**
 * Ballast with the sleepers drawn in: uv.x is distance along the track (m), uv.y across (−0.5…0.5). Concrete sleepers every
 * 0.62 m (JR's PC sleeper spacing on plain track is ~0.6 m), fading to an even tone with distance so they never shimmer.
 */
export function ballastMaterial(): THREE.MeshStandardMaterial {
  const mat = new THREE.MeshStandardMaterial({ color: PALETTE.ballast, roughness: 0.98 });
  mat.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader
      .replace("#include <common>", "#include <common>\nvarying vec2 vTrk;")
      .replace("#include <begin_vertex>", "#include <begin_vertex>\nvTrk = uv;");
    sh.fragmentShader = sh.fragmentShader
      .replace("#include <common>", "#include <common>\nvarying vec2 vTrk;\nfloat bh(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }")
      .replace(
        "#include <color_fragment>",
        `#include <color_fragment>
        float sl = vTrk.x / 0.62;
        float aa = fwidth(sl) * 1.5;
        float sleeper = (1.0 - smoothstep(0.32 - aa, 0.32 + aa, abs(fract(sl) - 0.5))) * step(abs(vTrk.y), 0.4);
        sleeper = mix(sleeper, 0.36 * step(abs(vTrk.y), 0.4), clamp(aa * 1.6 - 0.2, 0.0, 1.0));
        float grit = bh(floor(vTrk * vec2(9.0, 22.0))) * 0.12;
        diffuseColor.rgb = mix(diffuseColor.rgb * (0.94 + grit), vec3(0.66, 0.64, 0.6), sleeper);`,
      );
  };
  mat.customProgramCacheKey = () => "osaka-ballast";
  return mat;
}

/** Road surface: asphalt with a centre line and lane dashes from uv (distance, across); `lanes` encoded per vertex in aRoad. */
export function roadMaterial(): THREE.MeshStandardMaterial {
  const mat = new THREE.MeshStandardMaterial({ color: PALETTE.asphalt, roughness: 0.92 });
  mat.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader
      .replace("#include <common>", "#include <common>\nattribute vec2 aRoad;\nvarying vec2 vRoadUv;\nvarying vec2 vRoad;")
      .replace("#include <begin_vertex>", "#include <begin_vertex>\nvRoadUv = uv;\nvRoad = aRoad;");
    sh.fragmentShader = sh.fragmentShader
      .replace("#include <common>", "#include <common>\nvarying vec2 vRoadUv;\nvarying vec2 vRoad;")
      .replace(
        "#include <color_fragment>",
        `#include <color_fragment>
        // vRoad.x: width (m); vRoad.y: 0 plain, 1 two-way with a centre line, 2 one-way with lane dashes, 3 deck
        float w = vRoad.x;
        float across = vRoadUv.y * w;
        float aa = fwidth(across) * 1.2 + 1e-4;
        float line = 0.0;
        if (vRoad.y > 0.5 && vRoad.y < 1.5) {
          float dash = step(0.45, fract(vRoadUv.x / 9.0));
          line = (1.0 - smoothstep(0.08 - aa, 0.08 + aa, abs(across))) * mix(1.0, dash, step(w, 11.0));
        } else if (vRoad.y > 1.5 && vRoad.y < 2.5) {
          float lane = 3.3;
          float k = fract((across + w * 0.5) / lane);
          float dash = step(0.55, fract(vRoadUv.x / 8.0));
          float inner = abs(across) < w * 0.5 - 0.6 ? 1.0 : 0.0;
          line = (1.0 - smoothstep(0.03 - aa / lane, 0.03 + aa / lane, min(k, 1.0 - k))) * dash * step(lane * 1.6, w) * inner;
        }
        float edge = (1.0 - smoothstep(0.1 - aa, 0.1 + aa, abs(abs(across) - (w * 0.5 - 0.35)))) * step(8.0, w);
        line = max(line, edge * 0.9);
        line *= 1.0 - clamp(aa * 3.0 - 0.6, 0.0, 1.0);
        vec3 deck = vec3(0.7, 0.69, 0.66);
        diffuseColor.rgb = vRoad.y > 2.5 ? deck : mix(diffuseColor.rgb, vec3(0.93, 0.92, 0.88), line * 0.85);`,
      );
  };
  mat.customProgramCacheKey = () => "osaka-road";
  return mat;
}

/** Glass for station roofs: pale, partly transparent, a mullion grid drawn from uv in metres (`cell` m square). */
export function roofGlassMaterial(cell: number, shared: Shared, env: THREE.Texture | null): THREE.MeshStandardMaterial {
  const mat = new THREE.MeshStandardMaterial({ color: 0xe6edf0, roughness: 0.12, metalness: 0.2, transparent: true, opacity: 0.32, side: THREE.DoubleSide, depthWrite: false, envMap: env, envMapIntensity: 1.2 });
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uNight = shared.night;
    sh.vertexShader = sh.vertexShader
      .replace("#include <common>", "#include <common>\nvarying vec2 vG;")
      .replace("#include <begin_vertex>", "#include <begin_vertex>\nvG = uv;");
    sh.fragmentShader = sh.fragmentShader
      .replace("#include <common>", "#include <common>\nvarying vec2 vG;\nuniform float uNight;")
      .replace(
        "#include <color_fragment>",
        `#include <color_fragment>
        vec2 g = vG / ${cell.toFixed(2)};
        vec2 aa = fwidth(g) * 1.2 + 1e-4;
        vec2 d = abs(fract(g) - 0.5);
        float mull = max(1.0 - smoothstep(0.47 - aa.x, 0.47 + aa.x, 0.5 - d.x), 1.0 - smoothstep(0.47 - aa.y, 0.47 + aa.y, 0.5 - d.y));
        mull *= 1.0 - clamp(max(aa.x, aa.y) * 2.0 - 0.5, 0.0, 0.7);
        diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.97, 0.97, 0.95), mull);
        diffuseColor.a = mix(diffuseColor.a, 0.92, mull);`,
      )
      .replace("#include <emissivemap_fragment>", "#include <emissivemap_fragment>\ntotalEmissiveRadiance += uNight * vec3(0.55, 0.5, 0.42) * 0.35;");
  };
  mat.customProgramCacheKey = () => `osaka-roofglass-${cell}`;
  return mat;
}
