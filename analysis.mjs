export const LIMIT = 4096, MAX_URLS = 8;
const linkPattern = /https?:\/\/[^\s<>"`]+|(?<![\p{L}\p{N}@._\/-])(?:[a-z\d](?:[a-z\d-]*[a-z\d])?\.)+[a-z]{2,}(?:[\/?#][^\s<>"`]*)?/giu;
const rules = {
  urgency: /\b(urgent|act now|immediately|suspend(?:ed)?|final notice|expires soon)\b|បន្ទាន់|ភ្លាមៗ|ផ្អាក|ត្រូវបានបិទ/iu,
  credentials: /\b(?:send|share|enter|provide|verify|confirm|give|reply with|update)(?:[\w\s'-]{0,35})\b(?:otp|pin|password|verification code|one[- ]time (?:code|password)|account|(?:photo of your )?(?:bank|credit|debit) card)\b|(?:សូម)?(?:ផ្ញើ|បញ្ចូល|ផ្ទៀងផ្ទាត់)\s*(?:លេខកូដ|ពាក្យសម្ងាត់|គណនី|រូបកាតធនាគារ)/iu,
  reward: /\b(?:claim your prize|guaranteed returns|advance fee)\b|ទាមទាររង្វាន់|ប្រាក់ចំណេញធានា/iu,
  advance_payment: /\b(?:upfront fee|refundable deposit|processing fee|activation fee|pay (?:a |the )?(?:fee|deposit) (?:first|to (?:unlock|claim|start|withdraw)))\b|(?:បង់|ផ្ទេរ)ប្រាក់(?:ជាមុន|មុន)|ប្រាក់កក់មុន/iu,
  job_task: /\b(?:task commission|recharge to withdraw|paid to like videos|earn .* per day (?:from home|on telegram)|unlock your commission)\b|(?:ចុចឡាយ|ចុចចូលចិត្ត).{0,28}(?:កម្រៃ|ប្រាក់)|បំពេញភារកិច្ច.{0,28}កម្រៃ/iu,
  investment: /\b(?:risk[- ]free investment|double your (?:money|crypto)|guaranteed (?:daily )?(?:profit|investment return)|withdrawal fee)\b|វិនិយោគ.{0,35}(?:គ្មានហានិភ័យ|ធានាចំណេញ)|ធានាចំណេញ.{0,35}វិនិយោគ|ចំណេញរាល់ថ្ងៃ/iu,
  delivery: /(?:\b(?:parcel|package|delivery|shipment)\b.{0,70}\b(?:redelivery fee|customs fee|confirm your address|pay to release)\b)|(?:កញ្ចប់|ឥវ៉ាន់).{0,40}(?:បង់ថ្លៃ|បញ្ជាក់អាសយដ្ឋាន)/iu,
  impersonation: /\b(?:telegram support|bank support|bank security team|police officer)\b.{0,90}\b(?:verify|transfer|code|password|pay)\b|(?:ធនាគារ|ប៉ូលិស|តេឡេក្រាម).{0,40}(?:ផ្ញើលេខកូដ|ផ្ទេរប្រាក់|បង់ប្រាក់)/iu,
  remote_access: /\b(?:install|download|open)\b.{0,45}\b(?:anydesk|teamviewer|remote access|apk)\b|ដំឡើង.{0,30}(?:anydesk|teamviewer|apk)/iu,
  prize_payment: /\b(?:won|winner|prize)\b.{0,75}\b(?:pay|fee|deposit|claim|send)\b|ឈ្នះរង្វាន់.{0,45}(?:ផ្ទេរប្រាក់|បង់ប្រាក់|ទាមទារ)/iu,
};
const linkCues = ['short_link', 'disguised_link', 'unusual_host'];
export const cueIds = Object.freeze([...Object.keys(rules), ...linkCues]);

const baselineOverrides = {
  credentials:/\b(?:send|share|enter|provide|verify|confirm|give|reply with|update)(?:[\w\s']{0,35})\b(?:otp|pin|password|verification code|account)\b|(?:សូម)?(?:ផ្ញើ|បញ្ចូល|ផ្ទៀងផ្ទាត់)\s*(?:លេខកូដ|ពាក្យសម្ងាត់|គណនី)/iu,
  reward:/\b(?:won|winner|claim your prize|guaranteed returns|advance fee)\b|ឈ្នះរង្វាន់|ប្រាក់ចំណេញធានា/iu,
  investment:/\b(?:risk[- ]free investment|double your (?:money|crypto)|guaranteed (?:daily )?(?:profit|investment return)|withdrawal fee)\b|វិនិយោគ.{0,35}(?:គ្មានហានិភ័យ|ធានាចំណេញ)|ចំណេញរាល់ថ្ងៃ/iu,
};

// Parse URL syntax only. Do not decode path/query, strip www, or visit the host.
export function canonicalUrl(raw) {
  if (typeof raw !== 'string' || !raw || raw.length > 2048 || /[\s\\\u0000-\u001f\u007f]/u.test(raw)) return null;
  try {
    const url = new URL(raw);
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || !url.hostname) return null;
    url.hash = '';
    return url.href;
  } catch { return null; }
}

function unwrap(raw) {
  const noPunctuation = raw.replace(/[.,!?;:។៕’”]+$/u, '');
  return noPunctuation.replace(/[)\]}]+$/u, (closing) => {
    let cursor = noPunctuation.slice(0, -closing.length);
    for (const c of closing) {
      const open = { ')': '(', ']': '[', '}': '{' }[c];
      if (cursor.split(open).length > cursor.split(c).length) cursor += c;
    }
    return cursor.slice(noPunctuation.length - closing.length);
  });
}

export function extractUrls(text, entities = []) {
  const urls = new Set();
  let uncheckable = false;
  const add = (raw, exact) => {
    if (typeof raw !== 'string') { uncheckable = true; return; }
    const candidate = exact ? raw : unwrap(raw);
    // A naked domain has no defined scheme, so compare both with the exact-match index.
    const forms = /^[a-z][a-z0-9+.-]*:/i.test(candidate) ? [candidate] : ['https://' + candidate, 'http://' + candidate];
    for (const form of forms) {
      const normalized = canonicalUrl(form);
      if (!normalized) uncheckable = true;
      else if (urls.size < MAX_URLS || urls.has(normalized)) urls.add(normalized);
      else uncheckable = true;
    }
  };
  for (const entity of entities) {
    if (entity.type === 'text_link') add(entity.url, true);
    if (entity.type === 'url') add(text.slice(entity.offset, entity.offset + entity.length), true);
  }
  const untagged = [...entities].filter(e => e.type === 'url' && Number.isInteger(e.offset) && Number.isInteger(e.length))
    .sort((a,b) => b.offset-a.offset).reduce((str,e) => str.slice(0,e.offset)+' '.repeat(Math.min(e.length,LIMIT))+str.slice(e.offset+e.length),text);
  for (const match of untagged.matchAll(linkPattern)) add(match[0], false);
  return { urls: [...urls], uncheckable };
}

export function ruleCues(text, urls, entities = [], {baseline=false}={}) {
  const normalized = text.normalize('NFKC').replace(/[\u200B\u200E\u200F\uFEFF]/g, '').replace(/\s+/gu, ' ');
  const clauses = normalized.split(/(?<=[.!?។៕])\s+|[។៕]/u);
  const actionable = clauses.filter(part => !/^\s*(?:never|do not|don['’]t|avoid)\b|^\s*កុំ/iu.test(part));
  const cues = Object.entries(rules).filter(([id,pattern]) => baseline
    ? id !== 'prize_payment' && (baselineOverrides[id] ?? pattern).test(normalized)
    : actionable.some(part => pattern.test(part)
      || pattern.test(part.replace(/(?<=\p{Script=Khmer})\s+(?=\p{Script=Khmer})/gu,'')))).map(([id]) => id);
  const hosts = urls.map(value => new URL(value).hostname);
  if (hosts.some(host => ['bit.ly','t.co','tinyurl.com','cutt.ly','is.gd','shorturl.at','rb.gy','rebrand.ly','tiny.cc'].includes(host))) cues.push('short_link');
  if (hosts.some(host => /^\d+(?:\.\d+){3}$|^\[/.test(host) || host.split('.').some(part => part.startsWith('xn--')))) cues.push('unusual_host');
  if (entities.some(entity => entity.type === 'text_link')) cues.push('disguised_link');
  if (!baseline && cues.includes('urgency') && cues.length === 1 && urls.length === 0) return [];
  return cues;
}

export function decide({ cues = [], feed = 'skipped', reputation = 'skipped', model = 'skipped', uncheckable = false } = {}) {
  const incomplete = uncheckable || [feed, reputation, model].includes('unavailable');
  const outcome = feed === 'match' || reputation === 'match' ? 'known'
    : incomplete ? 'incomplete'
    : cues.length > 0 ? 'suspicious'
    : 'no_known';
  return { outcome, cues: [...new Set(cues)], feed, reputation, model, incomplete };
}

export function inputLanguage(text, preference = 'en') {
  return /[\u1780-\u17ff]/u.test(text) || preference === 'km' ? 'km' : 'en';
}

export const copy = {
  en: {
    prize_payment:'Prize offer asks you to act or pay',
    advance_payment:'Upfront payment or deposit request', job_task:'Paid task or commission scheme',
    investment:'Unusually high or guaranteed returns', delivery:'Delivery message asks for payment or address confirmation',
    impersonation:'Purported authority requests an action', remote_access:'Request to install remote-access software or an app package',
    unusual_host:'Link uses an IP address or an encoded domain name',
    unconfigured: 'Not configured',
    known: ['Known threat', 'A reputation source flagged the link as potentially unsafe. Avoid opening it. Verify through the official app or website.'],
    suspicious: ['Suspicious', 'Pause before acting. Open the official app or website separately to verify the request.'],
    no_known: ['No known threat found', 'This result cannot guarantee safety. Verify unexpected requests independently.'],
    incomplete: ['Unable to complete all checks', 'Some checks are unavailable. Avoid opening the link or sharing codes until you verify independently.'],
    urgency: 'Pressure or urgency', credentials: 'Request for login details or a code', reward: 'Unexpected prize or return', short_link: 'Short link hides its destination', disguised_link: 'A link is hidden behind text',
    clear: 'Checked, no match', match: 'Match found', unavailable: 'Unavailable', skipped: 'Not applicable', checked: 'Checked',
    feed: 'PhishTank', reputation: 'Google Safe Browsing', model: 'Gemini',
  },
  km: {
    prize_payment:'រង្វាន់ដែលស្នើឱ្យធ្វើសកម្មភាព ឬបង់ប្រាក់',
    advance_payment:'ស្នើឱ្យបង់ប្រាក់ ឬប្រាក់កក់ជាមុន', job_task:'ការងារតាមអនឡាញដែលសន្យាថានឹងផ្តល់កម្រៃ',
    investment:'សន្យាប្រាក់ចំណេញខ្ពស់ ឬធានាប្រាក់ចំណេញ', delivery:'សារដឹកជញ្ជូនស្នើឱ្យបង់ថ្លៃ ឬបញ្ជាក់អាសយដ្ឋាន',
    impersonation:'អ្នកអះអាងថាជាអាជ្ញាធរ ឬស្ថាប័ន ស្នើឱ្យធ្វើសកម្មភាព', remote_access:'ស្នើឱ្យដំឡើងកម្មវិធីគ្រប់គ្រងពីចម្ងាយ ឬឯកសារ APK',
    unusual_host:'តំណប្រើអាសយដ្ឋាន IP ឬឈ្មោះដែនដែលបានអ៊ិនកូដ',
    unconfigured: 'មិនបានកំណត់រចនាសម្ព័ន្ធ',
    known: ['រកឃើញតំណដែលអាចមានគ្រោះថ្នាក់', 'ប្រភពពិនិត្យតំណបានសម្គាល់តំណនេះ។ សូមកុំបើកតំណ។ ផ្ទៀងផ្ទាត់តាមកម្មវិធី ឬគេហទំព័រផ្លូវការ។'],
    suspicious: ['គួរឱ្យសង្ស័យ', 'សូមផ្អាកសិន។ បើកកម្មវិធី ឬគេហទំព័រផ្លូវការដោយផ្ទាល់ ដើម្បីផ្ទៀងផ្ទាត់។'],
    no_known: ['មិនរកឃើញការគំរាមកំហែងដែលស្គាល់', 'លទ្ធផលនេះមិនធានាសុវត្ថិភាពទេ។ សូមផ្ទៀងផ្ទាត់សំណើដែលមិនបានរំពឹងទុក។'],
    incomplete: ['មិនអាចបញ្ចប់ការត្រួតពិនិត្យទាំងអស់', 'ការត្រួតពិនិត្យមួយចំនួនមិនអាចដំណើរការបាន។ សូមកុំបើកតំណ ឬចែករំលែកលេខកូដ មុនពេលផ្ទៀងផ្ទាត់។'],
    urgency: 'សម្ពាធ ឬភាពបន្ទាន់', credentials: 'ស្នើសុំព័ត៌មានចូលគណនី ឬលេខកូដ', reward: 'រង្វាន់ ឬប្រាក់ចំណេញដែលមិនបានរំពឹងទុក', short_link: 'តំណខ្លីលាក់គោលដៅ', disguised_link: 'តំណលាក់នៅក្រោមអត្ថបទ',
    clear: 'បានពិនិត្យ មិនឃើញតំណត្រូវគ្នា', match: 'រកឃើញតំណត្រូវគ្នា', unavailable: 'មិនអាចពិនិត្យបាន', skipped: 'មិនពាក់ព័ន្ធ', checked: 'បានពិនិត្យ',
    feed: 'PhishTank', reputation: 'Google Safe Browsing', model: 'Gemini',
  },
};
