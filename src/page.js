/**
 * 跑在报名页里的脚本。只看当前文档的可见控件，不进 iframe，不点新增、不提交。
 */
'use strict';

const {
  normText,
  moneyYuan,
  salaryYuan,
  salaryBand,
  arrivalDays,
  scoreYearOption,
  scoreSalaryOption,
  scoreArrivalOption,
  scoreApproxOption,
} = require('./core');

function cssEscape(value) {
  const api = (typeof CSS !== 'undefined' && CSS && CSS.escape)
    || (typeof window !== 'undefined' && window.CSS && window.CSS.escape);
  if (api) return api.call(typeof CSS !== 'undefined' && CSS && CSS.escape ? CSS : window.CSS, String(value));
  return String(value).replace(/[^a-zA-Z0-9_-]/g, (ch) => `\\${ch}`);
}

function collectPageFields() {
  function clean(value) {
    return String(value || '').replace(/\s+/g, ' ').replace(/^\s*[*:：:]+|[*:：:]\s*$/g, '').trim();
  }

  function visible(el) {
    if (!el || !el.isConnected) return false;
    const style = window.getComputedStyle(el);
    if (style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity) === 0) return false;
    if (el.getAttribute('aria-hidden') === 'true') return false;
    const rect = el.getBoundingClientRect();
    if (rect.width < 2 || rect.height < 2) return false;
    // 滚出当前视口的字段还要收。只有绝对定位甩到屏幕外的蜜罐才丢掉。
    const parked = style.position === 'absolute' || style.position === 'fixed';
    if (parked && (rect.left < -200 || rect.top < -200)) return false;
    return true;
  }

  function textOf(node) {
    if (!node) return '';
    const clone = node.cloneNode(true);
    clone.querySelectorAll('input, select, textarea, button').forEach((child) => child.remove());
    return clean(clone.innerText || clone.textContent || '');
  }

  function cellLabel(el) {
    const cell = el.closest('td, th');
    if (!cell || !cell.previousElementSibling) return '';
    const text = textOf(cell.previousElementSibling);
    return text && text.length <= 40 ? text : '';
  }

  function boundLabel(el) {
    if (!el.id) return '';
    const root = el.getRootNode && el.getRootNode();
    const bound = root && root.querySelector
      ? root.querySelector(`label[for="${cssEscape(el.id)}"]`)
      : null;
    return textOf(bound);
  }

  function placeholderOption(text) {
    const coreText = clean(text).replace(/^[-—–\s]+|[-—–\s]+$/g, '');
    return !coreText || /^请选择|^请填|^select$|^choose$/i.test(coreText);
  }

  function labelFor(el) {
    const type = (el.getAttribute('type') || '').toLowerCase();
    if (type !== 'radio' && type !== 'checkbox') {
      const boundText = boundLabel(el);
      if (boundText) return boundText;
    }
    const wrap = el.closest('label');
    const wrapText = textOf(wrap);
    if (wrapText && wrapText.length <= 40) return wrapText;
    const aria = clean(el.getAttribute('aria-label') || '');
    if (aria) return aria;
    const labelledBy = el.getAttribute('aria-labelledby');
    if (labelledBy) {
      const joined = labelledBy.split(/\s+/).map((id) => textOf(document.getElementById(id))).filter(Boolean).join(' ');
      if (clean(joined)) return clean(joined);
    }
    const group = el.closest('.form-group, .form-item, .field, fieldset, .ant-form-item, .el-form-item');
    if (group) {
      const labels = group.querySelectorAll('label, legend, .form-item__text, .label, .form-label');
      for (let i = 0; i < labels.length; i += 1) {
        if (labels[i].querySelector('input, select, textarea')) continue;
        const text = textOf(labels[i]);
        if (text && text.length <= 40) return text;
      }
    }
    const prev = el.previousElementSibling;
    if (prev && !prev.matches('input, select, textarea, button')) {
      const text = textOf(prev);
      if (text && text.length <= 40) return text;
    }
    const fromCell = cellLabel(el);
    if (fromCell) return fromCell;
    const placeholder = clean(el.getAttribute('placeholder') || '');
    if (placeholder && !/^请输入|^请选择|^please|^enter|^select/i.test(placeholder)) return placeholder;
    return '';
  }

  function groupLabel(el) {
    const fromCell = cellLabel(el);
    if (fromCell) return fromCell;
    const group = el.closest('.form-group, .form-item, .field, fieldset');
    if (group) {
      const labels = group.querySelectorAll('label, legend, .form-item__text');
      for (let i = 0; i < labels.length; i += 1) {
        if (labels[i].querySelector('input, select, textarea')) continue;
        const text = textOf(labels[i]);
        if (text) return text;
      }
    }
    return labelFor(el);
  }

  function optionText(el) {
    const bound = boundLabel(el);
    if (bound) return bound;
    const wrap = el.closest('label');
    return textOf(wrap) || clean(el.value);
  }

  function ignoredLabel(label) {
    return /推荐码|内推码/.test(String(label || '').replace(/\s+/g, '').replace(/[*:：:（）()【】[\]·]/g, ''));
  }

  function honeypot(el) {
    const blob = `${el.name || ''} ${el.id || ''} ${el.className || ''}`;
    return /honeypot|honey-pot|hpfield|bot-field/i.test(blob);
  }

  function dateLike(el) {
    const type = (el.getAttribute('type') || '').toLowerCase();
    if (/^(date|month|datetime-local|time|week)$/.test(type)) return true;
    const blob = `${el.className || ''} ${el.name || ''} ${el.id || ''}`;
    return /wdate|laydate|ant-picker|el-date|datepicker/i.test(blob);
  }

  function calendarLabel(label) {
    return /出生日期|生日|出生年月|开始时间|结束时间|入学时间|毕业时间|入职时间|离职时间/.test(label);
  }

  function sectionOf(el) {
    const re = /个人信息|求职意向|投递意向|教育经历|工作经历|实习经历|项目经历|语言能力|培训经历|技能证书/;
    let node = el;
    for (let depth = 0; node && depth < 12; depth += 1) {
      let prev = node.previousElementSibling;
      for (let steps = 0; prev && steps < 10; steps += 1) {
        const compact = textOf(prev).replace(/\s+/g, '');
        if (compact && compact.length <= 12) {
          const hit = compact.match(re);
          if (hit) return hit[0];
        }
        prev = prev.previousElementSibling;
      }
      node = node.parentElement;
    }
    return '';
  }

  function cascade(label) {
    return /籍贯|生源地|户口|省市区|所在省|所在市|所在区|省份|省\/州|省\/市/.test(label);
  }

  function openQuestion(label) {
    return /为什么|自我评价|自荐|简述|求职信|个人介绍|个人简介|职业规划|cover letter/i.test(label);
  }

  function richText(el) {
    if (el.getAttribute('contenteditable') === 'true' && !/^(input|textarea|select)$/i.test(el.tagName)) return true;
    const blob = `${el.className || ''} ${el.id || ''}`;
    return /ueditor|edui-body|ql-editor|tox-edit|w-e-text/i.test(blob);
  }

  function requiredOf(el, label) {
    return el.required || el.getAttribute('aria-required') === 'true' || /必填|\*/.test(label);
  }

  function emptyControl(el, control) {
    if (control === 'radio') return true;
    if (control === 'select') {
      const selected = el.options && el.options[el.selectedIndex];
      const text = clean(selected && (selected.text || selected.label) || '');
      return !el.value || placeholderOption(text);
    }
    return !String(el.value || '').trim();
  }

  const fields = [];
  const seenRadio = new Set();
  let seq = 0;

  function push(el, extra) {
    seq += 1;
    const id = `f${seq}`;
    el.setAttribute('data-gj-na', id);
    fields.push(Object.assign({ id, section: extra.section || sectionOf(el) }, extra));
  }

  function visit(el) {
    if (!el || el.nodeType !== 1) return;
    const tag = el.tagName;
    if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA' || el.getAttribute('contenteditable') === 'true') {
      if (!visible(el)) return;
      if (honeypot(el)) {
        push(el, { label: labelFor(el) || '未命名', skip: 'honeypot', silent: false, empty: true, options: [], control: 'skip', required: false });
        return;
      }
      const type = (el.getAttribute('type') || '').toLowerCase();
      if (type === 'hidden' || type === 'password' || type === 'submit' || type === 'button' || type === 'reset' || type === 'image') {
        if (type === 'password') push(el, { label: labelFor(el) || '密码', skip: 'password', silent: false, empty: true, options: [], control: 'skip', required: false });
        return;
      }
      const phoenixSelect = /phoenix-select__input/.test(String(el.className || ''));
      if (phoenixSelect) {
        const box = el.closest('.phoenix-select');
        const first = box && box.querySelector('input.phoenix-select__input');
        if (first && first !== el) return;
      }
      if (type === 'radio') {
        const name = el.name || el.id || `radio-${seq}`;
        if (seenRadio.has(name)) return;
        seenRadio.add(name);
        const root = el.getRootNode && el.getRootNode();
        const radios = name && root && root.querySelectorAll
          ? Array.from(root.querySelectorAll(`input[type="radio"][name="${cssEscape(name)}"]`))
          : [el];
        const visibleRadios = radios.filter((item) => visible(item));
        if (!visibleRadios.length) return;
        const label = groupLabel(visibleRadios[0]);
        if (ignoredLabel(label)) return;
        const options = visibleRadios.map(optionText).filter(Boolean).slice(0, 40);
        const checked = visibleRadios.some((item) => item.checked);
        visibleRadios.forEach((item) => item.setAttribute('data-gj-na', ''));
        seq += 1;
        const id = `f${seq}`;
        visibleRadios.forEach((item) => item.setAttribute('data-gj-na', id));
        let skip = '';
        if (dateLike(visibleRadios[0])) skip = 'date';
        else if (cascade(label)) skip = 'cascade';
        else if (openQuestion(label)) skip = 'open';
        fields.push({
          id,
          label,
          section: sectionOf(visibleRadios[0]),
          skip,
          silent: false,
          empty: !checked,
          options,
          control: skip ? 'skip' : 'radio',
          required: requiredOf(visibleRadios[0], label),
        });
        return;
      }
      if (type === 'checkbox') return;
      const label = labelFor(el);
      if (ignoredLabel(label)) return;
      const isDate = dateLike(el) || (phoenixSelect && calendarLabel(label));
      let skip = '';
      let silent = false;
      if (type === 'file') skip = 'file';
      else if (richText(el)) skip = 'richtext';
      else if (cascade(label)) skip = 'cascade';
      else if (openQuestion(label)) skip = 'open';
      else if (/验证码|captcha|verifycode/i.test(`${label} ${el.name || ''} ${el.id || ''}`)) {
        skip = 'captcha';
      } else if (el.disabled) skip = 'disabled';
      const control = skip ? 'skip' : (isDate ? 'date' : (phoenixSelect || tag === 'SELECT' ? 'select' : 'text'));
      const options = tag === 'SELECT'
        ? Array.from(el.options || []).map((option) => clean(option.text || option.label || '')).filter((text) => text && !placeholderOption(text)).slice(0, 40)
        : [];
      push(el, {
        label,
        skip,
        silent,
        empty: emptyControl(el, control === 'select' ? 'select' : 'text'),
        options,
        control,
        required: requiredOf(el, label),
        lazy: phoenixSelect && !skip && !isDate,
      });
      return;
    }
  }

  function walk(root) {
    if (!root || !root.querySelectorAll) return;
    root.querySelectorAll('input, select, textarea, [contenteditable="true"]').forEach(visit);
    root.querySelectorAll('.phoenix-radio-group').forEach((group) => {
      if (group.querySelector('input[type="radio"]') || !visible(group)) return;
      const items = Array.from(group.querySelectorAll('.phoenix-radio')).filter((item) => visible(item));
      if (!items.length) return;
      const label = groupLabel(items[0]);
      if (ignoredLabel(label)) return;
      const options = items.map((item) => textOf(item.querySelector('.phoenix-radio__radio-text') || item)).filter(Boolean).slice(0, 40);
      const checked = items.some((item) => /checked/.test(String(item.className || '')) || item.getAttribute('aria-checked') === 'true');
      seq += 1;
      const id = `f${seq}`;
      items.forEach((item) => item.setAttribute('data-gj-na', id));
      let skip = '';
      if (cascade(label)) skip = 'cascade';
      else if (openQuestion(label)) skip = 'open';
      fields.push({
        id,
        label,
        section: sectionOf(items[0]),
        skip,
        silent: false,
        empty: !checked,
        options,
        control: skip ? 'skip' : 'radio',
        required: requiredOf(items[0], label),
        lazy: false,
      });
    });
    root.querySelectorAll('.edui-body, .ql-editor, .tox-edit-area, .w-e-text').forEach((el) => {
      if (!visible(el) || el.getAttribute('data-gj-na')) return;
      if (el.querySelector('input, select, textarea')) return;
      const label = labelFor(el);
      const skip = openQuestion(label) ? 'open' : 'richtext';
      push(el, {
        label: label || '未命名',
        skip,
        silent: false,
        empty: true,
        options: [],
        control: 'skip',
        required: requiredOf(el, label),
      });
    });
    root.querySelectorAll('*').forEach((el) => {
      if (el.shadowRoot) walk(el.shadowRoot);
    });
  }

  walk(document);
  const sample = String((document.body && document.body.innerText) || '').slice(0, 1500);
  const title = document.title || '';
  const fillable = fields.filter((field) => !field.silent && !field.skip).length;
  const challenge = /安全验证|人机验证|滑动验证|请完成验证|访问验证/.test(`${title}\n${sample}`) && fillable < 3;
  return { fields, challenge };
}

function applyPageWrites(writes) {
  function clean(value) {
    return String(value || '').replace(/\s+/g, ' ').trim();
  }

  function sleep(ms) {
    return new Promise((resolve) => { setTimeout(resolve, ms); });
  }

  function setValue(el, value) {
    const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    const desc = Object.getOwnPropertyDescriptor(proto, 'value');
    if (desc && desc.set) desc.set.call(el, value);
    else el.value = value;
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  }

  function find(id) {
    const out = [];
    function walk(root) {
      if (!root || !root.querySelectorAll) return;
      root.querySelectorAll(`[data-gj-na="${id}"]`).forEach((el) => out.push(el));
      root.querySelectorAll('*').forEach((el) => { if (el.shadowRoot) walk(el.shadowRoot); });
    }
    walk(document);
    return out;
  }

  function optionLabel(item) {
    const root = item.getRootNode && item.getRootNode();
    const bound = item.id && root && root.querySelector
      ? root.querySelector(`label[for="${cssEscape(item.id)}"]`)
      : null;
    const own = clean(item.innerText || item.textContent || '');
    const wrap = item.closest && item.closest('label');
    const wrapText = wrap ? clean(wrap.innerText || wrap.textContent || '') : '';
    return clean((bound && (bound.innerText || bound.textContent)) || (own && own.length <= 20 ? own : '') || wrapText || item.value);
  }

  function selectBox(el, label) {
    const want = clean(label || '');
    if (want) {
      const titles = Array.from(document.querySelectorAll('label, span, div, p')).filter((node) => {
        if (node.querySelector && node.querySelector('input, textarea, select, .phoenix-select')) return false;
        if (clean(node.innerText || node.textContent || '') !== want) return false;
        const rect = node.getBoundingClientRect();
        return rect.width > 8 && rect.height > 8;
      });
      for (let t = 0; t < titles.length; t += 1) {
        let cur = titles[t];
        for (let n = 0; n < 4 && cur; n += 1) {
          const next = cur.nextElementSibling;
          if (next && next.classList && next.classList.contains('phoenix-select')) return next;
          if (next && next.querySelector && next.getBoundingClientRect().height < 90) {
            const found = next.querySelector('.phoenix-select');
            if (found) return found;
          }
          cur = cur.parentElement;
        }
      }
    }
    if (el && el.isConnected && el.closest) {
      const own = el.closest('.phoenix-select');
      if (own && own.isConnected) return own;
    }
    return null;
  }

  function phoenixShown(el, label) {
    const box = selectBox(el, label);
    if (!box) return el && el.isConnected ? clean(el.value) : '';
    const tags = Array.from(box.querySelectorAll('.phoenix-select__tagText, .phoenix-select__tag, .phoenix-select__single, .phoenix-select__selection'));
    const tagText = tags.map((node) => clean(node.innerText || node.textContent || '')).find((text) => text.length >= 2 && !/^请选择|^请输入|^搜索/.test(text));
    if (tagText) return tagText;
    const lines = clean(box.innerText || '').split(/\s+/).filter((item) => item.length >= 2 && !/^请选择|^请输入|^搜索/.test(item));
    if (lines.length) return lines[0];
    const input = box.querySelector('input, textarea');
    return input && input.isConnected ? clean(input.value) : '';
  }

  function acceptedShown(shown, picked, write) {
    const text = clean(shown);
    if (!text || /^请选择|^请输入|^搜索/.test(text)) return false;
    if (picked && shownMatches(text, picked)) return true;
    const keys = [write && write.search, write && write.copy, write && write.optionText].concat((write && write.searches) || []);
    return keys.some((key) => {
      const item = clean(key);
      return item.length >= 2 && (text.indexOf(item) >= 0 || item.indexOf(text) >= 0);
    });
  }

  async function waitShown(el, picked, write) {
    const label = write && write.label;
    let shown = '';
    for (let i = 0; i < 12; i += 1) {
      shown = phoenixShown(el, label);
      if (acceptedShown(shown, picked, write)) return shown;
      await sleep(120);
    }
    return phoenixShown(el, label);
  }

  function popupRoot() {
    const nodes = Array.from(document.querySelectorAll(
      '.phoenix-selectList, .constant-main-selector-container, .common-unmodeled-layer, .phoenix-select__dropdown, .phoenix-unmodeled-layer'
    )).filter((node) => {
      const rect = node.getBoundingClientRect();
      return rect.width > 80 && rect.height > 40 && rect.bottom > 0 && rect.top < window.innerHeight + 40;
    });
    const outer = nodes.filter((node) => !nodes.some((other) => other !== node && other.contains(node)));
    if (outer.length) return outer[outer.length - 1];
    let best = null;
    let bestArea = Infinity;
    Array.from(document.querySelectorAll('div')).forEach((node) => {
      const rect = node.getBoundingClientRect();
      if (rect.width < 200 || rect.height < 120 || rect.width > 920 || rect.height > 680) return;
      if (rect.bottom < 0 || rect.top > window.innerHeight) return;
      const text = node.innerText || '';
      if (text.length > 2500 || !/确定/.test(text) || !/取消/.test(text)) return;
      const area = rect.width * rect.height;
      if (area >= bestArea) return;
      best = node;
      bestArea = area;
    });
    return best;
  }

  function choiceNodes() {
    const root = popupRoot() || document;
    const popup = popupRoot();
    const out = [];
    Array.from(root.querySelectorAll('li, div, span, td, a, label')).forEach((node) => {
      const text = clean(node.innerText || node.textContent || '');
      if (!text || text.length > 48) return;
      if (node.children && node.children.length > 8) return;
      const rect = node.getBoundingClientRect();
      if (rect.width < 16 || rect.height < 12 || rect.height > 72) return;
      const inside = popup && popup.contains(node);
      if (!inside && (rect.bottom < 0 || rect.top > window.innerHeight + 80)) return;
      out.push({ node, text, area: rect.width * rect.height });
    });
    return out;
  }

  function primaryLabel(text) {
    const line = clean(text).split('\n')[0];
    const parts = line.split(/\s+/).filter(Boolean);
    return parts[0] || '';
  }

  function findOpenOption(accept) {
    const wants = (Array.isArray(accept) ? accept : []).map(clean).filter(Boolean);
    const nodes = choiceNodes();
    for (let i = 0; i < wants.length; i += 1) {
      let best = null;
      let bestArea = Infinity;
      nodes.forEach((item) => {
        if (item.text !== wants[i] && primaryLabel(item.text) !== wants[i]) return;
        if (item.area >= bestArea) return;
        best = item.node;
        bestArea = item.area;
      });
      if (best) return best;
    }
    return null;
  }

  function openChoiceTexts() {
    const seen = {};
    const out = [];
    choiceNodes().forEach((item) => {
      if (seen[item.text]) return;
      seen[item.text] = true;
      out.push(item.text);
    });
    return out;
  }

  function closePopup() {
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    document.body.click();
  }

  async function openSelect(el) {
    const box = (el.closest && el.closest('.phoenix-select')) || el;
    try { box.scrollIntoView({ block: 'center' }); } catch (_) { /* 滚不到就算了 */ }
    await sleep(40);
    box.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    box.click();
    await sleep(80);
  }

  function findPopupSearch(el) {
    const scopes = [];
    const popup = popupRoot();
    if (popup) scopes.push(popup);
    scopes.push(document);
    for (let s = 0; s < scopes.length; s += 1) {
      const found = Array.from(scopes[s].querySelectorAll('input, textarea')).find((input) => {
        if (input === el) return false;
        const placeholder = input.getAttribute('placeholder') || '';
        const cls = String(input.className || '');
        if (!/搜索/.test(placeholder) && !/search/i.test(cls)) return false;
        const rect = input.getBoundingClientRect();
        return rect.width > 40 && rect.height > 10 && rect.bottom > 0 && rect.top < window.innerHeight + 20 && rect.left > -20;
      });
      if (found) return found;
    }
    return null;
  }

  function confirmButton() {
    const root = popupRoot();
    if (!root) return null;
    let best = null;
    let bestScore = Infinity;
    Array.from(root.querySelectorAll('button, a, span, div')).forEach((node) => {
      const text = clean(node.innerText || node.textContent || '');
      if (text !== '确定' && text !== '确认') return;
      const rect = node.getBoundingClientRect();
      const props = reactProps(node);
      const hasHandler = props && typeof props.onClick === 'function';
      if (!hasHandler && (rect.width < 36 || rect.width > 220 || rect.height < 16 || rect.height > 72)) return;
      if (hasHandler && (rect.width < 16 || rect.width > 220 || rect.height < 12 || rect.height > 72)) return;
      if (rect.bottom < -80) return;
      const score = (hasHandler ? 0 : 100000) + rect.width * rect.height;
      if (score < bestScore) {
        best = node;
        bestScore = score;
      }
    });
    return best;
  }

  async function typePopupSearch(el, text) {
    const input = findPopupSearch(el);
    if (!input) return false;
    input.focus();
    input.click();
    setValue(input, '');
    await sleep(30);
    setValue(input, text);
    input.dispatchEvent(new InputEvent('input', { bubbles: true, data: text, inputType: 'insertText' }));
    const wanted = clean(text);
    for (let i = 0; i < 12; i += 1) {
      await sleep(100);
      const texts = openChoiceTexts();
      const banner = popupRoot() && /搜索结果/.test(popupRoot().innerText || '');
      if (wanted && texts.some((item) => item.indexOf(wanted) >= 0) && (banner || texts.length <= 8)) break;
    }
    return true;
  }

  function listScroller() {
    const root = popupRoot();
    if (!root) return null;
    const boxes = Array.from(root.querySelectorAll('div, ul')).filter((node) => {
      const style = window.getComputedStyle(node);
      const rect = node.getBoundingClientRect();
      const scrolls = style.overflowY === 'auto' || style.overflowY === 'scroll' || style.overflowY === 'hidden' || node.scrollHeight > node.clientHeight + 8;
      return scrolls && node.scrollHeight > node.clientHeight + 8 && rect.height > 80 && rect.height < 520 && rect.width > 80;
    });
    boxes.sort((a, b) => (b.scrollHeight - b.clientHeight) - (a.scrollHeight - a.clientHeight));
    return boxes.length ? boxes[0] : null;
  }

  async function scrollFor(accept) {
    let hit = findOpenOption(accept);
    if (hit) return hit;
    const box = listScroller();
    if (!box) return null;
    box.scrollTop = 0;
    await sleep(160);
    hit = findOpenOption(accept);
    const steps = Math.min(40, Math.max(8, Math.ceil((box.scrollHeight || 0) / 120)));
    for (let i = 0; i < steps && !hit; i += 1) {
      box.scrollTop += 120;
      await sleep(160);
      hit = findOpenOption(accept);
    }
    return hit;
  }

  function yearHit(write) {
    if (write.kind !== 'years' || typeof scoreYearOption !== 'function') return null;
    const scored = scoreYearOption(write.copy || write.optionText, openChoiceTexts());
    return scored ? findOpenOption([scored.optionText]) : null;
  }

  function scoredHit(write) {
    const texts = openChoiceTexts();
    let scored = null;
    if (write.kind === 'salary' && typeof scoreSalaryOption === 'function') {
      scored = scoreSalaryOption(write.copy || write.optionText, texts);
    } else if (write.kind === 'arrival' && typeof scoreArrivalOption === 'function') {
      const fromCopy = write.copy ? scoreArrivalOption(write.copy, texts) : null;
      if (fromCopy) scored = fromCopy;
      else if (!write.copy || typeof arrivalDays !== 'function' || arrivalDays(write.copy) == null) {
        scored = scoreArrivalOption(write.optionText || '随时到岗', texts) || scoreArrivalOption('随时到岗', texts);
      }
    } else if (write.kind === 'approx' && typeof scoreApproxOption === 'function') {
      scored = scoreApproxOption(write.copy || write.optionText, texts, write.searches);
    }
    return scored ? findOpenOption([scored.optionText]) : null;
  }

  function choiceOk(write, node) {
    if (!node || write.kind !== 'approx') return true;
    const text = clean(node.innerText || node.textContent || '').toLowerCase();
    const tokens = (Array.isArray(write.searches) ? write.searches : []).filter((item) => /^(ios|android|前端|后端|算法|测试|运维)$/i.test(String(item || '')));
    if (!tokens.length) return true;
    return tokens.some((item) => text.includes(String(item).toLowerCase()));
  }

  function searchRows(searches) {
    const root = popupRoot();
    if (!root) return [];
    const seen = new Set();
    const rows = [];
    choiceNodes().forEach((item) => {
      const row = optionRow(item.node);
      if (!row || seen.has(row) || !root.contains(row)) return;
      const text = clean(row.innerText || row.textContent || '');
      if (!text || text.length > 40) return;
      if (/^(请选择|请输入|搜索|不限|确定|取消|清空|搜索结果|请在左侧|已选)/.test(text)) return;
      seen.add(row);
      rows.push(row);
    });
    rows.sort((a, b) => a.getBoundingClientRect().top - b.getBoundingClientRect().top);
    if (/搜索结果/.test(root.innerText || '')) return rows;
    const keys = (Array.isArray(searches) ? searches : []).map(clean).filter((item) => item.length >= 2);
    if (!keys.length || rows.length > 4) return [];
    return rows.filter((row) => {
      const text = clean(row.innerText || row.textContent || '');
      return keys.some((key) => text.indexOf(key) >= 0);
    });
  }

  function closestOption(keywords) {
    const keys = (Array.isArray(keywords) ? keywords : []).map(clean).filter((item) => item && item.length >= 2);
    let best = null;
    let bestScore = -Infinity;
    choiceNodes().forEach((item) => {
      if (/^请选择|^搜索|^不限/.test(item.text)) return;
      keys.forEach((key) => {
        if (item.text.indexOf(key) < 0) return;
        const score = key.length * 20 - item.text.length;
        if (score > bestScore) {
          best = item.node;
          bestScore = score;
        }
      });
    });
    return best;
  }

  function lookupChoice(keyword) {
    const root = popupRoot();
    const key = clean(keyword);
    if (!root || !key || key.length < 2) return null;
    let best = null;
    let bestLen = Infinity;
    Array.from(root.querySelectorAll('label, li, [class*="item"], [class*="Item"], [class*="option"]')).forEach((node) => {
      const text = clean(node.innerText || node.textContent || '');
      if (!text || text.length > 36 || text.indexOf(key) < 0) return;
      if (/^请选择|^搜索|^不限|^确定|^取消|^已选/.test(text)) return;
      const rect = node.getBoundingClientRect();
      if (rect.height < 12 || rect.height > 52 || rect.width < 20 || rect.width > 420) return;
      if (text.length < bestLen) {
        best = node;
        bestLen = text.length;
      }
    });
    return best;
  }

  function optionRow(node) {
    let cur = node;
    for (let i = 0; i < 7 && cur && cur.getBoundingClientRect; i += 1) {
      const rect = cur.getBoundingClientRect();
      const cls = String(cur.className || '');
      const role = cur.getAttribute ? (cur.getAttribute('role') || '') : '';
      const inputs = cur.querySelectorAll ? cur.querySelectorAll('input[type="radio"], input[type="checkbox"]') : [];
      const looks = cur.tagName === 'LI' || cur.tagName === 'LABEL'
        || role === 'option' || role === 'menuitem' || role === 'radio' || role === 'checkbox'
        || /listItem|list-item|area-item|option|cascader|city|selectItem|menu-item|lookup|radio|checkbox/i.test(cls);
      const hasIcon = cur.querySelector && cur.querySelector('[class*="Checkbox"], [class*="checkbox"], [class*="Radio"]');
      if (looks && inputs.length <= 1 && rect.height >= 12 && rect.height <= 84 && rect.width >= 16 && rect.width <= 640) {
        if (inputs.length === 1 || hasIcon || cur.tagName === 'LI' || cur.tagName === 'LABEL' || role === 'option') return cur;
      }
      cur = cur.parentElement;
    }
    return node;
  }

  async function pressNode(node) {
    if (!node || !node.dispatchEvent || !node.getBoundingClientRect) return;
    const rect = node.getBoundingClientRect();
    const x = Math.round(rect.left + Math.min(Math.max(rect.width / 2, 8), 36));
    const y = Math.round(rect.top + rect.height / 2);
    const at = document.elementFromPoint(x, y);
    const target = at && (at === node || node.contains(at)) ? at : node;
    const point = { bubbles: true, cancelable: true, view: window, button: 0, clientX: x, clientY: y };
    try {
      target.dispatchEvent(new PointerEvent('pointerdown', Object.assign({ pointerId: 1, pointerType: 'mouse' }, point)));
    } catch (_) { /* 没有 PointerEvent 就只用鼠标事件 */ }
    target.dispatchEvent(new MouseEvent('mousedown', point));
    try {
      target.dispatchEvent(new PointerEvent('pointerup', Object.assign({ pointerId: 1, pointerType: 'mouse' }, point)));
    } catch (_) { /* 同上 */ }
    target.dispatchEvent(new MouseEvent('mouseup', point));
    target.dispatchEvent(new MouseEvent('click', point));
  }

  function pressEnter(node) {
    if (!node || !node.dispatchEvent) return;
    const point = { bubbles: true, cancelable: true, key: 'Enter', code: 'Enter', keyCode: 13, which: 13 };
    node.dispatchEvent(new KeyboardEvent('keydown', point));
    node.dispatchEvent(new KeyboardEvent('keyup', point));
  }

  function shownMatches(shown, picked) {
    const left = clean(shown);
    const right = clean(picked);
    if (!left || !right || /^请选择|^请输入/.test(left)) return false;
    return left === right || left.includes(right) || (left.length >= 2 && right.includes(left));
  }

  function reactProps(node) {
    if (!node) return null;
    const keys = Object.keys(node);
    for (let i = 0; i < keys.length; i += 1) {
      const key = keys[i];
      if (/^__reactProps|^__reactEventHandlers/.test(key)) return node[key];
      if (/^__reactFiber|^__reactInternalInstance/.test(key)) {
        const fiber = node[key];
        return fiber && (fiber.memoizedProps || fiber.pendingProps);
      }
    }
    return null;
  }

  function fireReact(node) {
    const root = popupRoot();
    let cur = node;
    for (let i = 0; i < 8 && cur; i += 1) {
      const props = reactProps(cur);
      const fn = props && (props.onChange || props.onClick || props.onMouseDown);
      if (typeof fn === 'function') {
        const input = cur.querySelector ? cur.querySelector('input[type="radio"], input[type="checkbox"]') : null;
        const target = input || cur;
        try {
          fn({
            preventDefault() {},
            stopPropagation() {},
            persist() {},
            target,
            currentTarget: cur,
            button: 0,
            type: 'click',
            nativeEvent: { target },
          });
        } catch (_) { /* 组件自己的处理报错时，勾选可能已经生效 */ }
        return true;
      }
      if (cur === root) break;
      cur = cur.parentElement;
    }
    return false;
  }

  function selectedCount() {
    const root = popupRoot();
    if (!root) return -1;
    const text = clean((root.innerText || '').slice(0, 4000));
    const hit = text.match(/已选[^\d]{0,8}(\d+)/);
    return hit ? Number(hit[1]) : -1;
  }

  function rowSelected(row) {
    if (!row || !row.querySelector) return false;
    const input = row.querySelector('input[type="radio"], input[type="checkbox"]');
    if (input && input.checked) return true;
    if (row.getAttribute && (row.getAttribute('aria-checked') === 'true' || row.getAttribute('aria-selected') === 'true')) return true;
    const nodes = [row].concat(Array.from(row.querySelectorAll('[class*="checkbox"], [class*="Checkbox"], [class*="radio"], [aria-checked], [aria-selected], svg')));
    return nodes.some((node) => {
      if (node.getAttribute && (node.getAttribute('aria-checked') === 'true' || node.getAttribute('aria-selected') === 'true')) return true;
      const cls = String((node.getAttribute && node.getAttribute('class')) || node.className || '');
      if (/CheckboxUnchecked|RadioUnchecked/.test(cls)) return false;
      return /CheckboxChecked|RadioChecked|(?:^|\s|_|-)(is-checked|is-selected|checked)(?:\s|_|-|$)/.test(cls);
    });
  }

  function nativeSetChecked(input) {
    if (!input) return;
    const desc = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'checked');
    const tracker = input._valueTracker;
    if (tracker && tracker.setValue) tracker.setValue(false);
    if (desc && desc.set) desc.set.call(input, true);
    else input.checked = true;
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
    const props = reactProps(input);
    const fn = props && (props.onChange || props.onClick);
    if (typeof fn === 'function') {
      try {
        fn({
          target: input,
          currentTarget: input,
          preventDefault() {},
          stopPropagation() {},
          persist() {},
          type: 'change',
          nativeEvent: { target: input },
        });
      } catch (_) { /* 勾选状态已经写上 */ }
    }
  }

  function handlerNode(row) {
    if (!row || !row.querySelectorAll) return row;
    const icon = row.querySelector('svg[class*="Checkbox"], svg[class*="checkbox"], [class*="Checkbox"], [class*="checkbox"]');
    if (icon) return icon;
    const nodes = Array.from(row.querySelectorAll('svg, span, label, i, div, input'));
    for (let i = 0; i < nodes.length; i += 1) {
      const props = reactProps(nodes[i]);
      if (props && (typeof props.onClick === 'function' || typeof props.onMouseDown === 'function')) return nodes[i];
    }
    return row;
  }

  function clickControl(node) {
    if (!node || !node.dispatchEvent || !node.getBoundingClientRect) return;
    const rect = node.getBoundingClientRect();
    const point = {
      bubbles: true,
      cancelable: true,
      view: window,
      button: 0,
      clientX: rect.left + Math.max(rect.width / 2, 1),
      clientY: rect.top + Math.max(rect.height / 2, 1),
    };
    node.dispatchEvent(new MouseEvent('mousedown', point));
    node.dispatchEvent(new MouseEvent('mouseup', point));
    node.dispatchEvent(new MouseEvent('click', point));
  }

  async function selectRow(node) {
    const row = optionRow(node) || node;
    const input = row.querySelector && row.querySelector('input[type="radio"], input[type="checkbox"]');
    if (input && !input.checked) {
      input.click();
      await sleep(50);
    }
    if (input && !input.checked) nativeSetChecked(input);
    if (!rowSelected(row) && !(input && input.checked)) {
      const target = handlerNode(row) || row;
      clickControl(target);
      await sleep(60);
    }
    if (!rowSelected(row) && !(input && input.checked)) {
      fireReact(handlerNode(row) || row);
      await sleep(40);
    }
    return row;
  }

  async function expandRow(node) {
    const row = optionRow(node) || node;
    const arrow = row.querySelector && Array.from(row.querySelectorAll('i, span, svg, em')).find((item) => {
      return /arrow|expand|caret|right|icon/i.test(String(item.className || ''));
    });
    await pressNode(arrow || node);
  }

  async function confirmSelection(row) {
    const okBtn = confirmButton();
    if (!okBtn) return false;
    for (let i = 0; i < 8 && selectedCount() <= 0 && !rowSelected(row); i += 1) await sleep(60);
    const count = selectedCount();
    const ready = count > 0 || rowSelected(row);
    if (!ready) return false;
    const button = okBtn.closest ? (okBtn.closest('button') || okBtn) : okBtn;
    try { button.scrollIntoView({ block: 'center' }); } catch (_) { /* 滚不到也继续点 */ }
    clickControl(button);
    await sleep(180);
    if (popupRoot() && selectedCount() > 0) fireReact(button);
    await sleep(80);
    return true;
  }

  async function commitOption(node, confirm) {
    if (!confirm) {
      await expandRow(node);
      return optionRow(node) || node;
    }
    const row = await selectRow(node);
    await confirmSelection(row);
    return row;
  }

  async function choosePhoenix(el, write) {
    const accept = write.accept && write.accept.length ? write.accept : [write.optionText];
    const searches = [];
    (Array.isArray(write.searches) ? write.searches : []).forEach((item) => {
      const text = clean(item);
      if (text && searches.indexOf(text) < 0) searches.push(text);
    });
    if (write.search && searches.indexOf(clean(write.search)) < 0) searches.unshift(clean(write.search));
    await openSelect(el);
    const ranged = write.kind === 'salary' || write.kind === 'arrival';
    let hit = null;
    for (let i = 0; i < 6 && !hit; i += 1) {
      await sleep(70);
      hit = yearHit(write) || findOpenOption(accept);
      if (!hit && ranged) hit = scoredHit(write);
    }
    async function scrollScore() {
      let found = scoredHit(write);
      if (found) return found;
      const box = listScroller();
      if (!box) return null;
      box.scrollTop = 0;
      await sleep(160);
      found = scoredHit(write);
      const steps = Math.min(24, Math.max(4, Math.ceil((box.scrollHeight || 0) / 120)));
      for (let i = 0; i < steps && !found; i += 1) {
        box.scrollTop += 120;
        await sleep(160);
        found = scoredHit(write);
      }
      return found;
    }
    const guessed = write.kind === 'approx' || write.kind === 'city';
    if (!hit && ranged) hit = await scrollScore();
    if (!hit && !guessed && !ranged) hit = await scrollFor(accept.concat(write.kind === 'years' ? [`${write.search}年`] : []));
    for (let i = 0; i < searches.length && !hit; i += 1) {
      const typed = await typePopupSearch(el, searches[i]);
      if (!typed) break;
      hit = yearHit(write)
        || findOpenOption(accept.concat([searches[i], `${searches[i]}年`, `${searches[i]}市`]))
        || scoredHit(write);
      if (!hit && guessed) hit = lookupChoice(searches[i]) || closestOption([searches[i]]);
      if (hit && !choiceOk(write, hit)) hit = null;
      if (!hit && Array.isArray(write.parents) && write.parents.length) {
        const parent = findOpenOption(write.parents) || closestOption(write.parents);
        if (parent && clean(parent.innerText || parent.textContent || '').indexOf(clean(write.search)) < 0) {
          await commitOption(parent);
          await sleep(280);
          if (write.search) await typePopupSearch(el, write.search);
          hit = findOpenOption(accept.concat([write.search, `${write.search}市`]))
            || closestOption([write.search, `${write.search}市`]);
          if (!hit) hit = await scrollFor(accept.concat([write.search, `${write.search}市`]));
        }
      }
    }
    if (!hit && guessed) hit = scoredHit(write) || closestOption(searches.concat(accept));
    if (hit && !choiceOk(write, hit)) hit = null;
    if (!hit && ranged) hit = await scrollScore();
    if (!hit) hit = await scrollFor(accept.concat(guessed ? searches : []));
    if (!hit) {
      const rows = searchRows(searches);
      const pickedRow = rows.find((row) => choiceOk(write, row));
      if (pickedRow) hit = pickedRow;
    }
    if (hit && write.kind === 'city' && write.search && clean(hit.innerText || hit.textContent || '').indexOf(clean(write.search)) < 0) {
      await commitOption(hit);
      await sleep(240);
      if (write.search) await typePopupSearch(el, write.search);
      const deeper = findOpenOption([write.search, `${write.search}市`])
        || closestOption([write.search, `${write.search}市`])
        || await scrollFor([write.search, `${write.search}市`]);
      if (deeper && clean(deeper.innerText || deeper.textContent || '').indexOf(clean(write.search)) >= 0) hit = deeper;
      else hit = null;
    }
    if (!hit) {
      closePopup();
      return { ok: false, reason: `下拉里没有「${clean(write.optionText || write.copy || write.search)}」` };
    }
    const picked = clean(hit.innerText || hit.textContent || '');
    let shown = phoenixShown(el, write.label);
    if (!acceptedShown(shown, picked, write)) await commitOption(hit, true);
    shown = phoenixShown(el, write.label);
    if (!acceptedShown(shown, picked, write)) {
      const searchInput = findPopupSearch(el);
      if (searchInput) {
        pressEnter(searchInput);
        await sleep(80);
        shown = phoenixShown(el, write.label);
      }
    }
    let childText = '';
    if (!acceptedShown(shown, picked, write)) {
      await sleep(180);
      const child = findOpenOption(accept.concat(searches)) || closestOption([picked].concat(searches));
      if (child && optionRow(child) !== optionRow(hit)) {
        childText = clean(child.innerText || child.textContent || '');
        await commitOption(child, true);
        shown = phoenixShown(el, write.label);
      }
    }
    if (!acceptedShown(shown, childText || picked, write)) shown = await waitShown(el, childText || picked, write);
    let ok = acceptedShown(shown, childText || picked, write);
    if (!ok) closePopup();
    if (!ok) return { ok: false, reason: '网页没有接住' };
    return { ok, optionText: shown || picked };
  }

  function pickerYear(picker) {
    const header = picker.querySelector('[class*="header"]') || picker;
    const text = clean(header.innerText || '').slice(0, 24);
    const hit = text.match(/(\d{4})/);
    return hit ? Number(hit[1]) : 0;
  }

  function headerButtons(picker) {
    const header = picker.querySelector('[class*="header"]') || picker;
    const seen = new Set();
    return Array.from(header.querySelectorAll('button, a, span, i')).filter((node) => {
      if (seen.has(node)) return false;
      const rect = node.getBoundingClientRect();
      if (rect.width < 8 || rect.width > 48 || rect.height < 8 || rect.height > 48) return false;
      const text = clean(node.innerText || node.textContent || '');
      if (/\d{4}|月/.test(text)) return false;
      if (node.querySelector && node.querySelector('button, a, span, i')) {
        const inner = node.querySelector('button, a, span, i');
        const innerRect = inner.getBoundingClientRect();
        if (innerRect.width > 8 && innerRect.width < 48) return false;
      }
      seen.add(node);
      return true;
    }).sort((a, b) => a.getBoundingClientRect().left - b.getBoundingClientRect().left);
  }

  function namedStep(picker, dir, kind) {
    const sel = kind === 'year'
      ? (dir === 'prev'
        ? '[class*="prev-year"], [class*="prevYear"], [class*="super-prev"], [class*="superPrev"]'
        : '[class*="next-year"], [class*="nextYear"], [class*="super-next"], [class*="superNext"]')
      : (dir === 'prev'
        ? '[class*="prev-month"], [class*="prevMonth"]'
        : '[class*="next-month"], [class*="nextMonth"]');
    return picker.querySelector(sel);
  }

  function yearStep(picker, dir) {
    const named = namedStep(picker, dir, 'year');
    if (named) return named;
    const buttons = headerButtons(picker);
    if (buttons.length >= 4) return dir === 'prev' ? buttons[0] : buttons[buttons.length - 1];
    if (!buttons.length) return null;
    return dir === 'prev' ? buttons[0] : buttons[buttons.length - 1];
  }

  function monthStep(picker, dir) {
    const named = namedStep(picker, dir, 'month');
    if (named) return named;
    const buttons = headerButtons(picker);
    if (buttons.length >= 4) return dir === 'prev' ? buttons[1] : buttons[buttons.length - 2];
    if (buttons.length >= 2) return dir === 'prev' ? buttons[0] : buttons[buttons.length - 1];
    return null;
  }

  function headerMonth(picker) {
    const header = picker.querySelector('[class*="header"]') || picker;
    const text = clean(header.innerText || '').slice(0, 32);
    const hit = text.match(/(\d{4})\s*年\s*(\d{1,2})\s*月/);
    return hit ? Number(hit[2]) : 0;
  }

  function monthCell(picker, month) {
    const wants = [`${month}月`, `${month < 10 ? `0${month}` : month}月`];
    return findIn(picker, wants);
  }

  function findIn(root, wants) {
    let best = null;
    let bestArea = Infinity;
    Array.from(root.querySelectorAll('td, span, div, a, li, button')).forEach((node) => {
      const text = clean(node.innerText || node.textContent || '');
      if (wants.indexOf(text) < 0) return;
      const rect = node.getBoundingClientRect();
      if (rect.width < 8 || rect.height < 8 || rect.height > 64) return;
      const area = rect.width * rect.height;
      if (area < bestArea) {
        best = node;
        bestArea = area;
      }
    });
    return best;
  }

  function isMonthGrid(picker) {
    let count = 0;
    for (let month = 1; month <= 12; month += 1) {
      if (monthCell(picker, month)) count += 1;
    }
    return count >= 8;
  }

  function isMuted(node) {
    const cls = String(node.className || '');
    if (/disabled|other|outside|not-current|prev-month|next-month/.test(cls)) return true;
    try {
      const style = window.getComputedStyle(node);
      const color = (style.color || '').match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
      const bg = (style.backgroundColor || '').match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?/);
      const grayText = color && Number(color[1]) > 170 && Number(color[2]) > 170 && Number(color[3]) > 170;
      const painted = bg && Number(bg[4] == null ? 1 : bg[4]) > 0.4
        && !(Number(bg[1]) > 245 && Number(bg[2]) > 245 && Number(bg[3]) > 245);
      if (grayText && !painted) return true;
    } catch (_) { /* 读不到颜色就当可选 */ }
    return false;
  }

  function dayCell(picker, day) {
    const wants = String(day);
    let best = null;
    let bestArea = Infinity;
    Array.from(picker.querySelectorAll('td, span, div, a, button')).forEach((node) => {
      const text = clean(node.innerText || node.textContent || '');
      if (text !== wants || isMuted(node)) return;
      const rect = node.getBoundingClientRect();
      if (rect.width < 8 || rect.height < 8 || rect.height > 48) return;
      const area = rect.width * rect.height;
      if (area < bestArea) {
        best = node;
        bestArea = area;
      }
    });
    return best;
  }

  function dateShown(el) {
    const box = el.closest && (el.closest('.phoenix-date-picker-wrapper') || el.closest('.phoenix-select') || el.parentElement);
    const fromBox = box ? clean(box.innerText || '') : '';
    const value = clean(el.value);
    return value || fromBox;
  }

  async function chooseDate(el, write) {
    await openSelect(el);
    let picker = null;
    for (let i = 0; i < 8 && !picker; i += 1) {
      await sleep(70);
      picker = document.querySelector('.phoenix-date-picker');
    }
    if (!picker) return { ok: false, reason: '没有打开日期' };
    const year = Number(write.year) || 0;
    const month = Number(write.month) || 0;
    const day = Number(write.day) || 1;
    for (let step = 0; step < 50 && pickerYear(picker) && pickerYear(picker) !== year; step += 1) {
      const dir = pickerYear(picker) > year ? 'prev' : 'next';
      const button = yearStep(picker, dir);
      if (!button) break;
      button.click();
      await sleep(40);
      picker = document.querySelector('.phoenix-date-picker') || picker;
    }
    if (pickerYear(picker) !== year) {
      const yearCell = findIn(picker, [String(year), `${year}年`]);
      if (yearCell) {
        yearCell.click();
        await sleep(80);
        picker = document.querySelector('.phoenix-date-picker') || picker;
      }
    }
    picker = document.querySelector('.phoenix-date-picker') || picker;
    if (isMonthGrid(picker)) {
      const cell = monthCell(picker, month);
      if (!cell) {
        closePopup();
        return { ok: false, reason: '没有点到月份' };
      }
      try { cell.click(); } catch (_) { /* 页面自己的日期处理报错时，值可能已经写上 */ }
      await sleep(80);
    } else {
      for (let step = 0; step < 14 && headerMonth(picker) && headerMonth(picker) !== month; step += 1) {
        const current = headerMonth(picker);
        const forward = (month - current + 12) % 12;
        const backward = (current - month + 12) % 12;
        const button = monthStep(picker, forward <= backward ? 'next' : 'prev');
        if (!button) break;
        try { button.click(); } catch (_) { /* 翻月失败就停在当前月 */ }
        await sleep(40);
        picker = document.querySelector('.phoenix-date-picker') || picker;
      }
      const cell = dayCell(picker, day) || findIn(picker, [String(day)]);
      if (!cell) {
        closePopup();
        return { ok: false, reason: '没有点到日期' };
      }
      try { cell.click(); } catch (_) { /* 同上 */ }
      await sleep(80);
    }
    const shown = dateShown(el);
    const monthText = String(month);
    const ok = shown.includes(String(year)) && (shown.includes(`${monthText}月`) || shown.includes(`/${monthText}`) || shown.includes(`-${monthText}`) || shown.includes(`.${monthText}`) || shown.includes(`-${monthText.padStart(2, '0')}`) || shown.includes(`/${monthText.padStart(2, '0')}`));
    if (!ok) closePopup();
    return { ok, optionText: shown };
  }

  return (async () => {
    try { document.body.click(); } catch (_) { /* 页面拦了空白点击也不影响后面逐项填 */ }
    const results = [];
    const list = Array.isArray(writes) ? writes : [];
    for (let i = 0; i < list.length; i += 1) {
      const write = list[i];
      if (!write || !write.id || write.status === 'miss') continue;
      try {
      const nodes = find(write.id);
      const el = nodes[0];
      if (!el) {
        results.push({ id: write.id, ok: false });
        continue;
      }
      if (write.control === 'select' && el.tagName === 'SELECT') {
        if (String(el.value || '').trim() && !/^请选择/.test(clean(el.options[el.selectedIndex] && el.options[el.selectedIndex].text))) {
          results.push({ id: write.id, ok: false });
          continue;
        }
        const wanted = clean(write.optionText);
        const option = Array.from(el.options || []).find((item) => clean(item.text || item.label) === wanted || clean(item.value) === wanted);
        if (!option) {
          results.push({ id: write.id, ok: false });
          continue;
        }
        el.value = option.value;
        option.selected = true;
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
        const current = clean(el.options[el.selectedIndex] && el.options[el.selectedIndex].text);
        results.push({ id: write.id, ok: current === wanted });
        continue;
      }
      if (write.control === 'date') {
        const nativeType = (el.getAttribute('type') || '').toLowerCase();
        if (/^(date|month|datetime-local)$/.test(nativeType)) {
          if (String(el.value || '').trim()) {
            results.push({ id: write.id, ok: false });
            continue;
          }
          const month = String(write.month || 0).padStart(2, '0');
          const day = String(write.day || 0).padStart(2, '0');
          let value = '';
          if (nativeType === 'month' && write.year && write.month) value = `${write.year}-${month}`;
          else if (write.year && write.month && write.day) value = nativeType === 'datetime-local' ? `${write.year}-${month}-${day}T00:00` : `${write.year}-${month}-${day}`;
          if (!value) {
            results.push({ id: write.id, ok: false, reason: '资料里没有具体日期' });
            continue;
          }
          setValue(el, value);
          results.push({ id: write.id, ok: String(el.value || '') === value });
          continue;
        }
        const picked = await chooseDate(el, write);
        results.push({ id: write.id, ok: !!(picked && picked.ok), reason: picked && picked.reason, optionText: picked && picked.optionText });
        continue;
      }
      if (write.control === 'select' && (write.lazy || (el.closest && el.closest('.phoenix-select')))) {
        let picked = null;
        try {
          picked = await choosePhoenix(el, write);
        } catch (_) {
          closePopup();
          picked = { ok: false, reason: '下拉没有选上' };
        }
        results.push({
          id: write.id,
          ok: !!(picked && picked.ok),
          reason: picked && picked.reason,
          optionText: picked && picked.optionText,
        });
        continue;
      }
      if (write.control === 'radio') {
        const wanted = clean(write.optionText);
        const match = nodes.find((item) => optionLabel(item) === wanted || clean(item.value) === wanted);
        const already = nodes.some((item) => item.checked || /checked/.test(String(item.className || '')));
        if (!match || already) {
          results.push({ id: write.id, ok: false });
          continue;
        }
        match.click();
        await sleep(80);
        const ok = !!(match.checked || /checked/.test(String(match.className || '')) || match.getAttribute('aria-checked') === 'true');
        results.push({ id: write.id, ok });
        continue;
      }
      if (String(el.value || '').trim()) {
        results.push({ id: write.id, ok: false });
        continue;
      }
      let value = String(write.value || '');
      const max = Number(el.maxLength);
      if (max > 0 && max < 100000 && value.length > max) value = value.slice(0, max);
      setValue(el, value);
      results.push({ id: write.id, ok: String(el.value || '') === value });
      } catch (err) {
        try { console.error(`[net-apply] ${write && write.id}: ${err && (err.stack || err.message) || err}`); } catch (_) { /* 控制台没有也不影响 */ }
        try { closePopup(); } catch (_) { /* 弹层已经关了 */ }
        results.push({ id: write && write.id, ok: false, reason: '没有填上' });
      }
    }
    return results;
  })();
}

function scrollToNetApplyField(id) {
  const safe = String(id || '').replace(/"/g, '');
  let el = null;
  function walk(root) {
    if (el || !root || !root.querySelectorAll) return;
    el = root.querySelector(`[data-gj-na="${safe}"]`);
    if (el) return;
    root.querySelectorAll('*').forEach((node) => { if (node.shadowRoot) walk(node.shadowRoot); });
  }
  walk(document);
  if (!el) return false;
  el.scrollIntoView({ block: 'center', behavior: 'smooth' });
  const prev = el.style.outline;
  el.style.outline = '2px solid #00bebd';
  el.style.outlineOffset = '2px';
  window.setTimeout(() => {
    el.style.outline = prev;
    el.style.outlineOffset = '';
  }, 1600);
  return true;
}

function collectScript() {
  return `(${collectPageFields.toString()})()`;
}

function embedJson(value) {
  return JSON.stringify(Array.isArray(value) ? value : [])
    .replace(/</g, '\\u003c')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
}

function applyParts(writes) {
  const bind = (name, fn) => `var ${name} = ${typeof fn === 'function' ? fn.toString() : 'function(){return null;}'};`;
  const prelude = [
    bind('normText', normText),
    bind('moneyYuan', moneyYuan),
    bind('salaryYuan', salaryYuan),
    bind('salaryBand', salaryBand),
    bind('arrivalDays', arrivalDays),
    bind('scoreYearOption', scoreYearOption),
    bind('scoreSalaryOption', scoreSalaryOption),
    bind('scoreArrivalOption', scoreArrivalOption),
    bind('scoreApproxOption', scoreApproxOption),
  ].join('\n');
  return { prelude, call: `(${applyPageWrites.toString()})(${embedJson(writes)})` };
}

function applyScript(writes) {
  const parts = applyParts(writes);
  return `${parts.prelude}\n${parts.call}`;
}

function readPageValues(ids) {
  const wanted = {};
  (Array.isArray(ids) ? ids : []).forEach((id) => {
    const key = String(id || '');
    if (key) wanted[key] = true;
  });
  const groups = {};
  function add(el) {
    if (!el || !el.getAttribute) return;
    const id = el.getAttribute('data-gj-na');
    if (!id || !wanted[id]) return;
    if (!groups[id]) groups[id] = [];
    groups[id].push(el);
  }
  function walk(root) {
    if (!root || !root.querySelectorAll) return;
    root.querySelectorAll('[data-gj-na]').forEach(add);
    root.querySelectorAll('*').forEach((node) => {
      if (node.shadowRoot) walk(node.shadowRoot);
    });
  }
  walk(document);
  function clean(text) {
    return String(text || '').replace(/\s+/g, ' ').trim();
  }
  function labelText(el) {
    const wrap = el.closest && el.closest('label');
    if (wrap) {
      const text = clean(wrap.textContent);
      if (text) return text;
    }
    return clean(el.value);
  }
  return Object.keys(wanted).map((id) => {
    const nodes = groups[id] || [];
    if (!nodes.length) return { id, found: false, text: '', empty: true };
    const select = nodes.find((el) => String(el.tagName || '').toLowerCase() === 'select');
    if (select) {
      const chosen = select.options && select.selectedIndex >= 0 ? select.options[select.selectedIndex] : null;
      const text = clean(chosen && (chosen.text || chosen.label));
      return { id, found: true, text, empty: !text };
    }
    const choice = nodes.find((el) => {
      const type = String(el.type || '').toLowerCase();
      return type === 'radio' || type === 'checkbox';
    });
    if (choice) {
      const picked = nodes.find((el) => el.checked || el.getAttribute('aria-checked') === 'true');
      const text = picked ? labelText(picked) : '';
      return { id, found: true, text, empty: !text };
    }
    const input = nodes.find((el) => el && 'value' in el);
    const text = input ? String(input.value || '') : '';
    return { id, found: true, text, empty: !String(text).trim() };
  });
}

function scrollScript(id) {
  return `(${scrollToNetApplyField.toString()})(${JSON.stringify(String(id || ''))})`;
}

function readScript(ids) {
  return `(${readPageValues.toString()})(${JSON.stringify(Array.isArray(ids) ? ids : [])})`;
}

module.exports = {
  collectPageFields,
  applyPageWrites,
  scrollToNetApplyField,
  collectScript,
  applyParts,
  applyScript,
  scrollScript,
  readScript,
};
