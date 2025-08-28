import '../components/wb-strain-list.js';
import '../components/wb-strain-form.js';
import '../components/wb-json-diff.js';

export default async function renderStrainEditor(root) {
  root.innerHTML = `
    <div style="display:flex;gap:16px;">
      <wb-strain-list style="flex:1"></wb-strain-list>
      <wb-strain-form style="flex:2"></wb-strain-form>
    </div>
  `;
  const list = root.querySelector('wb-strain-list');
  const form = root.querySelector('wb-strain-form');
  list.addEventListener('select', (e) => { form.strain = e.detail; });
  list.addEventListener('create', () => { form.strain = {}; });
  form.addEventListener('saved', () => list.load());
  form.addEventListener('published', () => list.load());
}
