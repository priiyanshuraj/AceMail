import { useEffect, useRef } from "react";

// Pixel-art sprites: 0 empty, 1 main, 2 shade, 3 highlight
const PETAL = [
  "0110",
  "1311",
  "1112",
  "0120",
];
const PETAL_SM = ["11", "12"];
const LEAF = [
  "00110",
  "01111",
  "11120",
  "1200",
];

type P = { x: number; y: number; s: number; vy: number; vx: number; sway: number; ph: number; rot: number; vr: number; kind: number; a: number; t: number; max: number };

function css(name: string) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

/** Sparse, low-contrast falling pixel petals. Decorative background only. */
export function PetalField() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let w = 0, h = 0, raf = 0, last = performance.now();
    let colors = { petal: "", shade: "", hi: "", leaf: "", leafShade: "" };
    const readColors = () => {
      colors = { petal: css("--petal"), shade: css("--petal-shade"), hi: css("--petal-hi"), leaf: css("--leaf"), leafShade: css("--leaf-shade") };
    };
    const resize = () => {
      w = canvas.width = window.innerWidth;
      h = canvas.height = window.innerHeight;
      ctx.imageSmoothingEnabled = false;
    };
    const mobile = window.innerWidth < 768;
    const count = mobile ? 10 : 22;
    // Canopy of the sakura tree (bottom-right, see .sakura-tree in styles.css)
    const canopy = () => {
      const vmin = Math.min(w, h);
      const tw = Math.min(vmin * (mobile ? 0.7 : 0.62), 640);
      return { x0: w - tw * 0.95, x1: w - tw * 0.1, y0: h - tw * 0.98, y1: h - tw * 0.45 };
    };
    const spawn = (initial: boolean): P => {
      const leaf = Math.random() < 0.1;
      const c = canopy();
      const p: P = {
        x: c.x0 + Math.random() * (c.x1 - c.x0),
        y: c.y0 + Math.random() * (c.y1 - c.y0),
        s: leaf ? 2 : Math.random() < 0.35 ? 3 : 2,
        vy: 10 + Math.random() * 16,
        vx: -(14 + Math.random() * 26),
        sway: 8 + Math.random() * 18,
        ph: Math.random() * Math.PI * 2,
        rot: Math.random() * Math.PI,
        vr: (Math.random() - 0.5) * 0.8,
        kind: leaf ? 2 : Math.random() < 0.4 ? 1 : 0,
        a: 0,
        t: 0,
        max: 0.4 + Math.random() * 0.35,
      };
      if (initial) {
        // pre-advance so the drift is already in motion on load
        const secs = Math.random() * 25;
        p.x += p.vx * secs; p.y += p.vy * secs; p.t = secs; p.a = p.max;
      }
      return p;
    };

    resize();
    readColors();
    const ps = Array.from({ length: count }, () => spawn(true));

    const draw = (p: P) => {
      const sprite = p.kind === 2 ? LEAF : p.kind === 1 ? PETAL_SM : PETAL;
      const main = p.kind === 2 ? colors.leaf : colors.petal;
      const shade = p.kind === 2 ? colors.leafShade : colors.shade;
      ctx.save();
      ctx.globalAlpha = p.a;
      ctx.translate(Math.round(p.x), Math.round(p.y));
      // quantized rotation keeps the pixel look crisp
      ctx.rotate(Math.round(p.rot / (Math.PI / 4)) * (Math.PI / 4));
      const off = ((sprite[0]?.length ?? 0) * p.s) / 2;
      sprite.forEach((row, ry) => {
        for (let rx = 0; rx < row.length; rx++) {
          const c = row[rx];
          if (c === "0") continue;
          ctx.fillStyle = c === "2" ? shade : c === "3" ? colors.hi : main;
          ctx.fillRect(rx * p.s - off, ry * p.s - off, p.s, p.s);
        }
      });
      ctx.restore();
    };

    const tick = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      ctx.clearRect(0, 0, w, h);
      for (let i = 0; i < ps.length; i++) {
        const p = ps[i];
        if (!p) continue;
        p.ph += dt * 0.9;
        p.t += dt;
        p.a = Math.min(p.max, p.t * 0.5);
        p.y += p.vy * dt;
        p.x += (p.vx + Math.sin(p.ph) * p.sway) * dt;
        p.rot += p.vr * dt;
        if (p.y > h + 20 || p.x < -30) ps[i] = spawn(false);
        draw(p);
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    const onVis = () => {
      cancelAnimationFrame(raf);
      if (!document.hidden) { last = performance.now(); raf = requestAnimationFrame(tick); }
    };
    const themeObs = new MutationObserver(readColors);
    themeObs.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    window.addEventListener("resize", resize);
    document.addEventListener("visibilitychange", onVis);
    return () => {
      cancelAnimationFrame(raf);
      themeObs.disconnect();
      window.removeEventListener("resize", resize);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, []);

  return <canvas ref={ref} aria-hidden className="pointer-events-none fixed inset-0 z-0 h-full w-full" />;
}
