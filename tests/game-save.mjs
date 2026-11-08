import {test} from 'node:test';
import assert from 'node:assert/strict';
import {gameSave} from '../lib/accounts/game-save.mjs';
test('cloud data includes permanent records and audio, not mission or device state',()=>{
 const save=gameSave({best:42,completed:1,played:2,health:20},{music:true,volume:130,renderMode:'fps',zoom:90});
 assert.deepEqual(save,{version:1,records:{best:42,completed:1,played:2},preferences:{music:true,volume:100}});
 assert.throws(()=>gameSave({best:0,completed:3,played:1},{}));
 assert.throws(()=>gameSave({best:NaN,completed:0,played:0},{}));
});
