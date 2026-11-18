import type * as THREE from 'three';

// What the scene needs from a car, whether it's built in code or loaded from a model file.
// Convention: car faces +X, wheels touch y = 0, centred on the origin.
export interface WheelRig {
  steer: THREE.Object3D; // yaws for steering (front wheels)
  spinner: THREE.Object3D; // rolls about its local Z axis
  front: boolean;
  spinSign: 1 | -1; // multiplies roll angle so every wheel rolls forward
}

export interface CarRig {
  root: THREE.Object3D;
  body: THREE.Object3D; // sprung mass: pitches and rolls on the suspension
  wheels: WheelRig[];
  wheelRadius: number;
  rearAxleX: number;
  trackHalfWidth: number;
  length: number;
  setLights: (intensity: number) => void;
  dispose: () => void;
}
