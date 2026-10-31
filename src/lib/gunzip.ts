// The standalone file stores the bundled data gzipped (base64), which keeps
// the file a fraction of the size; this unpacks one dataset when it's needed.
export async function gunzipJson(b64: string): Promise<unknown> {
  const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'));
  return JSON.parse(await new Response(stream).text());
}
