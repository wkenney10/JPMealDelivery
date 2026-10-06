/**
 * Records the English text each Spanish string was translated from.
 * Run after updating src/i18n/messages/es.ts:  npm run i18n:sync
 * The i18n test then flags any English change made without a Spanish update.
 */
import fs from "node:fs";
import path from "node:path";
import { flatten } from "../src/i18n/flatten";
import { en } from "../src/i18n/messages/en";

const file = path.join(process.cwd(), "src/i18n/messages/es.source.json");
fs.writeFileSync(file, JSON.stringify(flatten(en), null, 1) + "\n");
console.log(`Saved ${Object.keys(flatten(en)).length} English source strings to ${path.relative(process.cwd(), file)}`);
