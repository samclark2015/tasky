#!/usr/bin/env node
/**
 * Prints a tree view of the Tasky project.
 * Run from anywhere; resolves the project root automatically.
 * No external dependencies — uses only Node.js built-ins.
 */

import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

// Resolve project root: this script lives at .agents/skills/project-map/scripts/
const __filename = fileURLToPath(import.meta.url);
const SCRIPT_DIR = path.dirname(__filename);
const ROOT = path.resolve(SCRIPT_DIR, '../../../..');

const IGNORE = new Set([
  'node_modules',
  'target',
  'dist',
  '.git',
  'gen',
  '.pnpm-store',
  '.vite',
]);

const IGNORE_PATTERNS = [
  /\.lock$/,
  /\.DS_Store$/,
];

function shouldIgnore(name) {
  if (IGNORE.has(name)) return true;
  return IGNORE_PATTERNS.some(p => p.test(name));
}

function printTree(dir, prefix = '') {
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }

  // Directories first, then files, both sorted alphabetically
  const dirs = entries
    .filter(e => e.isDirectory() && !shouldIgnore(e.name))
    .sort((a, b) => a.name.localeCompare(b.name));
  const files = entries
    .filter(e => !e.isDirectory() && !shouldIgnore(e.name))
    .sort((a, b) => a.name.localeCompare(b.name));
  const sorted = [...dirs, ...files];

  sorted.forEach((entry, i) => {
    const isLast = i === sorted.length - 1;
    const connector = isLast ? '└── ' : '├── ';
    const childPrefix = prefix + (isLast ? '    ' : '│   ');

    const suffix = entry.isDirectory() ? '/' : '';
    console.log(`${prefix}${connector}${entry.name}${suffix}`);

    if (entry.isDirectory()) {
      printTree(path.join(dir, entry.name), childPrefix);
    }
  });
}

console.log(path.basename(ROOT) + '/');
printTree(ROOT);
