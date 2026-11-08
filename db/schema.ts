import { sqliteTable, text, integer, index, uniqueIndex } from 'drizzle-orm/sqlite-core';

// Player accounts are independent of the game's runtime and ChatGPT identity.
export const accounts = sqliteTable('player_accounts', {
  id: text('id').primaryKey(), publicId: text('public_id').notNull(),
  username: text('username').notNull(), usernameKey: text('username_key').notNull(),
  email: text('email').notNull(), // Informational only, not an authentication factor.
  passwordHash: text('password_hash').notNull(), avatar: text('avatar').notNull().default('soldier'),
  avatarKey: text('avatar_key'), createdAt: integer('created_at').notNull(), disabledAt: integer('disabled_at'),
}, t => [uniqueIndex('player_accounts_public_id_uq').on(t.publicId), uniqueIndex('player_accounts_username_uq').on(t.usernameKey)]);

export const sessions = sqliteTable('player_sessions', {
  idHash: text('id_hash').primaryKey(),
  accountId: text('account_id').notNull().references(() => accounts.id, { onDelete: 'cascade' }),
  createdAt: integer('created_at').notNull(), expiresAt: integer('expires_at').notNull(),
}, t => [index('player_sessions_account_idx').on(t.accountId), index('player_sessions_expiry_idx').on(t.expiresAt)]);

export const recoveryCodes = sqliteTable('player_recovery_codes', {
  codeHash: text('code_hash').primaryKey(),
  accountId: text('account_id').notNull().references(() => accounts.id, { onDelete: 'cascade' }),
  createdAt: integer('created_at').notNull(),
}, t => [index('player_recovery_account_idx').on(t.accountId)]);

export const saves = sqliteTable('player_saves', {
  accountId: text('account_id').primaryKey().references(() => accounts.id, { onDelete: 'cascade' }),
  revision: integer('revision').notNull().default(0), dataVersion: integer('data_version').notNull().default(1),
  data: text('data').notNull().default('{}'), updatedAt: integer('updated_at').notNull(),
});

export const results = sqliteTable('player_results', {
  id: text('id').primaryKey(),
  accountId: text('account_id').notNull().references(() => accounts.id, { onDelete: 'cascade' }),
  mode: text('mode').notNull().default('solo'), outcome: text('outcome').notNull(),
  activeSeconds: integer('active_seconds').notNull(), eliminations: integer('eliminations').notNull(),
  createdAt: integer('created_at').notNull(),
}, t => [index('player_results_account_idx').on(t.accountId)]);

export const rateLimits = sqliteTable('player_rate_limits', {
  bucket: text('bucket').primaryKey(), attempts: integer('attempts').notNull(), expiresAt: integer('expires_at').notNull(),
}, t => [index('player_rate_limits_expiry_idx').on(t.expiresAt)]);
