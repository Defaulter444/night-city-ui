#!/usr/bin/env python3
"""Build only the module's own installable files, with deterministic ZIP metadata."""
from pathlib import Path
import hashlib
import json
import sys
import zipfile

ROOT = Path(__file__).resolve().parent
# --preview builds the test channel served from the development branch; the ZIP embeds that manifest.
PREVIEW = '--preview' in sys.argv
PREVIEW_URL = 'https://raw.githubusercontent.com/Defaulter444/night-city-ui/refs/heads/claude/pensive-rubin-8opsg3/distribution/preview/'
OUT = ROOT / 'distribution' / 'preview' if PREVIEW else ROOT / 'dist'
manifest = json.loads((ROOT / 'module.json').read_text(encoding='utf-8'))
assert manifest['id'] == 'night-city-ui'
assert manifest['download'].endswith(f"/v{manifest['version']}/night-city-ui.zip")
paths = ['module.json', 'README.md', 'LICENSE', 'CHANGELOG.md', 'THIRD_PARTY_NOTICES.md', 'design-qa.md']
paths += [p.relative_to(ROOT).as_posix() for folder in ['scripts', 'styles', 'visual'] for p in sorted((ROOT / folder).rglob('*')) if p.is_file()]
for name in paths:
    assert (ROOT / name).is_file(), name
for name in manifest['esmodules'] + manifest['styles'] + [lang['path'] for lang in manifest.get('languages', [])]:
    assert name in paths, name
if PREVIEW:
    manifest |= {'manifest': PREVIEW_URL + 'module.json', 'download': PREVIEW_URL + 'night-city-ui.zip'}
manifest_bytes = (json.dumps(manifest, ensure_ascii=False, indent=2) + '\n').encode('utf-8')
OUT.mkdir(parents=True, exist_ok=True)
(OUT / 'module.json').write_bytes(manifest_bytes)
archive = OUT / 'night-city-ui.zip'
with zipfile.ZipFile(archive, 'w', zipfile.ZIP_DEFLATED) as package:
    for name in paths:
        info = zipfile.ZipInfo('night-city-ui/' + name, date_time=(2026, 10, 16, 0, 0, 0))
        info.compress_type = zipfile.ZIP_DEFLATED
        info.external_attr = 0o100644 << 16
        package.writestr(info, manifest_bytes if name == 'module.json' else (ROOT / name).read_bytes())
    assert package.testzip() is None
checksums = {name: hashlib.sha256((OUT / name).read_bytes()).hexdigest() for name in ['module.json', 'night-city-ui.zip']}
(OUT / 'SHA256SUMS.txt').write_text(''.join(f'{value}  {name}\n' for name, value in checksums.items()), encoding='utf-8')
print(json.dumps({'version': manifest['version'], 'files': len(paths), 'zip_bytes': archive.stat().st_size, 'sha256': checksums}, indent=2))
