import { copy } from './analysis.mjs';
import { fixtures, demoAnalyze } from './fixtures.mjs';

const byId = id => document.getElementById(id);
const message = byId('message'), result = byId('result');
let chosen, current;

const scenarioMeta = {
  khmer: ['Urgent account', 'Khmer verification request', '!'],
  match: ['Known phishing link', 'Exact open-data match', '⌁'],
  benign: ['Ordinary message', 'No obvious warning cues', '✓'],
  unavailable: ['Service unavailable', 'Shows honest uncertainty', '…'],
  mixed: ['Mixed-language scam', 'Khmer + English signals', 'Aa'],
};

function el(tag, text, className = '') {
  const node = document.createElement(tag);
  if (className) node.className = className;
  node.textContent = text;
  return node;
}

function render() {
  if (!current) return;
  const lang = document.querySelector('input[name=lang]:checked').value;
  const t = copy[lang];
  const [title, advice] = t[current.outcome];
  const evidence = lang === 'km' ? 'លទ្ធផលពីទិន្នន័យសាកល្បង' : 'Synthetic result';
  const items = el('ul','','cue-list');
  for (const cue of current.cues) items.append(el('li',t[cue]));
  result.lang = lang;
  result.dataset.outcome = current.outcome;
  const header = el('div','','result-header');
  const icon = el('div',current.outcome === 'no_known' ? '✓' : current.outcome === 'incomplete' ? '…' : '!','outcome-icon');
  const heading = el('div');
  heading.append(el('p',evidence,'eyebrow'),el('h3',title));
  header.append(icon,heading);
  result.replaceChildren(header,el('p',advice,'result-advice'));
  if (items.children.length) result.append(el('h4',lang === 'km' ? 'អ្វីដែល Kapear បានកត់សម្គាល់' : 'What Kapear noticed'),items);
  if (current.feed === 'match') result.append(el('p',lang === 'km' ? 'បញ្ជីសាកល្បងមានតំណនេះ។' : 'The fictional indicator list contains this exact example URL.','feed-note'));
}

for (const fixture of fixtures) {
  if (fixture.id !== 'precedence') {
    const meta = scenarioMeta[fixture.id] || [fixture.name,'Demo scenario','•'];
    const button = el('button','','scenario-button');
    button.type='button';
    button.dataset.fixture = fixture.id;
    const icon = el('span',meta[2],'scenario-icon');
    const label = el('span');
    label.append(el('strong',meta[0]),el('small',meta[1]));
    button.append(icon,label);
    button.addEventListener('click',() => {
      for (const item of document.querySelectorAll('.scenario-button')) item.classList.remove('active');
      button.classList.add('active');
      chosen=fixture;
      message.value=fixture.text;
      byId('char-count').textContent = `${message.value.length} / 4096`;
      if (fixture.id === 'khmer' || fixture.id === 'mixed') document.querySelector('input[value=km]').checked = true;
      else document.querySelector('input[value=en]').checked = true;
      current = demoAnalyze(fixture.text,fixture.failure);
      render();
    });
    byId('examples').append(button);
  }
  const check = demoAnalyze(fixture.text,fixture.failure);
  byId('test-list').append(el('li',fixture.name + ' · ' + copy.en[check.outcome][0] + (check.outcome===fixture.expected ? '' : ' · unexpected')));
}
message.addEventListener('input',() => {
  chosen=undefined;
  byId('char-count').textContent = `${message.value.length} / 4096`;
  for (const item of document.querySelectorAll('.scenario-button')) item.classList.remove('active');
});
byId('checker').addEventListener('submit',event => {
  event.preventDefault();
  if (!message.value.trim()) return;
  const progress = byId('analysis-progress');
  const button = event.currentTarget.querySelector('button[type=submit]');
  progress.classList.add('visible');
  button.disabled = true;
  result.style.opacity = '.45';
  window.setTimeout(() => {
    current = demoAnalyze(message.value,chosen?.failure);
    render();
    progress.classList.remove('visible');
    button.disabled = false;
    result.style.opacity = '1';
  },720);
});
for (const radio of document.querySelectorAll('input[name=lang]')) radio.addEventListener('change',render);

const menuToggle = document.querySelector('.menu-toggle');
const mainMenu = byId('main-menu');
menuToggle.addEventListener('click',() => {
  const open = mainMenu.classList.toggle('open');
  menuToggle.setAttribute('aria-expanded',String(open));
});
for (const link of mainMenu.querySelectorAll('a')) link.addEventListener('click',() => {
  mainMenu.classList.remove('open');
  menuToggle.setAttribute('aria-expanded','false');
});
try {
  const response = await fetch('./snapshot.json',{cache:'no-store'});
  if (!response.ok) throw new Error();
  const data = await response.json();
  if (!data) throw new Error();
  byId('row-count').textContent = Number(data.uniqueRows).toLocaleString('en') + ' unique';
  byId('snapshot-date').textContent = new Intl.DateTimeFormat('en-GB',{dateStyle:'medium',timeZone:'Asia/Phnom_Penh'}).format(new Date(data.importedAt));
} catch {
  byId('row-count').textContent = 'Unavailable';
  byId('snapshot-date').textContent = 'Unavailable';
}
try {
  const response = await fetch('./pilot.json');
  if (!response.ok) throw new Error();
  const counts = await response.json();
  const date = new Intl.DateTimeFormat('en-GB',{dateStyle:'medium',timeZone:'Asia/Phnom_Penh'}).format(new Date(counts.asOf));
  byId('pilot-totals').textContent = `${counts.received} reports in the pilot queue, ${counts.reviewed} reviewed as scam or benign as of ${date}. Fictional demo reports are excluded.`;
} catch {}
