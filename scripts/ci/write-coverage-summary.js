#!/usr/bin/env node

const fs = require('fs');

const [title, summaryPath, ...args] = process.argv.slice(2);

if (!title || !summaryPath) {
  console.error('Usage: write-coverage-summary.js <title> <coverage-summary.json> [--min-lines=<percent>]');
  process.exit(2);
}

const thresholdArg = args.find((arg) => arg.startsWith('--min-lines='));
const minLinesRaw = thresholdArg
  ? thresholdArg.slice('--min-lines='.length)
  : (process.env.COVERAGE_MIN_LINES || '70');
const minLines = Number(minLinesRaw);
if (!Number.isFinite(minLines) || minLines < 0 || minLines > 100) {
  console.error(`Invalid line coverage threshold: ${minLinesRaw}`);
  process.exit(2);
}

if (!fs.existsSync(summaryPath)) {
  console.error(`Coverage summary missing at ${summaryPath}`);
  process.exit(1);
}

const summary = JSON.parse(fs.readFileSync(summaryPath, 'utf8'));
const total = summary.total;
const metrics = ['lines', 'statements', 'functions', 'branches'];

if (!total || metrics.some((metric) => !total[metric] || typeof total[metric].pct !== 'number')) {
  console.error(`Coverage summary at ${summaryPath} is missing total coverage metrics`);
  process.exit(1);
}

const rows = metrics.map((metric) => {
  const label = metric.charAt(0).toUpperCase() + metric.slice(1);
  const data = total[metric];
  return `| ${label} | ${data.pct}% | ${data.covered} / ${data.total} |`;
});

const lines = [
  `### ${title}`,
  '',
  '| Metric | Percent | Covered / Total |',
  '| --- | ---: | ---: |',
  ...rows,
  '',
  `Minimum line coverage: ${minLines}%`,
  '',
];

if (process.env.GITHUB_STEP_SUMMARY) {
  fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${lines.join('\n')}\n`);
} else {
  console.log(lines.join('\n'));
}

if (total.lines.pct < minLines) {
  console.error(`${title} line coverage ${total.lines.pct}% is below required ${minLines}%`);
  process.exit(1);
}
