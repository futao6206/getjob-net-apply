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
    savedNote: false,
    panelHeight: 0,
    rows: [],
  };

  let shadow = null;
  let saveTimer = null;

  function writeNow() {
    if (saveTimer) {
      clearTimeout(saveTimer);
      saveTimer = null;
    }
    const next = writeSaved(state.profile, state.sources);
    state.savedNote = true;
    const active = shadow && shadow.activeElement;
    core.FIELD_KEYS.forEach((key) => {
      state.sources[key] = next.sources[key];
      if (active && active.getAttribute && active.getAttribute('data-key') === key) return;
      state.profile[key] = next.profile[key];
    });
  }

  function scheduleSave() {
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      saveTimer = null;
      writeSaved(state.profile, state.sources);
      state.savedNote = true;
      const note = shadow && shadow.querySelector('[data-save-state]');
      if (note) note.textContent = '已自动保存在这台电脑。';
    }, 400);
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
    const groups = { filled: [], check: [], miss: [] };
    state.rows.forEach((row, index) => {
      const bucket = row.status === 'filled' ? 'filled' : (row.status === 'check' ? 'check' : 'miss');
      groups[bucket].push(Object.assign({ index }, row));
    });
    const rowHtml = (row) => {
      const copy = row.copy ? `<em data-act="copy" data-row="${row.index}">复制</em>` : '';
      const fix = row.fix ? `<em data-act="fix" data-fix="${esc(row.fix)}">去补</em>` : '';
      const text = row.text || '';
      return `<button type="button" class="hit" data-act="scroll" data-id="${esc(row.id)}"><b>${esc(row.label || '未命名')}</b><span title="${esc(text)}">${esc(text)}</span>${copy}${fix}</button>`;
    };
    const group = (title, list) => (list.length ? `<div class="bucket"><div class="group">${title}</div>${list.map(rowHtml).join('')}</div>` : '');
    const chip = (cls, title, count) => `<span class="chip ${cls}">${title} ${count}</span>`;
    return `<div class="result-card">
      <div class="result-sum">${chip('ok', '已填', groups.filled.length)}${chip('check', '待核对', groups.check.length)}${chip('miss', '没填上', groups.miss.length)}</div>
      <div class="result-body">${group('已填', groups.filled)}${group('待核对', groups.check)}${group('没填上', groups.miss)}</div>
    </div>`;
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
    const saveNote = state.savedNote ? '已自动保存在这台电脑。' : '修改会自动保存在这台电脑，不上传。';
    const heightStyle = state.panelHeight ? ` style="height:${state.panelHeight}px;max-height:${state.panelHeight}px"` : '';
    return `<div class="panel" role="dialog" aria-label="网申自动填写"${heightStyle}>
      <div class="resize-top" data-act="resize" title="按住向上拖，加大显示区域"></div>
      <header data-act="resize"><strong>网申自动填写</strong><button type="button" data-act="close">收起</button></header>
      <div class="body">
        <p class="lead">用上面的资料填写你正在看的这一页。脚本不代点提交。</p>
        ${sections}
        <label class="file">选择文字版 PDF<input type="file" accept="application/pdf,.pdf" data-act="pdf"></label>
        <p class="message" role="status">${esc(state.message)}</p>
        <p class="hint" data-save-state>${saveNote}</p>
        <div class="actions">
          <button type="button" data-act="clear">清空资料</button>
          <button type="button" data-act="fill">自动填写当前页面</button>
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
      if (!key || el.value === state.profile[key]) return;
      state.profile[key] = el.value;
      state.sources[key] = 'user';
      scheduleSave();
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
        syncFromDom();
        if (saveTimer) writeNow();
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
    const clear = shadow.querySelector('[data-act="clear"]');
    if (clear) clear.addEventListener('click', onClear);
    const fill = shadow.querySelector('[data-act="fill"]');
    if (fill) fill.addEventListener('click', onFill);
    shadow.querySelectorAll('[data-act="resize"]').forEach((el) => {
      el.addEventListener('pointerdown', startResize);
    });
    shadow.querySelectorAll('[data-act="scroll"]').forEach((el) => {
      el.addEventListener('click', () => {
        const id = el.getAttribute('data-id');
        if (id) pageApi.scrollToNetApplyField(id);
      });
    });
    shadow.querySelectorAll('[data-act="copy"]').forEach((el) => {
      el.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        const row = state.rows[Number(el.getAttribute('data-row'))];
        if (!row || !row.copy) return;
        const done = () => {
          state.message = '已复制资料原文。';
          const message = shadow.querySelector('.message');
          if (message) message.textContent = state.message;
        };
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(row.copy).then(done).catch(() => {});
        }
      });
    });
    shadow.querySelectorAll('[data-act="fix"]').forEach((el) => {
      el.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        const field = shadow.querySelector(`[data-key="${el.getAttribute('data-fix') || ''}"]`);
        if (!field) return;
        field.scrollIntoView({ block: 'center', behavior: 'smooth' });
        field.focus();
      });
    });
  }

  let resizeDrag = null;

  function startResize(event) {
    if (event.button != null && event.button !== 0) return;
    if (event.target && event.target.closest && event.target.closest('button')) return;
    const panel = shadow && shadow.querySelector('.panel');
    if (!panel) return;
    resizeDrag = { startY: event.clientY, height: panel.getBoundingClientRect().height };
    event.preventDefault();
  }

  function moveResize(event) {
    if (!resizeDrag) return;
    const panel = shadow && shadow.querySelector('.panel');
    if (!panel) return;
    const max = Math.max(280, window.innerHeight - 24);
    const height = Math.round(Math.max(280, Math.min(resizeDrag.height + (resizeDrag.startY - event.clientY), max)));
    state.panelHeight = height;
    panel.style.height = `${height}px`;
    panel.style.maxHeight = `${height}px`;
  }

  function onClear() {
    if (saveTimer) {
      clearTimeout(saveTimer);
      saveTimer = null;
    }
    const empty = writeSaved(core.emptyProfile(), core.emptySources());
    state.profile = Object.assign({}, empty.profile);
    state.sources = Object.assign({}, empty.sources);
    state.savedNote = false;
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
    writeNow();
    state.message = '已从 PDF 写入并自动保存。核对后点「自动填写当前页面」。';
    paint();
  }

  async function onFill() {
    if (state.busy) return;
    syncFromDom();
    writeNow();
    const saved = readSaved();
    if (!core.filledKeys(saved.profile).length) {
      state.message = '上面还是空的。先写资料，或选一份 PDF，再点「自动填写当前页面」。';
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
      .resize-top {
        flex: none; height: 10px; cursor: ns-resize; position: relative;
      }
      .resize-top::after {
        content: ''; position: absolute; left: 50%; top: 4px; width: 36px; height: 3px;
        margin-left: -18px; border-radius: 999px; background: #d9d3c7;
      }
      header, .body { padding: 12px 14px; }
      header { display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #eee6d8; cursor: ns-resize; user-select: none; }
      header button { cursor: pointer; }
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
      .actions { display: flex; flex-wrap: wrap; gap: 8px; margin: 8px 0 12px; }
      .result-card { margin-top: 4px; }
      .result-sum { display: flex; flex-wrap: wrap; gap: 6px; padding: 2px 0 4px; }
      .chip { padding: 2px 8px; border-radius: 999px; font-size: 12px; font-weight: 500; line-height: 1.4; }
      .chip.ok { background: rgba(22, 163, 74, 0.1); color: #15803d; }
      .chip.check { background: #fffbeb; color: #b45309; }
      .chip.miss { background: #f1f5f9; color: #64748b; }
      .group { margin: 8px 8px 2px; font-size: 12px; font-weight: 600; color: #6d655b; }
      .hit {
        width: 100%; display: flex; align-items: baseline; gap: 10px; padding: 7px 8px;
        border: 0; border-radius: 8px; background: transparent; text-align: left; font: inherit; cursor: pointer;
      }
      .hit:hover { background: #f8fafc; }
      .hit b { flex: none; max-width: 46%; font-size: 13px; font-weight: 500; color: #1c1915; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .hit span { flex: 1; min-width: 0; font-size: 12px; color: #64748b; text-align: right; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .hit em { flex: none; font-style: normal; font-size: 12px; color: #0f766e; text-decoration: underline; }
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

  window.addEventListener('pointermove', moveResize);
  window.addEventListener('pointerup', () => { resizeDrag = null; });
  window.addEventListener('pointercancel', () => { resizeDrag = null; });

  window.addEventListener('pagehide', () => {
    try {
      syncFromDom();
      if (saveTimer) writeNow();
    } catch (_) { /* 离开页面时能存下就存 */ }
  });

  ensure();
  try {
    const observer = new MutationObserver(() => ensure());
    observer.observe(document.documentElement, { childList: true });
  } catch (_) { /* 页面不允许观察时，靠下面的定时器 */ }
  setInterval(ensure, 2000);
}

if (typeof document !== 'undefined' && document.documentElement) boot();
