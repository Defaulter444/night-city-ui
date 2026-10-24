class SceneImagePopout extends ImagePopout {
    async _render(force, options) {
        await super._render(force, options);
        const bounds = document.getElementById('board')?.getBoundingClientRect();
        const areaWidth = bounds?.width || window.innerWidth;
        const areaHeight = bounds?.height || window.innerHeight;
        const width = Math.floor(Math.min(areaWidth, window.innerWidth) * 0.75);
        const height = Math.floor(Math.min(areaHeight, window.innerHeight) * 0.75);
        this.setPosition({ width, height, left: (window.innerWidth - width) / 2, top: (window.innerHeight - height) / 2 });
    }
}
export function registerScenePreviews() {
    let popup = null;
    let timer;
    let dismissTimer;
    let generation = 0;
    const hide = () => { generation++; clearTimeout(timer); clearTimeout(dismissTimer); popup?.remove(); popup = null; };
    const keepOpen = () => { clearTimeout(dismissTimer); };
    const dismiss = () => { clearTimeout(dismissTimer); dismissTimer = setTimeout(hide, 250); };
    const position = (row) => {
        if (!popup)
            return;
        const rect = row.getBoundingClientRect();
        const left = rect.left >= popup.offsetWidth + 12 ? rect.left - popup.offsetWidth - 8 : rect.right + 8;
        popup.style.left = `${Math.max(8, Math.min(left, innerWidth - popup.offsetWidth - 8))}px`;
        popup.style.top = `${Math.max(8, Math.min(rect.top, innerHeight - popup.offsetHeight - 8))}px`;
    };
    Hooks.on('renderCompendium', (app, html) => {
        const pack = app.collection;
        if (pack.documentName !== 'Scene')
            return;
        html[0]?.querySelectorAll('[data-document-id]').forEach(row => {
            const open = (event) => {
                const target = event.target;
                if (!(target instanceof Element) || !target.closest('.document-name, .entry-name, .thumbnail, h3, h4, img'))
                    return;
                event.preventDefault();
                event.stopImmediatePropagation();
                hide();
                void pack.getDocument(row.dataset.documentId).then(scene => {
                    if (!(scene instanceof Scene) || !scene.background.src)
                        return;
                    new SceneImagePopout(scene.background.src, { title: scene.name ?? 'Сцена', classes: ['image-popout', 'dark', 'pvt-scene-image-popout'], resizable: true }).render(true);
                }).catch(error => ui.notifications?.error(String(error)));
            };
            row.addEventListener('click', open, true);
            row.addEventListener('keydown', event => { if (event.key === 'Enter' || event.key === ' ')
                open(event); }, true);
            const show = () => {
                hide();
                const request = generation;
                timer = setTimeout(() => {
                    void (async () => {
                        try {
                            const scene = await pack.getDocument(row.dataset.documentId);
                            if (request !== generation || !row.isConnected || !(scene instanceof Scene))
                                return;
                            popup = document.createElement('aside');
                            popup.className = 'pvt-scene-preview';
                            popup.setAttribute('role', 'tooltip');
                            popup.setAttribute('aria-label', 'Превью сцены');
                            popup.addEventListener('mouseenter', keepOpen);
                            popup.addEventListener('mouseleave', dismiss);
                            popup.addEventListener('focusin', keepOpen);
                            popup.addEventListener('focusout', dismiss);
                            const heading = document.createElement('strong');
                            heading.textContent = scene.name ?? 'Сцена';
                            popup.append(heading);
                            if (scene.thumb) {
                                const image = document.createElement('img');
                                image.src = scene.thumb;
                                image.alt = scene.name ?? 'Миниатюра сцены';
                                image.addEventListener('load', () => position(row));
                                popup.append(image);
                            }
                            const grids = ['Без сетки', 'Квадратная', 'Гексы (нечётные ряды)', 'Гексы (чётные ряды)', 'Гексы (нечётные столбцы)', 'Гексы (чётные столбцы)'];
                            const info = document.createElement('div');
                            info.className = 'pvt-scene-preview-info';
                            const background = (scene.background.src ?? '').split(/[?#]/)[0] ?? '';
                            const animated = /\.(webm|mp4|m4v|mov|ogv|ogg|gif)$/i.test(background);
                            const columns = [
                                [`Размер: ${scene.width} × ${scene.height} px`, animated ? 'Анимированная' : 'Изображение'],
                                [`Сетка: ${grids[scene.grid.type] ?? 'Сетка'}`, `Клетка: ${scene.grid.size} px`, `Масштаб клетки: ${scene.grid.distance} ${scene.grid.units}`]
                            ];
                            for (const lines of columns) {
                                const column = document.createElement('div');
                                column.textContent = lines.join('\n');
                                info.append(column);
                            }
                            popup.append(info);
                            document.body.append(popup);
                            position(row);
                        }
                        catch {
                            if (request === generation)
                                hide();
                        }
                    })();
                }, 250);
            };
            row.addEventListener('mouseenter', show);
            row.addEventListener('mouseleave', dismiss);
            row.addEventListener('focusin', show);
            row.addEventListener('focusout', dismiss);
            row.addEventListener('dragstart', hide);
        });
    });
    Hooks.on('closeCompendium', hide);
    document.addEventListener('keydown', event => { if (event.key === 'Escape')
        hide(); });
    window.addEventListener('resize', hide);
    document.addEventListener('scroll', hide, true);
}
