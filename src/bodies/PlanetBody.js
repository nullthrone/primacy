import * as THREE from 'three';

const DEG = Math.PI / 180;

/**
 * A planet/moon/dwarf: tilt group (obliquity) -> spin mesh. Material comes
 * from the material factory (Materials.js); until M3 lands a tinted
 * standard material stands in. Built at unit radius, display size via
 * setRadius, so scale transitions are cheap.
 */
export class PlanetBody {
  constructor(def, material = null) {
    this.def = def;
    this.id = def.id;
    this.group = new THREE.Group();
    this.group.name = `body:${def.id}`;

    // Tilt: rotate the spin axis by obliquity around scene X (the system
    // plane is XZ, axis default +Y).
    this.tilt = new THREE.Group();
    this.tilt.rotation.x = (def.physical.obliquityDeg || 0) * DEG;
    this.group.add(this.tilt);

    const geo = new THREE.SphereGeometry(1, 64, 32);
    this.material = material || new THREE.MeshStandardMaterial({
      color: def.material?.tint ?? 0x8899aa,
      roughness: 0.92,
      metalness: 0.0,
    });
    this.mesh = new THREE.Mesh(geo, this.material);
    this.mesh.name = def.id;
    this.tilt.add(this.mesh);

    this.extras = []; // clouds/atmosphere/rings attach here (M3+)
  }

  setRadius(r) {
    this.mesh.scale.setScalar(r);
    for (const ex of this.extras) ex.onRadius?.(r);
  }

  get displayRadius() {
    return this.mesh.scale.x;
  }

  /**
   * Spin angle from simulation time. Tidally locked bodies get their angle
   * set explicitly by the system scene (from true longitude) instead.
   */
  updateSpin(jd) {
    const p = this.def.physical;
    if (p.tidallyLocked) return;
    const rotH = p.rotationH || 24;
    const angle = ((jd * 24) / rotH) * 2 * Math.PI;
    this.mesh.rotation.y = angle % (2 * Math.PI);
  }

  setSpinAngle(rad) {
    this.mesh.rotation.y = rad;
  }

  update(dt, camera) {
    for (const ex of this.extras) ex.update?.(dt, camera);
  }

  dispose() {
    this.mesh.geometry.dispose();
    this.material.dispose?.();
    for (const ex of this.extras) ex.dispose?.();
  }
}
