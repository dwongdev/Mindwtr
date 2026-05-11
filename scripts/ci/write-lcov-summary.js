#!/usr/bin/env node

const fs = require('fs');

const [title, lcovPath, ...args] = process.argv.slice(2);

if (!title || !lcovPath) {
  console.error('Usage: write-lcov-summary.js <title> <lcov.info> [--min-lines=<percent>] [--include-prefix=<prefix>]');
  process.exit(2);
}

const getArgValue = (name, fallback) => {
  const arg = args.find((candidate) => candidate.startsWith(`${name}=`));
  return arg ? arg.slice(name.length + 1) : fallback;
};

const minLinesRaw = getArgValue('--min-lines', process.env.COVERAGE_MIN_LINES || '70');
const includePrefix = getArgValue('--include-prefix', '');
const minLines = Number(minLinesRaw);

if (!Number.isFinite(minLines) || minLines < 0 || minLines > 100) {
  console.error(`Invalid line coverage threshold: ${minLinesRaw}`);
  process.exit(2);
}

if (!fs.existsSync(lcovPath)) {
  console.error(`LCOV report missing at ${lcovPath}`);
  process.exit(1);
}

const normalizePath = (value) => value.replaceAll('\\', '/');
const shouldIncludeFile = (filePath) => {
  if (!includePrefix) return true;
  return normalizePath(filePath).startsWith(normalizePath(includePrefix));
};

const records = fs.readFileSync(lcovPath, 'utf8').split('end_of_record');
let coveredLines = 0;
let totalLines = 0;
let includedFiles = 0;

for (const record of records) {
  const lines = record.split(/\r?\n/);
  const sourceLine = lines.find((line) => line.startsWith('SF:'));
  if (!sourceLine) continue;

  const sourcePath = sourceLine.slice('SF:'.length);
  if (!shouldIncludeFile(sourcePath)) continue;

  let fileLineTotal = 0;
  let fileLineCovered = 0;
  for (const line of lines) {
    if (!line.startsWith('DA:')) continue;
    const [, hitCountRaw] = line.slice('DA:'.length).split(',');
    fileLineTotal += 1;
    if (Number(hitCountRaw) > 0) {
      fileLineCovered += 1;
    }
  }

  if (fileLineTotal > 0) {
    includedFiles += 1;
    totalLines += fileLineTotal;
    coveredLines += fileLineCovered;
  }
}

if (totalLines === 0) {
  console.error(`LCOV report at ${lcovPath} did not include any matching lines`);
  process.exit(1);
}

const linePct = Number(((coveredLines / totalLines) * 100).toFixed(2));
const lines = [
  `### ${title}`,
  '',
  '| Metric | Percent | Covered / Total |',
  '| --- | ---: | ---: |',
  `| Lines | ${linePct}% | ${coveredLines} / ${totalLines} |`,
  `| Files | ${includedFiles} | ${includedFiles} |`,
  '',
  `Minimum line coverage: ${minLines}%`,
  '',
];

if (process.env.GITHUB_STEP_SUMMARY) {
  fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${lines.join('\n')}\n`);
} else {
  console.log(lines.join('\n'));
}

if (linePct < minLines) {
  console.error(`${title} line coverage ${linePct}% is below required ${minLines}%`);
  process.exit(1);
}
