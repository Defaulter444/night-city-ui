#!/usr/bin/env python3
"""Build only the module's own installable files, with deterministic ZIP metadata."""
from pathlib import Path
import hashlib
import json
import shutil
import zipfile

ROOT = Path(__file__).resolve().parent
OUT = ROOT / 'dist'
manifest = json.loads((ROOT / 'module.json').read_text(encoding='utf-8'))
assert manifest['id'] == 'night-city-ui'
assert manifest['download'].endswith(f"/v{manifest['version']}/night-city-ui.zip")
paths = ['module.json', 'README.md', 'LICENSE', 'CHANGELOG.md', 'design-qa.md']
paths += [p.relative_to(ROOT).as_posix() for folder in ['scripts', 'styles'] for p in sorted((ROOT / folder).rglob('*')) if p.is_file()]
for name in paths:
    assert (ROOT / name).is_file(), name
for name in manifest['esmodules'] + manifest['styles']:
    assert name in paths, name
OUT.mkdir(exist_ok=True)
shutil.copyfile(ROOT / 'module.json', OUT / 'module.json')
archive = OUT / 'night-city-ui.zip'
with zipfile.ZipFile(archive, 'w', zipfile.ZIP_DEFLATED) as package:
    for name in paths:
        info = zipfile.ZipInfo('night-city-ui/' + name, date_time=(2026, 10, 16, 0, 0, 0))
        info.compress_type = zipfile.ZIP_DEFLATED
        info.external_attr = 0o100644 << 16
        package.writestr(info, (ROOT / name).read_bytes())
    assert package.testzip() is None
checksums = {name: hashlib.sha256((OUT / name).read_bytes()).hexdigest() for name in ['module.json', 'night-city-ui.zip']}
(OUT / 'SHA256SUMS.txt').write_text(''.join(f'{value}  {name}\n' for name, value in checksums.items()), encoding='utf-8')
print(json.dumps({'version': manifest['version'], 'files': len(paths), 'zip_bytes': archive.stat().st_size, 'sha256': checksums}, indent=2))
