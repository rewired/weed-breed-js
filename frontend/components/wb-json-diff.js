class WbJsonDiff extends HTMLElement {
  set data({ before, after }) {
    this.before = before;
    this.after = after;
    this.render();
  }
  render() {
    this.innerHTML = `
      <div style="display:flex;gap:8px;">
        <pre style="flex:1;background:#0002;padding:8px;border-radius:6px;overflow:auto;">${JSON.stringify(this.before, null, 2) || ''}</pre>
        <pre style="flex:1;background:#0002;padding:8px;border-radius:6px;overflow:auto;">${JSON.stringify(this.after, null, 2) || ''}</pre>
      </div>`;
  }
}
customElements.define('wb-json-diff', WbJsonDiff);
export default WbJsonDiff;
