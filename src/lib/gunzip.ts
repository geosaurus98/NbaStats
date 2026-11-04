// The standalone file stores the bundled data gzipped (base64), which keeps
// the file a fraction of the size; this unpacks one dataset when it's needed.

/** Base64 to bytes: the browser's own decoder via a data: URL, or a plain loop if that's unavailable. */
async function decode(b64: string): Promise<Blob> {
  try {
    const res = await fetch(`data:application/octet-stream;base64,${b64}`);
    if (res.ok) return await res.blob();
  } catch {
    /* fall through */
  }
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes]);
}

export async function gunzipJson(b64: string): Promise<unknown> {
  const stream = (await decode(b64)).stream().pipeThrough(new DecompressionStream('gzip'));
  return JSON.parse(await new Response(stream).text());
}
