// Runtime alpha verification for the P0.1 transparency proof.
//
// Decodes a saved data URL back into pixels (same-origin data URL, so no
// CORS risk) and reports how much of it is actually transparent. Used to
// prove — at runtime, per save — that the Unlayer editor preserved the
// alpha channel instead of flattening onto an opaque background.

export interface AlphaReport {
  width: number;
  height: number;
  total: number;
  transparent: number;
  opaque: number;
  translucent: number;
  /** Fraction of pixels that are not fully opaque (0..1). */
  transparentRatio: number;
  hasTransparency: boolean;
}

export function analyzeAlpha(dataUrl: string): Promise<AlphaReport | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      try {
        const width = img.naturalWidth;
        const height = img.naturalHeight;
        if (width === 0 || height === 0) {
          resolve(null);
          return;
        }
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d", { willReadFrequently: true });
        if (!ctx) {
          resolve(null);
          return;
        }
        ctx.clearRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0);
        const data = ctx.getImageData(0, 0, width, height).data;
        let transparent = 0;
        let opaque = 0;
        let translucent = 0;
        for (let i = 3; i < data.length; i += 4) {
          const a = data[i];
          if (a === 0) transparent += 1;
          else if (a === 255) opaque += 1;
          else translucent += 1;
        }
        const total = width * height;
        const nonOpaque = transparent + translucent;
        resolve({
          width,
          height,
          total,
          transparent,
          opaque,
          translucent,
          transparentRatio: total === 0 ? 0 : nonOpaque / total,
          hasTransparency: nonOpaque > 0,
        });
      } catch (err) {
        console.warn("[crewmark] Alpha analysis failed; treating as unknown.", err);
        resolve(null);
      }
    };
    img.onerror = () => {
      console.warn("[crewmark] Alpha analysis could not decode the saved image.");
      resolve(null);
    };
    img.src = dataUrl;
  });
}

/** Compact human-readable summary, e.g. "1024×1024 // 78% transparent". */
export function formatAlpha(report: AlphaReport): string {
  const pct = Math.round(report.transparentRatio * 100);
  return `${report.width}×${report.height} // ${pct}% transparent`;
}
