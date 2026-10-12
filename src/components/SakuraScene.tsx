import treeUrl from "@/assets/sakura-tree.png";

/** Decorative sakura tree (bottom-right), distant mountains and a moon (top-left at night). */
export function SakuraScene() {
  return (
    <div aria-hidden className="sakura-scene pointer-events-none fixed inset-0 z-0 overflow-hidden">
      <div className="sakura-sky absolute inset-0" />
      <div className="sakura-sun absolute" />
      <div className="sakura-moon absolute" />
      <svg className="sakura-hills absolute inset-x-0 bottom-0 w-full" viewBox="0 0 1440 320" preserveAspectRatio="none">
        <path className="sakura-hill-far" d="M0 210 L120 150 L210 185 L330 105 L440 170 L560 120 L690 190 L820 135 L940 180 L1060 125 L1180 175 L1300 140 L1440 180 L1440 320 L0 320 Z" />
        <path className="sakura-hill-mid" d="M0 250 C160 205 280 235 420 215 C560 195 680 245 840 228 C1000 210 1140 250 1280 232 C1360 222 1410 230 1440 236 L1440 320 L0 320 Z" />
        <path className="sakura-hill-near" d="M0 290 C200 262 380 288 600 274 C820 260 1040 292 1260 278 C1340 273 1400 276 1440 280 L1440 320 L0 320 Z" />
      </svg>
      <div className="sakura-haze absolute" />
      <img src={treeUrl} alt="" width={1024} height={1024} loading="lazy" decoding="async" className="sakura-tree absolute" />
    </div>
  );
}
