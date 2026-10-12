import treeUrl from "@/assets/sakura-tree.png";

/** Decorative manga-style sakura tree (bottom-right) with morning haze / moonlit night. */
export function SakuraScene() {
  return (
    <div aria-hidden className="sakura-scene pointer-events-none fixed inset-0 z-0 overflow-hidden">
      <div className="sakura-sky absolute inset-0" />
      <div className="sakura-moon absolute" />
      <div className="sakura-haze absolute" />
      <img src={treeUrl} alt="" width={1024} height={1024} loading="lazy" decoding="async" className="sakura-tree absolute" />
    </div>
  );
}
