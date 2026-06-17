import { z } from 'zod';

/**
 * Domain types and the Zod schemas used to validate input at the API boundary.
 * Keeping both together makes the shape of every persisted entity obvious in
 * one place.
 */

// --- Mailbox source ---------------------------------------------------------

export const sourceInputSchema = z.object({
    name: z.string().min(1).max(120),
    host: z.string().min(1).max(255),
    port: z.number().int().min(1).max(65535).default(993),
    secure: z.boolean().default(true),
    // Accept self-signed / untrusted TLS certs (common for local mail servers
    // like a Synology MailPlus on your LAN).
    allowSelfSigned: z.boolean().default(false),
    username: z.string().min(1).max(255),
    // Only required on create; on update an empty password keeps the old one.
    password: z.string().max(1024).optional(),
});
export type SourceInput = z.infer<typeof sourceInputSchema>;

export interface Source {
    id: string;
    name: string;
    host: string;
    port: number;
    secure: boolean;
    allowSelfSigned: boolean;
    username: string;
    status: 'ok' | 'error' | 'unknown';
    lastCheckedAt: number | null;
    lastError: string | null;
    createdAt: number;
    updatedAt: number;
}

// --- Rule filter + rule -----------------------------------------------------

/**
 * The filter is intentionally conservative: every populated condition must
 * match (logical AND), and the `contains` lists match if ANY entry is found.
 * This makes "archive only invoices from these senders" expressible while
 * keeping spam in the inbox untouched.
 */
export const ruleFilterSchema = z.object({
    fromContains: z.array(z.string().min(1)).default([]),
    toContains: z.array(z.string().min(1)).default([]),
    subjectContains: z.array(z.string().min(1)).default([]),
    requireAttachment: z.boolean().default(false),
    seenOnly: z.boolean().default(true),
    excludeFlagged: z.boolean().default(true),
});
export type RuleFilter = z.infer<typeof ruleFilterSchema>;

export const ruleActionSchema = z.enum(['archive', 'archive_delete']);
export type RuleAction = z.infer<typeof ruleActionSchema>;

export const ageUnitSchema = z.enum(['days', 'hours']);
export type AgeUnit = z.infer<typeof ageUnitSchema>;

export const ruleInputSchema = z.object({
    sourceId: z.string().min(1),
    name: z.string().min(1).max(120),
    enabled: z.boolean().default(true),
    folders: z.array(z.string().min(1)).min(1, 'Select at least one folder'),
    // Also archive any (new) subfolders below the selected folders, discovered
    // fresh on every run.
    includeSubfolders: z.boolean().default(false),
    filter: ruleFilterSchema.default(ruleFilterSchema.parse({})),
    minAge: z.number().int().min(0).max(100000).default(30),
    minAgeUnit: ageUnitSchema.default('days'),
    action: ruleActionSchema.default('archive'),
    scheduleCron: z.string().min(1).max(120).default('0 3 * * *'),
});
export type RuleInput = z.infer<typeof ruleInputSchema>;

export interface Rule {
    id: string;
    sourceId: string;
    name: string;
    enabled: boolean;
    folders: string[];
    includeSubfolders: boolean;
    filter: RuleFilter;
    minAge: number;
    minAgeUnit: AgeUnit;
    action: RuleAction;
    scheduleCron: string;
    lastRunAt: number | null;
    nextRunAt: number | null;
    createdAt: number;
    updatedAt: number;
}

// --- Archived email + run ---------------------------------------------------

export interface ArchivedEmail {
    id: string;
    sourceId: string;
    ruleId: string | null;
    messageId: string | null;
    folder: string;
    subject: string | null;
    fromAddr: string | null;
    toAddr: string | null;
    sentAt: number | null;
    size: number | null;
    hasAttachments: boolean;
    attachmentNames: string[];
    emlPath: string;
    archivedAt: number;
}

export type RunStatus = 'running' | 'success' | 'error';
export type RunTrigger = 'schedule' | 'manual';

export interface Run {
    id: string;
    ruleId: string;
    trigger: RunTrigger;
    status: RunStatus;
    startedAt: number;
    finishedAt: number | null;
    scanned: number;
    archived: number;
    deleted: number;
    error: string | null;
}

// --- IMAP folder listing ----------------------------------------------------

export interface MailboxFolder {
    path: string;
    name: string;
    /** Best-effort special-use flag, e.g. \Junk, \Trash, \Sent. */
    specialUse: string | null;
    selectable: boolean;
}
