/**
 * Owns one SystemScene (+ its LabelManager) per star system, built lazily
 * on first visit and cached forever. One renderer/composer serves all.
 */
import { SystemScene } from '../scenes/SystemScene.js';

export class SceneRouter {
  constructor({ engine, time, scale, materials, defs, makeLabels, catalog = null, custom = {} }) {
    this.engine = engine;
    this.time = time;
    this.scale = scale;
    this.materials = materials;
    this.defs = defs;
    this.makeLabels = makeLabels;
    this.catalog = catalog;
    this.custom = custom;
    this.entries = new Map();
    this.activeId = null;
  }

  get active() {
    return this.entries.get(this.activeId) ?? null;
  }

  has(id) {
    return !!this.defs[id] || !!this.custom[id];
  }

  switchTo(id) {
    if (!this.has(id)) return null;
    let entry = this.entries.get(id);
    if (!entry) {
      const scene = this.custom[id]
        ? this.custom[id]()
        : new SystemScene({
          def: this.defs[id],
          engine: this.engine,
          time: this.time,
          scale: this.scale,
          materials: this.materials,
          catalog: this.catalog,
        });
      const labels = this.makeLabels(scene);
      entry = { id, scene, labels };
      this.entries.set(id, entry);
    }
    if (this.active && this.active !== entry) {
      // Hide the outgoing system's DOM labels.
      this.active.labels.enabled = false;
      this.active.labels.update();
    }
    this.activeId = id;
    entry.labels.enabled = true;
    this.engine.setScene(entry.scene.scene);
    return entry;
  }
}
