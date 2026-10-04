// docs/05 の列挙値。SQL では CHECK 制約にしていないので、書き込み前にここで検証する。

import { z } from 'zod';

export const TABLES = [
  'images',
  'posts',
  'threads_replies',
  'link_clicks',
  'users',
  'deliveries',
  'inbound_messages',
  'post_metrics',
  'purchases',
] as const;

export const ImageKind = z.enum(['birthday', 'common', 'kaiunbi', 'affirmation']);
export const ImageStatus = z.enum(['generated', 'approved', 'rejected']);
export const PostTheme = z.enum(['birthday', 'kaiunbi', 'affirmation']);
export const PublishStatus = z.enum(['planned', 'container_created', 'published', 'failed', 'skipped']);
export const ThreadsReplyStatus = z.enum(['pending', 'sent', 'rejected', 'capped', 'skipped', 'failed']);
export const Platform = z.enum(['threads', 'instagram']);
export const UaClass = z.enum(['ios', 'android', 'desktop', 'other']);
export const Variant = z.enum(['A', 'B']);
export const DeliveryType = z.enum(['birthday_reply', 'common_reply', 'daily_word_reply', 'weekly_push', 'pack_offer']);

export type ImageKind = z.infer<typeof ImageKind>;
export type ImageStatus = z.infer<typeof ImageStatus>;
export type PostTheme = z.infer<typeof PostTheme>;
export type PublishStatus = z.infer<typeof PublishStatus>;
export type ThreadsReplyStatus = z.infer<typeof ThreadsReplyStatus>;
export type Platform = z.infer<typeof Platform>;
export type UaClass = z.infer<typeof UaClass>;
export type Variant = z.infer<typeof Variant>;
export type DeliveryType = z.infer<typeof DeliveryType>;

/** 投稿の最大リトライ回数（CLAUDE.md ルール8） */
export const MAX_RETRY = 2;
