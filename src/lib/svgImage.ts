// Turns an on-screen SVG card into a PNG: saved as a file, or handed to the
// phone's share sheet when it can take images.

function toCanvas(svg: SVGSVGElement, w: number, h: number): Promise<HTMLCanvasElement> {
  const xml = new XMLSerializer().serializeToString(svg);
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = w * 2;
      canvas.height = h * 2;
      const ctx = canvas.getContext('2d')!;
      ctx.scale(2, 2);
      ctx.drawImage(img, 0, 0);
      resolve(canvas);
    };
    img.onerror = reject;
    img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(xml)}`;
  });
}

export async function saveSvgAsPng(svg: SVGSVGElement | null, w: number, h: number, filename: string) {
  if (!svg) return;
  const canvas = await toCanvas(svg, w, h);
  const a = document.createElement('a');
  a.download = filename;
  a.href = canvas.toDataURL('image/png');
  a.click();
}

/** Shares the card as an image where the browser supports it; returns false otherwise. */
export async function shareSvgAsPng(svg: SVGSVGElement | null, w: number, h: number, filename: string, text: string): Promise<boolean> {
  if (!svg || typeof navigator === 'undefined' || !navigator.canShare) return false;
  const canvas = await toCanvas(svg, w, h);
  const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, 'image/png'));
  if (!blob) return false;
  const file = new File([blob], filename, { type: 'image/png' });
  if (!navigator.canShare({ files: [file] })) return false;
  await navigator.share({ files: [file], text }).catch(() => undefined);
  return true;
}
