// three's VSM blur shader text (not in its typings): compile.ts's stand-ins for the shadow pass's own blur materials
declare module "three/src/renderers/shaders/ShaderLib/vsm.glsl.js" {
  export const vertex: string;
  export const fragment: string;
}
