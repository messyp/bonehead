// Cache-bust every ES module for deploys: adds an import map that points each
// module at ?v=<content hash>, and stamps the entry script. Run on a copy of dist.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const root = process.argv[2] || 'dist';
const files = [];
const walk = dir => { for (const f of fs.readdirSync(dir)) { const p = path.join(dir, f); if (fs.statSync(p).isDirectory()) walk(p); else if (p.endsWith('.js')) files.push(p); } };
walk(root);
const imports = {};
for (const f of files) {
  const rel = './' + path.relative(root, f).split(path.sep).join('/');
  const hash = crypto.createHash('sha1').update(fs.readFileSync(f)).digest('hex').slice(0, 10);
  imports[rel] = `${rel}?v=${hash}`;
}
const indexPath = path.join(root, 'index.html');
let html = fs.readFileSync(indexPath, 'utf8');
const map = `<script type="importmap">${JSON.stringify({ imports })}</script>`;
html = html.replace(/<script type="importmap">.*?<\/script>\n?/s, '');
html = html.replace('<script type="module" src="js/main.js"></script>', `${map}\n<script type="module" src="${imports['./js/main.js']}"></script>`);
fs.writeFileSync(indexPath, html);
console.log(`Stamped ${files.length} modules.`);
