/**
 * Claimed names: identity without accounts. A name is claimed once with a random token that
 * the device keeps, and a recovery code shown once; the server stores only hashes. Later
 * submissions prove ownership with the token; a lost device recovers the name with the code,
 * which rotates both secrets.
 */
import { createHash, randomBytes } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { RECOVERY_CODE_LENGTH } from '@parapet/protocol';

export interface NameRecord {
  /** `nameKey(name)`: the uniqueness key. */
  key: string;
  /** The name as the player wrote it. */
  name: string;
  tokenHash: string;
  recoveryHash: string;
  /** ISO 8601. */
  createdAt: string;
  lastSeenAt: string;
}

export interface NameStore {
  get(key: string): NameRecord | undefined;
  /** Insert a record; false when the key is taken. */
  add(record: NameRecord): boolean;
  update(record: NameRecord): void;
  count(): number;
}

export function hashSecret(secret: string): string {
  return createHash('sha256').update(secret, 'utf8').digest('hex');
}

/** 32 random bytes, base64url (43 characters). */
export function createToken(): string {
  return randomBytes(32).toString('base64url');
}

/** Unambiguous alphabet (no 0/O, 1/I/L) so the code can be read back from paper. */
const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

export function createRecoveryCode(): string {
  const bytes = randomBytes(RECOVERY_CODE_LENGTH);
  let out = '';
  for (let i = 0; i < RECOVERY_CODE_LENGTH; i++) {
    out += CODE_ALPHABET[bytes[i]! % CODE_ALPHABET.length];
  }
  return out;
}

/** Codes are compared case-insensitively, with the easily confused letters mapped. */
export function normaliseRecoveryCode(code: string): string {
  return code
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .replace(/O/g, '0')
    .replace(/[IL]/g, '1');
}

export function hashRecoveryCode(code: string): string {
  return hashSecret(normaliseRecoveryCode(code));
}

export class MemoryNameStore implements NameStore {
  protected readonly records = new Map<string, NameRecord>();

  get(key: string): NameRecord | undefined {
    const r = this.records.get(key);
    return r ? { ...r } : undefined;
  }

  add(record: NameRecord): boolean {
    if (this.records.has(record.key)) return false;
    this.records.set(record.key, { ...record });
    return true;
  }

  update(record: NameRecord): void {
    this.records.set(record.key, { ...record });
  }

  count(): number {
    return this.records.size;
  }
}

interface NameFile {
  names: NameRecord[];
}

export class JsonNameStore extends MemoryNameStore {
  readonly file: string;

  constructor(file: string) {
    super();
    this.file = file;
    if (existsSync(file)) {
      const parsed = JSON.parse(readFileSync(file, 'utf8')) as Partial<NameFile> | null;
      if (!parsed || !Array.isArray(parsed.names)) {
        throw new Error(`${file} is not a name store (expected { "names": [...] })`);
      }
      for (const r of parsed.names) this.records.set(r.key, r);
    }
  }

  override add(record: NameRecord): boolean {
    const added = super.add(record);
    if (added) this.save();
    return added;
  }

  override update(record: NameRecord): void {
    super.update(record);
    this.save();
  }

  private save(): void {
    mkdirSync(dirname(this.file), { recursive: true });
    const tmp = `${this.file}.${process.pid}.tmp`;
    const data: NameFile = { names: [...this.records.values()] };
    writeFileSync(tmp, JSON.stringify(data, null, 2) + '\n', 'utf8');
    renameSync(tmp, this.file);
  }
}

export type ClaimResult =
  | { ok: true; record: NameRecord; token: string; recoveryCode: string }
  | { ok: false; code: 'name-taken' };

/** Claim `name` (already validated) under `key`. */
export function claimName(store: NameStore, name: string, key: string, now: Date): ClaimResult {
  const token = createToken();
  const recoveryCode = createRecoveryCode();
  const record: NameRecord = {
    key,
    name,
    tokenHash: hashSecret(token),
    recoveryHash: hashRecoveryCode(recoveryCode),
    createdAt: now.toISOString(),
    lastSeenAt: now.toISOString(),
  };
  if (!store.add(record)) return { ok: false, code: 'name-taken' };
  return { ok: true, record, token, recoveryCode };
}

/** The record when `token` proves ownership of the name under `key`, else null. */
export function authenticate(store: NameStore, key: string, token: string): NameRecord | null {
  const record = store.get(key);
  if (!record || record.tokenHash !== hashSecret(token)) return null;
  return record;
}

export type RecoverResult =
  | { ok: true; record: NameRecord; token: string; recoveryCode: string }
  | { ok: false; code: 'unauthorized' };

/** Rotate the secrets of the name under `key` when `code` matches. */
export function recoverName(store: NameStore, key: string, code: string, now: Date): RecoverResult {
  const record = store.get(key);
  if (!record || record.recoveryHash !== hashRecoveryCode(code))
    return { ok: false, code: 'unauthorized' };
  const token = createToken();
  const recoveryCode = createRecoveryCode();
  const updated: NameRecord = {
    ...record,
    tokenHash: hashSecret(token),
    recoveryHash: hashRecoveryCode(recoveryCode),
    lastSeenAt: now.toISOString(),
  };
  store.update(updated);
  return { ok: true, record: updated, token, recoveryCode };
}
