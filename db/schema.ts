import { sqliteTable, text, integer, index } from 'drizzle-orm/sqlite-core';
export const records = sqliteTable('records', {
 id:text('id').primaryKey(), owner:text('owner').notNull(), kind:text('kind').notNull(),
 data:text('data').notNull(), version:integer('version').notNull().default(1),
 createdAt:text('created_at').notNull(), updatedAt:text('updated_at').notNull(),
}, t => [index('records_owner_kind').on(t.owner,t.kind)]);
export const audit = sqliteTable('audit', {
 id:text('id').primaryKey(),owner:text('owner').notNull(),recordId:text('record_id').notNull(),
 action:text('action').notNull(),label:text('label').notNull(),createdAt:text('created_at').notNull(),
},t=>[index('audit_owner_date').on(t.owner,t.createdAt)]);
