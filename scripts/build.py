import json
from pathlib import Path

root = Path(__file__).resolve().parents[1]
public = root / 'public'
assets = {}
for name, content_type in [('index.html', 'text/html; charset=utf-8'), ('styles.css', 'text/css; charset=utf-8'), ('app.js', 'text/javascript; charset=utf-8')]:
    assets['/' + name] = {'body': (public / name).read_text(), 'type': content_type}

output = root / 'dist'
(output / 'server').mkdir(parents=True, exist_ok=True)
(output / '.openai').mkdir(parents=True, exist_ok=True)
source = (root / 'worker' / 'index.js').read_text()
(output / 'server' / 'index.js').write_text(source.replace('__ASSETS__', json.dumps(assets, ensure_ascii=False)))
(output / '.openai' / 'hosting.json').write_text((root / '.openai' / 'hosting.json').read_text())
