/** Typed client for the SelfArchiver backend. Mirrors the server's domain types. */

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

export interface RuleFilter {
    fromContains: string[];
    toContains: string[];
    subjectContains: string[];
    requireAttachment: boolean;
    seenOnly: boolean;
    excludeFlagged: boolean;
}

export type RuleAction = 'archive' | 'archive_delete';
export type AgeUnit = 'days' | 'hours';

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

export interface RuleInput {
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
}

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

export interface Run {
    id: string;
    ruleId: string;
    trigger: 'schedule' | 'manual';
    status: 'running' | 'success' | 'error';
    startedAt: number;
    finishedAt: number | null;
    scanned: number;
    archived: number;
    deleted: number;
    error: string | null;
}

export interface MailboxFolder {
    path: string;
    name: string;
    specialUse: string | null;
    selectable: boolean;
}

export interface DashboardData {
    sources: Source[];
    rules: Rule[];
    stats: { total: number; totalSize: number; bySource: { sourceId: string; count: number }[] };
    recentRuns: Run[];
}

export const defaultFilter = (): RuleFilter => ({
    fromContains: [],
    toContains: [],
    subjectContains: [],
    requireAttachment: false,
    seenOnly: true,
    excludeFlagged: true,
});

async function request<T>(path: string, init?: RequestInit): Promise<T> {
    const res = await fetch(`/api${path}`, {
        credentials: 'include',
        headers: init?.body ? { 'Content-Type': 'application/json' } : undefined,
        ...init,
    });
    if (res.status === 401) throw new ApiError('Unauthorized', 401);
    const text = await res.text();
    const data = text ? JSON.parse(text) : {};
    if (!res.ok) throw new ApiError(data?.error ?? res.statusText, res.status);
    return data as T;
}

export class ApiError extends Error {
    constructor(
        message: string,
        public status: number,
    ) {
        super(message);
    }
}

export const api = {
    session: () => request<{ authRequired: boolean; authenticated: boolean }>('/session'),
    login: (password: string) =>
        request<{ authenticated: boolean }>('/login', { method: 'POST', body: JSON.stringify({ password }) }),
    logout: () => request<{ ok: boolean }>('/logout', { method: 'POST' }),

    dashboard: () => request<DashboardData>('/dashboard'),

    listSources: () => request<{ sources: Source[] }>('/sources').then((r) => r.sources),
    createSource: (body: SourceFormValues) =>
        request<{ source: Source; connectionOk: boolean; error: string | null }>('/sources', {
            method: 'POST',
            body: JSON.stringify(body),
        }),
    updateSource: (id: string, body: SourceFormValues) =>
        request<{ source: Source; connectionOk: boolean; error: string | null }>(`/sources/${id}`, {
            method: 'PUT',
            body: JSON.stringify(body),
        }),
    deleteSource: (id: string) => request<{ ok: boolean }>(`/sources/${id}`, { method: 'DELETE' }),
    testSource: (id: string) => request<{ ok: boolean; error: string | null }>(`/sources/${id}/test`, { method: 'POST' }),
    testConnection: (body: SourceFormValues & { id?: string }) =>
        request<{ ok: boolean; error: string | null }>('/sources/test-connection', {
            method: 'POST',
            body: JSON.stringify(body),
        }),
    folders: (id: string) => request<{ folders: MailboxFolder[] }>(`/sources/${id}/folders`).then((r) => r.folders),

    listRules: () => request<{ rules: Rule[] }>('/rules').then((r) => r.rules),
    createRule: (body: RuleInput) => request<{ rule: Rule }>('/rules', { method: 'POST', body: JSON.stringify(body) }),
    updateRule: (id: string, body: RuleInput) =>
        request<{ rule: Rule }>(`/rules/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
    deleteRule: (id: string) => request<{ ok: boolean }>(`/rules/${id}`, { method: 'DELETE' }),
    runRule: (id: string) => request<{ started: boolean }>(`/rules/${id}/run`, { method: 'POST' }),
    validateCron: (cron: string) =>
        request<{ valid: boolean; nextRun: number | null }>('/rules/validate-cron', {
            method: 'POST',
            body: JSON.stringify({ cron }),
        }),

    listEmails: (params: {
        search?: string;
        sourceId?: string;
        folder?: string;
        from?: number;
        to?: number;
        limit?: number;
        offset?: number;
    }) => {
        const qs = new URLSearchParams();
        if (params.search) qs.set('search', params.search);
        if (params.sourceId) qs.set('sourceId', params.sourceId);
        if (params.folder) qs.set('folder', params.folder);
        if (params.from) qs.set('from', String(params.from));
        if (params.to) qs.set('to', String(params.to));
        if (params.limit) qs.set('limit', String(params.limit));
        if (params.offset) qs.set('offset', String(params.offset));
        return request<{ items: ArchivedEmail[]; total: number; limit: number; offset: number }>(`/emails?${qs}`);
    },
    archiveFolders: (sourceId?: string) =>
        request<{ folders: string[] }>(`/emails/folders${sourceId ? `?sourceId=${sourceId}` : ''}`).then((r) => r.folders),
    emailContent: (id: string) =>
        request<{
            subject: string | null;
            from: string | null;
            to: string | null;
            date: number | null;
            text: string | null;
            html: string | null;
            attachments: { index: number; filename: string; size: number | null; contentType: string | null }[];
        }>(`/emails/${id}/content`),
    downloadUrl: (id: string) => `/api/emails/${id}/download`,
    attachmentUrl: (id: string, index: number) => `/api/emails/${id}/attachment/${index}`,

    listRuns: (ruleId?: string) =>
        request<{ runs: Run[] }>(`/runs${ruleId ? `?ruleId=${ruleId}` : ''}`).then((r) => r.runs),
};

export interface SourceFormValues {
    name: string;
    host: string;
    port: number;
    secure: boolean;
    allowSelfSigned: boolean;
    username: string;
    password?: string;
}
