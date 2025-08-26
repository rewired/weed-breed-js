/**
 * Append-only JSONL writer for daily simulation lines.
 * @module lib/reporting/dailyWriter
 */

import fs from 'node:fs';
import path from 'node:path';

export class DailyWriter {
  /**
   * @param {string} filePath absolute or relative path to target JSONL file
   */
  constructor(filePath) {
    this.filePath = filePath;
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    // ensure file exists
    if (!fs.existsSync(filePath)) fs.writeFileSync(filePath, '');
  }

  /**
   * Write one JSON object as a line.
   * @param {object} entry
   */
  write(entry) {
    fs.appendFileSync(this.filePath, `${JSON.stringify(entry)}\n`);
  }
}

/**
 * Convenience helper to append a single daily row to a report file.
 * @param {string} reportPath
 * @param {object} obj
 */
export function writeDailyRow(reportPath, obj) {
  const writer = new DailyWriter(reportPath);
  writer.write(obj);
}
