// Borrow the live token texture; never extract pixels or own/destroy its image.
// Pixi's stock sprite mask also uses the red channel. Only alpha should clip
// these effects, otherwise opaque black artwork would incorrectly erase them.
const fragment = `
varying vec2 vTextureCoord;
varying vec2 vMaskCoord;
uniform sampler2D uSampler;
uniform sampler2D mask;
uniform vec4 maskClamp;
void main(void) {
  float inside = step(maskClamp.x, vMaskCoord.x) * step(maskClamp.y, vMaskCoord.y)
    * step(vMaskCoord.x, maskClamp.z) * step(vMaskCoord.y, maskClamp.w);
  float coverage = texture2D(mask, vMaskCoord).a * inside;
  gl_FragColor = texture2D(uSampler, vTextureCoord) * coverage;
}`;

export function createTokenEffectMask(token: Token, layer: PIXI.Container) {
 const sprite = new PIXI.Sprite();
 sprite.eventMode = 'none';
 layer.addChild(sprite);
 const local = new PIXI.Matrix(), previous = new PIXI.Matrix();
 let initialized = false;
 function update(): boolean {
  const mesh = token.mesh, texture = mesh?.texture;
  if (!mesh || !texture?.valid || mesh.destroyed) return false;
  let changed = !initialized;
  if (sprite.texture !== texture) {sprite.texture = texture;changed = true;}
  if(sprite.anchor.x !== mesh.anchor.x || sprite.anchor.y !== mesh.anchor.y) {sprite.anchor.copyFrom(mesh.anchor);changed = true;}
  // Token artwork lives in PrimaryCanvasGroup, not under the Token container.
  // Convert its world transform into this overlay's local coordinates. This
  // includes texture scale, mirroring, rotation, anchor, movement and canvas zoom.
  local.copyFrom(layer.worldTransform).invert().append(mesh.worldTransform);
  if(changed || local.a!==previous.a || local.b!==previous.b || local.c!==previous.c || local.d!==previous.d || local.tx!==previous.tx || local.ty!==previous.ty) {
   sprite.transform.setFromMatrix(local);
   sprite.updateTransform();
   previous.copyFrom(local);initialized = true;
  }
  return true;
 }
 class ImageAlphaFilter extends PIXI.SpriteMaskFilter {
  constructor() {super(undefined, fragment);this.maskSprite = sprite;}
  override apply(manager: PIXI.FilterSystem, input: PIXI.RenderTexture, output: PIXI.RenderTexture, clear: PIXI.CLEAR_MODES): void {
   // Render-time transforms are current even during movement animation or zoom.
   // Missing/unloaded artwork must not expose an unmasked rectangular effect.
   if (update()) super.apply(manager, input, output, clear);
  }
 }
 const filter = new ImageAlphaFilter();
 layer.filters = [filter];
 return {
  update,
  destroy() {
   layer.filters = null;
   filter.destroy();
   layer.removeChild(sprite);
   sprite.destroy({texture:false,baseTexture:false});
  }
 };
}
