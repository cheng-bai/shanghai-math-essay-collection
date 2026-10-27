'use strict';
const $ = selector => document.querySelector(selector);
const cats = ['立体几何','三角','解析几何','函数与导数','数列','平面向量','概率与统计','不等式与代数','综合与其他'];
let records = [], schoolSources = {}, category = '', page = 1, expanded = false;
const pageSize = 8;
const schoolFilters = [
  {value: '', label: '全部学校来源', matches: () => true},
  {value: 'four', label: '四校本部', matches: s => s.group === '四校本部'},
  {value: 'eight', label: '八大本部', matches: s => s.group === '八大本部'},
  {value: 'city', label: '市重点（含四校、八大）', matches: s => s.kind === 'school' && s.type === '市实验性示范性高中'},
  {value: 'othercity', label: '其他市重点', matches: s => s.group === '其他市重点'},
  {value: 'district', label: '区重点', matches: s => s.kind === 'school' && s.type.startsWith('区实验性示范性高中')},
  {value: 'branch', label: '分校', matches: s => s.isBranch},
  {value: 'policy', label: '享受市重点招生政策', matches: s => s.kind === 'school' && s.type === '享受市实验性示范性高中招生政策高中'},
  {value: 'general', label: '一般高中', matches: s => s.kind === 'school' && s.type === '一般高中'},
  {value: 'joint', label: '联考', matches: s => s.kind === 'joint'},
  {value: 'unknown', label: '学校匹配待核', matches: s => s.kind === 'unmatched'},
];
window.__mathErrors = [];

function renderMarkdown(text) {
  const math = [];
  const code = [];
  const protectedText = text.replace(/```[\s\S]*?```|`[^`\n]*`/g, raw => {
    const token = `CODEOPAQUE${code.length}END`;
    code.push(raw);
    return token;
  });
  const safe = protectedText.replace(/\$\$([\s\S]*?)\$\$|\\\[([\s\S]*?)\\\]|\\\(([\s\S]*?)\\\)|(?<!\\)\$([^$]+?)(?<!\\)\$/g, (raw, a, b, c, d) => {
    const index = math.length;
    math.push({tex: a ?? b ?? c ?? d, display: a !== undefined || b !== undefined, raw});
    return `<span data-math="${index}"></span>`;
  }).replace(/CODEOPAQUE(\d+)END/g, (_, index) => code[Number(index)]);
  const el = document.createElement('div');
  el.innerHTML = DOMPurify.sanitize(marked.parse(safe, {breaks: false}));
  el.querySelectorAll('[data-math]').forEach(node => {
    const item = math[Number(node.dataset.math)];
    try {
      katex.render(item.tex, node, {displayMode: item.display || /\\tag\s*\{/.test(item.tex), throwOnError: true, strict: 'ignore', trust: false,
        macros: {'\\Vec': '\\vec', '\\mathbfit': '\\boldsymbol{#1}'}});
    } catch(error) {
      node.className = 'math-source';
      node.textContent = item.raw;
      node.title = '源稿公式未能排版，保留原文：' + error.message;
      window.__mathErrors.push({tex: item.tex, message: error.message});
    }
  });
  el.querySelectorAll('a').forEach(link => { link.target = '_blank'; link.rel = 'noopener'; });
  return el;
}
function node(tag, cls, text) {
  const el = document.createElement(tag);
  if (cls) el.className = cls;
  if (text !== undefined) el.textContent = text;
  return el;
}
function examName(q) { return q.sourceCode === 'S005' ? '考试名称待核' : q.examType; }
function filtered(ignoreCategory = false) {
  const query = $('#search').value.trim().toLowerCase();
  const grade = $('#grade').value;
  const filter = schoolFilters.find(item => item.value === $('#schoolFilter').value);
  return records.filter(q => (ignoreCategory || !category || q.category === category) && (!grade || q.grade === grade) && filter.matches(schoolSources[q.sourceCode]) && (!query || [schoolSources[q.sourceCode].name,q.grade,q.topic,q.year,examName(q),q.prompt].join(' ').toLowerCase().includes(query)));
}
function nav() {
  const el = $('#categories'); el.replaceChildren();
  const available = filtered(true);
  for (const cat of ['', ...cats]) {
    if (cat && !records.some(q => q.category === cat)) continue;
    const count = available.filter(q => !cat || q.category === cat).length;
    const button = node('button', cat === category ? 'active' : '', cat || '全部大题');
    button.append(node('span', '', String(count)));
    button.onclick = () => { category = cat; page = 1; $('#download').href = cat ? '分册/' + encodeURIComponent(cat) + '.md' : '上海高中数学大题分类汇编.md'; $('#download').setAttribute('download',''); render(); nav(); };
    el.append(button);
  }
}
function questionCard(q) {
  const article = node('article','question'); article.id = 'q-' + q.id;
  const header = node('header');
  const top = node('div','qtop');
  const info = schoolSources[q.sourceCode];
  const title = node('h3'); title.append(node('span','qid',String(q.number).padStart(3,'0')), document.createTextNode(info.name));
  const source = node('span','original',q.sourceCode + ' · 原卷第' + q.questionNumber + '题');
  const exam = examName(q);
  top.append(title,source);header.append(top,node('div','source',[q.grade,q.year || '年份待核',exam,q.category].filter(Boolean).join(' / ')));
  const classification = info.kind === 'joint' ? '联考 · 不归入单校层级' : [info.group,info.type].filter(Boolean).join(' / ');
  header.append(node('div','school-classification',classification));
  const topic=node('div','topic');topic.append(node('strong','','考点'),document.createTextNode(q.topic));topic.title=q.topicBasis;
  const prompt = renderMarkdown(q.prompt); prompt.className='body prompt';
  const details = node('details','solutions');details.open=expanded;
  const summary=node('summary','','答案与解析');
  const solution=node('div','body');
  const answer=renderMarkdown(q.answer);answer.className='answer';
  const explanation=renderMarkdown(q.solution);explanation.className='explanation';
  solution.append(node('div','solution-title','答案'),answer,node('div','solution-title','解析 · 保留源稿'),explanation);
  details.append(summary,solution);article.append(header,topic,prompt,details);return article;
}
function render() {
  window.__mathErrors=[];
  const data=filtered(), pages=Math.max(1,Math.ceil(data.length/pageSize));page=Math.min(page,pages);
  $('#categoryTitle').textContent=category || '全部大题';$('#resultCount').textContent=data.length+' 道完整大题';
  const list=$('#questions');list.replaceChildren();
  for(const q of data.slice((page-1)*pageSize,page*pageSize)) list.append(questionCard(q));
  if(!data.length)list.append(node('p','empty','没有匹配的题目，可调整学校分组、知识板块、搜索词或年级。'));
  $('#pageCount').textContent=`${page} / ${pages}`;$('#prev').disabled=page<=1;$('#next').disabled=page>=pages;
  $('#errorCount').textContent=window.__mathErrors.length?`本页 ${window.__mathErrors.length} 处源公式排版疑点已保留原文`:'';
  $('#expand').textContent=expanded?'收起本页解析':'展开本页解析';
}
function refreshFilters(){page=1;render();nav()}
$('#search').addEventListener('input',refreshFilters);$('#grade').addEventListener('change',refreshFilters);$('#schoolFilter').addEventListener('change',refreshFilters);
$('#expand').onclick=()=>{expanded=!expanded;document.querySelectorAll('.solutions').forEach(x=>x.open=expanded);$('#expand').textContent=expanded?'收起本页解析':'展开本页解析';};
for(const [id,direction] of [['#prev',-1],['#next',1]]) $(id).onclick=()=>{page+=direction;render();$('.sectionhead').scrollIntoView({block:'start'});};
function readJSON(url){return fetch(url).then(r=>{if(!r.ok)throw Error('无法读取 '+url);return r.json()})}
Promise.all([readJSON('大题索引.json?v=school-groups-20261027'),readJSON('学校来源映射.json?v=school-groups-20261027')]).then(([data, schools])=>{
  schoolSources=schools;
  records=data;
  if(data.some(q=>!schoolSources[q.sourceCode]))throw Error('部分试卷缺少学校来源映射');
  $('#summary').textContent=`${data.length} 道完整大题 · ${new Set(data.map(x=>x.category)).size} 个知识板块 · ${new Set(data.map(x=>x.sourceCode)).size} 个来源文件`;
  for(const grade of [...new Set(data.map(q=>q.grade))].sort()){const o=node('option','',grade);o.value=grade;$('#grade').append(o)}
  for(const filter of schoolFilters){const count=data.filter(q=>filter.matches(schoolSources[q.sourceCode])).length;const o=node('option','',`${filter.label} · ${count}`);o.value=filter.value;$('#schoolFilter').append(o)}
  nav();render();window.__appReady=true;
}).catch(error=>{$('#questions').replaceChildren(node('p','empty','载入失败：'+error.message+'。请稍后刷新页面重试。'))});
