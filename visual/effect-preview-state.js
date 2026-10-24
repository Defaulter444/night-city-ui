const previews = new Map();
export function tokenPreview(token) { return previews.get(token); }
export function anyTokenPreview() { return previews.size > 0; }
export function setTokenPreview(token, kind) {
    previews.clear();
    if (token && kind)
        previews.set(token, { kind, created: Date.now() });
    Hooks.callAll('pneumaVisualToolsPreviewChanged');
}
