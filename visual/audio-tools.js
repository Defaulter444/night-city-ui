const MODULE = 'night-city-ui';
function playlists() { return Array.from(game.playlists ?? []); }
const ONCE_FLAG = MODULE + '.soundboardOnce';
const pendingSoundboardTracks = new Set();
function isOneShot(track) { return foundry.utils.getProperty(track.flags, ONCE_FLAG) === true; }
export async function playSoundboardOnce(track) {
    if (!game.user?.isGM || track.parent?.mode !== CONST.PLAYLIST_MODES.DISABLED)
        return;
    const flag = `flags.${ONCE_FLAG}`;
    const stop = { playing: false, pausedTime: 0.0001, [flag]: true };
    const start = { playing: true, pausedTime: null, [flag]: true };
    if (track.playing)
        await track.update(stop);
    await track.update(start);
}
/** Apply the shared playback marker to each client's runtime Sound, preserving Repeat. */
export function registerSoundboardOnce() {
    const watched = new WeakSet();
    const nativeSync = PlaylistSound.prototype.sync;
    PlaylistSound.prototype.sync = function () {
        nativeSync.call(this);
        const sound = this.sound;
        if (!sound)
            return;
        if (!watched.has(sound)) {
            watched.add(sound);
            sound.addEventListener('play', () => { if (isOneShot(this))
                sound.loop = false; });
        }
        if (sound.playing && isOneShot(this))
            sound.loop = false;
    };
    const clearForNativePlay = (change) => {
        const flag = `flags.${ONCE_FLAG}`;
        const marked = change[flag] === true || foundry.utils.getProperty(change, flag) === true;
        if (change.playing === true && !marked)
            change[flag] = false;
    };
    Hooks.on('preUpdatePlaylistSound', (_track, change, options) => { if (!options?.pvtSeek)
        clearForNativePlay(change); });
    Hooks.on('preUpdatePlaylist', (_playlist, change) => {
        if (Array.isArray(change.sounds))
            for (const sound of change.sounds)
                clearForNativePlay(sound);
    });
}
export function audioTime(seconds) {
    const value = Math.max(0, Math.floor(Number.isFinite(seconds) ? seconds : 0));
    return `${Math.floor(value / 60)}:${String(value % 60).padStart(2, '0')}`;
}
export function parseAudioTime(value) {
    if (!/^\d+(?::[0-5]\d){0,2}$/.test(value.trim()))
        return null;
    return value.trim().split(':').reduce((sum, part) => sum * 60 + Number(part), 0);
}
export async function seekAudio(track, seconds) {
    if (!game.user?.isGM)
        throw Error('Общее воспроизведение может менять только Мастер.');
    const duration = track.sound?.duration;
    if (!duration || !Number.isFinite(duration) || !Number.isFinite(seconds))
        throw Error('Длительность трека недоступна.');
    const offset = Math.max(0, Math.min(seconds, Math.max(0, duration - 0.01)));
    const playing = track.playing;
    const options = { render: false, pvtSeek: true };
    if (playing)
        await track.update({ playing: false, pausedTime: offset }, options);
    await track.update({ playing, pausedTime: offset }, options);
    updateSidebarProgress();
    updateSoundboardIndicators();
}
export function updateSoundboardIndicators() {
    document.querySelectorAll('#pvt-soundboard [data-track]').forEach(row => {
        const track = game.playlists?.get(row.dataset.playlist ?? '')?.sounds.get(row.dataset.track ?? '');
        const button = row.querySelector('.pvt-sound-tile');
        if (!track || !button)
            return;
        button.classList.toggle('playing', track.playing);
        button.setAttribute('aria-pressed', String(track.playing));
        button.setAttribute('aria-label', `${track.playing ? 'Стоп' : 'Играть'} ${track.name ?? ''}`);
        button.disabled = pendingSoundboardTracks.has(track) || !game.user?.isGM || !track.path || !!track.sound?.failed;
    });
}
function description(track) {
    return String(track.description ?? '').trim() || String(foundry.utils.getProperty(track.flags, MODULE + '.soundDescription') ?? '').trim();
}
const progressRows = new Map();
let progressTimer;
const progressObserver = new IntersectionObserver(entries => {
    for (const entry of entries)
        progressRows.set(entry.target, entry.isIntersecting);
    refreshProgressPolling();
});
function refreshProgressPolling(update = true) {
    const active = [];
    for (const [row, visible] of progressRows) {
        if (!row.isConnected) {
            progressObserver.unobserve(row);
            progressRows.delete(row);
            continue;
        }
        const track = game.playlists?.get(row.dataset.playlistId ?? '')?.sounds.get(row.dataset.soundId ?? '');
        if (visible && !document.hidden && track?.playing)
            active.push(row);
    }
    if (update)
        updateProgressRows(active);
    if (active.length && !progressTimer)
        progressTimer = setInterval(refreshProgressPolling, 500);
    else if (!active.length && progressTimer) {
        clearInterval(progressTimer);
        progressTimer = undefined;
    }
}
/** Separate from the native .sound-volume slider: values are seconds. */
export function mountSidebarProgress(root) {
    root.querySelectorAll('#currently-playing .sound[data-sound-id]').forEach(row => {
        if (!progressRows.has(row)) {
            progressRows.set(row, false);
            progressObserver.observe(row);
        }
        if (row.querySelector('[data-pvt-progress]'))
            return;
        const group = document.createElement('div');
        group.className = 'pvt-sidebar-progress';
        group.dataset.pvtProgress = '';
        const slider = document.createElement('input');
        slider.type = 'range';
        slider.min = '0';
        slider.max = '0';
        slider.step = '0.1';
        slider.value = '0';
        slider.dataset.pvtSidebarSeek = '';
        slider.setAttribute('aria-label', 'Позиция воспроизведения');
        slider.title = 'Позиция воспроизведения — перетащите или щёлкните для перемотки';
        const skipButton = (seconds) => {
            const button = document.createElement('button');
            button.type = 'button';
            button.dataset.pvtSidebarSkip = String(seconds);
            button.textContent = seconds < 0 ? '−20s' : '+20s';
            button.title = seconds < 0 ? 'Назад на 20 секунд' : 'Вперёд на 20 секунд';
            button.setAttribute('aria-label', button.title);
            button.addEventListener('click', event => {
                event.preventDefault();
                event.stopPropagation();
                const track = game.playlists?.get(row.dataset.playlistId ?? '')?.sounds.get(row.dataset.soundId ?? '');
                if (!track || !game.user?.isGM || slider.dataset.seeking)
                    return;
                slider.dataset.seeking = 'true';
                slider.setAttribute('aria-busy', 'true');
                void seekAudio(track, (track.sound?.currentTime ?? track.pausedTime ?? 0) + seconds)
                    .catch(error => ui.notifications?.error(String(error))).finally(() => { delete slider.dataset.seeking; slider.removeAttribute('aria-busy'); updateSidebarProgress(root); });
            });
            return button;
        };
        group.append(skipButton(-20), slider, skipButton(20));
        row.append(group);
        slider.addEventListener('pointerdown', () => { slider.dataset.interacting = 'true'; });
        slider.addEventListener('pointercancel', () => { delete slider.dataset.interacting; });
        slider.addEventListener('pointerup', () => { delete slider.dataset.interacting; });
        slider.addEventListener('input', () => { slider.dataset.interacting = 'true'; });
        slider.addEventListener('blur', () => { delete slider.dataset.interacting; });
        slider.addEventListener('change', event => {
            event.stopPropagation();
            delete slider.dataset.interacting;
            if (slider.dataset.seeking)
                return;
            const track = game.playlists?.get(row.dataset.playlistId ?? '')?.sounds.get(row.dataset.soundId ?? '');
            if (!track || !game.user?.isGM)
                return;
            slider.dataset.seeking = 'true';
            slider.setAttribute('aria-busy', 'true');
            void seekAudio(track, Number(slider.value)).catch(error => ui.notifications?.error(String(error))).finally(() => {
                delete slider.dataset.seeking;
                slider.removeAttribute('aria-busy');
                updateSidebarProgress(root);
            });
        });
    });
    updateSidebarProgress(root);
}
export function updateSidebarProgress(root = document) {
    updateProgressRows(Array.from(root.querySelectorAll('#currently-playing .sound[data-sound-id]')));
    refreshProgressPolling(false);
}
function updateProgressRows(rows) {
    for (const row of rows) {
        const track = game.playlists?.get(row.dataset.playlistId ?? '')?.sounds.get(row.dataset.soundId ?? '');
        const slider = row.querySelector('[data-pvt-sidebar-seek]');
        if (!track || !slider || slider.dataset.seeking)
            continue;
        const reportedDuration = track.sound?.duration;
        if (reportedDuration && Number.isFinite(reportedDuration))
            slider.dataset.pvtDuration = String(reportedDuration);
        const duration = reportedDuration && Number.isFinite(reportedDuration) ? reportedDuration : Number(slider.dataset.pvtDuration);
        const current = track.sound?.currentTime ?? track.pausedTime ?? 0;
        const loaded = !!duration && Number.isFinite(duration);
        slider.disabled = !game.user?.isGM || !loaded;
        row.querySelectorAll('[data-pvt-sidebar-skip]').forEach(button => { button.disabled = slider.disabled; });
        if (!slider.dataset.interacting) {
            slider.max = String(loaded ? duration : 0);
            slider.value = String(current);
        }
    }
}
export class Soundboard extends Application {
    static get defaultOptions() {
        return foundry.utils.mergeObject(super.defaultOptions, { id: 'pvt-soundboard', title: 'Звуковая панель', width: 220, height: 320, resizable: false, template: `modules/${MODULE}/visual/soundboard.hbs` });
    }
    getData() {
        const data = { isGM: !!game.user?.isGM, boards: playlists().filter(p => p.mode === CONST.PLAYLIST_MODES.DISABLED && foundry.utils.getProperty(p.flags, MODULE + '.includeSoundboard') === true && p.visible).map(p => ({ id: p.id, sounds: p.sounds.contents.map(s => ({ id: s.id, name: s.name, description: description(s), playing: s.playing, missing: !s.path || s.sound?.failed, image: foundry.utils.getProperty(s.flags, MODULE + '.soundImage') })) })) };
        const expanded = foundry.utils.getProperty(game.folders ?? {}, '_expanded');
        const folders = new Map();
        const roots = [];
        const loose = [];
        const ensure = (folder) => {
            const existing = folders.get(folder.id);
            if (existing)
                return existing;
            const branch = { id: folder.id, uuid: folder.uuid, name: folder.name ?? 'Папка', color: String(folder.color ?? ''), collapsed: !expanded?.[folder.uuid], children: [], sounds: [] };
            folders.set(branch.id, branch);
            if (folder.folder)
                ensure(folder.folder).children.push(branch);
            else
                roots.push(branch);
            return branch;
        };
        for (const board of data.boards) {
            const playlist = game.playlists?.get(board.id);
            if (!playlist)
                continue;
            const tiles = board.sounds.map(sound => ({ ...sound, playlist: board.id, isGM: data.isGM }));
            if (playlist.folder)
                ensure(playlist.folder).sounds.push(...tiles);
            else
                loose.push(...tiles);
        }
        const sort = (branches) => {
            branches.sort((a, b) => a.name.localeCompare(b.name));
            for (const branch of branches)
                sort(branch.children);
        };
        sort(roots);
        return { ...data, folders: roots, loose, hasSounds: data.boards.length > 0 };
    }
    activateListeners(html) {
        super.activateListeners(html);
        html[0]?.querySelectorAll('[data-action="play"]').forEach(button => button.addEventListener('click', () => {
            if (!game.user?.isGM)
                return;
            const row = button.closest('[data-track]');
            const track = game.playlists?.get(row?.dataset.playlist ?? '')?.sounds.get(row?.dataset.track ?? '');
            if (!track || pendingSoundboardTracks.has(track))
                return;
            pendingSoundboardTracks.add(track);
            button.disabled = true;
            const playback = track.playing ? track.update({ playing: false, pausedTime: null }) : playSoundboardOnce(track);
            void playback.catch(error => ui.notifications?.error(String(error))).finally(() => {
                pendingSoundboardTracks.delete(track);
                button.disabled = !game.user?.isGM || !track.path || !!track.sound?.failed;
                updateSoundboardIndicators();
            });
        }));
        html[0]?.querySelectorAll('.folder-header').forEach(header => {
            const toggle = (event) => {
                event.preventDefault();
                const native = ui.playlists;
                native._toggleFolder.call(this, event);
                header.setAttribute('aria-expanded', String(!header.parentElement?.classList.contains('collapsed')));
            };
            header.addEventListener('click', toggle);
            header.addEventListener('keydown', event => { if (event.key === 'Enter' || event.key === ' ')
                toggle(event); });
        });
    }
}
let soundboardApp;
export function toggleSoundboard() {
    soundboardApp ??= new Soundboard();
    if (soundboardApp.rendered)
        void soundboardApp.close();
    else
        soundboardApp.render(true);
}
export function registerAudioTools() {
    registerSoundboardOnce();
    game.keybindings.register(MODULE, 'toggleSoundboard', {
        name: 'Звуковая панель — открыть или закрыть', hint: 'Открывает или закрывает компактную звуковую панель.',
        editable: [{ key: 'KeyS', modifiers: ['Alt', 'Shift'] }],
        onDown: () => { toggleSoundboard(); return true; }, restricted: true,
    });
    Hooks.on('getSceneControlButtons', (controls) => {
        const tokens = controls.find(control => control.name === 'token');
        if (!tokens || tokens.tools.some(tool => tool.name === 'vt-soundboard'))
            return;
        tokens.tools.push({ name: 'vt-soundboard', title: 'Звуковая панель', icon: 'fas fa-volume-up', button: true, visible: !!game.user?.isGM, onClick: toggleSoundboard });
    });
    Hooks.on('renderPlaylistDirectory', (_app, html) => {
        const root = html[0];
        if (!root)
            return;
        mountSidebarProgress(root);
        if (root.querySelector('[data-pvt-soundboard-open]'))
            return;
        const boardButton = document.createElement('button');
        boardButton.type = 'button';
        boardButton.dataset.pvtSoundboardOpen = '';
        const nativeButton = root.querySelector('.directory-footer button, .directory-header button');
        if (nativeButton)
            boardButton.className = nativeButton.className;
        boardButton.innerHTML = '<i class="fas fa-volume-up" aria-hidden="true"></i> Звуковая панель';
        boardButton.title = 'Звуковая панель (Alt+Shift+S; меняется в «Настройке управления»)';
        boardButton.addEventListener('click', toggleSoundboard);
        (root.querySelector('.directory-header') ?? root).prepend(boardButton);
    });
    Hooks.on('renderPlaylistConfig', (app, html) => {
        const root = html[0];
        if (!root || !game.user?.isGM || root.querySelector('[data-pvt-include-soundboard]'))
            return;
        const group = document.createElement('div');
        group.className = 'form-group';
        group.dataset.pvtIncludeSoundboard = '';
        const label = document.createElement('label');
        label.textContent = 'Показывать на звуковой панели';
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.name = `flags.${MODULE}.includeSoundboard`;
        checkbox.checked = foundry.utils.getProperty(app.object.flags, MODULE + '.includeSoundboard') === true;
        group.append(label, checkbox);
        const submit = root.querySelector('button[type="submit"]');
        if (submit)
            submit.before(group);
        else
            root.append(group);
        const mode = root.querySelector('[name="mode"]');
        const syncAvailability = () => {
            const available = Number(mode?.value ?? app.object.mode) === CONST.PLAYLIST_MODES.DISABLED;
            group.hidden = !available;
            checkbox.disabled = !available;
        };
        mode?.addEventListener('change', syncAvailability);
        syncAvailability();
    });
    Hooks.on('renderPlaylistSoundConfig', (app, html) => {
        const root = html[0];
        if (!root || !game.user?.isGM || root.querySelector('[data-pvt-sound-image]'))
            return;
        for (const [key, labelText] of [['soundImage', 'Картинка для звуковой панели']]) {
            const group = document.createElement('div');
            group.className = 'form-group';
            group.dataset.pvtSoundImage = '';
            const label = document.createElement('label');
            label.textContent = labelText;
            const input = document.createElement('input');
            input.name = `flags.${MODULE}.${key}`;
            input.value = String(foundry.utils.getProperty(app.object.flags, MODULE + '.' + key) ?? '');
            group.append(label);
            if (key === 'soundImage') {
                const fields = document.createElement('div');
                fields.className = 'form-fields';
                const browse = document.createElement('button');
                browse.type = 'button';
                browse.className = 'file-picker';
                browse.title = 'Выбрать картинку для звуковой панели';
                browse.setAttribute('aria-label', browse.title);
                const icon = document.createElement('i');
                icon.className = 'fas fa-file-import';
                icon.setAttribute('aria-hidden', 'true');
                browse.append(icon);
                browse.addEventListener('click', event => {
                    event.preventDefault();
                    new FilePicker({ type: 'image', current: input.value, callback: path => { input.value = path; input.dispatchEvent(new Event('change', { bubbles: true })); } }).render(true);
                });
                fields.append(input, browse);
                group.append(fields);
            }
            else
                group.append(input);
            const submit = root.querySelector('button[type="submit"]');
            if (submit)
                submit.before(group);
            else
                root.append(group);
        }
    });
    const refresh = () => { if (soundboardApp?.rendered)
        soundboardApp.render(false); };
    for (const hook of ['createPlaylist', 'updatePlaylist', 'deletePlaylist', 'createPlaylistSound', 'deletePlaylistSound'])
        Hooks.on(hook, refresh);
    Hooks.on('updatePlaylistSound', (_track, _change, options) => {
        updateSoundboardIndicators();
        updateSidebarProgress();
        if (!options?.pvtSeek)
            refresh();
    });
    for (const hook of ['createFolder', 'updateFolder', 'deleteFolder'])
        Hooks.on(hook, refresh);
    Hooks.once('ready', async () => { await loadTemplates([`modules/${MODULE}/visual/soundboard-folder.hbs`, `modules/${MODULE}/visual/soundboard-tile.hbs`]); });
    document.addEventListener('visibilitychange', () => refreshProgressPolling());
    window.addEventListener('pagehide', () => { if (progressTimer)
        clearInterval(progressTimer); progressTimer = undefined; });
}
