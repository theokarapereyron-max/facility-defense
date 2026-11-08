// A header check is only the first gate; accepted input must still be decoded
// and re-encoded by the image processor before it can be stored or served.
export function avatarFormat(bytes) {
  if (!(bytes instanceof Uint8Array) || bytes.length === 0 || bytes.length > 3 * 1024 * 1024) return null;
  if (bytes.length >= 24 && [137,80,78,71,13,10,26,10].every((b,i)=>bytes[i]===b)) return 'png';
  if (bytes.length >= 12 && bytes[0]===255 && bytes[1]===216 && bytes[2]===255) return 'jpeg';
  if (bytes.length >= 12 && String.fromCharCode(...bytes.slice(0,4))==='RIFF' && String.fromCharCode(...bytes.slice(8,12))==='WEBP') return 'webp';
  return null;
}
