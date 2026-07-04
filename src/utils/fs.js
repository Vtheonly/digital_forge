/**
 * fs.js — Filesystem helpers
 *
 * Small, well-tested utilities for the operations the pipeline needs:
 *   - rmrf: recursive remove (like rm -rf)
 *   - ensureDir: mkdir -p
 *   - listFiles: list files matching a predicate
 *   - fileExists: stat-based existence check
 *   - fileSize: safe size lookup
 *   - cleanDir: remove contents but keep dir
 */

const fs = require('fs');
const path = require('path');

function rmrf(target) {
  if (!target) return;
  try {
    fs.rmSync(target, { recursive: true, force: true });
  } catch (e) {
    // Ignore — best effort
  }
}

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function fileExists(p) {
  try {
    return fs.statSync(p).isFile();
  } catch {
    return false;
  }
}

function dirExists(p) {
  try {
    return fs.statSync(p).isDirectory();
  } catch {
    return false;
  }
}

function fileSize(p) {
  try {
    return fs.statSync(p).size;
  } catch {
    return 0;
  }
}

function listFiles(dir, predicate) {
  if (!dirExists(dir)) return [];
  const out = [];
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name);
    if (!fs.statSync(full).isFile()) continue;
    if (predicate && !predicate(name)) continue;
    out.push(full);
  }
  return out;
}

function cleanDir(dir) {
  if (!dirExists(dir)) return ensureDir(dir);
  for (const name of fs.readdirSync(dir)) {
    rmrf(path.join(dir, name));
  }
  return dir;
}

/** Count files in dir matching predicate (default: all files). */
function countFiles(dir, predicate) {
  return listFiles(dir, predicate).length;
}

/** Human-readable byte size. */
function humanSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

module.exports = {
  rmrf, ensureDir, fileExists, dirExists, fileSize,
  listFiles, cleanDir, countFiles, humanSize
};
