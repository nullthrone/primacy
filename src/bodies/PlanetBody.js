import * as THREE from 'three';

const DEG = Math.PI / 180;

/**
 * A planet/moon/dwarf: tilt group (obliquity) -> spinning surface mesh,
 * plus extras (clouds, atmosphere shell, rings) provided by the material
 * factory. Built at unit radius; display size via setRadius, so scale
 * transitions are cheap.
 */
export class PlanetBody {
  constructor(def, materials = null) {
    this.def = def;
    this.id = def.id;
    this.group = new THREE.Group();
    this.group.name = `body:${def.id}`;

    // Obliquity: rotate the spin axis around scene X (system plane is XZ).
    this.tilt = new THREE.Group();
    this.tilt.rotation.x = (def.physical.obliquityDeg || 0) * DEG;
    this.group.add(this.tilt);

    const geo = new THREE.SphereGeometry(1, 64, 32);
    this.material = materials?.createFor(def) ?? new THREE.MeshStandardMaterial({
      color: def.material?.tint ?? 0x8899aa,
      roughness: 0.92,
      metalness: 0.0,
    });
    this.mesh = new THREE.Mesh(geo, this.material);
    this.mesh.name = def.id;
    this.tilt.add(this.mesh);

    this.extras = materials?.extrasFor(def) ?? [];
    for (const ex of this.extras) {
      if (!ex.mesh) continue;
      (ex.attach === 'group' ? this.group : this.tilt).add(ex.mesh);
    }
  }

  setRadius(r) {
    this.mesh.scale.setScalar(r);
    for (const ex of this.extras) ex.onRadius?.(r);
  }

  get displayRadius() {
    return this.mesh.scale.x;
  }

  /** Spin from simulation time; tidally locked bodies are set explicitly. */
  updateSpin(jd) {
    const p = this.def.physical;
    if (p.tidallyLocked) return;
    const rotH = p.rotationH || 24;
    const angle = (((jd * 24) / rotH) * 2 * Math.PI) % (2 * Math.PI);
    this.setSpinAngle(angle);
  }

  setSpinAngle(rad) {
    this.mesh.rotation.y = rad;
    for (const ex of this.extras) ex.onSpin?.(rad);
  }

  /** Per-frame sun geometry (world space). */
  setSun(dirWorld, sunPosWorld, sunColor, bodyWorldPos) {
    this.material.userData.sunHook?.(dirWorld, sunPosWorld, sunColor, this.mesh);
    for (const ex of this.extras) ex.setSun?.(dirWorld, sunPosWorld, sunColor, bodyWorldPos);
  }

  update(dt, camera) {
    this.material.userData.tick?.(dt);
    for (const ex of this.extras) ex.update?.(dt, camera);
  }

  dispose() {
    this.mesh.geometry.dispose();
    this.material.dispose?.();
    for (const ex of this.extras) ex.dispose?.();
  }
}
