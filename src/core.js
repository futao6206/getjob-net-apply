/**
 * 网申填写：资料字段、PDF 限额文案、标签规则。
 * 不写网页，不访问网络。证件号只留在本机脚本里。
 */
'use strict';

const PDF_MAX_BYTES = 5 * 1024 * 1024;
const PDF_MAX_PAGES = 5;
const MIN_TEXT_CHARS = 20;
const SECTIONS = [
  {
    title: '基本信息',
    fields: [
      { key: 'name', label: '姓名' },
      { key: 'idNo', label: '证件号', placeholder: '身份证或护照号' },
      { key: 'gender', label: '性别', options: ['男', '女'] },
      { key: 'birthday', label: '出生日期', picker: 'date' },
      { key: 'phone', label: '手机', local: true },
      { key: 'email', label: '邮箱', local: true },
      { key: 'years', label: '工作年限', placeholder: '例如 9年' },
      { key: 'jobStatus', label: '求职状态', options: ['在职', '离职', '在校'] },
    ],
  },
  {
    title: '教育经历',
    note: '写最高学历那一段。简历只有年份时，入学按 9 月、毕业按 6 月，可以改',
    fields: [
      { key: 'school', label: '学校' },
      { key: 'degree', label: '学历', options: ['大专', '本科', '硕士', '博士'] },
      { key: 'major', label: '专业' },
      { key: 'eduRange', label: '在校时间', picker: 'monthRange' },
    ],
  },
  {
    title: '工作经历',
    note: '写最近一段。城市按公司名开头认，不对可以改',
    fields: [
      { key: 'company', label: '公司' },
      { key: 'title', label: '职位' },
      { key: 'city', label: '工作城市', placeholder: '例如 广州' },
      { key: 'workRange', label: '在职时间', picker: 'monthRange' },
      { key: 'role', label: '现从事职业', placeholder: '和下拉不完全一样时，会选接近的' },
      { key: 'industry', label: '现从事行业', placeholder: '会先搜索，再勾选接近的一项' },
      { key: 'salary', label: '现月薪', placeholder: '例如 20000。下拉是区间时选包含这个数的一档' },
      { key: 'duties', label: '工作职责', placeholder: '最近一段在做什么', multiline: true, max: 500 },
    ],
  },
  {
    title: '求职意向',
    note: '能对上的直接填。只能推测的会先选一个接近的，标成待核对。月薪简历里没有就不会填',
    fields: [
      { key: 'intent', label: '搜索关键词', placeholder: '例如 iOS 开发' },
      { key: 'expectRole', label: '期望职业', placeholder: '例如 iOS 高级开发工程师。会选接近的，放到待核对' },
      { key: 'expectIndustry', label: '期望行业', placeholder: '会先搜索，再勾选接近的一项' },
      { key: 'expectCity', label: '期望城市', placeholder: '例如 广州' },
      { key: 'expectSalary', label: '期望月薪', placeholder: '例如 25000。下拉是区间时选包含这个数的一档' },
      { key: 'arrival', label: '到岗时间', placeholder: '例如 随时到岗。没有这一项时选最短的一档' },
    ],
  },
  {
    title: '语言',
    note: '听说和读写用同一档',
    fields: [
      { key: 'language', label: '语言', placeholder: '例如 英语' },
      { key: 'langLevel', label: '掌握程度', options: ['一般', '良好', '熟练', '精通'] },
    ],
  },
  {
    title: '其他',
    note: '很多表会问，写了才会填',
    fields: [
      { key: 'politics', label: '政治面貌', options: ['中共党员', '中共预备党员', '共青团员', '群众', '民主党派'] },
      { key: 'gpa', label: '绩点', placeholder: '例如 3.6 / 4.0' },
    ],
  },
];

const ALL_FIELDS = SECTIONS.flatMap((section) => section.fields);
const FIELD_KEYS = ALL_FIELDS.map((field) => field.key);
const LOCAL_KEYS = ALL_FIELDS.filter((field) => field.local).map((field) => field.key);
const HINT_KEYS = ['school', 'degree', 'company', 'title', 'intent', 'city', 'language'];

const ID_LABELS = ['证件号', '证件号码', '身份证', '身份证号', '身份证号码', 'idnumber', 'idno'];

const RULES = [
  { key: 'name', aliases: ['姓名', '真实姓名', '您的姓名', 'fullname', 'name'], exclude: /紧急|推荐|家长|父亲|母亲|父母|监护|英文名|firstname|lastname|^姓$|^名$/i },
  { key: 'idNo', aliases: ID_LABELS.slice(), exclude: /紧急联系人|推荐人|家长|父亲|母亲|父母|监护人/ },
  { key: 'gender', aliases: ['性别', 'gender', 'sex'], exclude: /紧急|推荐|家长|父亲|母亲/ },
  { key: 'phone', aliases: ['手机', '手机号', '手机号码', '移动电话', '联系电话', '电话', 'phone', 'mobile', 'tel'], exclude: /紧急|推荐|家长|父亲|母亲|父母|监护|固话|座机|区号|分机|联系人/ },
  { key: 'email', aliases: ['邮箱', '电子邮箱', '电子邮件', 'email', 'e-mail'], exclude: /紧急|推荐|家长|父亲|母亲|父母|监护|联系人/ },
  { key: 'school', aliases: ['学校', '学校名称', '毕业院校', '毕业学校', '就读学校', '就读院校', '最高学历院校', 'school', 'university', 'college'], exclude: /第一学历/ },
  { key: 'degree', aliases: ['学历', '最高学历', '教育程度', '学位', 'degree'], exclude: /第一学历|期望/ },
  { key: 'major', aliases: ['专业', '专业名称', '所学专业', 'major'], exclude: /期望/ },
  { key: 'eduRange', aliases: ['在校时间', '在读时间', '就读时间', '教育起止时间'], exclude: /工作|在职/ },
  { key: 'company', aliases: ['公司', '公司名称', '工作单位', '单位名称', '现工作单位', 'company', 'employer'], exclude: /期望|推荐/ },
  { key: 'title', aliases: ['职位', '职位名称', '岗位', '职务', 'jobtitle', 'position'], exclude: /期望|应聘|担任|推荐|现从事|目前职业/ },
  { key: 'workRange', aliases: ['在职时间', '任职时间', '工作起止时间'], exclude: /在校|就读|教育/ },
  { key: 'birthday', aliases: ['出生日期', '生日', '出生年月'], exclude: /家长|父亲|母亲|父母/ },
  { key: 'years', aliases: ['工作年限', '工作经验', '从业年限'], exclude: /开始|结束|在校|期望/ },
  { key: 'jobStatus', aliases: ['求职状态', '在职状态', '目前状态', '工作状态', '就职状态'], exclude: /到岗/ },
  { key: 'city', aliases: ['现工作城市', '工作城市', '所在城市', '现居城市'], exclude: /期望|户口|籍贯|家乡/ },
  { key: 'role', aliases: ['现从事职业', '目前职业', '当前职业', '现职业'], exclude: /期望/ },
  { key: 'industry', aliases: ['现从事行业', '目前行业', '所在行业', '从事行业'], exclude: /期望/ },
  { key: 'salary', aliases: ['现月薪税前', '现月薪', '目前月薪', '当前月薪', '目前薪资'], exclude: /期望/ },
  { key: 'duties', aliases: ['工作职责', '职责描述', '岗位职责', '工作内容', '工作描述'], exclude: /期望/ },
  { key: 'intent', aliases: ['搜索职位关键词', '职位关键词', '求职意向', '求职关键词'], exclude: /期望/ },
  { key: 'expectRole', aliases: ['期望从事职业', '期望职位', '期望职业', '期望岗位'], exclude: /$^/ },
  { key: 'expectIndustry', aliases: ['期望从事行业', '期望行业'], exclude: /$^/ },
  { key: 'expectCity', aliases: ['期望工作城市', '期望城市', '意向城市'], exclude: /$^/ },
  { key: 'expectSalary', aliases: ['期望月薪税前', '期望月薪', '期望薪资', '期望工资'], exclude: /$^/ },
  { key: 'arrival', aliases: ['到岗时间', '最快到岗', '可到岗时间'], exclude: /$^/ },
  { key: 'language', aliases: ['语言类型', '语种', '外语语种'], exclude: /等级|掌握|听说|读写/ },
  { key: 'langLevel', aliases: ['掌握程度', '听说能力', '读写能力', '听说', '读写'], exclude: /类型|语种/ },
  { key: 'politics', aliases: ['政治面貌', '政治面目'], exclude: /$^/ },
  { key: 'gpa', aliases: ['绩点', 'gpa', '成绩绩点'], exclude: /$^/ },
];

const DEGREE_ALIASES = {
  大专: ['专科', '高职', '高职专科'],
  本科: ['大学本科', '学士', '本科生', '全日制本科'],
  硕士: ['硕士研究生', '研究生', '硕士生'],
  博士: ['博士研究生', '博士生'],
};

// 学历和学位不是同一个下拉。本科对应的学位叫「学士」。
const DEGREE_RANK = {
  大专: ['无学位'],
  本科: ['学士', '学士学位'],
  硕士: ['硕士', '硕士学位'],
  博士: ['博士', '博士学位'],
};

const GENDER_ALIASES = {
  男: ['male', 'm'],
  女: ['female', 'f'],
};

const RECRUIT_HOST_SUFFIXES = [
  'zhiye.com',
  'hotjob.cn',
  'job.chinatelecom.com.cn',
  'iguopin.com',
  'mokahr.com',
  'moka.com',
];

function labelOf(key) {
  const found = ALL_FIELDS.find((field) => field.key === key);
  return found ? found.label : key;
}

function emptyProfile() {
  const profile = {};
  FIELD_KEYS.forEach((key) => { profile[key] = ''; });
  return profile;
}

function normLabel(value) {
  return String(value || '')
    .replace(/\s+/g, '')
    .replace(/[*:：:（）()【】[\]·]/g, '')
    .trim()
    .toLowerCase();
}

function normText(value) {
  return String(value || '').replace(/\s+/g, '').trim().toLowerCase();
}

function hasValue(value) {
  return String(value || '').trim() !== '';
}

function filledKeys(profile) {
  return FIELD_KEYS.filter((key) => hasValue(profile && profile[key]));
}

function pad2(n) {
  return String(n).padStart(2, '0');
}

function formatDate(point) {
  if (!point || !point.year) return '';
  return `${point.year}-${pad2(point.month || 1)}-${pad2(point.day || 1)}`;
}

function formatMonth(point) {
  if (!point || !point.year || !point.month) return '';
  return `${point.year}-${pad2(point.month)}`;
}

function completeBirthday(value) {
  const point = parsePoint(value);
  if (!point || !point.year || point.ongoing) return String(value || '').trim();
  return formatDate({ year: point.year, month: point.month || 1, day: point.day || 1 });
}

function defaultEduRange(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  const start = rangePoint(raw, 0);
  const end = rangePoint(raw, 1);
  const startMissing = !!(start && start.year && !start.month);
  const endMissing = !!(end && end.year && !end.ongoing && !end.month);
  if (!startMissing && !endMissing) return raw;
  const left = start && start.year ? `${start.year}-${pad2(startMissing ? 9 : start.month)}` : '';
  let right = '';
  if (end && end.ongoing) right = '至今';
  else if (end && end.year) right = `${end.year}-${pad2(endMissing ? 6 : end.month)}`;
  if (left && right) return `${left} – ${right}`;
  return left || right || raw;
}

function joinMonthRange(start, end) {
  const left = String(start || '').trim();
  const right = String(end || '').trim();
  if (!left && !right) return '';
  if (left && !right) return `${left} – 至今`;
  if (!left) return right;
  return `${left} – ${right}`;
}

function sanitizeProfile(input) {
  const profile = emptyProfile();
  const source = input && typeof input === 'object' ? input : {};
  FIELD_KEYS.forEach((key) => {
    const field = ALL_FIELDS.find((item) => item.key === key);
    let value = String(source[key] == null ? '' : source[key]).replace(/\s+/g, ' ').trim();
    const limit = field && field.max ? field.max : 120;
    if (value.length > limit) value = value.slice(0, limit);
    if (field && field.options && value && field.options.indexOf(value) < 0) value = '';
    if (key === 'birthday') value = completeBirthday(value);
    if (key === 'eduRange') value = defaultEduRange(value);
    profile[key] = value;
  });
  return profile;
}

function limitMessage(kind, overPages, overSize) {
  const verb = kind === 'upload' ? '不能上传识别' : '没有读取';
  if (overPages && overSize) return `这份 PDF 超过 5 页，也超过 5 MB，${verb}。换一份，或改成手动填写。`;
  if (overPages) return `这份 PDF 超过 5 页，${verb}。换一份，或改成手动填写。`;
  if (overSize) return `这份 PDF 超过 5 MB，${verb}。换一份，或改成手动填写。`;
  return '';
}

function activeRules() {
  return RULES.map((rule) => ({
    key: rule.key,
    aliases: rule.aliases.slice(),
    exclude: rule.exclude,
    excludeWords: [],
  }));
}

function ruleHits(label) {
  const normalized = normLabel(label);
  if (!normalized) return [];
  const raw = String(label || '');
  return activeRules().filter((rule) => {
    if (rule.aliases.indexOf(normalized) < 0) return false;
    if (rule.exclude && (rule.exclude.test(raw) || rule.exclude.test(normalized))) return false;
    return !rule.excludeWords.some((word) => raw.indexOf(word) >= 0 || normalized.indexOf(word) >= 0);
  }).map((rule) => rule.key);
}

function dateFieldKey(label, section) {
  const normalized = normLabel(label);
  if (normalized === '出生日期' || normalized === '生日' || normalized === '出生年月') return 'birthday';
  const start = normalized === '开始时间' || normalized === '入学时间' || normalized === '入校时间' || normalized === '入职时间';
  const end = normalized === '结束时间' || normalized === '毕业时间' || normalized === '离职时间';
  if (!start && !end) return '';
  const sec = String(section || '');
  if (/教育|在校|学校/.test(sec)) return start ? 'eduStart' : 'eduEnd';
  if (/工作|实习|在职/.test(sec)) return start ? 'workStart' : 'workEnd';
  return '';
}

function matchRule(label, section) {
  const dated = dateFieldKey(label, section);
  if (dated && dated !== 'birthday') return dated;
  const hits = ruleHits(label);
  if (hits.length === 1) return hits[0];
  return dated || null;
}

function unmatchedLabels(fields) {
  const seen = {};
  const out = [];
  (Array.isArray(fields) ? fields : []).forEach((field) => {
    if (!field || field.silent || field.skip || !field.empty || field.control === 'date') return;
    if (ignoredField(field.label)) return;
    const normalized = normLabel(field.label);
    if (!normalized || seen[normalized]) return;
    if (matchRule(field.label, field.section)) return;
    seen[normalized] = true;
    out.push(normalized);
  });
  return out;
}

function ignoredField(label) {
  return /推荐码|内推码/.test(normLabel(label));
}

function userFillsId(label) {
  return ID_LABELS.indexOf(normLabel(label)) >= 0;
}

function isOtherPerson(label) {
  return /紧急联系人|推荐人|推荐单位|家长|父亲|母亲|父母|监护人/.test(String(label || ''));
}

function isRecruitHost(url) {
  let host = '';
  try {
    host = new URL(String(url || '')).hostname.toLowerCase();
  } catch (_) {
    return false;
  }
  return RECRUIT_HOST_SUFFIXES.some((suffix) => host === suffix || host.endsWith(`.${suffix}`));
}

function classifyPage(url, fields, challenge) {
  if (challenge) return { ok: false, challenge: true };
  const list = Array.isArray(fields) ? fields : [];
  const visible = list.filter((field) => field && !field.silent);
  const strong = /学校|学历|专业|毕业|教育|工作经历|简历|政治面貌|school|university|college|degree|major|education/i;
  const weak = /姓名|手机|邮箱|电话|fullname|name|phone|mobile|e-?mail/i;
  const strongHits = visible.filter((field) => strong.test(field.label || ''));
  const weakHits = visible.filter((field) => weak.test(field.label || ''));
  const hasPassword = list.some((field) => field && field.skip === 'password');
  if (hasPassword && strongHits.length === 0) return { ok: false, challenge: false };
  if (strongHits.length >= 1 && (weakHits.length >= 1 || visible.length >= 4)) {
    return { ok: true, challenge: false };
  }
  if (!hasPassword && weakHits.length >= 2 && visible.length >= 4) {
    return { ok: true, challenge: false };
  }
  if (isRecruitHost(url) && (strongHits.length >= 1 || weakHits.length >= 2) && visible.length >= 3) {
    return { ok: true, challenge: false };
  }
  return { ok: false, challenge: false };
}

function optionMatch(key, profileValue, options) {
  const list = (Array.isArray(options) ? options : []).map((item) => String(item || '').trim()).filter(Boolean);
  const value = String(profileValue || '').trim();
  if (!value || !list.length) return null;
  const exact = list.find((item) => normText(item) === normText(value));
  if (exact) return { optionText: exact, status: 'filled' };
  let aliases = [];
  if (key === 'degree') aliases = (DEGREE_ALIASES[value] || []).slice();
  if (key === 'gender') aliases = (GENDER_ALIASES[value] || []).slice();
  if (key === 'politics') aliases = [value];
  const hits = list.filter((item) => {
    const left = normText(item);
    return aliases.some((alias) => {
      const right = normText(alias);
      if (!right || right === normText(value)) {
        return key === 'politics' && (left.includes(right) || right.includes(left));
      }
      return left === right || left.includes(right) || right.includes(left);
    });
  });
  const unique = [];
  hits.forEach((item) => { if (unique.indexOf(item) < 0) unique.push(item); });
  if (unique.length === 1) {
    return {
      optionText: unique[0],
      status: 'check',
      reason: `资料写「${value}」，选了「${unique[0]}」`,
    };
  }
  return null;
}

function acceptTexts(key, value) {
  const out = [];
  function add(text) {
    const item = String(text || '').trim();
    if (item && out.indexOf(item) < 0) out.push(item);
  }
  add(value);
  let aliases = [];
  if (key === 'degree') aliases = DEGREE_ALIASES[value] || [];
  if (key === 'gender') aliases = GENDER_ALIASES[value] || [];
  aliases.forEach(add);
  return out;
}

const CITY_PARENT = {
  北京: ['北京', '北京市'],
  上海: ['上海', '上海市'],
  天津: ['天津', '天津市'],
  重庆: ['重庆', '重庆市'],
  广州: ['广东', '广东省'],
  深圳: ['广东', '广东省'],
  佛山: ['广东', '广东省'],
  东莞: ['广东', '广东省'],
  杭州: ['浙江', '浙江省'],
  宁波: ['浙江', '浙江省'],
  南京: ['江苏', '江苏省'],
  苏州: ['江苏', '江苏省'],
  无锡: ['江苏', '江苏省'],
  成都: ['四川', '四川省'],
  武汉: ['湖北', '湖北省'],
  长沙: ['湖南', '湖南省'],
  西安: ['陕西', '陕西省'],
  郑州: ['河南', '河南省'],
  青岛: ['山东', '山东省'],
  济南: ['山东', '山东省'],
  厦门: ['福建', '福建省'],
  福州: ['福建', '福建省'],
  合肥: ['安徽', '安徽省'],
  昆明: ['云南', '云南省'],
  大连: ['辽宁', '辽宁省'],
};

const ARRIVAL_SOON = ['随时到岗', '随时', '即时到岗', '可立即到岗', '立即到岗', '即可到岗', '一周内', '一周以内', '一周内到岗', '一个月内'];

function cityParents(value) {
  const name = String(value || '').replace(/市$/, '').trim();
  return (CITY_PARENT[name] || []).slice();
}

function cityFromCompany(name) {
  const text = String(name || '');
  const cities = Object.keys(CITY_PARENT).sort((a, b) => b.length - a.length);
  return cities.find((city) => text.startsWith(city)) || '';
}

function parsePoint(text) {
  const raw = String(text || '').replace(/\s+/g, '');
  if (!raw) return null;
  if (/至今|现在/.test(raw)) return { ongoing: true };
  const full = raw.match(/(\d{4})[.\-/年](\d{1,2})[.\-/月](\d{1,2})/);
  if (full) return { year: Number(full[1]), month: Number(full[2]), day: Number(full[3]) };
  const ym = raw.match(/(\d{4})[.\-/年](\d{1,2})/);
  if (ym) return { year: Number(ym[1]), month: Number(ym[2]), day: 0 };
  const year = raw.match(/(\d{4})/);
  if (year) return { year: Number(year[1]), month: 0, day: 0 };
  return null;
}

function rangeParts(range) {
  const raw = String(range || '').trim();
  if (!raw) return ['', ''];
  const spaced = raw.split(/\s+[–—~～至到-]\s+/);
  if (spaced.length >= 2) return [spaced[0], spaced.slice(1).join(' ')];
  const glued = raw.match(/^(.+?)\s*[-–—~～至到]\s*(至今|现在|\d{4}.*)$/);
  if (glued) return [glued[1], glued[2]];
  return [raw, ''];
}

function rangePoint(range, index) {
  const parts = rangeParts(range);
  return parsePoint(parts[index] || '');
}

function dateCopy(point) {
  if (!point || point.ongoing || !point.year) return '';
  if (!point.month) return String(point.year);
  if (!point.day) return `${point.year}/${point.month}`;
  return `${point.year}/${point.month}/${point.day}`;
}

function scoreYearOption(value, options) {
  const list = (Array.isArray(options) ? options : []).map((item) => String(item || '').trim()).filter(Boolean);
  const wanted = String(value || '').replace(/\s+/g, '');
  if (!wanted || !list.length) return null;
  const exacts = list.filter((item) => {
    const text = item.replace(/\s+/g, '');
    const left = text.replace(/年$/, '');
    const right = wanted.replace(/年$/, '');
    return text === wanted || (left === right && /^\d{1,2}$/.test(right));
  });
  const exact = exacts.find((item) => /年/.test(item)) || exacts[0];
  if (exact) return { optionText: exact, status: 'filled', reason: '' };
  const num = wanted.match(/^(\d{1,2})年?$/);
  const years = num ? Number(num[1]) : 0;
  if (!years) return null;
  let best = '';
  let bestWidth = 99;
  list.forEach((item) => {
    const text = item.replace(/\s+/g, '');
    const span = text.match(/(\d+)[-~～—至到](\d+)年?$/);
    const above = text.match(/(\d+)年(?:以上|及以上)/);
    const below = text.match(/(\d+)年(?:以下|以内)/);
    let lo = 0;
    let hi = 0;
    let width = 99;
    let inside = false;
    if (span) {
      lo = Number(span[1]);
      hi = Number(span[2]);
      width = hi - lo;
      inside = years >= lo && years <= hi;
    } else if (above) {
      lo = Number(above[1]);
      width = 40;
      inside = years >= lo;
    } else if (below) {
      hi = Number(below[1]);
      width = hi;
      inside = years <= hi;
    }
    if (!inside || width >= bestWidth) return;
    best = item;
    bestWidth = width;
  });
  if (!best) return null;
  return { optionText: best, status: 'check', reason: `资料写「${value}」，选了「${best}」` };
}

function moneyYuan(num, unit, fallbackUnit) {
  const n = Number(num);
  if (!Number.isFinite(n)) return null;
  const u = String(unit || fallbackUnit || '');
  if (u === '万') return Math.round(n * 10000);
  if (u === '千' || u.toLowerCase() === 'k') return Math.round(n * 1000);
  if (u === '元') return Math.round(n);
  if (n >= 100) return Math.round(n);
  return Math.round(n * 1000);
}

function salaryYuan(value) {
  const raw = String(value || '').replace(/[,，\s]/g, '');
  if (!raw || /面议/.test(raw)) return null;
  const wan = raw.match(/(\d+(?:\.\d+)?)万/);
  if (wan) return Math.round(Number(wan[1]) * 10000);
  const k = raw.match(/(\d+(?:\.\d+)?)[kK千]/);
  if (k) return Math.round(Number(k[1]) * 1000);
  const num = raw.match(/(\d{3,8})/);
  return num ? Number(num[1]) : null;
}

function salaryBand(text) {
  const raw = String(text || '').replace(/\s+/g, '');
  if (!raw || /面议/.test(raw)) return null;
  const range = raw.match(/(\d+(?:\.\d+)?)(万|千|[kK]|元)?\s*[-~～—–至到]\s*(\d+(?:\.\d+)?)(万|千|[kK]|元)?/);
  if (range) {
    const lo = moneyYuan(range[1], range[2], range[4]);
    const hi = moneyYuan(range[3], range[4], range[2]);
    if (lo == null || hi == null) return null;
    return lo <= hi ? { lo, hi } : { lo: hi, hi: lo };
  }
  const below = raw.match(/(\d+(?:\.\d+)?)(万|千|[kK]|元)?(?:以下|以内)/);
  if (below) {
    const hi = moneyYuan(below[1], below[2], '');
    return hi == null ? null : { lo: 0, hi };
  }
  const above = raw.match(/(\d+(?:\.\d+)?)(万|千|[kK]|元)?(?:以上|及以上)/);
  if (above) {
    const lo = moneyYuan(above[1], above[2], '');
    return lo == null ? null : { lo, hi: Infinity };
  }
  return null;
}

function scoreSalaryOption(value, options) {
  const yuan = salaryYuan(value);
  const list = (Array.isArray(options) ? options : []).map((item) => String(item || '').trim()).filter(Boolean);
  if (!yuan || !list.length) return null;
  let best = '';
  let bestWidth = Infinity;
  list.forEach((item) => {
    const band = salaryBand(item);
    if (!band || yuan < band.lo || yuan > band.hi) return;
    const width = band.hi === Infinity ? 1e15 : (band.hi - band.lo);
    if (width >= bestWidth) return;
    best = item;
    bestWidth = width;
  });
  if (!best) return null;
  return { optionText: best, status: 'check', reason: `资料写「${value}」，选了「${best}」` };
}

function arrivalDays(text) {
  const raw = String(text || '').replace(/\s+/g, '');
  if (!raw || /面议|待定|协商|不确定/.test(raw)) return null;
  if (/随时|立即|即时|即可|马上/.test(raw)) return 0;
  if (/三个月以上|三个月后|3个月以上|三月以上/.test(raw)) return 120;
  if (/三个月|3个月|三月/.test(raw)) return 90;
  if (/两个月|2个月|两月/.test(raw)) return 60;
  if (/半个月|半月|两周|14天/.test(raw)) return 14;
  if (/一个月|1个月|30天|一月/.test(raw)) return 30;
  if (/一周|7天|七天/.test(raw)) return 7;
  return null;
}

function scoreArrivalOption(value, options) {
  const need = arrivalDays(value);
  const list = (Array.isArray(options) ? options : []).map((item) => String(item || '').trim()).filter(Boolean);
  if (need == null || !list.length) return null;
  let best = '';
  let bestDays = Infinity;
  list.forEach((item) => {
    const days = arrivalDays(item);
    if (days == null || days < need || days >= bestDays) return;
    best = item;
    bestDays = days;
  });
  if (!best) return null;
  const same = normText(best) === normText(value);
  return {
    optionText: best,
    status: same ? 'filled' : 'check',
    reason: same ? '' : `资料写「${value}」，选了「${best}」`,
  };
}

function scoreApproxOption(value, options, searches) {
  const rawKeys = Array.isArray(searches) && searches.length ? searches : [value];
  const keys = rawKeys.map((item) => String(item || '').trim()).filter((item) => item.length >= 2);
  const primary = String(value || '').replace(/\s+/g, '');
  const distinctive = keys.filter((item) => /^(ios|android|前端|后端|算法|测试|运维)$/i.test(item));
  const list = (Array.isArray(options) ? options : []).map((item) => String(item || '').trim()).filter(Boolean);
  const anyDistinctive = distinctive.length > 0 && list.some((item) => {
    const lower = item.toLowerCase();
    return distinctive.some((token) => lower.includes(token.toLowerCase()));
  });
  let best = '';
  let bestScore = 0;
  list.forEach((item) => {
    const text = item.replace(/\s+/g, '');
    if (!text || text.length > 40) return;
    if (/^请选择|^搜索|^不限|^确定|^取消|^已选|^清空|^搜索结果|^请在左侧|^全国$/.test(text)) return;
    const lower = text.toLowerCase();
    if (anyDistinctive && !distinctive.some((token) => lower.includes(token.toLowerCase()))) return;
    let score = 0;
    if (primary && text.includes(primary)) score += 100;
    keys.forEach((key) => {
      if (lower.includes(key.toLowerCase())) score += 30 + key.length;
    });
    if (!score) return;
    score -= text.length;
    if (score <= bestScore) return;
    best = item;
    bestScore = score;
  });
  if (!best) return null;
  const same = normText(best) === normText(value);
  return {
    optionText: best,
    status: same ? 'filled' : 'check',
    reason: same ? '' : `资料写「${value}」，选了「${best}」`,
  };
}

function tagDateSections(list) {
  let mode = '';
  list.forEach((field) => {
    if (!field) return;
    const label = String(field.label || '');
    const section = String(field.section || '');
    if (/教育/.test(section)) mode = 'edu';
    else if (/工作|实习/.test(section)) mode = 'work';
    if (/学校名称|毕业院校/.test(label)) mode = 'edu';
    if (/公司名称|工作单位/.test(label)) mode = 'work';
    if (field.control === 'date' && !field.section) {
      if (mode === 'edu') field.section = '教育经历';
      if (mode === 'work') field.section = '工作经历';
    }
  });
}

function planDateWrite(field, safe) {
  const kind = dateFieldKey(field.label, field.section);
  const fix = kind === 'birthday' ? 'birthday' : (kind.indexOf('edu') === 0 ? 'eduRange' : 'workRange');
  if (!kind) {
    return {
      id: field.id, status: 'miss', reason: '看不出这段日期该填哪一段', label: field.label, copy: '', fix: '',
    };
  }
  let point = null;
  if (kind === 'birthday') point = parsePoint(safe.birthday);
  else if (kind === 'eduStart' || kind === 'workStart') point = rangePoint(kind.indexOf('edu') === 0 ? safe.eduRange : safe.workRange, 0);
  else point = rangePoint(kind.indexOf('edu') === 0 ? safe.eduRange : safe.workRange, 1);
  const copy = dateCopy(point);
  if (!point) {
    return { id: field.id, status: 'miss', reason: '资料里空着', fix, label: field.label, copy: '', key: fix };
  }
  if (point.ongoing) {
    return { id: field.id, status: 'miss', reason: '资料写的是至今', fix, label: field.label, copy: '至今', key: fix };
  }
  if (!point.month) {
    return { id: field.id, status: 'miss', reason: '资料里只有年份，没有月份', fix, label: field.label, copy, key: fix };
  }
  return {
    id: field.id,
    key: fix,
    control: 'date',
    year: point.year,
    month: point.month,
    day: point.day || 1,
    status: 'filled',
    reason: '',
    copy,
    value: copy,
    label: field.label,
  };
}

function decorateSelect(field, key, value, matched) {
  const accept = acceptTexts(key, value);
  const write = {
    id: field.id,
    key,
    control: field.control,
    optionText: matched ? matched.optionText : (accept[0] || value),
    accept: matched ? accept.concat([matched.optionText]) : accept,
    lazy: !!field.lazy,
    status: matched ? matched.status : 'filled',
    reason: matched ? (matched.reason || '') : '',
    copy: value,
    label: field.label,
  };
  if (key === 'years') {
    write.kind = 'years';
    const num = String(value || '').match(/(\d{1,2})/);
    if (num) write.search = num[1];
    write.searches = num ? [num[1], `${num[1]}年`] : [];
  } else if (key === 'city' || key === 'expectCity') {
    write.kind = 'city';
    write.parents = cityParents(value);
    write.search = String(value || '').replace(/市$/, '');
    write.searches = [];
    if (write.search) write.searches.push(write.search);
    write.parents.forEach((item) => {
      if (item && write.searches.indexOf(item) < 0) write.searches.push(item);
    });
    write.status = 'check';
    write.reason = `按「${value}」选城市，请核对`;
  } else if (key === 'role' || key === 'expectRole') {
    write.kind = 'approx';
    write.searches = roleSearches(value);
    write.search = write.searches[0] || value;
    write.status = 'check';
    if (!write.reason) write.reason = `按「${value}」选接近的一项，请核对`;
  } else if (key === 'industry' || key === 'expectIndustry') {
    write.kind = 'approx';
    write.searches = industrySearches(value);
    write.search = write.searches[0] || value;
    write.status = 'check';
    if (!write.reason) write.reason = `按「${value}」选接近的一项，请核对`;
  } else if (key === 'language') {
    write.search = value;
    write.searches = value ? [value] : [];
  } else if (key === 'arrival') {
    write.kind = 'arrival';
    write.search = '';
    write.searches = [];
    if (!matched || matched.status !== 'filled') {
      write.status = 'check';
      if (!write.reason) write.reason = `资料写「${value}」，选最短能到岗的一项`;
    }
  } else if (key === 'salary' || key === 'expectSalary') {
    write.kind = 'salary';
    write.search = '';
    write.searches = [];
    if (!matched || matched.status !== 'filled') {
      write.status = 'check';
      if (!write.reason) write.reason = `资料写「${value}」，按区间选一档`;
    }
  }
  return write;
}

function roleSearches(value) {
  const text = String(value || '');
  const out = [];
  function add(item) {
    const word = String(item || '').trim();
    if (word && out.indexOf(word) < 0) out.push(word);
  }
  ['iOS', 'Android', '前端', '后端', '算法', '测试', '运维'].forEach((word) => {
    if (text.toLowerCase().includes(word.toLowerCase())) add(word);
  });
  if (/开发|工程师|程序员/.test(text)) add('开发');
  if (/软件/.test(text)) add('软件');
  if (text && text.length <= 8) add(text);
  return out.slice(0, 4);
}

function industrySearches(value) {
  const text = String(value || '').trim();
  const out = [];
  function add(item) {
    if (item && out.indexOf(item) < 0) out.push(item);
  }
  if (text) add(text);
  if (/互联网|计算机|软件|开发|iOS|工程师/.test(text)) {
    ['互联网', '计算机', '软件', 'IT'].forEach(add);
  }
  return out.slice(0, 4);
}

function skipCopy(skip) {
  if (skip === 'date') return '日期控件，这一版不填';
  if (skip === 'file') return '附件，这一版不传';
  if (skip === 'richtext') return '富文本，这一版不填';
  if (skip === 'cascade') return '省市级联，这一版不填';
  if (skip === 'open') return '开放题，这一版不填';
  if (skip === 'password') return '密码，这一版不填';
  if (skip === 'captcha') return '验证码，这一版不填';
  if (skip === 'disabled') return '这一项不能编辑';
  return '这一版不填';
}

function writeProfileValue(field, key, safe) {
  const value = safe[key];
  if (!hasValue(value)) return null;
  if (field.control === 'select' || field.control === 'radio') {
    let matched = optionMatch(key, value, field.options);
    if (!matched && key === 'years' && field.options && field.options.length) {
      matched = scoreYearOption(value, field.options);
    }
    if (!matched && (key === 'salary' || key === 'expectSalary')) {
      matched = scoreSalaryOption(value, field.options || []);
    }
    if (!matched && key === 'arrival') {
      matched = scoreArrivalOption(value, field.options || []);
    }
    if (!matched && (key === 'role' || key === 'expectRole')) {
      matched = scoreApproxOption(value, field.options || [], roleSearches(value));
    }
    if (!matched && (key === 'industry' || key === 'expectIndustry')) {
      matched = scoreApproxOption(value, field.options || [], industrySearches(value));
    }
    if (matched) return decorateSelect(field, key, value, matched);
    if (field.lazy && acceptTexts(key, value).length) return decorateSelect(field, key, value, null);
    return null;
  }
  return {
    id: field.id,
    key,
    control: 'text',
    value,
    status: 'filled',
    reason: '',
    copy: value,
    label: field.label,
  };
}

function planRuleFills(fields, profile) {
  const safe = sanitizeProfile(profile);
  const list = Array.isArray(fields) ? fields : [];
  tagDateSections(list);
  const claims = [];
  list.forEach((field) => {
    if (!field || field.silent || field.skip || !field.empty || field.control === 'date') return;
    const key = matchRule(field.label, field.section);
    if (!key || FIELD_KEYS.indexOf(key) < 0 || !hasValue(safe[key])) return;
    if (key === 'idNo' && (isOtherPerson(field.label) || isOtherPerson(field.section))) return;
    // 「学位」对上学历这项，但下拉是学士/硕士，不能把「本科」直接写进去。
    if (normLabel(field.label) === '学位') return;
    claims.push({ field, key });
  });
  const groups = {};
  const byId = {};
  claims.forEach((claim) => {
    const group = `${claim.key}\n${normLabel(claim.field.label)}`;
    groups[group] = (groups[group] || 0) + 1;
    byId[claim.field.id] = (byId[claim.field.id] || 0) + 1;
  });
  const writes = [];
  const claimedIds = {};
  claims.forEach((claim) => {
    const group = `${claim.key}\n${normLabel(claim.field.label)}`;
    if (groups[group] !== 1 || byId[claim.field.id] !== 1) return;
    const write = writeProfileValue(claim.field, claim.key, safe);
    if (!write) return;
    writes.push(write);
    claimedIds[claim.field.id] = claim.key;
  });
  list.forEach((field) => {
    if (!field || field.silent || field.skip || !field.empty || field.control !== 'date' || claimedIds[field.id]) return;
    const write = planDateWrite(field, safe);
    writes.push(write);
    claimedIds[field.id] = write.key || 'date';
  });
  list.forEach((field) => {
    if (!field || field.silent || field.skip || !field.empty || claimedIds[field.id]) return;
    if (normLabel(field.label) !== '学位') return;
    const accept = (DEGREE_RANK[safe.degree] || []).slice();
    if (!accept.length) return;
    const listed = Array.isArray(field.options) ? field.options : [];
    const hit = accept.map((item) => listed.find((option) => normText(option) === normText(item))).find(Boolean);
    if (listed.length && !hit && !field.lazy) return;
    writes.push({
      id: field.id,
      key: 'degree',
      control: field.control === 'radio' ? 'radio' : ((field.control === 'select' || field.lazy) ? 'select' : 'text'),
      optionText: hit || accept[0],
      value: hit || accept[0],
      accept,
      lazy: !hit && (field.control === 'select' || !!field.lazy),
      status: 'check',
      reason: `资料写「${safe.degree}」，选了「${hit || accept[0]}」`,
      copy: safe.degree,
      label: field.label,
    });
    claimedIds[field.id] = 'degree';
  });
  list.forEach((field) => {
    if (!field || field.silent || field.skip || !field.empty || claimedIds[field.id]) return;
    const label = normLabel(field.label);
    if (label !== '到岗时间' && label !== '最快到岗' && label !== '可到岗时间') return;
    if (safe.jobStatus !== '离职') return;
    const listed = Array.isArray(field.options) ? field.options : [];
    const scored = listed.length ? scoreArrivalOption('随时到岗', listed) : null;
    const hit = scored ? scored.optionText : ARRIVAL_SOON.map((item) => listed.find((option) => normText(option) === normText(item))).find(Boolean);
    if (listed.length && !hit && !field.lazy) return;
    writes.push({
      id: field.id,
      key: 'jobStatus',
      kind: 'arrival',
      control: field.control === 'radio' ? 'radio' : 'select',
      optionText: hit || ARRIVAL_SOON[0],
      accept: hit ? [hit].concat(ARRIVAL_SOON) : ARRIVAL_SOON.slice(),
      search: '',
      searches: [],
      lazy: !hit,
      status: 'check',
      reason: scored && scored.reason ? scored.reason.replace('随时到岗', '离职') : '资料写「离职」，选了能马上到岗的选项',
      copy: '离职',
      label: field.label,
    });
    claimedIds[field.id] = 'jobStatus';
  });
  return { writes, claimedIds, profile: safe };
}

function emptyKeyForField(field, profile) {
  const key = matchRule(field && field.label, field && field.section);
  if (!key || FIELD_KEYS.indexOf(key) < 0) return '';
  if (hasValue(profile && profile[key])) return '';
  return key;
}

function resultRows(fields, profile, applied) {
  const safe = sanitizeProfile(profile);
  const done = {};
  (Array.isArray(applied) ? applied : []).forEach((item) => { if (item && item.id) done[item.id] = item; });
  const rows = [];
  (Array.isArray(fields) ? fields : []).forEach((field) => {
    if (!field || field.silent || ignoredField(field.label)) return;
    const appliedRow = done[field.id];
    if (appliedRow && appliedRow.status && appliedRow.status !== 'miss') {
      rows.push({
        id: field.id,
        status: appliedRow.status,
        label: field.label || labelOf(appliedRow.key),
        text: appliedRow.key === 'idNo'
          ? hideSecret(appliedRow.status === 'check' ? (appliedRow.reason || '请确认') : displayValue(appliedRow), appliedRow.copy || appliedRow.value || '')
          : (appliedRow.status === 'check' ? (appliedRow.reason || '请确认') : displayValue(appliedRow)),
        copy: appliedRow.copy || '',
        fix: '',
        source: appliedRow.source || '',
        learnIndex: Number.isInteger(appliedRow.learnIndex) ? appliedRow.learnIndex : -1,
      });
      return;
    }
    if (appliedRow && appliedRow.status === 'miss') {
      rows.push({
        id: field.id,
        status: 'miss',
        label: field.label || labelOf(appliedRow.key),
        text: appliedRow.key === 'idNo' ? hideSecret(appliedRow.reason || '没填上', appliedRow.copy || '') : (appliedRow.reason || '没填上'),
        copy: appliedRow.copy || '',
        fix: appliedRow.fix || '',
        source: appliedRow.source || '',
        learnIndex: Number.isInteger(appliedRow.learnIndex) ? appliedRow.learnIndex : -1,
      });
      return;
    }
    if (!field.empty) return;
    if (field.skip) {
      rows.push({
        id: field.id,
        status: 'miss',
        label: field.label || '未命名',
        text: skipCopy(field.skip),
        copy: '',
        fix: '',
      });
      return;
    }
    const emptyKey = emptyKeyForField(field, safe);
    if (emptyKey) {
      rows.push({
        id: field.id,
        status: 'miss',
        label: field.label,
        text: '资料里空着',
        copy: '',
        fix: emptyKey,
      });
      return;
    }
    const ruled = matchRule(field.label, field.section);
    if (ruled && FIELD_KEYS.indexOf(ruled) >= 0 && hasValue(safe[ruled]) && !isOtherPerson(field.label)) {
      rows.push({
        id: field.id,
        status: 'miss',
        label: field.label,
        text: ruled === 'idNo' ? hideSecret('和网页上的选项对不上', safe[ruled]) : '和网页上的选项对不上',
        copy: safe[ruled],
        fix: '',
      });
      return;
    }
    if (isOtherPerson(field.label) && /电话|手机|phone|mobile/i.test(field.label)) {
      rows.push({
        id: field.id,
        status: 'miss',
        label: field.label,
        text: '不用你的手机号填',
        copy: '',
        fix: '',
      });
      return;
    }
    rows.push({
      id: field.id,
      status: 'miss',
      label: field.label || '未命名',
      text: '资料里没有这一项',
      copy: '',
      fix: '',
    });
  });
  return rows;
}

function displayValue(row) {
  if (!row) return '';
  if (row.key === 'phone') return maskPhone(row.copy || row.value || '');
  if (row.key === 'idNo') return maskId(row.copy || row.value || '');
  if (row.optionText) return row.optionText;
  return row.value || row.copy || '';
}

function hideSecret(text, secret) {
  const raw = String(secret || '').trim();
  const shown = String(text || '');
  if (!raw) return shown;
  return shown.split(raw).join(maskId(raw));
}

function maskPhone(value) {
  const text = String(value || '');
  if (/^1\d{10}$/.test(text)) return `${text.slice(0, 3)}****${text.slice(7)}`;
  return text;
}

function meaningfulText(text) {
  return String(text || '').replace(/\s+/g, '').replace(/\uFFFD/g, '');
}

// PDF 文字层经常把一个词拆成多块，拼回来中间会多空格：「广 州热度网络 科技」「202 3」。
// 页脚「3 / 3」贴在年份后面时先拿掉，否则「2016  3」会粘成 20163，在校时间对不上。
function normalizeResumeText(raw) {
  let text = String(raw || '').replace(/\u00a0/g, ' ').replace(/\u3000/g, ' ');
  text = text.replace(/(?:^|[ \t])\d{1,2}[ \t]+\/[ \t]+\d{1,2}(?=[ \t]*(?:\n|$))/g, '\n');
  let prev = '';
  while (text !== prev) {
    prev = text;
    text = text.replace(/([\u4e00-\u9fff])[ \t]+([\u4e00-\u9fff])/g, '$1$2');
    text = text.replace(/(\d)[ \t]+(\d)/g, '$1$2');
  }
  return text.replace(/[ \t]+/g, ' ');
}

function sectionAfter(text, starts, ends) {
  let startAt = -1;
  let startLen = 0;
  starts.forEach((label) => {
    const at = text.indexOf(label);
    if (at >= 0 && (startAt < 0 || at < startAt)) {
      startAt = at;
      startLen = label.length;
    }
  });
  if (startAt < 0) return '';
  const rest = text.slice(startAt + startLen);
  let endAt = rest.length;
  ends.forEach((label) => {
    const at = rest.indexOf(label);
    if (at >= 0 && at < endAt) endAt = at;
  });
  return rest.slice(0, endAt);
}

function workSection(text) {
  const ends = ['专业技能', '项目经历', '项目经验', '教育经历', '教育背景', '自我评价'];
  if (text.includes('工作经历')) return sectionAfter(text, ['工作经历'], ends);
  return sectionAfter(text, ['实习经历'], ends);
}

function educationSection(text) {
  return sectionAfter(text, ['教育经历', '教育背景'], ['工作经历', '实习经历', '专业技能', '项目经历', '项目经验', '自我评价']);
}

function firstCompany(text) {
  if (!text) return '';
  const bounded = text.match(/(?:^|[\n●•])\s*([\u4e00-\u9fffA-Za-z0-9]{2,30}(?:有限公司|股份公司|集团公司))/);
  if (bounded) return bounded[1];
  const labeled = text.match(/(?:公司|单位)[:：]\s*([\u4e00-\u9fffA-Za-z0-9]{2,30})/);
  if (labeled) return labeled[1];
  const any = text.match(/([\u4e00-\u9fffA-Za-z0-9]{2,30}(?:有限公司|股份公司|集团公司))/);
  return any ? any[1] : '';
}

// 职位和下一家公司都是中文，空格会被收掉，粘成「工程师杭州青澜科技有限公司」。
function stripGluedCompany(chunk) {
  const source = String(chunk || '');
  const mark = source.search(/有限公司|股份公司|集团公司/);
  if (mark < 0) return source;
  let cut = -1;
  Object.keys(CITY_PARENT).forEach((city) => {
    const at = source.lastIndexOf(city, mark - 1);
    if (at < 0) return;
    const len = mark - at;
    if (len < city.length + 2 || len > 24) return;
    if (cut < 0 || at > cut) cut = at;
  });
  if (cut > 0) return source.slice(0, cut);
  const titled = source.match(/^(.+?(?:工程师|架构师|设计师|分析师|实习生|程序员|负责人|经理|总监|主管|专员|顾问))/);
  if (titled && titled[1].length >= 2 && titled[1].length < mark) return titled[1];
  return source;
}

function titleBesideCompany(text, company) {
  if (!text || !company) return '';
  const at = text.indexOf(company);
  if (at < 0) return '';
  let rest = text.slice(at + company.length);
  rest = rest.replace(/^\s*[（(][^）)\n]{0,60}[）)]/, '');
  rest = rest.replace(/^\s*\d{4}\s*[.\-/年]\s*\d{0,2}\s*[-–—~至到]+\s*(?:\d{4}\s*[.\-/年]\s*\d{0,2}|至今|现在)/, '');
  let chunk = (rest.split(/[●•・\n]/)[0] || '').split(/[（(]/)[0] || '';
  chunk = stripGluedCompany(chunk);
  chunk = chunk.replace(/^[\s|：:，,；;]+/, '').replace(/[\s|：:，,；;]+$/, '').trim();
  if (chunk.length < 2 || chunk.length > 30) return '';
  if (/有限公司|股份公司|集团公司|专业技能|教育经历|项目经历|工作经历/.test(chunk)) return '';
  if (/^[\d\s./\-–—]+$/.test(chunk)) return '';
  return chunk;
}

function formatRange(start, end) {
  return `${String(start).replace(/\s+/g, '')} – ${String(end).replace(/\s+/g, '')}`;
}

function firstRange(text) {
  if (!text) return '';
  const month = text.match(/(\d{4}\s*[.\-/年]\s*\d{1,2})\s*[-–—~至到]+\s*(\d{4}\s*[.\-/年]\s*\d{1,2}|至今|现在)/);
  if (month) return formatRange(month[1], month[2]);
  const year = text.match(/(?:^|[^\d])(\d{4})\s*[-–—~至到]+\s*(\d{4}|至今|现在)(?!\d)/);
  if (year) return formatRange(year[1], year[2]);
  return '';
}

function allMonthRanges(text) {
  const ranges = [];
  const rangeRe = /(\d{4}\s*[.\-/年]\s*\d{1,2})\s*[-–—~至到]+\s*(\d{4}\s*[.\-/年]\s*\d{1,2}|至今|现在)/g;
  let rangeMatch = rangeRe.exec(String(text || ''));
  while (rangeMatch) {
    ranges.push(formatRange(rangeMatch[1], rangeMatch[2]));
    rangeMatch = rangeRe.exec(String(text || ''));
  }
  return ranges;
}

function degreeIn(text) {
  const found = String(text || '').match(/博士研究生|硕士研究生|博士|硕士|本科|大专|专科/);
  if (!found) return '';
  if (found[0] === '博士研究生' || found[0] === '博士') return '博士';
  if (found[0] === '硕士研究生' || found[0] === '硕士') return '硕士';
  if (found[0] === '专科' || found[0] === '大专') return '大专';
  return '本科';
}

function highestDegree(text) {
  const order = ['博士', '硕士', '本科', '大专'];
  let found = '';
  order.some((item) => {
    if (String(text || '').includes(item)) {
      found = item;
      return true;
    }
    return false;
  });
  return found;
}

function firstSchool(text) {
  const school = String(text || '').match(/([\u4e00-\u9fffA-Za-z]{2,20}(?:大学|学院))/);
  return school ? school[1] : '';
}

function labeledMajor(text) {
  const major = String(text || '').match(/专业(?!技能|知识|能力|课程)[:：\s]+([\u4e00-\u9fffA-Za-z0-9]{2,20})/);
  return major ? major[1] : '';
}

function majorBesideSchool(text) {
  const line = String(text || '').match(/(?:大学|学院)\s*(?:统招|全日制|非全日制|自考)?\s*(?:博士研究生|硕士研究生|博士|硕士|本科|大专|专科)?\s*([\u4e00-\u9fffA-Za-z]{2,20})/);
  if (!line) return '';
  const major = line[1];
  if (/^(博士|硕士|本科|大专|专科|学士|研究生|统招|全日制|教育|工作|项目)/.test(major)) return '';
  return major;
}


function maskId(value) {
  const text = String(value || '').replace(/\s+/g, '');
  if (!text) return '';
  if (text.length < 8) return '已填写';
  return `${text.slice(0, 3)}****${text.slice(-4)}`;
}

function emptySources() {
  const sources = {};
  FIELD_KEYS.forEach((key) => { sources[key] = ''; });
  return sources;
}

function normalizeSources(profile, sources) {
  const safe = sanitizeProfile(profile);
  const out = emptySources();
  const incoming = sources && typeof sources === 'object' ? sources : null;
  FIELD_KEYS.forEach((key) => {
    if (incoming && (incoming[key] === 'user' || incoming[key] === 'pdf')) out[key] = incoming[key];
    else if (!incoming && hasValue(safe[key])) out[key] = 'user';
  });
  return { profile: safe, sources: out };
}

function mergePdfProfile(savedProfile, savedSources, extracted) {
  const saved = sanitizeProfile(savedProfile);
  const found = sanitizeProfile(extracted);
  const prev = savedSources && typeof savedSources === 'object' ? savedSources : {};
  const sources = {};
  FIELD_KEYS.forEach((key) => {
    const origin = prev[key] === 'user' || prev[key] === 'pdf' ? prev[key] : '';
    if (hasValue(found[key])) {
      saved[key] = found[key];
      sources[key] = 'pdf';
      return;
    }
    if (origin === 'user') {
      sources[key] = 'user';
      return;
    }
    saved[key] = '';
    sources[key] = '';
  });
  return { profile: saved, sources };
}

const ID_EXTRACT_LABELS = ['身份证号码', '身份证号', '证件号码', '身份证', '证件号'];

function extractLabeledId(text) {
  const lines = String(text || '').split(/\n/);
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    for (let n = 0; n < ID_EXTRACT_LABELS.length; n += 1) {
      const label = ID_EXTRACT_LABELS[n];
      let from = 0;
      while (from < line.length) {
        const at = line.indexOf(label, from);
        if (at < 0) break;
        const before = line.slice(Math.max(0, at - 20), at);
        if (/紧急联系人|推荐人|家长|父亲|母亲|父母|监护人/.test(before)) {
          from = at + label.length;
          continue;
        }
        const windowText = line.slice(at + label.length, at + label.length + 40);
        const cleaned = windowText.replace(/[\s-]/g, '');
        const hit = cleaned.match(/[0-9]{17}[0-9Xx]|[0-9]{15}/);
        if (hit) return hit[0].toUpperCase();
        from = at + label.length;
      }
    }
  }
  return '';
}

function extractProfileFromText(raw) {
  const profile = emptyProfile();
  const compact = normalizeResumeText(raw);
  const work = workSection(compact);
  const edu = educationSection(compact);
  const phone = compact.match(/1[3-9]\d{9}/);
  if (phone) profile.phone = phone[0];
  const email = compact.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
  if (email) profile.email = email[0];
  const gender = compact.match(/(?:性别|个人信息)[:：\s]*([男女])/);
  if (gender) profile.gender = gender[1];
  const named = compact.match(/姓名[:：\s]*([\u4e00-\u9fff·]{2,8})/);
  if (named) profile.name = named[1];
  else {
    const first = compact.split(/\n/).map((line) => line.trim()).find(Boolean) || '';
    if (/^[\u4e00-\u9fff·]{2,4}$/.test(first)) profile.name = first;
    else {
      const lead = first.match(/^([\u4e00-\u9fff·]{2,4})\s+\S/);
      if (lead) profile.name = lead[1];
    }
  }
  ['中共预备党员', '中共党员', '共青团员', '民主党派', '群众'].some((item) => {
    if (compact.includes(item)) {
      profile.politics = item;
      return true;
    }
    return false;
  });
  const gpa = compact.match(/绩点[:：\s]*([0-9]+(?:\.[0-9]+)?(?:\s*[/／]\s*[0-9]+(?:\.[0-9]+)?)?)/);
  if (gpa) profile.gpa = gpa[1].replace(/\s+/g, ' ').trim();
  profile.degree = degreeIn(edu) || highestDegree(compact);
  profile.school = firstSchool(edu) || firstSchool(compact);
  profile.major = labeledMajor(edu) || majorBesideSchool(edu) || labeledMajor(compact);
  const company = firstCompany(work) || firstCompany(compact);
  if (company) profile.company = company;
  const title = compact.match(/(?:职位|岗位|职务)(?!描述)[:：\s]+([\u4e00-\u9fffA-Za-z0-9+.#]{2,24})/);
  if (title) profile.title = title[1];
  else profile.title = titleBesideCompany(work || compact, company);
  const eduRange = firstRange(edu);
  const workRange = firstRange(work);
  if (eduRange) profile.eduRange = eduRange;
  if (workRange) profile.workRange = workRange;
  if (!work && !edu) {
    const ranges = allMonthRanges(compact);
    if (ranges[0]) profile.eduRange = ranges[0];
    if (ranges[1]) profile.workRange = ranges[1];
  }
  const intent = compact.match(/求职意向\s*[:：]\s*(.+?)(?=\s*(?:个人信息|工作经历|教育经历|学历[:：]|个人优势|工作经验|$))/);
  if (intent) profile.intent = intent[1].replace(/\s+/g, ' ').trim();
  const years = compact.match(/(?:工作经验|工作年限|从业年限)\s*[:：]?\s*(\d{1,2})\s*年/);
  if (years) profile.years = `${years[1]}年`;
  const birth = compact.match(/(?:出生日期|出生年月|生日)\s*[:：]?\s*(\d{4}\s*[.\-/年]\s*\d{1,2}(?:\s*[.\-/月]\s*\d{1,2})?)/);
  if (birth) profile.birthday = birth[1].replace(/\s+/g, '');
  else {
    const brief = compact.match(/[男女]\s*[|｜/]\s*(\d{4})(?!\d)/);
    if (brief) profile.birthday = brief[1];
  }
  if (/就职状态\s*[:：]?\s*离职|目前离职|已离职/.test(compact)) profile.jobStatus = '离职';
  else if (/就职状态\s*[:：]?\s*在职|目前在职/.test(compact)) profile.jobStatus = '在职';
  if (/英语/.test(compact)) profile.language = '英语';
  else if (/日语/.test(compact)) profile.language = '日语';
  if (profile.language === '英语') {
    if (/精通英语|英语精通/.test(compact)) profile.langLevel = '精通';
    else if (/优秀的英语|英语优秀|流利|CET-?\s*6|英语六级|大学英语六级/.test(compact)) profile.langLevel = '熟练';
    else if (/CET-?\s*4|英语四级|英语良好/.test(compact)) profile.langLevel = '良好';
  }
  const dutyAt = compact.search(/职责描述\s*[:：]/);
  if (dutyAt >= 0) {
    let duty = compact.slice(dutyAt).replace(/^职责描述\s*[:：]\s*/, '');
    const dutyEnd = duty.search(/技术概括|项目成就|开发环境|教育经历|专业技能/);
    if (dutyEnd > 20) duty = duty.slice(0, dutyEnd);
    profile.duties = duty.replace(/\s+/g, ' ').replace(/\s*([、，。；：）])/g, '$1').replace(/([、，。；：])\s+/g, '$1').replace(/（\s*/g, '（').trim();
  }
  profile.city = cityFromCompany(profile.company);
  if (profile.title) profile.role = profile.title;
  if (profile.intent) profile.expectRole = profile.intent;
  const tradeHint = `${profile.title || ''} ${profile.intent || ''} ${profile.role || ''}`;
  if (!profile.industry && /iOS|Android|前端|后端|全栈|算法|开发|软件|工程师|程序员|测试|运维/.test(tradeHint)) {
    profile.industry = '互联网';
  }
  if (!profile.expectIndustry && profile.industry) profile.expectIndustry = profile.industry;
  if (!profile.expectCity && profile.city) profile.expectCity = profile.city;
  profile.idNo = extractLabeledId(compact);
  return sanitizeProfile(profile);
}

module.exports = {
  PDF_MAX_BYTES,
  PDF_MAX_PAGES,
  MIN_TEXT_CHARS,
  SECTIONS,
  ALL_FIELDS,
  FIELD_KEYS,
  LOCAL_KEYS,
  HINT_KEYS,
  RECRUIT_HOST_SUFFIXES,
  ID_LABELS,
  labelOf,
  emptyProfile,
  emptySources,
  hasValue,
  filledKeys,
  sanitizeProfile,
  normalizeSources,
  mergePdfProfile,
  limitMessage,
  matchRule,
  unmatchedLabels,
  isOtherPerson,
  isRecruitHost,
  classifyPage,
  optionMatch,
  ignoredField,
  userFillsId,
  normText,
  moneyYuan,
  salaryYuan,
  salaryBand,
  arrivalDays,
  scoreYearOption,
  scoreSalaryOption,
  scoreArrivalOption,
  scoreApproxOption,
  parsePoint,
  rangePoint,
  formatDate,
  formatMonth,
  joinMonthRange,
  DEFAULT_BIRTHDAY: '2004-01-01',
  planRuleFills,
  resultRows,
  maskPhone,
  maskId,
  meaningfulText,
  extractProfileFromText,
};
