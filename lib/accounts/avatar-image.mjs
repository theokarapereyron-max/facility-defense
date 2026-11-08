import { PhotonImage } from '@cf-wasm/photon';
import { avatarFormat } from './avatar-input.mjs';

// The crop editor produces PNG. Check dimensions before allocating the decoder;
// original JPEG/WebP inputs are cropped to this format in the editor.
export function sanitizeAvatar(bytes) {
 if(avatarFormat(bytes)!=='png') throw new Error('INVALID_AVATAR');
 const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
 if(String.fromCharCode(...bytes.slice(12,16))!=='IHDR') throw new Error('INVALID_AVATAR');
 const width=view.getUint32(16),height=view.getUint32(20);
 if(width!==256||height!==256) throw new Error('INVALID_AVATAR_DIMENSIONS');
 let image;
 try {
  image=PhotonImage.new_from_byteslice(bytes);
  if(image.get_width()!==256||image.get_height()!==256) throw new Error('INVALID_AVATAR_DIMENSIONS');
  return image.get_bytes();
 } finally { image?.free(); }
}
