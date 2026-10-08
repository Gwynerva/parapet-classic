import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { decodeIndex, type GameIndex } from '../src/decodeIndex.ts';
import { ZipArchive } from '../src/zip.ts';

export const JAR_PATH = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '..',
  '..',
  '..',
  'packages',
  'content',
  'playman',
  'original',
  'Playman_Extreme_Running_240x320.jar',
);

let archive: ZipArchive | undefined;
export function jar(): ZipArchive {
  archive ??= ZipArchive.fromFile(JAR_PATH);
  return archive;
}

let gameIndex: GameIndex | undefined;
export function index(): GameIndex {
  gameIndex ??= decodeIndex(jar().read('i'));
  return gameIndex;
}

let blobFiles: Uint8Array[] | undefined;
export function bFiles(): Uint8Array[] {
  blobFiles ??= [jar().read('b0'), jar().read('b1'), jar().read('b2')];
  return blobFiles;
}
