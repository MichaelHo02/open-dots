/** Run: node --import tsx scripts/stroke-check.ts */
import assert from 'node:assert/strict';
import { strokePoints, symmetricPoints } from '../lib/stroke';
for (const end of [[19,4],[-12,5],[2,-20],[0,0]]) {
  const points = strokePoints(0,0,end[0],end[1]);
  assert.deepEqual(points[0],{x:0,y:0});
  assert.deepEqual(points.at(-1),{x:end[0],y:end[1]});
  for (let i=1;i<points.length;i++) {
    assert.ok(Math.abs(points[i].x-points[i-1].x)<=1);
    assert.ok(Math.abs(points[i].y-points[i-1].y)<=1);
  }
}
assert.deepEqual(symmetricPoints({x:1,y:2},8,8,'both'),[{x:1,y:2},{x:6,y:2},{x:1,y:5},{x:6,y:5}]);
assert.equal(symmetricPoints({x:2,y:2},5,5,'both').length,1);
console.log('PASS: continuous strokes in all directions and symmetry deduplication');
