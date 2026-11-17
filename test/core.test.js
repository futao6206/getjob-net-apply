'use strict';

const assert = require('assert');
const core = require('../src/core');

function field(partial) {
  return Object.assign({
    id: 'f1',
    label: '',
    required: false,
    empty: true,
    options: [],
    skip: '',
    silent: false,
    control: 'text',
  }, partial);
}

const profile = core.sanitizeProfile({
  name: '陈可',
  gender: '女',
  phone: '13812346210',
  email: 'chenke@example.com',
  school: '浙江大学',
  degree: '本科',
  major: '计算机科学与技术',
  company: '杭州澄光科技',
  title: '前端开发',
});

assert.strictEqual(
  core.limitMessage('read', true, false),
  '这份 PDF 超过 5 页，没有读取。换一份，或改成手动填写。'
);
assert.strictEqual(
  core.limitMessage('read', false, true),
  '这份 PDF 超过 5 MB，没有读取。换一份，或改成手动填写。'
);
assert.strictEqual(
  core.limitMessage('read', true, true),
  '这份 PDF 超过 5 页，也超过 5 MB，没有读取。换一份，或改成手动填写。'
);
assert.strictEqual(
  core.limitMessage('upload', true, false),
  '这份 PDF 超过 5 页，不能上传识别。换一份，或改成手动填写。'
);
assert.strictEqual(
  core.limitMessage('upload', false, true),
  '这份 PDF 超过 5 MB，不能上传识别。换一份，或改成手动填写。'
);
assert.strictEqual(
  core.limitMessage('upload', true, true),
  '这份 PDF 超过 5 页，也超过 5 MB，不能上传识别。换一份，或改成手动填写。'
);

assert.strictEqual(core.filledKeys(core.emptyProfile()).length, 0);
assert.strictEqual(core.sanitizeProfile({ gender: '未知' }).gender, '');

const parsed = core.extractProfileFromText(`
陈可
性别：女
手机 13812346210
邮箱 chenke@example.com
浙江大学
专业：计算机科学与技术
本科
2018.09 – 2022.06
杭州澄光科技有限公司
职位：前端开发
2022.07 – 至今
绩点：3.6 / 4.0
身份证 330102199901011234
政治面貌：共青团员
`);
assert.strictEqual(parsed.name, '陈可');
assert.strictEqual(core.extractProfileFromText('付桃  Phone: 13800001111  Email: a@b.cn').name, '付桃');
assert.strictEqual(parsed.gender, '女');
assert.strictEqual(parsed.phone, '13812346210');
assert.strictEqual(parsed.email, 'chenke@example.com');
assert.strictEqual(parsed.school, '浙江大学');
assert.strictEqual(parsed.degree, '本科');
assert.strictEqual(parsed.major, '计算机科学与技术');
assert.strictEqual(parsed.company, '杭州澄光科技有限公司');
assert.strictEqual(parsed.title, '前端开发');
assert.strictEqual(parsed.idNo, '330102199901011234');
assert.strictEqual(parsed.phone, '13812346210');
assert.strictEqual(parsed.politics, '共青团员');
assert.ok(parsed.gpa.includes('3.6'));
assert.ok(parsed.eduRange.includes('2018'));
assert.ok(parsed.workRange.includes('至今'));

const spaced = core.extractProfileFromText(`
付桃  Phone:   13800138000   Email:   ft@example.com
求职意向： iOS   高级开发工程师  个人信息：男 |1994  工作经验： 9   年  学历： 统招 本科
工作经历  ●   广 州热度网络 科技有限公司（ 202 3 / 3 -202 5 / 8 ）   iOS   高级开发工程师  ●   广东搜款网科技有限公司（ 2022/7-2022/11 ）   iOS   高级开发工程师  ●   慧科教育科技集团有限公司（ 2016/11-2022/6 ）   iOS   高级开发工程师
专业技能  ●   精通 Swift
教育经历  湖南科技学院   本科   制药工程   2012-2016
`);
assert.strictEqual(spaced.name, '付桃');
assert.strictEqual(spaced.gender, '男');
assert.strictEqual(spaced.phone, '13800138000');
assert.strictEqual(spaced.email, 'ft@example.com');
assert.strictEqual(spaced.school, '湖南科技学院');
assert.strictEqual(spaced.degree, '本科');
assert.strictEqual(spaced.major, '制药工程');
assert.strictEqual(spaced.company, '广州热度网络科技有限公司');
assert.strictEqual(spaced.title, 'iOS 高级开发工程师');
assert.strictEqual(spaced.eduRange, '2012-09 – 2016-06');
assert.ok(spaced.workRange.includes('2023') && spaced.workRange.includes('2025'));
assert.ok(!/2012-09/.test(spaced.workRange));
assert.strictEqual(spaced.years, '9年');
assert.strictEqual(spaced.birthday, '1994-01-01');
assert.strictEqual(spaced.intent, 'iOS 高级开发工程师');
assert.strictEqual(spaced.city, '广州');
assert.strictEqual(spaced.role, 'iOS 高级开发工程师');
assert.strictEqual(spaced.expectRole, 'iOS 高级开发工程师');
assert.strictEqual(spaced.industry, '互联网');
assert.strictEqual(spaced.expectIndustry, '互联网');
assert.strictEqual(spaced.expectCity, '广州');
assert.strictEqual(parsed.city, '杭州');

const bottomEdu = core.extractProfileFromText(`
林知远  iOS 高级开发工程师  手机 138 0000 1234  邮箱 linzhiyuan@example.com
求职意向：iOS 高级开发工程师  个人信息：男 | 1995  工作经验：9 年
工作经历  深圳星桥网络科技有限公司（2023/3 – 2025/8）   iOS 高级开发工程师  杭州青澜科技有限公司（2022/7 – 2022/11）   iOS 高级开发工程师
专业技能  精通 Swift
教育经历  北京大学   本科   软件工程   2012 – 2016  3 / 3
`);
assert.strictEqual(bottomEdu.name, '林知远');
assert.strictEqual(bottomEdu.school, '北京大学');
assert.strictEqual(bottomEdu.degree, '本科');
assert.strictEqual(bottomEdu.major, '软件工程');
assert.strictEqual(bottomEdu.title, 'iOS 高级开发工程师');
assert.strictEqual(bottomEdu.role, 'iOS 高级开发工程师');
assert.strictEqual(bottomEdu.eduRange, '2012-09 – 2016-06');
assert.ok(bottomEdu.workRange.includes('2023') && bottomEdu.workRange.includes('2025'));
assert.strictEqual(bottomEdu.company, '深圳星桥网络科技有限公司');

const richer = core.extractProfileFromText(`
付桃
求职意向：iOS 高级开发工程师
就职状态：离职
英语水平：CET6
优秀的英语听说读写能力
工作经历
广州热度网络科技有限公司 iOS 高级开发工程师
项目经历
职责描述：1、主导 IM 模块重构。2、搭建自动化发布。
技术概括：Ruby 脚本
`);
assert.strictEqual(richer.jobStatus, '离职');
assert.strictEqual(richer.language, '英语');
assert.strictEqual(richer.langLevel, '熟练');
assert.ok(richer.duties.includes('IM'));
assert.ok(!richer.duties.includes('Ruby'));

const yearHit = core.scoreYearOption('9年', ['1-3年', '3-5年', '5-10年', '10年以上']);
assert.strictEqual(yearHit.optionText, '5-10年');
assert.strictEqual(yearHit.status, 'check');
assert.strictEqual(core.scoreYearOption('9年', ['8年', '9年', '10年']).optionText, '9年');
assert.strictEqual(core.scoreYearOption('9年', ['8年', '9年', '10年及以上']).optionText, '9年');
assert.strictEqual(core.scoreYearOption('9年', ['8年', '9年', '10年及以上']).status, 'filled');
assert.strictEqual(core.scoreYearOption('9年', ['8年', '9年', '10年']).status, 'filled');

const datedProfile = core.sanitizeProfile({
  name: '付桃',
  eduRange: '2012 – 2016',
  workRange: '2023/3 – 2025/8',
  birthday: '1994',
  years: '9年',
  intent: 'iOS 高级开发工程师',
  jobStatus: '离职',
  language: '英语',
  langLevel: '熟练',
  duties: '主导 IM 模块重构',
});
const dated = core.planRuleFills([
  field({ id: 'a1', label: '搜索职位关键词' }),
  field({ id: 'a2', label: '工作年限', control: 'select', options: [], lazy: true }),
  field({ id: 'a3', label: '出生日期', control: 'date' }),
  field({ id: 'a4', label: '学校名称' }),
  field({ id: 'a5', label: '开始时间', control: 'date' }),
  field({ id: 'a6', label: '结束时间', control: 'date' }),
  field({ id: 'a7', label: '公司名称' }),
  field({ id: 'a8', label: '开始时间', control: 'date' }),
  field({ id: 'a9', label: '结束时间', control: 'date' }),
  field({ id: 'a10', label: '工作职责' }),
  field({ id: 'a11', label: '语言类型', control: 'select', options: [], lazy: true }),
  field({ id: 'a12', label: '掌握程度', control: 'select', options: ['一般', '熟练', '精通'], lazy: true }),
  field({ id: 'a13', label: '听说', control: 'select', options: [], lazy: true }),
  field({ id: 'a14', label: '读写', control: 'select', options: [], lazy: true }),
  field({ id: 'a15', label: '到岗时间', control: 'select', options: [], lazy: true }),
  field({ id: 'a16', label: '姓名' }),
  field({ id: 'a17', label: '姓名' }),
], datedProfile);
const datedWrite = (id) => dated.writes.find((item) => item.id === id);
assert.strictEqual(datedWrite('a1').value, 'iOS 高级开发工程师');
assert.strictEqual(datedWrite('a2').kind, 'years');
assert.strictEqual(datedWrite('a3').year, 1994);
assert.strictEqual(datedWrite('a3').month, 1);
assert.strictEqual(datedWrite('a3').day, 1);
assert.strictEqual(datedWrite('a3').control, 'date');
assert.strictEqual(datedWrite('a5').year, 2012);
assert.strictEqual(datedWrite('a5').month, 9);
assert.strictEqual(datedWrite('a5').day, 1);
assert.strictEqual(datedWrite('a6').year, 2016);
assert.strictEqual(datedWrite('a6').month, 6);
assert.strictEqual(datedWrite('a6').day, 1);
assert.strictEqual(datedWrite('a8').year, 2023);
assert.strictEqual(datedWrite('a8').month, 3);
assert.strictEqual(datedWrite('a8').control, 'date');
assert.strictEqual(datedWrite('a9').year, 2025);
assert.strictEqual(datedWrite('a9').month, 8);
assert.strictEqual(datedWrite('a10').value, '主导 IM 模块重构');
assert.strictEqual(datedWrite('a11').optionText, '英语');
assert.strictEqual(datedWrite('a12').optionText, '熟练');
assert.strictEqual(datedWrite('a13').optionText, '熟练');
assert.strictEqual(datedWrite('a14').optionText, '熟练');
assert.strictEqual(datedWrite('a15').status, 'check');
assert.ok(datedWrite('a15').accept.includes('随时到岗'));
assert.strictEqual(dated.writes.filter((item) => item.label === '姓名').length, 0);

const guessed = core.planRuleFills([
  field({ id: 'g1', label: '现从事行业', control: 'select', options: [], lazy: true }),
  field({ id: 'g2', label: '现工作城市', control: 'select', options: [], lazy: true }),
  field({ id: 'g3', label: '现从事职业', control: 'select', options: [], lazy: true }),
], { industry: '互联网', city: '广州', role: 'iOS 高级开发工程师' });
const guessedWrite = (id) => guessed.writes.find((item) => item.id === id);
assert.strictEqual(guessedWrite('g1').status, 'check');
assert.strictEqual(guessedWrite('g1').kind, 'approx');
assert.ok(guessedWrite('g1').searches.includes('互联网'));
assert.strictEqual(guessedWrite('g2').status, 'check');
assert.ok(guessedWrite('g2').searches.includes('广东'));
assert.strictEqual(guessedWrite('g3').status, 'check');
assert.ok(guessedWrite('g3').searches.includes('iOS'));

const fields = [
  field({ id: 'f1', label: '姓名' }),
  field({ id: 'f2', label: '手机号' }),
  field({ id: 'f3', label: '邮箱' }),
  field({ id: 'f4', label: '学校' }),
  field({ id: 'f5', label: '学历', control: 'select', options: ['高中', '大专', '本科', '硕士'] }),
  field({ id: 'f6', label: '紧急联系人电话' }),
  field({ id: 'f7', label: '期望职位' }),
  field({ id: 'f8', label: '姓名', empty: false }),
  field({ id: 'f9', label: '出生日期', skip: 'date', control: 'skip' }),
  field({ id: 'f10', label: '第一学历院校' }),
  field({ id: 'f11', label: '政治面貌', control: 'select', options: ['群众', '中共党员'] }),
];
const ruled = core.planRuleFills(fields, profile);
const ruledIds = ruled.writes.map((item) => item.id);
assert.ok(ruledIds.includes('f1'));
assert.ok(ruledIds.includes('f2'));
assert.ok(!ruledIds.includes('f6'), '紧急联系人电话不靠规则填');
assert.ok(!ruledIds.includes('f7'), '期望职位不填职位');
assert.ok(!ruledIds.includes('f8'), '已有内容不覆盖');
assert.ok(!ruledIds.includes('f9'));
assert.strictEqual(ruled.writes.find((item) => item.id === 'f5').status, 'filled');

const fuzzy = core.planRuleFills([
  field({ id: 'f20', label: '学历', control: 'select', options: ['大学本科', '硕士研究生'] }),
], profile);
assert.strictEqual(fuzzy.writes[0].status, 'check');
assert.strictEqual(fuzzy.writes[0].optionText, '大学本科');

const emptyPolitics = core.sanitizeProfile(Object.assign({}, profile, { politics: '' }));
const rows = core.resultRows([
  field({ id: 'f11', label: '政治面貌', control: 'select', options: ['群众'] }),
], emptyPolitics, []);
assert.strictEqual(rows[0].text, '资料里空着');
assert.strictEqual(rows[0].fix, 'politics');

assert.strictEqual(core.classifyPage('https://example.com/login', [
  field({ id: 'f1', label: '密码', skip: 'password', silent: true, control: 'skip' }),
  field({ id: 'f2', label: '手机号' }),
], false).ok, false);
assert.strictEqual(core.classifyPage('https://example.com/apply', fields, false).ok, true);
assert.strictEqual(core.classifyPage('https://beisen.zhiye.com/campus/jobs', [
  field({ id: 'f1', label: '搜索' }),
], false).ok, false);
assert.strictEqual(core.classifyPage('https://evil.example/captcha', [], true).challenge, true);
assert.strictEqual(core.isRecruitHost('https://vivo.zhiye.com/social/detail'), true);
assert.strictEqual(core.isRecruitHost('https://www.zhipin.com/web/geek/job'), false);
assert.strictEqual(core.maskPhone('13812346210'), '138****6210');

assert.strictEqual(core.matchRule('最高毕业院校'), null);
assert.ok(core.unmatchedLabels([
  field({ id: 'f50', label: '最高毕业院校' }),
  field({ id: 'f51', label: '姓名' }),
  field({ id: 'f52', label: '出生日期', skip: 'date', control: 'skip' }),
  field({ id: 'f53', label: '姓名', empty: false }),
]).indexOf('最高毕业院校') >= 0);

const lazyDegree = core.planRuleFills([
  field({ id: 'f60', label: '学历', control: 'select', options: [], lazy: true }),
  field({ id: 'f61', label: '学位', control: 'select', options: [], lazy: true }),
  field({ id: 'f62', label: '姓名' }),
  field({ id: 'f63', label: '开始时间', skip: 'date', control: 'skip' }),
], profile);
assert.strictEqual(core.matchRule('学位'), 'degree');
assert.ok(!core.unmatchedLabels([
  field({ id: 'f61b', label: '学位', control: 'select', options: [], lazy: true }),
]).includes('学位'));
assert.strictEqual(lazyDegree.writes.find((item) => item.id === 'f60').optionText, '本科');
assert.strictEqual(lazyDegree.writes.find((item) => item.id === 'f60').status, 'filled');
const rank = lazyDegree.writes.find((item) => item.id === 'f61');
assert.strictEqual(rank.optionText, '学士');
assert.strictEqual(rank.status, 'check');
assert.ok(rank.accept.includes('学士'));
assert.strictEqual(lazyDegree.writes.find((item) => item.id === 'f62').value, '陈可');
assert.ok(!lazyDegree.writes.find((item) => item.id === 'f63'));
assert.strictEqual(core.planRuleFills([
  field({ id: 'f64', label: '学历', control: 'select', options: [], lazy: true }),
  field({ id: 'f65', label: '学位', control: 'select', options: [], lazy: true }),
], core.sanitizeProfile(Object.assign({}, profile, { degree: '' }))).writes.length, 0);

const rangedYears = core.planRuleFills([
  field({ id: 'y1', label: '工作年限', control: 'select', options: ['3-5年', '5-10年', '10年以上'] }),
], datedProfile);
assert.strictEqual(rangedYears.writes[0].optionText, '5-10年');
assert.strictEqual(rangedYears.writes[0].status, 'check');

assert.strictEqual(core.matchRule('推荐码'), null);
assert.strictEqual(core.matchRule('内推码'), null);
assert.ok(!core.FIELD_KEYS.includes('referral'));
assert.ok(!('referral' in core.sanitizeProfile({ referral: '6688' })));
assert.ok(core.FIELD_KEYS.includes('idNo'));
assert.strictEqual(core.sanitizeProfile({ idNo: '330102199901011234' }).idNo, '330102199901011234');
assert.strictEqual(core.sanitizeProfile({ idNo: 'E12345678' }).idNo, 'E12345678');
assert.strictEqual(core.matchRule('证件号'), 'idNo');
assert.strictEqual(core.matchRule('身份证号码'), 'idNo');
assert.strictEqual(core.matchRule('证件类型'), null);
assert.strictEqual(core.userFillsId('证件号'), true);
assert.strictEqual(core.userFillsId('证件类型'), false);
const idProfile = core.sanitizeProfile(Object.assign({}, profile, { idNo: '330102199901011234' }));
const idPage = [
  field({ id: 'id1', label: '证件号' }),
  field({ id: 'id2', label: '身份证号码' }),
  field({ id: 'idType', label: '证件类型', control: 'select', options: ['居民身份证', '护照'] }),
  field({ id: 'idEmergency', label: '紧急联系人证件号' }),
  field({ id: 'idFilled', label: '证件号', empty: false }),
  field({ id: 'idDup1', label: '证件号码' }),
  field({ id: 'idDup2', label: '证件号码' }),
];
const idWrites = core.planRuleFills(idPage, idProfile);
assert.strictEqual(idWrites.writes.find((item) => item.id === 'id1').value, '330102199901011234');
assert.strictEqual(idWrites.writes.find((item) => item.id === 'id2').value, '330102199901011234');
assert.ok(!idWrites.writes.find((item) => item.id === 'idType'));
assert.ok(!idWrites.writes.find((item) => item.id === 'idEmergency'));
assert.ok(!idWrites.writes.find((item) => item.id === 'idFilled'));
assert.ok(!idWrites.writes.find((item) => item.id === 'idDup1'));
assert.ok(!idWrites.writes.find((item) => item.id === 'idDup2'));
const idRows = core.resultRows(idPage, idProfile, idWrites.writes);
assert.strictEqual(idRows.find((item) => item.id === 'id1').text, '330****1234');
assert.ok(!idRows.find((item) => item.id === 'id1').text.includes('330102199901011234'));
const emptyIdRows = core.resultRows([
  field({ id: 'id1', label: '证件号' }),
  field({ id: 'idType', label: '证件类型' }),
], core.emptyProfile(), []);
assert.strictEqual(emptyIdRows.find((item) => item.id === 'id1').text, '资料里空着');
assert.ok(!JSON.stringify(emptyIdRows).includes('请自己填写'));
assert.strictEqual(core.maskId('E1234'), '已填写');
assert.strictEqual(core.maskId('33010219990101123X'), '330****123X');
const emergencyPdf = core.extractProfileFromText('姓名：陈可\n紧急联系人身份证 110101199001011234\n证件号：33010219990101123X');
assert.strictEqual(emergencyPdf.name, '陈可');
assert.strictEqual(emergencyPdf.idNo, '33010219990101123X');
assert.strictEqual(core.extractProfileFromText('证件类型：居民身份证\n手机 13800001111').idNo, '');
const keptPhone = core.sanitizeProfile({ phone: '13812346210', name: '旧名', email: 'a@b.cn' });
const merged = core.mergePdfProfile(keptPhone, { phone: 'user', name: 'pdf', email: 'pdf' }, core.extractProfileFromText('陈可\n浙江大学'));
assert.strictEqual(merged.profile.phone, '13812346210');
assert.strictEqual(merged.sources.phone, 'user');
assert.strictEqual(merged.profile.name, '陈可');
assert.strictEqual(merged.sources.name, 'pdf');
assert.strictEqual(merged.profile.school, '浙江大学');
assert.strictEqual(merged.sources.school, 'pdf');
assert.strictEqual(merged.profile.email, '');
assert.strictEqual(merged.sources.email, '');
const legacy = core.normalizeSources({ phone: '13812346210' }, null);
assert.strictEqual(legacy.sources.phone, 'user');
assert.strictEqual(legacy.profile.phone, '13812346210');
const hiddenReferral = core.resultRows([
  field({ id: 'r1', label: '推荐码' }),
  field({ id: 'r2', label: '内推码' }),
], profile, []);
assert.strictEqual(hiddenReferral.length, 0);

const salaryBands = ['2000以下', '15001～25000', '25001～30000', '30001～50000', '面议'];
assert.strictEqual(core.scoreSalaryOption('25000', salaryBands).optionText, '15001～25000');
assert.strictEqual(core.scoreSalaryOption('25000', salaryBands).status, 'check');
assert.strictEqual(core.scoreSalaryOption('26000', ['15001～25000', '25001～30000']).optionText, '25001～30000');
assert.strictEqual(core.scoreSalaryOption('25000', ['面议']), null);
const salaryPlan = core.planRuleFills([
  field({ id: 's1', label: '期望月薪（税前）', control: 'select', options: ['15001～25000', '25001～30000'], lazy: true }),
], { expectSalary: '25000' });
assert.strictEqual(salaryPlan.writes[0].optionText, '15001～25000');
assert.strictEqual(salaryPlan.writes[0].kind, 'salary');
assert.strictEqual(salaryPlan.writes[0].status, 'check');
assert.strictEqual(salaryPlan.writes[0].search, '');

const arrivalOptions = ['一周内', '一个月内', '三个月内', '三个月以上', '面议'];
assert.strictEqual(core.scoreArrivalOption('随时到岗', arrivalOptions).optionText, '一周内');
assert.strictEqual(core.scoreArrivalOption('随时到岗', arrivalOptions).status, 'check');
assert.strictEqual(core.scoreArrivalOption('三个月内', arrivalOptions).optionText, '三个月内');
assert.strictEqual(core.scoreArrivalOption('随时到岗', ['一个月内', '三个月内']).optionText, '一个月内');
assert.strictEqual(core.scoreArrivalOption('三个月内', ['一周内', '一个月内']), null);
const arrivalPlan = core.planRuleFills([
  field({ id: 't1', label: '到岗时间', control: 'select', options: arrivalOptions, lazy: true }),
], { arrival: '随时到岗' });
assert.strictEqual(arrivalPlan.writes[0].optionText, '一周内');
assert.strictEqual(arrivalPlan.writes[0].status, 'check');
assert.strictEqual(arrivalPlan.writes[0].kind, 'arrival');

const rolePlan = core.scoreApproxOption('iOS 高级开发工程师', ['Java开发', 'iOS开发', '前端开发'], ['iOS', '开发']);
assert.strictEqual(rolePlan.optionText, 'iOS开发');
assert.strictEqual(rolePlan.status, 'check');
const industryPlan = core.scoreApproxOption('互联网', ['计算机硬件及网络', '互联网/电子商务', '广告'], ['互联网', '计算机', '软件', 'IT']);
assert.strictEqual(industryPlan.optionText, '互联网/电子商务');

console.log('core.test.js ok');
