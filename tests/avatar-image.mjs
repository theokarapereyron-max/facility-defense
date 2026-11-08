import {test} from 'node:test';
import assert from 'node:assert/strict';
import {PhotonImage} from '@cf-wasm/photon';
import {sanitizeAvatar} from '../lib/accounts/avatar-image.mjs';

test('avatar processor decodes and re-encodes the cropped image',()=>{
 const source=new PhotonImage(new Uint8Array(256*256*4).fill(255),256,256);
 let decoded;
 try {
  const output=sanitizeAvatar(source.get_bytes());
  decoded=PhotonImage.new_from_byteslice(output);
  assert.equal(decoded.get_width(),256);assert.equal(decoded.get_height(),256);
 } finally {source.free();decoded?.free();}
});
test('avatar processor rejects oversized dimensions before decoding',()=>{
 const bytes=new Uint8Array(24);bytes.set([137,80,78,71,13,10,26,10]);bytes.set([73,72,68,82],12);
 const view=new DataView(bytes.buffer);view.setUint32(16,100000);view.setUint32(20,100000);
 assert.throws(()=>sanitizeAvatar(bytes),/INVALID_AVATAR_DIMENSIONS/);
 assert.throws(()=>sanitizeAvatar(new TextEncoder().encode('<svg/>')),/INVALID_AVATAR/);
});
