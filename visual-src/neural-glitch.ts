import {mountScreenEffect,removeScreenEffect} from './screen-effect-area.js';
/** One timer per focused actor. Ordinary HUD rerenders must not restart the interval. */
export function createIntrusionGlitches(eligible: () => string | undefined) {
  const looks = [
    {name:"tear", displacement:42, split:6, frequency:.055, bands:5, height:7},
    {name:"echo", displacement:12, split:13, frequency:.025, bands:2, height:3},
    {name:"dropout", displacement:68, split:3, frequency:.018, bands:4, height:10},
    {name:"scan", displacement:24, split:4, frequency:.12, bands:8, height:2},
  ] as const;
  let lastLook = -1;
  let identity: string | undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let finish: ReturnType<typeof setTimeout> | undefined;
  let overlay: HTMLElement | undefined;
  const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const current = () => !document.hidden && !motion.matches ? eligible() : undefined;
  function stop() {
    clearTimeout(timer); clearTimeout(finish); timer = finish = undefined;
    removeScreenEffect(overlay); overlay = undefined; identity = undefined;
  }
  function queue(first = false) { timer = setTimeout(burst, first ? 1000 : 6000 + Math.random() * 4000); }
  function burst() {
    timer = undefined;
    if (!identity || current() !== identity) { stop(); sync(); return; }
    const index = lastLook < 0 ? Math.floor(Math.random()*looks.length)
      : (lastLook + 1 + Math.floor(Math.random()*(looks.length-1))) % looks.length;
    lastLook = index;
    const look = looks[index]!;
    const severity = [0.65, 1, 1.4][Math.floor(Math.random()*3)]!;
    overlay = document.createElement("div"); overlay.id = "pneuma-visual-neural-glitch";
    overlay.className = "pneuma-neural-" + look.name;
    overlay.setAttribute("data-severity", severity < 1 ? "mild" : severity > 1 ? "strong" : "medium");
    overlay.setAttribute("aria-hidden", "true");
    // Filter the rendered backdrop directly; no screen capture, DOM cloning or frame loop.
    overlay.innerHTML = `<svg width="0" height="0" aria-hidden="true"><defs>
      <filter id="pneuma-visual-neural-distortion" x="-5%" y="-5%" width="110%" height="110%" color-interpolation-filters="sRGB">
        <feTurbulence type="fractalNoise" baseFrequency="0.0001 ${look.frequency}" numOctaves="1" seed="${Math.floor(Math.random()*100)}" result="noise"/>
        <feComponentTransfer in="noise" result="horizontalNoise"><feFuncR type="discrete" tableValues="0.1 0.48 0.5 0.52 0.9"/><feFuncA type="table" tableValues="0.5 0.5"/></feComponentTransfer>
        <feDisplacementMap in="SourceGraphic" in2="horizontalNoise" scale="${look.displacement*severity}" xChannelSelector="R" yChannelSelector="A" result="torn"/>
        <feColorMatrix in="torn" type="matrix" values="1 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0" result="red"/>
        <feOffset in="red" dx="${look.split*severity}" result="redShift"/>
        <feColorMatrix in="torn" type="matrix" values="0 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 1 0" result="cyan"/>
        <feOffset in="cyan" dx="${-look.split*severity}" result="cyanShift"/>
        <feBlend in="redShift" in2="cyanShift" mode="screen"/>
      </filter>
    </defs></svg>`;
    const count = Math.random() < 0.25 ? 2 : 1;
    // Share a bounded area budget between regions, independently of distortion strength.
    const area = (0.10 + Math.random() * 0.14) / count;
    for (let r = 0; r < count; r++) {
      const region = document.createElement("div"); region.className = "pneuma-neural-region";
      const width = Math.random() < 0.5 ? 0.65 + Math.random()*0.25 : 0.40 + Math.random()*0.20;
      const height = area / width;
      region.style.width = width*100 + "%";
      region.style.height = height*100 + "%";
      region.style.left = Math.random()*(1-width)*100 + "%";
      region.style.top = Math.random()*(1-height)*100 + "%";
      const signal = document.createElement("div"); signal.className = "pneuma-neural-signal";
      region.append(signal);
      for (let n = 0; n < look.bands; n++) {
        const band = document.createElement("div");
        band.className = "pneuma-neural-tear";
        band.style.top = (5 + Math.random() * 85) + "%";
        band.style.height = (n % 2 ? 5 : look.height*severity*2) + "%";
        band.style.animationDelay = (n * -137) + "ms";
        region.append(band);
      }
      overlay.append(region);
    }
    mountScreenEffect(overlay,true);
    finish = setTimeout(() => { removeScreenEffect(overlay); overlay = undefined; finish = undefined; queue(); }, 1800);
  }
  function sync() {
    const next = current();
    if (next === identity) return;
    stop(); identity = next;
    if (identity) queue(true);
  }
  document.addEventListener("visibilitychange", sync);
  motion.addEventListener("change", sync);
  return {sync, stop};
}
