/**
 * 油猴面板。资料存在脚本管理器里，不上传。
 */
'use strict';

const core = require('./core');
const pageApi = require('./page');

const STORE_KEY = 'profile';
const HOST_ID = 'gj-net-apply-host';
const PANEL_LINK = 'https://getjob.help/?src=net-apply&via=panel';
const FAIL_PDF = '无法读取这份 PDF，换一份，或改成手动填写。';

function gmGet(key, fallback) {
  try {
    if (typeof GM_getValue === 'function') return GM_getValue(key, fallback);
  } catch (_) { /* 管理器没有把接口放出来 */ }
  return fallback;
}

function gmSet(key, value) {
  try {
    if (typeof GM_setValue === 'function') GM_setValue(key, value);
  } catch (_) { /* 存不下就只留在这次面板里 */ }
}

function readSaved() {
  const raw = gmGet(STORE_KEY, null);
  if (!raw || typeof raw !== 'object') return core.normalizeSources(core.emptyProfile(), null);
  const hasSources = raw.sources && typeof raw.sources === 'object';
  return core.normalizeSources(raw.profile, hasSources ? raw.sources : null);
}

function writeSaved(profile, sources) {
  const next = core.normalizeSources(profile, sources);
  gmSet(STORE_KEY, { version: 1, profile: next.profile, sources: next.sources });
  return next;
}

function esc(value) {
  return String(value == null ? '' : value).replace(/[&<>"']/g, (ch) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  }[ch]));
}

function markReadback(writes, readback) {
  const byId = {};
  (Array.isArray(readback) ? readback : []).forEach((item) => {
    if (item && item.id) byId[item.id] = item;
  });
  return writes.map((write) => {
    if (write.status === 'miss' || !write.control) return write;
    const back = byId[write.id];
    if (back && back.ok) {
      const picked = back.optionText || '';
      if (picked && write.optionText && picked !== write.optionText) {
        return Object.assign({}, write, {
          optionText: picked,
          status: 'check',
          reason: `资料写「${write.copy || write.optionText}」，选了「${picked}」`,
        });
      }
      if (write.status === 'check') {
        return Object.assign({}, write, {
          optionText: picked || write.optionText,
          status: 'check',
          reason: write.reason || `选了「${picked || write.optionText}」，请核对`,
        });
      }
      return write;
    }
    return {
      id: write.id,
      key: write.key,
      status: 'miss',
      reason: (back && back.reason) || '网页没有接住',
      label: write.label,
      copy: write.copy || '',
      fix: write.key || '',
    };
  });
}

function pdfApi() {
  const lib = globalThis.pdfjsLib;
  if (lib && typeof lib.getDocument === 'function') return lib;
  return null;
}

function ensurePdf() {
  if (pdfApi()) return pdfApi();
  if (typeof globalThis.__gjLoadPdfWorker === 'function') {
    globalThis.__gjLoadPdfWorker();
    globalThis.__gjLoadPdfWorker = null;
  }
  if (typeof globalThis.__gjLoadPdfLib === 'function') {
    globalThis.__gjLoadPdfLib();
    globalThis.__gjLoadPdfLib = null;
  }
  return pdfApi();
}

async function readPdf(file) {
  if (!file) return { ok: false, message: FAIL_PDF };
  const name = file.name || '';
  if (!/\.pdf$/i.test(name) && file.type !== 'application/pdf') {
    return { ok: false, message: '请选择 PDF' };
  }
  if (file.size > core.PDF_MAX_BYTES) {
    return { ok: false, message: core.limitMessage('read', false, true) };
  }
  const pdfjs = ensurePdf();
  if (!pdfjs) return { ok: false, message: FAIL_PDF };
  let data;
  try {
    data = new Uint8Array(await file.arrayBuffer());
  } catch (_) {
    return { ok: false, message: FAIL_PDF };
  }
  try {
    const task = pdfjs.getDocument({
      data,
      isEvalSupported: false,
      disableFontFace: true,
      isOffscreenCanvasSupported: false,
      useWorkerFetch: false,
    });
    const doc = await task.promise;
    try {
      const pages = doc.numPages || 0;
      if (pages > core.PDF_MAX_PAGES) {
        return { ok: false, message: core.limitMessage('read', true, false) };
      }
      let text = '';
      for (let i = 1; i <= pages; i += 1) {
        const pdfPage = await doc.getPage(i);
        const content = await pdfPage.getTextContent();
        text += `${(content.items || []).map((item) => item.str || '').join(' ')}\n`;
        try { pdfPage.cleanup(); } catch (_) { /* 这一页的文字已经拿到 */ }
      }
      return { ok: true, text };
    } finally {
      try { await doc.destroy(); } catch (_) { /* 读完就放掉 */ }
    }
  } catch (_) {
    return { ok: false, message: FAIL_PDF };
  }
}

function boot() {
  const saved = readSaved();
  const state = {
    open: false,
    painting: false,
    busy: false,
    profile: Object.assign({}, saved.profile),
    sources: Object.assign({}, saved.sources),
    message: '',
    rows: [],
  };

  let shadow = null;

  function draftDirty() {
    const current = readSaved();
    return core.FIELD_KEYS.some((key) => String(state.profile[key] || '') !== String(current.profile[key] || ''));
  }

  function syncFromDom() {
    if (!shadow || state.painting) return;
    core.FIELD_KEYS.forEach((key) => {
      const el = shadow.querySelector(`[data-key="${key}"]`);
      if (!el) return;
      const value = el.value;
      if (value !== state.profile[key]) {
        state.profile[key] = value;
        state.sources[key] = 'user';
      }
    });
  }

  function fieldControl(field) {
    const value = state.profile[field.key] || '';
    if (field.multiline) {
      return `<textarea data-key="${field.key}" rows="3">${esc(value)}</textarea>`;
    }
    if (field.options) {
      const options = ['<option value="">请选择</option>'].concat(field.options.map((item) => (
        `<option value="${esc(item)}"${item === value ? ' selected' : ''}>${esc(item)}</option>`
      )));
      return `<select data-key="${field.key}">${options.join('')}</select>`;
    }
    const placeholder = field.key === 'birthday' ? core.DEFAULT_BIRTHDAY : (field.placeholder || '');
    return `<input data-key="${field.key}" type="text" value="${esc(value)}" placeholder="${esc(placeholder)}">`;
  }

  function resultsHtml() {
    if (!state.rows.length) return '';
    const groups = [
      ['filled', '已填'],
      ['check', '待核对'],
      ['miss', '留空'],
    ];
    return groups.map(([status, title]) => {
      const rows = state.rows.filter((row) => row.status === status);
      const items = rows.length
        ? rows.map((row) => `<li><b>${esc(row.label || '未命名')}</b> ${esc(row.text || '')}</li>`).join('')
        : '<li class="muted">无</li>';
      return `<section class="result"><h3>${title}</h3><ul>${items}</ul></section>`;
    }).join('');
  }

  function panelHtml() {
    const sections = core.SECTIONS.map((section) => {
      const fields = section.fields.map((field) => {
        const hint = field.key === 'idNo' ? '<p class="hint">只存在这台电脑的脚本里，不上传。</p>' : '';
        return `<label class="field"><span>${esc(field.label)}</span>${fieldControl(field)}${hint}</label>`;
      }).join('');
      const note = section.note ? `<p class="note">${esc(section.note)}</p>` : '';
      return `<section><h2>${esc(section.title)}</h2>${note}${fields}</section>`;
    }).join('');
    const dirty = draftDirty() ? '<p class="warn">有修改还没保存，这次填写仍用已保存的资料。</p>' : '';
    return `<div class="panel" role="dialog" aria-label="网申自动填写">
      <header><strong>网申自动填写</strong><button type="button" data-act="close">收起</button></header>
      <div class="body">
        <p class="lead">用本机简历填当前这一张表。脚本不代点提交。</p>
        ${sections}
        <label class="file">选择文字版 PDF<input type="file" accept="application/pdf,.pdf" data-act="pdf"></label>
        <p class="message" role="status">${esc(state.message)}</p>
        ${dirty}
        <div class="actions">
          <button type="button" data-act="save">保存</button>
          <button type="button" data-act="clear">清空资料</button>
          <button type="button" data-act="fill">按简历填写</button>
        </div>
        <div class="results">${resultsHtml()}</div>
        <p class="foot"><a href="${PANEL_LINK}" target="_blank" rel="noopener noreferrer">打开 GetJob 官网即可直接体验：${PANEL_LINK}</a></p>
      </div>
    </div>`;
  }

  function paint() {
    if (!shadow) return;
    state.painting = true;
    shadow.innerHTML = `<style>${css()}</style>` + (state.open
      ? panelHtml()
      : '<button type="button" class="launcher" data-act="open">网申填写</button>');
    state.painting = false;
    bind();
  }

  function bind() {
    function onEdit(event) {
      if (state.painting) return;
      const el = event.currentTarget;
      const key = el.getAttribute('data-key');
      state.profile[key] = el.value;
      state.sources[key] = 'user';
      const warn = shadow.querySelector('.warn');
      if (!warn && draftDirty()) {
        const message = shadow.querySelector('.message');
        if (message) message.insertAdjacentHTML('afterend', '<p class="warn">有修改还没保存，这次填写仍用已保存的资料。</p>');
      }
    }
    shadow.querySelectorAll('button, a, input, select, textarea').forEach((el) => {
      el.addEventListener('mousedown', (event) => event.stopPropagation());
      el.addEventListener('click', (event) => event.stopPropagation());
    });
    const open = shadow.querySelector('[data-act="open"]');
    if (open) open.addEventListener('click', () => { state.open = true; paint(); });
    const close = shadow.querySelector('[data-act="close"]');
    if (close) {
      close.addEventListener('click', () => {
        state.open = false;
        state.rows = [];
        state.message = '';
        paint();
      });
    }
    shadow.querySelectorAll('[data-key]').forEach((el) => {
      el.addEventListener('input', onEdit);
      el.addEventListener('change', onEdit);
    });
    const file = shadow.querySelector('[data-act="pdf"]');
    if (file) {
      file.addEventListener('change', () => {
        const picked = file.files && file.files[0];
        file.value = '';
        if (picked) ingest(picked);
      });
    }
    const save = shadow.querySelector('[data-act="save"]');
    if (save) save.addEventListener('click', onSave);
    const clear = shadow.querySelector('[data-act="clear"]');
    if (clear) clear.addEventListener('click', onClear);
    const fill = shadow.querySelector('[data-act="fill"]');
    if (fill) fill.addEventListener('click', onFill);
  }

  function onSave() {
    syncFromDom();
    const next = writeSaved(state.profile, state.sources);
    state.profile = Object.assign({}, next.profile);
    state.sources = Object.assign({}, next.sources);
    state.message = '资料已保存在这台电脑的脚本里。';
    paint();
  }

  function onClear() {
    const empty = writeSaved(core.emptyProfile(), core.emptySources());
    state.profile = Object.assign({}, empty.profile);
    state.sources = Object.assign({}, empty.sources);
    state.rows = [];
    state.message = '资料已清空。';
    paint();
  }

  async function ingest(file) {
    if (state.busy) return;
    state.busy = true;
    state.message = '正在读取 PDF';
    paint();
    const read = await readPdf(file);
    state.busy = false;
    if (!read.ok) {
      state.message = read.message || FAIL_PDF;
      paint();
      return;
    }
    if (core.meaningfulText(read.text).length < core.MIN_TEXT_CHARS) {
      state.message = '这份 PDF 去掉空白后不足 20 个字，像是扫描件或图片，没有读取。改成手动填写。';
      paint();
      return;
    }
    const extracted = core.extractProfileFromText(read.text);
    const merged = core.mergePdfProfile(state.profile, state.sources, extracted);
    state.profile = merged.profile;
    state.sources = merged.sources;
    state.message = '已从 PDF 写入草稿。核对后点保存，再去报名页填写。';
    paint();
  }

  async function onFill() {
    if (state.busy) return;
    syncFromDom();
    const saved = readSaved();
    if (!core.filledKeys(saved.profile).length) {
      state.message = '先保存资料，再填写。';
      state.rows = [];
      paint();
      return;
    }
    state.busy = true;
    state.message = '正在填写…';
    paint();
    let collected = null;
    try {
      collected = pageApi.collectPageFields();
    } catch (_) {
      collected = null;
    }
    if (!collected) {
      state.busy = false;
      state.message = '这页看不出是报名表，没有填写。';
      paint();
      return;
    }
    const judged = core.classifyPage(location.href, collected.fields, !!collected.challenge);
    if (judged.challenge) {
      state.busy = false;
      state.message = '这页需要验证，没有填写。';
      state.rows = [];
      paint();
      return;
    }
    if (!judged.ok) {
      state.busy = false;
      state.message = '这页看不出是报名表，没有填写。';
      state.rows = [];
      paint();
      return;
    }
    const planned = core.planRuleFills(collected.fields, saved.profile);
    let applied = planned.writes.slice();
    try {
      if (planned.writes.length) {
        const readback = await pageApi.applyPageWrites(planned.writes);
        applied = markReadback(planned.writes, readback);
      }
    } catch (_) {
      applied = planned.writes.map((write) => Object.assign({}, write, {
        status: 'miss',
        reason: '没有填上',
      }));
    }
    state.rows = core.resultRows(collected.fields, saved.profile, applied);
    state.busy = false;
    state.message = '填完了。请自己核对，再点报名站的提交。';
    paint();
  }

  function css() {
    return `
      :host, * { box-sizing: border-box; }
      .launcher, button, input, select, textarea { font: 14px/1.4 -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
      .launcher {
        position: fixed; right: 16px; bottom: 16px; z-index: 2147483646;
        border: 0; border-radius: 999px; padding: 10px 14px; cursor: pointer;
        background: #143d2c; color: #fff;
      }
      .panel {
        position: fixed; right: 16px; bottom: 16px; z-index: 2147483646;
        width: min(380px, calc(100vw - 24px)); max-height: min(640px, calc(100vh - 24px));
        display: flex; flex-direction: column; overflow: hidden;
        background: #fff; color: #1c1915; border: 1px solid #d9d3c7; border-radius: 12px;
        box-shadow: 0 12px 40px rgba(28, 25, 21, 0.18);
      }
      header, .body { padding: 12px 14px; }
      header { display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #eee6d8; }
      header button, .actions button { border: 1px solid #d9d3c7; background: #fff; border-radius: 8px; padding: 6px 10px; cursor: pointer; }
      .actions button[data-act="fill"] { background: #143d2c; color: #fff; border-color: #143d2c; }
      .body { overflow: auto; }
      h2 { margin: 14px 0 6px; font-size: 13px; }
      h3 { margin: 0 0 4px; font-size: 13px; }
      .note, .hint, .lead, .foot, .muted { color: #6d655b; font-size: 12px; }
      .hint { margin: 4px 0 0; }
      .field { display: block; margin: 8px 0; }
      .field span { display: block; margin-bottom: 4px; }
      input, select, textarea { width: 100%; border: 1px solid #d9d3c7; border-radius: 8px; padding: 6px 8px; background: #fff; color: inherit; }
      .file { display: block; margin: 12px 0; font-size: 13px; }
      .message { min-height: 1.2em; }
      .warn { color: #8a4b08; font-size: 12px; }
      .actions { display: flex; flex-wrap: wrap; gap: 8px; margin: 8px 0 12px; }
      .result { margin-top: 10px; }
      .result ul { margin: 0; padding-left: 18px; }
      .foot a { color: #143d2c; word-break: break-all; }
    `;
  }

  function ensure() {
    let host = document.getElementById(HOST_ID);
    if (host && host.isConnected) return;
    host = document.createElement('div');
    host.id = HOST_ID;
    host.setAttribute('data-gj-net-apply', '1');
    document.documentElement.appendChild(host);
    shadow = host.attachShadow({ mode: 'closed' });
    paint();
  }

  try {
    if (typeof GM_addStyle === 'function') {
      GM_addStyle(`#${HOST_ID}{all:initial;position:fixed;right:16px;bottom:16px;z-index:2147483646;width:0;height:0;overflow:visible;}`);
    }
  } catch (_) { /* 样式写在影子树里 */ }

  ensure();
  try {
    const observer = new MutationObserver(() => ensure());
    observer.observe(document.documentElement, { childList: true });
  } catch (_) { /* 页面不允许观察时，靠下面的定时器 */ }
  setInterval(ensure, 2000);
}

if (typeof document !== 'undefined' && document.documentElement) boot();
