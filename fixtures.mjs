import { extractUrls, ruleCues, decide, LIMIT } from './analysis.mjs';

const demoIndicator = 'https://account-check.example/notice';
export const fixtures = [
  { id:'khmer', name:'Khmer · account message', text:'បន្ទាន់! គណនីរបស់អ្នកនឹងត្រូវបានផ្អាក។ សូមផ្ញើលេខកូដផ្ទៀងផ្ទាត់។', expected:'suspicious' },
  { id:'match', name:'Example list match', text:'Please review https://account-check.example/notice', expected:'known' },
  { id:'benign', name:'Ordinary message', text:'I left the class notes on your desk. See you after lunch.', expected:'no_known' },
  { id:'unavailable', name:'Incomplete check', text:'Are these today’s class notes? https://notes.example/agenda', expected:'incomplete', failure:true },
  { id:'mixed', name:'Mixed language', text:'បន្ទាន់! Please send your verification code.', expected:'suspicious' },
  { id:'precedence', name:'Match during service outage', text:'Check https://account-check.example/notice', expected:'known', failure:true },
];

export function demoAnalyze(input, failure = false) {
  const sample = input.slice(0,LIMIT);
  const { urls, uncheckable } = extractUrls(sample);
  const cues = ruleCues(sample, urls);
  return decide({ cues, feed:urls.includes(demoIndicator) ? 'match' : urls.length ? 'clear' : 'skipped',
    reputation:failure ? 'unavailable' : 'skipped', uncheckable:uncheckable || input.length > sample.length });
}
