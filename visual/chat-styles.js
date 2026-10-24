/** Visual Tools owns stylesheet delivery (not a Combat Tools migration hook).
 * Normal loading is via module.json. This fallback covers an older cached
 * manifest that loads the effects stylesheet but omits the separated chat files.
 * Resolve from the module URL to preserve Foundry's optional route prefix.
 */
export function ensureChatStyles(moduleURL) {
    // Same shared-layout/appearance order as module.json; each asset is deduped.
    for (const [name, file] of [["layout", "chat-cards.css"], ["hub", "chat-hub.css"], ["native", "chat-theme.css"]]) {
        const url = new URL("./" + file, moduleURL);
        const exists = Array.from(document.querySelectorAll('link[rel="stylesheet"]'))
            .some(link => {
            const loaded = new URL(link.href, document.baseURI);
            return loaded.origin === url.origin && loaded.pathname === url.pathname;
        });
        if (exists)
            continue;
        const link = document.createElement("link");
        link.rel = "stylesheet";
        link.href = url.href;
        link.dataset.pneumaChatStyle = name;
        link.addEventListener("error", () => console.error("night-city-ui | Could not load chat skin", url.href), { once: true });
        document.head.append(link);
    }
}
