import { t } from './i18n.js';

/**
 * Left navigation: system header, searchable body tree (planets with
 * nested moons). Highlights the current selection.
 */
export class NavTree {
  constructor(root, { onPick, onOverview }) {
    this.root = root;
    this.onPick = onPick;
    this.systemDef = null;
    root.innerHTML = `
      <div class="nav-head">
        <input class="nav-search" type="search" spellcheck="false">
        <button class="nav-overview" type="button"></button>
      </div>
      <ul class="nav-list"></ul>
    `;
    this.searchEl = root.querySelector('.nav-search');
    this.listEl = root.querySelector('.nav-list');
    this.overviewBtn = root.querySelector('.nav-overview');
    this.overviewBtn.addEventListener('click', onOverview);
    this.searchEl.addEventListener('input', () => this.render());
  }

  setSystem(def) {
    this.systemDef = def;
    this.render();
  }

  nameOf(entry) {
    return t(`${entry.i18n ?? `body.${entry.id}`}.name`);
  }

  render() {
    if (!this.systemDef) return;
    this.searchEl.placeholder = t('ui.search');
    this.overviewBtn.textContent = t('ui.overview');
    const q = this.searchEl.value.trim().toLowerCase();
    const def = this.systemDef;
    const starId = def.star.id;
    const matches = (entry) => !q || this.nameOf(entry).toLowerCase().includes(q) || entry.id.includes(q);

    const children = new Map();
    for (const b of def.bodies) {
      if (b.parent && b.parent !== starId) {
        const arr = children.get(b.parent) ?? [];
        arr.push(b);
        children.set(b.parent, arr);
      }
    }

    const li = (entry, depth) => `
      <li>
        <button type="button" class="nav-item depth-${depth} ${this.selected === entry.id ? 'active' : ''}"
                data-id="${entry.id}">
          ${this.nameOf(entry)}
        </button>
      </li>`;

    let html = matches(def.star) ? li(def.star, 0) : '';
    for (const b of def.bodies) {
      if (b.parent && b.parent !== starId) continue;
      const kids = (children.get(b.id) ?? []).filter(matches);
      if (matches(b) || kids.length) {
        html += li(b, 1);
        html += kids.map((k) => li(k, 2)).join('');
      }
    }
    this.listEl.innerHTML = html;
    for (const btn of this.listEl.querySelectorAll('.nav-item')) {
      btn.addEventListener('click', () => this.onPick(btn.dataset.id));
    }
  }

  setSelected(id) {
    this.selected = id;
    for (const btn of this.listEl.querySelectorAll('.nav-item')) {
      btn.classList.toggle('active', btn.dataset.id === id);
    }
  }
}
