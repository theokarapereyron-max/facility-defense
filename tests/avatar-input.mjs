import {test} from 'node:test';
import assert from 'node:assert/strict';
import {avatarFormat} from '../lib/accounts/avatar-input.mjs';
test('avatar input rejects empty, oversized and unrelated content',()=>{
 assert.equal(avatarFormat(new Uint8Array()),null);
 assert.equal(avatarFormat(new TextEncoder().encode('<svg><script/></svg>')),null);
 assert.equal(avatarFormat(new Uint8Array(3*1024*1024+1)),null);
 const png=new Uint8Array(24);png.set([137,80,78,71,13,10,26,10]);assert.equal(avatarFormat(png),'png');
});
