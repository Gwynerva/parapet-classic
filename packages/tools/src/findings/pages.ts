/**
 * The findings' pages: every finding (the Lab's, and the ones only Node can measure), where their
 * pages live, and the manifest of what was measured and drawn for each (`manifest.json`).
 */
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import type { Facts, Finding } from '@parapet/lab/finding.ts';
import { FINDINGS } from '@parapet/lab/findings/index.ts';
import { readJson, REPO_ROOT } from '../files.ts';
import { whatsInTheJar } from './jar.ts';
import { whatTricksCost } from './tricks.ts';

export const FINDINGS_DIR = join(REPO_ROOT, 'reference', 'findings');

/** The Lab's findings and the ones only Node can measure (the jar's files), by page. */
export const ALL_FINDINGS: readonly Finding[] = [
  ...FINDINGS,
  whatsInTheJar as Finding,
  whatTricksCost as Finding,
].sort((a, b) => a.slug.localeCompare(b.slug));
export const MANIFEST = join(FINDINGS_DIR, 'manifest.json');

export interface ClipEntry {
  width: number;
  height: number;
  frames: number;
  hash: string;
  gifBytes: number;
  mp4Bytes: number;
}

export interface PageEntry {
  title: string;
  claim: string;
  facts: Facts;
  charts: string[];
  pictures: string[];
  clips: Record<string, ClipEntry>;
}

export interface Manifest {
  ffmpeg: string;
  pages: Record<string, PageEntry>;
}

export function readManifest(): Manifest {
  return existsSync(MANIFEST) ? readJson<Manifest>(MANIFEST) : { ffmpeg: '', pages: {} };
}
