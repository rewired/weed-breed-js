import { createStrain, updateStrain, publishStrain } from '../api/strains.js';

class WbStrainForm extends HTMLElement {
  constructor() {
    super();
    this._strain = null;
    this._timer = null;
  }

  connectedCallback() {
    this.render();
  }

  set strain(s) {
    this._strain = s;
    this.render();
  }

  render() {
    if (!this.isConnected) return;
    const s = this._strain || {};
    this.innerHTML = `
      <div style="display:flex;flex-direction:column;gap:8px;">
        <input id="name" placeholder="Name" value="${s.name || ''}" />
        <pre id="preview" style="background:#0002;padding:8px;border-radius:6px;overflow:auto;max-height:300px;"></pre>
        <button id="publish" class="btn">Publish</button>
      </div>
    `;
    const nameInput = this.querySelector('#name');
    const preview = this.querySelector('#preview');
    const updatePreview = () => { preview.textContent = JSON.stringify(this._strain, null, 2); };
    const save = async () => {
      const data = { ...(this._strain || {}), name: nameInput.value, genotype: this._strain?.genotype || { sativa:1, indica:0, ruderalis:0 } };
      let res;
      if (data.id) res = await updateStrain(data.id, data);
      else res = await createStrain(data);
      this._strain = res;
      updatePreview();
      this.dispatchEvent(new CustomEvent('saved', { detail: res }));
    };
    nameInput.addEventListener('input', () => {
      clearTimeout(this._timer);
      this._timer = setTimeout(save, 500);
    });
    updatePreview();
    this.querySelector('#publish').addEventListener('click', async () => {
      if (!this._strain?.id) return;
      const pub = await publishStrain(this._strain.id, 'patch');
      this.dispatchEvent(new CustomEvent('published', { detail: pub }));
    });
  }
}

customElements.define('wb-strain-form', WbStrainForm);
export default WbStrainForm;
