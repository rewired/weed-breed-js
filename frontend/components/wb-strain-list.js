import { listStrains } from '../api/strains.js';

class WbStrainList extends HTMLElement {
  connectedCallback() {
    this.innerHTML = `
      <div style="display:flex;gap:8px;margin-bottom:8px;">
        <button id="new" class="btn">New</button>
        <input id="q" placeholder="Filter" style="flex:1;" />
      </div>
      <ul id="list" style="list-style:none;padding:0;margin:0;display:flex;flex-direction:column;gap:4px;"></ul>
    `;
    this.querySelector('#new').addEventListener('click', () => this.dispatchEvent(new CustomEvent('create')));
    this.querySelector('#q').addEventListener('input', () => this.load());
    this.load();
  }

  async load() {
    const q = this.querySelector('#q').value;
    const strains = await listStrains({ query: q });
    const ul = this.querySelector('#list');
    ul.innerHTML = '';
    strains.forEach((s) => {
      const li = document.createElement('li');
      li.innerHTML = `<button class="btn" data-id="${s.id}">${s.name} <span class="badge">${s.meta?.status || 'draft'}</span></button>`;
      li.querySelector('button').addEventListener('click', () => this.dispatchEvent(new CustomEvent('select', { detail: s })));
      ul.appendChild(li);
    });
  }
}

customElements.define('wb-strain-list', WbStrainList);
export default WbStrainList;
