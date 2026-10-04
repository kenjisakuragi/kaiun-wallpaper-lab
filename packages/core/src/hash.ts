// sha256。Node（batch）と Workers（edge）の両方で同期的に動くよう @noble/hashes を使う。

import { sha256 } from '@noble/hashes/sha2.js';
import { bytesToHex, utf8ToBytes } from '@noble/hashes/utils.js';

export function sha256Bytes(input: string): Uint8Array {
  return sha256(utf8ToBytes(input));
}

export function sha256Hex(input: string): string {
  return bytesToHex(sha256Bytes(input));
}

/** LINE userId・Threads ユーザー名のハッシュ（docs/05 users.user_hash、threads_replies.author_hash） */
export function hashIdentifier(id: string, salt: string): string {
  if (salt === '') throw new Error('hash salt is empty');
  return sha256Hex(id + salt);
}
