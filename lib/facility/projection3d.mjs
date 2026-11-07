import * as THREE from 'three';
import {TILE} from './world-config.mjs';
import {CEILING_HEIGHT,EYE_HEIGHT} from './fps-ballistics.mjs';

export const CAMERA_ELEVATION = Math.PI * 0.31;
export const CAMERA_YAW = Math.PI / 7;
export const BODY_HEIGHT = 0.95;

// Simulation x/y becomes scene x/z. Floor IDs stay in the simulation;
// only the currently observed deck is drawn, so upper decks never hide it.
export const scenePosition = (p, height = 0) => new THREE.Vector3(p.x / TILE, height, p.y / TILE);

export function placeCamera(camera, center, width, height, zoom, yaw = CAMERA_YAW, elevation = CAMERA_ELEVATION) {
 const scale = Math.max(.1, zoom) * TILE;
 camera.left = -width / scale / 2;
 camera.right = width / scale / 2;
 camera.top = height / scale / 2;
 camera.bottom = -height / scale / 2;
 camera.near = .1;
 camera.far = 500;
 const distance = 100, horizontal = Math.cos(elevation) * distance;
 camera.position.set(center.x / TILE + Math.sin(yaw) * horizontal, Math.sin(elevation) * distance, center.y / TILE + Math.cos(yaw) * horizontal);
 camera.up.set(0, 1, 0);
 camera.lookAt(center.x / TILE, 0, center.y / TILE);
 camera.updateProjectionMatrix();
 camera.updateMatrixWorld(true);
 return camera;
}

export function projectPosition(camera, p, width, height, elevation = 0) {
 const v = scenePosition(p, elevation).project(camera);
 return {x:(v.x + 1) * width / 2, y:(1 - v.y) * height / 2, depth:v.z};
}

export function groundPosition(camera, x, y, width, height, elevation = 0) {
 const ray = new THREE.Raycaster();
 ray.setFromCamera(new THREE.Vector2(x / Math.max(1, width) * 2 - 1, 1 - y / Math.max(1, height) * 2), camera);
 const point = ray.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), -elevation), new THREE.Vector3());
 return point ? {x:point.x * TILE, y:point.z * TILE} : {x:camera.position.x * TILE, y:camera.position.z * TILE};
}

export function cameraRelativeInput(input, yaw) {
 const x = input.x || 0, y = input.y || 0, c = Math.cos(yaw), s = Math.sin(yaw);
 return {...input, x:x * c + y * s, y:y * c - x * s,
  ...(Number.isFinite(input.angle) ? {angle:input.angle - yaw} : {})};
}

export function placeFirstPerson(camera, player, width, height, pitch, fov = camera.fov) {
 camera.fov = fov;
 camera.aspect = Math.max(1, width) / Math.max(1, height);
 camera.position.set(player.x / TILE, EYE_HEIGHT+(player.stairHeight||0), player.y / TILE);
 const horizontal = Math.cos(pitch);
 camera.lookAt(camera.position.x + Math.cos(player.angle) * horizontal,
  camera.position.y + Math.sin(pitch), camera.position.z + Math.sin(player.angle) * horizontal);
 camera.updateProjectionMatrix();
 camera.updateMatrixWorld(true);
}

// Only walls in front of the local action are lowered; collisions are untouched.
export function wallHeight(cell, player, yaw, cutaway = true) {
 if(!cutaway)return CEILING_HEIGHT;
 const dx = cell.x - player.x / TILE, dz = cell.z - player.y / TILE;
 return dx * dx + dz * dz < 18 * 18 && dx * Math.sin(yaw) + dz * Math.cos(yaw) > -.8 ? .38 : CEILING_HEIGHT;
}

export function boundaryWalls(floor) {
 const walls = [], {cols, rows, grid} = floor;
 for(let y=1;y<rows-1;y++)for(let x=1;x<cols-1;x++) {
  const i = y * cols + x;
  if(grid[i]!==1)continue;
  if([i-1,i+1,i-cols,i+cols].some(n=>grid[n]===0||grid[n]===2))walls.push({x:x+.5,z:y+.5});
 }
 return walls;
}
