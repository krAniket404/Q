/// <reference types="node" />
// Writes the synthetic training cohort to data/synthetic/. Run: npx ts-node --transpile-only tools/ml/export_synthetic.ts
import * as fs from 'fs';
import { generateCohort, toCsv } from '../../src/ml/synthetic';

const rows = generateCohort(12, 180, 7);
fs.mkdirSync('data/synthetic', { recursive: true });
fs.writeFileSync('data/synthetic/cohort_180d.csv', toCsv(rows));
const users = new Set(rows.map(r => r.userId)).size;
console.log(`wrote ${rows.length} transactions for ${users} synthetic users`);
