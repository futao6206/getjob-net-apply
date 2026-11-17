'use strict';

const fs = require('fs');
const path = require('path');
const esbuild = require('esbuild');

const ROOT = __dirname;
const RAW = 'https://raw.githubusercontent.com/futao6206/getjob-net-apply/main/dist/getjob-net-apply.user.js';

const HEADER = `// ==UserScript==
// @name         网申自动填写
// @namespace    https://github.com/futao6206/getjob-net-apply
// @version      1.1.1
// @description  在北森、大易、Moka、国聘等网申页，用本机简历填写报名表。免费，不代提交。
// @match        http://*/*
// @match        https://*/*
// @noframes
// @run-at       document-idle
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_addStyle
// @inject-into  page
// @license      MIT
// @downloadURL  ${RAW}
// @updateURL    ${RAW}
// ==/UserScript==
`;

function stripModuleExport(source) {
  return source
    .replace(/import\.meta\.url/g, '""')
    .replace(/import\.meta/g, '({})')
    .replace(/;export\{[^}]*\};?\s*$/, ';');
}

function wrapLazy(name, source) {
  return `globalThis.${name}=function(){\n${stripModuleExport(source)}\n};\n`;
}

async function main() {
  const result = await esbuild.build({
    absWorkingDir: ROOT,
    entryPoints: [path.join(ROOT, 'src/panel.js')],
    bundle: true,
    format: 'iife',
    platform: 'browser',
    target: ['es2020'],
    legalComments: 'none',
    write: false,
  });
  const worker = fs.readFileSync(path.join(ROOT, 'vendor/pdfjs/pdf.worker.min.mjs'), 'utf8');
  const lib = fs.readFileSync(path.join(ROOT, 'vendor/pdfjs/pdf.min.mjs'), 'utf8');
  const app = result.outputFiles[0].text;
  const out = `${HEADER}\n${wrapLazy('__gjLoadPdfWorker', worker)}${wrapLazy('__gjLoadPdfLib', lib)}${app}\n`;
  const dist = path.join(ROOT, 'dist');
  fs.mkdirSync(dist, { recursive: true });
  const file = path.join(dist, 'getjob-net-apply.user.js');
  fs.writeFileSync(file, out);
  console.log(`wrote ${file} (${out.length} bytes)`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
