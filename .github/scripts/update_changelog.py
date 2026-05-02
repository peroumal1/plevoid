import os
import re

version = os.environ['VERSION']
today   = os.environ['TODAY']

with open('/tmp/commits.txt') as f:
    commits = [l.strip() for l in f if l.strip()]

added = [c[len('feat:'):].strip()  for c in commits if c.lower().startswith('feat:')]
fixed = [c[len('fix:'):].strip()   for c in commits if c.lower().startswith('fix:')]
other = [c for c in commits if not c.lower().startswith(('feat:', 'fix:', 'chore:'))]

sections = []
if added: sections.append('### Added\n'   + '\n'.join(f'- {a}' for a in added))
if fixed: sections.append('### Fixed\n'   + '\n'.join(f'- {f}' for f in fixed))
if other: sections.append('### Changed\n' + '\n'.join(f'- {o}' for o in other))
if not sections: sections.append('### Changed\n- maintenance')

entry = f"## [{version}] — {today}\n\n" + '\n\n'.join(sections) + "\n\n"

with open('CHANGELOG.md', 'r') as f:
    content = f.read()

match = re.search(r'^## \[', content, re.MULTILINE)
insert_at = match.start() if match else len(content)
content = content[:insert_at] + entry + content[insert_at:]

with open('CHANGELOG.md', 'w') as f:
    f.write(content)

print(f"CHANGELOG updated for v{version}")
