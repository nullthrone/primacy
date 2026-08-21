import { t } from './i18n.js';

/** Hides all chrome for clean screenshots; offers a PNG download. */
export class PhotoMode {
  constructor(engine, hintRoot) {
    this.engine = engine;
    this.root = hintRoot;
    this.active = false;
    hintRoot.innerHTML = `
      <span class="photo-hint-text"></span>
      <button class="text-btn photo-save" type="button"></button>
    `;
    hintRoot.querySelector('.photo-save').addEventListener('click', () => this.save());
  }

  toggle() {
    this.active ? this.exit() : this.enter();
  }

  enter() {
    this.active = true;
    document.body.classList.add('photo');
    this.root.querySelector('.photo-hint-text').textContent = t('ui.photoHint');
    this.root.querySelector('.photo-save').textContent = t('ui.photoSave');
    this.root.hidden = false;
    this.root.classList.remove('idle');
    clearTimeout(this._idleTimer);
    this._idleTimer = setTimeout(() => this.root.classList.add('idle'), 2500);
  }

  exit() {
    this.active = false;
    document.body.classList.remove('photo');
    this.root.hidden = true;
    this.root.classList.remove('idle');
    clearTimeout(this._idleTimer);
  }

  save() {
    // Render synchronously so the buffer is defined, then grab it.
    this.engine.renderFrame();
    this.engine.renderer.domElement.toBlob((blob) => {
      if (!blob) return;
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'primacy.png';
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 5000);
    }, 'image/png');
  }
}
