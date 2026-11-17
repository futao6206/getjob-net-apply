'use strict';

const assert = require('assert');
const { JSDOM } = require('jsdom');
const core = require('../src/core');

function mount(html, url) {
  const dom = new JSDOM(`<!doctype html><html><body>${html}</body></html>`, {
    url,
    pretendToBeVisual: true,
  });
  const { window } = dom;
  global.window = window;
  global.document = window.document;
  global.HTMLInputElement = window.HTMLInputElement;
  global.HTMLTextAreaElement = window.HTMLTextAreaElement;
  global.HTMLElement = window.HTMLElement;
  global.Element = window.Element;
  global.Node = window.Node;
  global.Event = window.Event;
  global.CSS = window.CSS && window.CSS.escape ? window.CSS : {
    escape(value) {
      return String(value).replace(/[^a-zA-Z0-9_-]/g, (ch) => `\\${ch}`);
    },
  };
  const realStyle = window.getComputedStyle.bind(window);
  window.getComputedStyle = (el) => {
    const style = realStyle(el);
    return new Proxy(style, {
      get(target, prop, receiver) {
        if (prop === 'opacity') return target.opacity || '1';
        const value = Reflect.get(target, prop, receiver);
        return typeof value === 'function' ? value.bind(target) : value;
      },
    });
  };
  global.getComputedStyle = window.getComputedStyle;
  window.HTMLElement.prototype.getBoundingClientRect = () => ({
    width: 180,
    height: 32,
    left: 10,
    top: 10,
    right: 190,
    bottom: 42,
    x: 10,
    y: 10,
  });
  return window;
}

function loadPage() {
  delete require.cache[require.resolve('../src/page')];
  return require('../src/page');
}

async function main() {
  const plain = mount('<p>今天的新闻</p><button type="button" id="next">下一页</button>', 'https://example.com/news');
  let plainClicks = 0;
  plain.document.getElementById('next').addEventListener('click', () => { plainClicks += 1; });
  const plainPage = loadPage();
  const plainFields = plainPage.collectPageFields();
  assert.strictEqual(core.classifyPage(plain.location.href, plainFields.fields, plainFields.challenge).ok, false);
  assert.strictEqual(plainClicks, 0);

  const login = mount('<label>密码 <input type="password"></label><label>手机 <input></label>', 'https://example.com/login');
  const loginPage = loadPage();
  const loginFields = loginPage.collectPageFields();
  assert.strictEqual(core.classifyPage(login.location.href, loginFields.fields, loginFields.challenge).ok, false);

  const form = mount(`
    <form>
      <label>姓名 <input id="name"></label>
      <label>手机 <input id="phone"></label>
      <label>学校 <input id="school"></label>
      <label>学历 <select id="degree"><option value="">请选择</option><option>本科</option><option>硕士</option></select></label>
      <label>邮箱 <input id="email" value="already@example.com"></label>
      <button type="submit" id="submit">提交</button>
    </form>
  `, 'https://jobs.example.com/apply');
  let submits = 0;
  form.document.getElementById('submit').addEventListener('click', () => { submits += 1; });
  const formPage = loadPage();
  const collected = formPage.collectPageFields();
  const labels = collected.fields.map((item) => item.label);
  assert.ok(labels.includes('姓名'), `labels=${labels.join('|')}`);
  assert.strictEqual(core.classifyPage(form.location.href, collected.fields, collected.challenge).ok, true);
  const profile = core.sanitizeProfile({
    name: '陈可',
    phone: '13812346210',
    school: '浙江大学',
    degree: '本科',
    email: 'new@example.com',
  });
  const planned = core.planRuleFills(collected.fields, profile);
  const emailField = collected.fields.find((item) => item.label === '邮箱');
  assert.ok(emailField && emailField.empty === false);
  assert.ok(!planned.writes.find((item) => item.id === emailField.id));
  await formPage.applyPageWrites(planned.writes);
  assert.strictEqual(form.document.getElementById('name').value, '陈可');
  assert.strictEqual(form.document.getElementById('phone').value, '13812346210');
  assert.strictEqual(form.document.getElementById('school').value, '浙江大学');
  assert.strictEqual(form.document.getElementById('degree').value, '本科');
  assert.strictEqual(form.document.getElementById('email').value, 'already@example.com');
  assert.strictEqual(submits, 0);
  console.log('page.test.js ok');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
