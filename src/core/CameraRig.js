import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

const _end = new THREE.Vector3();
const _delta = new THREE.Vector3();

// Farthest catalogued point from any system barycenter: Halley's aphelion,
// ~35.1 AU. Camera bounds derive from where this lands in scene units at
// the current scale blend, so they follow mode transitions exactly.
const OUTERMOST_AU = 36;
// Didactic floors: systems span ~420 u, the interstellar map ~850 u.
const MIN_MAX_DISTANCE = 4000;
const MIN_TARGET_RADIUS = 2000;

function easeInOut(t) {
  return t * t * (3 - 2 * t);
}

/**
 * Camera + OrbitControls with cinematic fly-to and follow mode. While
 * following, the camera keeps its user-chosen offset relative to the moving
 * body (expressed in units of the body's display radius, so scale-mode
 * changes re-frame consistently). Dolly and rotate speeds adapt to the
 * distance to the target's surface.
 */
export class CameraRig {
  constructor(engine, domElement, scale = null) {
    this.engine = engine;
    this.camera = engine.camera;
    this.scale = scale;
    this.controls = new OrbitControls(this.camera, domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.07;
    this.controls.maxDistance = MIN_MAX_DISTANCE;
    this.controls.maxTargetRadius = MIN_TARGET_RADIUS;
    this.followCtl = null;
    this.flight = null;
    this._lastFollowPos = new THREE.Vector3();
  }

  /** Fly to a body controller; keeps tracking it during the flight. */
  flyTo(ctl, { distanceFactor = 4.2, duration = null, onArrive = null } = {}) {
    const radius = ctl.body?.displayRadius ?? 5;
    const targetPos = ctl.worldPos;
    // Approach along the current view direction, offset slightly upward.
    const dir = this.camera.position.clone().sub(targetPos);
    if (dir.lengthSq() < 1e-9) dir.set(0.4, 0.3, 1);
    dir.normalize();
    dir.y += 0.22;
    dir.normalize();
    const dist = Math.max(radius * distanceFactor, radius + 0.02);
    const travel = this.camera.position.distanceTo(targetPos);
    this.flight = {
      ctl,
      dir,
      dist,
      t: 0,
      duration: duration ?? Math.min(3.2, 1.1 + Math.log10(1 + travel) * 0.55),
      startPos: this.camera.position.clone(),
      startTarget: this.controls.target.clone(),
      onArrive,
    };
    this.controls.enabled = false;
  }

  /** Tween to a fixed pose (used for the system overview). */
  flyToPose(position, target, duration = 1.8) {
    const start = this.camera.position.clone();
    const startTarget = this.controls.target.clone();
    this.followCtl = null;
    this.flight = {
      pose: { position: position.clone(), target: target.clone() },
      t: 0,
      duration,
      startPos: start,
      startTarget,
    };
    this.controls.enabled = false;
  }

  follow(ctl) {
    this.followCtl = ctl;
    if (ctl) {
      this._lastFollowPos.copy(ctl.worldPos);
      this._lastFollowRadius = ctl.body?.displayRadius ?? null;
    }
  }

  stop() {
    this.flight = null;
    this.controls.enabled = true;
    this.followCtl = null;
  }

  /** Re-frame after a scale-mode change: keep offset in display radii. */
  reframeFollowed(oldRadius, newRadius) {
    if (!this.followCtl || oldRadius <= 0) return;
    const pos = this.followCtl.worldPos;
    _delta.copy(this.camera.position).sub(pos).multiplyScalar(newRadius / oldRadius);
    this.camera.position.copy(pos).add(_delta);
    this.controls.target.copy(pos);
  }

  update(dt) {
    if (this.flight) {
      const f = this.flight;
      f.t = Math.min(1, f.t + dt / f.duration);
      const e = easeInOut(f.t);
      if (f.pose) {
        this.camera.position.lerpVectors(f.startPos, f.pose.position, e);
        this.controls.target.lerpVectors(f.startTarget, f.pose.target, e);
        if (f.t >= 1) {
          this.controls.enabled = true;
          this.flight = null;
        }
      } else {
        const targetPos = f.ctl.worldPos;
        _end.copy(f.dir).multiplyScalar(f.dist).add(targetPos);
        this.camera.position.lerpVectors(f.startPos, _end, e);
        this.controls.target.lerpVectors(f.startTarget, targetPos, Math.min(1, e * 1.5));
        if (f.t >= 1) {
          this.controls.enabled = true;
          this.follow(f.ctl);
          const done = f.onArrive;
          this.flight = null;
          done?.();
        }
      }
    } else if (this.followCtl) {
      // Carry the camera along with the body, keep the user's offset.
      _delta.copy(this.followCtl.worldPos).sub(this._lastFollowPos);
      this.camera.position.add(_delta);
      this.controls.target.add(_delta);
      this._lastFollowPos.copy(this.followCtl.worldPos);
      const r = this.followCtl.body?.displayRadius ?? 0.5;
      // Scale-mode transitions change the display radius; keep the
      // framing by scaling the camera offset along with it.
      if (this._lastFollowRadius && Math.abs(r - this._lastFollowRadius) > 1e-9) {
        _delta.copy(this.camera.position).sub(this.followCtl.worldPos)
          .multiplyScalar(r / this._lastFollowRadius);
        this.camera.position.copy(this.followCtl.worldPos).add(_delta);
      }
      this._lastFollowRadius = r;
      this.controls.minDistance = Math.max(r * 1.35, 0.01);
    } else {
      this.controls.minDistance = 0.01;
    }

    // Bound dolly and pan to the world's current extent so the camera can
    // never be lost in the void with nothing on screen. Tracking the live
    // scale blend keeps the bounds outside every reachable body mid-
    // transition, and reels a far-out camera back in when the world
    // shrinks from true scale to didactic underneath it.
    if (this.scale) {
      const worldR = this.scale.mapDistance(OUTERMOST_AU);
      this.controls.maxDistance = Math.max(MIN_MAX_DISTANCE, worldR * 2.2);
      this.controls.maxTargetRadius = Math.max(MIN_TARGET_RADIUS, worldR * 1.2);
    }

    // Distance-adaptive interaction speeds.
    const surfDist = Math.max(0.02,
      this.camera.position.distanceTo(this.controls.target) -
      (this.followCtl?.body?.displayRadius ?? 0));
    this.controls.zoomSpeed = THREE.MathUtils.clamp(Math.log10(1 + surfDist) * 0.55, 0.25, 2.2);
    this.controls.rotateSpeed = THREE.MathUtils.clamp(Math.log10(1 + surfDist) * 0.4, 0.3, 1.1);

    this.controls.update();
  }
}
