import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

/**
 * Tiny dependency-free i18n. Strings live in one dictionary keyed by a flat
 * dotted key; `t(key, vars)` interpolates `{name}` placeholders. The chosen
 * language is persisted in localStorage and defaults to the browser language.
 */

export type Lang = 'en' | 'de';

const STRINGS: Record<Lang, Record<string, string>> = {
    en: {
        'common.cancel': 'Cancel',
        'common.save': 'Save',
        'common.edit': 'Edit',
        'common.delete': 'Delete',
        'common.test': 'Test',
        'common.runNow': 'Run now',
        'common.close': 'Close',

        'nav.overview': 'Overview',
        'nav.mailboxes': 'Mailboxes',
        'nav.rules': 'Rules',
        'nav.archive': 'Archive',
        'nav.activity': 'Activity',
        'app.tagline': 'mailbox keeper',
        'action.signOut': 'Sign out',
        'nav.collapse': 'Collapse',
        'nav.expand': 'Expand',
        'lang.language': 'Language',

        'login.subtitle': 'sign in to continue',
        'login.password': 'Password',
        'login.signIn': 'Sign in',
        'login.wrong': 'Wrong password.',

        'run.running': 'running',
        'run.error': 'error',
        'run.done': 'done',

        'dash.subtitle': 'What SelfArchiver is keeping safe and small.',
        'dash.archivedEmails': 'Archived emails',
        'dash.connected': '{n} connected',
        'dash.activeRules': 'Active rules',
        'dash.totalRules': '{n} total',
        'dash.recentlyDeleted': 'Recently deleted',
        'dash.fromSource': 'from source mailboxes',
        'dash.recentActivity': 'Recent activity',
        'dash.noRuns': 'No rule has run yet.',
        'dash.runLine': '{a} archived · {d} deleted',
        'dash.noMailbox': 'No mailbox yet',
        'dash.noMailboxDesc': 'Connect an IMAP mailbox to start archiving.',
        'dash.addMailboxLink': 'Add a mailbox →',

        'sources.subtitle': 'IMAP accounts SelfArchiver connects to.',
        'sources.add': '+ Add mailbox',
        'sources.none': 'No mailboxes',
        'sources.noneDesc': 'Add an IMAP mailbox (host, username, password) to start archiving from it.',
        'sources.checked': 'checked {t}',
        'sources.deleteConfirm':
            'Delete mailbox "{name}"? Rules using it are removed too. Archived emails are kept.',
        'sources.testOk': 'Connection OK',
        'sources.testFailed': 'Failed: {error}',
        'form.addMailbox': 'Add mailbox',
        'form.editMailbox': 'Edit mailbox',
        'form.name': 'Name',
        'form.namePh': 'Private Gmail',
        'form.imapHost': 'IMAP host',
        'form.port': 'Port',
        'form.useTls': 'Use TLS (recommended)',
        'form.allowSelfSigned': 'Accept self-signed certificate',
        'form.allowSelfSignedHint':
            'Enable for local mail servers on your LAN that use a self-signed or untrusted TLS certificate.',
        'form.username': 'Username',
        'form.password': 'Password',
        'form.passwordHintEdit': 'Leave empty to keep the current password.',
        'form.passwordHintNew': 'Use an app password where available.',
        'form.testConnection': 'Test connection',
        'form.saveTest': 'Save & test',
        'form.savedButFailed': 'Saved, but connection failed: {error}',
        'form.failedSave': 'Failed to save',

        'rules.subtitle':
            'Each rule archives chosen folders on its own schedule — optionally clearing them from the mailbox.',
        'rules.new': '+ New rule',
        'rules.addMailboxFirst': 'Add a mailbox first',
        'rules.addMailboxFirstDesc': 'Rules act on a mailbox, so connect one before creating rules.',
        'rules.goToMailboxes': 'Go to mailboxes →',
        'rules.noRules': 'No rules yet',
        'rules.noRulesDesc':
            'Create a rule to archive e.g. the Invoices folder every 30 days and keep your mailbox small.',
        'rules.archiveDelete': 'archive + delete',
        'rules.archiveOnly': 'archive only',
        'rules.paused': 'paused',
        'rules.metaLine': '{source} · older than {age} · {schedule}',
        'rules.lastNext': 'last run {last} · next {next}',
        'rules.started': '"{name}" started. Watch progress under Activity.',
        'rules.couldNotStart': 'Could not start rule',
        'rules.deleteConfirm': 'Delete rule "{name}"? Archived emails are kept.',
        'rules.unknownMailbox': 'Unknown mailbox',

        'rf.new': 'New rule',
        'rf.edit': 'Edit rule',
        'rf.mailbox': 'Mailbox',
        'rf.ruleName': 'Rule name',
        'rf.ruleNamePh': 'Archive invoices',
        'rf.foldersTitle': 'Folders to archive',
        'rf.loadingFolders': 'Loading folders…',
        'rf.foldersHint': 'Only the folders you tick are touched — the rest of the mailbox (incl. spam) is left alone.',
        'rf.refreshFolders': 'Refresh',
        'rf.includeSubfolders': 'Also include (new) subfolders',
        'rf.includeSubfoldersHint':
            'On every run, subfolders below the selected folders are discovered and archived too.',
        'rf.filterLegend': 'Filter (all conditions must match)',
        'rf.fromContains': 'From contains any of',
        'rf.fromPh': 'e.g. rechnung@, @amazon.de — press Enter',
        'rf.subjectContains': 'Subject contains any of',
        'rf.subjectPh': 'e.g. Rechnung, Invoice — press Enter',
        'rf.onlyAttachment': 'Only with attachment',
        'rf.onlyRead': 'Only already-read mail',
        'rf.neverFlagged': 'Never touch flagged mail',
        'rf.olderThan': 'Only mails older than',
        'rf.olderThanHint': 'Younger mail is left in place.',
        'rf.days': 'days',
        'rf.hours': 'hours',
        'rf.frequency': 'Frequency',
        'rf.freqHourly': 'Hourly',
        'rf.freqDaily': 'Daily',
        'rf.freqWeekly': 'Weekly',
        'rf.freqMonthly': 'Monthly',
        'rf.freqCustom': 'Custom (cron)',
        'rf.minute': 'Minute',
        'rf.time': 'Time',
        'rf.weekdays': 'Weekdays',
        'rf.dayOfMonth': 'Day of month',
        'rf.cronExpr': 'Cron expression',
        'wd.0': 'Sun',
        'wd.1': 'Mon',
        'wd.2': 'Tue',
        'wd.3': 'Wed',
        'wd.4': 'Thu',
        'wd.5': 'Fri',
        'wd.6': 'Sat',
        'sched.descHourly': 'Hourly at :{m}',
        'sched.descDaily': 'Daily at {time}',
        'sched.descWeekly': '{days} at {time}',
        'sched.descMonthly': 'Monthly on day {day} at {time}',
        'arch.allFolders': 'All folders',
        'arch.from': 'From',
        'arch.to': 'To',
        'rf.whatToDo': 'What to do',
        'rf.archiveOnlyOpt': 'Archive only',
        'rf.archiveDeleteOpt': 'Archive, then delete from mailbox',
        'rf.deleteHint': '⚠ Deletes from the mailbox after archiving.',
        'rf.keepHint': 'Keeps the original in the mailbox.',
        'rf.schedule': 'Schedule',
        'rf.nextRun': 'Next run: {time}',
        'rf.invalidCron': 'Invalid cron expression',
        'rf.custom': 'Custom…',
        'rf.enabled': 'Rule enabled',
        'rf.saveRule': 'Save rule',
        'rf.errChooseMailbox': 'Choose a mailbox.',
        'rf.errName': 'Give the rule a name.',
        'rf.errFolder': 'Select at least one folder.',
        'rf.errCron': 'The schedule is not a valid cron expression.',
        'rf.errSave': 'Failed to save rule',

        'arch.subtitle': '{n} emails stored and searchable.',
        'arch.searchPh': 'Search subject, sender, recipient, body…',
        'arch.allMailboxes': 'All mailboxes',
        'arch.nothing': 'Nothing here yet',
        'arch.nothingDesc':
            'Once a rule archives mail, it shows up here — full-text searchable, downloadable as .eml.',
        'arch.noSubject': '(no subject)',
        'arch.unknown': 'unknown',
        'arch.loadMore': 'Load more ({n} left)',
        'arch.noContent': 'No content',
        'arch.plain': 'Text',
        'arch.formatted': 'Formatted',
        'arch.delete': 'Delete from archive',
        'arch.deleteConfirm': 'Delete this email from the archive? This cannot be undone.',
        'arch.deleteFolder': 'Delete folder',
        'arch.deleteFolderConfirm': 'Delete ALL archived emails in "{folder}"? This cannot be undone.',

        'runs.subtitle': 'Every rule run, what it archived, and what it removed from source.',
        'runs.none': 'No activity yet',
        'runs.noneDesc': 'Runs appear here once a rule executes — on schedule or run manually.',
        'runs.colRule': 'Rule',
        'runs.colStatus': 'Status',
        'runs.colResult': 'Result',
        'runs.colWhen': 'When',
        'runs.deletedRule': 'Deleted rule',
        'runs.resultLine': 'scanned {s} · archived {a} · deleted {d}',
        'runs.searchPh': 'Search rule or error…',
        'runs.statusAll': 'All statuses',
        'runs.triggerAll': 'All triggers',
        'runs.triggerSchedule': 'Scheduled',
        'runs.triggerManual': 'Manual',
        'runs.clear': 'Clear filters',
        'runs.count': '{n} runs',
        'runs.settings': 'Settings',
        'runs.noMatch': 'No runs match the filters',
        'runs.noMatchDesc': 'Try widening the date range or clearing the search.',
        'runs.retentionTitle': 'Activity history',
        'runs.retentionLabel': 'Keep at most',
        'runs.retentionUnit': 'runs',
        'runs.retentionHint': 'Older runs are pruned automatically after each run. 0 = keep everything.',
        'runs.retentionSaved': 'Saved.',
        'runs.delete': 'Delete run',
        'runs.deleteConfirm': 'Delete this run from the history?',
        'runs.clearAll': 'Clear all',
        'runs.clearAllConfirm': 'Delete ALL runs from the activity history? This cannot be undone.',
        'runs.archivedTitle': 'Archived in this run',
        'runs.viewHint': 'Show the archived emails',
        'runs.noArchived': 'No archived emails found for this run.',
        'runs.olderRunHint': 'They may have since been removed from the archive.',

        'cron.daily0300': 'Every day at 03:00',
        'cron.daily0400': 'Every day at 04:00',
        'cron.sunday0300': 'Every Sunday at 03:00',
        'cron.monthly0300': 'On the 1st each month at 03:00',
        'cron.hourly': 'Every hour',
        'cron.every30': 'Every 30 minutes',
    },
    de: {
        'common.cancel': 'Abbrechen',
        'common.save': 'Speichern',
        'common.edit': 'Bearbeiten',
        'common.delete': 'Löschen',
        'common.test': 'Testen',
        'common.runNow': 'Jetzt ausführen',
        'common.close': 'Schließen',

        'nav.overview': 'Übersicht',
        'nav.mailboxes': 'Postfächer',
        'nav.rules': 'Regeln',
        'nav.archive': 'Archiv',
        'nav.activity': 'Aktivität',
        'app.tagline': 'Postfach-Hüter',
        'action.signOut': 'Abmelden',
        'nav.collapse': 'Einklappen',
        'nav.expand': 'Ausklappen',
        'lang.language': 'Sprache',

        'login.subtitle': 'zum Fortfahren anmelden',
        'login.password': 'Passwort',
        'login.signIn': 'Anmelden',
        'login.wrong': 'Falsches Passwort.',

        'run.running': 'läuft',
        'run.error': 'Fehler',
        'run.done': 'fertig',

        'dash.subtitle': 'Was SelfArchiver sichert und klein hält.',
        'dash.archivedEmails': 'Archivierte E-Mails',
        'dash.connected': '{n} verbunden',
        'dash.activeRules': 'Aktive Regeln',
        'dash.totalRules': '{n} gesamt',
        'dash.recentlyDeleted': 'Kürzlich gelöscht',
        'dash.fromSource': 'aus Quell-Postfächern',
        'dash.recentActivity': 'Letzte Aktivität',
        'dash.noRuns': 'Noch keine Regel ausgeführt.',
        'dash.runLine': '{a} archiviert · {d} gelöscht',
        'dash.noMailbox': 'Noch kein Postfach',
        'dash.noMailboxDesc': 'Verbinde ein IMAP-Postfach, um mit dem Archivieren zu beginnen.',
        'dash.addMailboxLink': 'Postfach hinzufügen →',

        'sources.subtitle': 'IMAP-Konten, mit denen sich SelfArchiver verbindet.',
        'sources.add': '+ Postfach hinzufügen',
        'sources.none': 'Keine Postfächer',
        'sources.noneDesc': 'Füge ein IMAP-Postfach (Host, Benutzer, Passwort) hinzu, um daraus zu archivieren.',
        'sources.checked': 'geprüft {t}',
        'sources.deleteConfirm':
            'Postfach „{name}" löschen? Zugehörige Regeln werden ebenfalls entfernt. Archivierte E-Mails bleiben erhalten.',
        'sources.testOk': 'Verbindung OK',
        'sources.testFailed': 'Fehlgeschlagen: {error}',
        'form.addMailbox': 'Postfach hinzufügen',
        'form.editMailbox': 'Postfach bearbeiten',
        'form.name': 'Name',
        'form.namePh': 'Privates Gmail',
        'form.imapHost': 'IMAP-Host',
        'form.port': 'Port',
        'form.useTls': 'TLS verwenden (empfohlen)',
        'form.allowSelfSigned': 'Selbstsigniertes Zertifikat akzeptieren',
        'form.allowSelfSignedHint':
            'Für lokale Mailserver im LAN mit selbstsigniertem oder nicht vertrauenswürdigem TLS-Zertifikat aktivieren.',
        'form.username': 'Benutzername',
        'form.password': 'Passwort',
        'form.passwordHintEdit': 'Leer lassen, um das aktuelle Passwort zu behalten.',
        'form.passwordHintNew': 'Wenn möglich ein App-Passwort verwenden.',
        'form.testConnection': 'Verbindung testen',
        'form.saveTest': 'Speichern & testen',
        'form.savedButFailed': 'Gespeichert, aber Verbindung fehlgeschlagen: {error}',
        'form.failedSave': 'Speichern fehlgeschlagen',

        'rules.subtitle':
            'Jede Regel archiviert gewählte Ordner nach eigenem Zeitplan — optional werden sie aus dem Postfach gelöscht.',
        'rules.new': '+ Neue Regel',
        'rules.addMailboxFirst': 'Zuerst ein Postfach hinzufügen',
        'rules.addMailboxFirstDesc': 'Regeln arbeiten auf einem Postfach — verbinde zuerst eines.',
        'rules.goToMailboxes': 'Zu den Postfächern →',
        'rules.noRules': 'Noch keine Regeln',
        'rules.noRulesDesc':
            'Erstelle eine Regel, z. B. den Ordner „Rechnungen" alle 30 Tage zu archivieren, und halte dein Postfach klein.',
        'rules.archiveDelete': 'archivieren + löschen',
        'rules.archiveOnly': 'nur archivieren',
        'rules.paused': 'pausiert',
        'rules.metaLine': '{source} · älter als {age} · {schedule}',
        'rules.lastNext': 'letzter Lauf {last} · nächster {next}',
        'rules.started': '„{name}" gestartet. Fortschritt unter Aktivität.',
        'rules.couldNotStart': 'Regel konnte nicht gestartet werden',
        'rules.deleteConfirm': 'Regel „{name}" löschen? Archivierte E-Mails bleiben erhalten.',
        'rules.unknownMailbox': 'Unbekanntes Postfach',

        'rf.new': 'Neue Regel',
        'rf.edit': 'Regel bearbeiten',
        'rf.mailbox': 'Postfach',
        'rf.ruleName': 'Regelname',
        'rf.ruleNamePh': 'Rechnungen archivieren',
        'rf.foldersTitle': 'Zu archivierende Ordner',
        'rf.loadingFolders': 'Ordner werden geladen…',
        'rf.foldersHint':
            'Nur angehakte Ordner werden bearbeitet — der Rest des Postfachs (inkl. Spam) bleibt unberührt.',
        'rf.refreshFolders': 'Aktualisieren',
        'rf.includeSubfolders': 'Auch (neue) Unterordner einbeziehen',
        'rf.includeSubfoldersHint':
            'Bei jedem Lauf werden Unterordner der gewählten Ordner erkannt und mitarchiviert.',
        'rf.filterLegend': 'Filter (alle Bedingungen müssen zutreffen)',
        'rf.fromContains': 'Absender enthält eines von',
        'rf.fromPh': 'z. B. rechnung@, @amazon.de — Enter drücken',
        'rf.subjectContains': 'Betreff enthält eines von',
        'rf.subjectPh': 'z. B. Rechnung, Invoice — Enter drücken',
        'rf.onlyAttachment': 'Nur mit Anhang',
        'rf.onlyRead': 'Nur bereits gelesene',
        'rf.neverFlagged': 'Geflaggte nie anfassen',
        'rf.olderThan': 'Nur Mails älter als',
        'rf.olderThanHint': 'Jüngere Mails bleiben liegen.',
        'rf.days': 'Tage',
        'rf.hours': 'Stunden',
        'rf.frequency': 'Intervall',
        'rf.freqHourly': 'Stündlich',
        'rf.freqDaily': 'Täglich',
        'rf.freqWeekly': 'Wöchentlich',
        'rf.freqMonthly': 'Monatlich',
        'rf.freqCustom': 'Eigen (Cron)',
        'rf.minute': 'Minute',
        'rf.time': 'Uhrzeit',
        'rf.weekdays': 'Wochentage',
        'rf.dayOfMonth': 'Tag im Monat',
        'rf.cronExpr': 'Cron-Ausdruck',
        'wd.0': 'So',
        'wd.1': 'Mo',
        'wd.2': 'Di',
        'wd.3': 'Mi',
        'wd.4': 'Do',
        'wd.5': 'Fr',
        'wd.6': 'Sa',
        'sched.descHourly': 'Stündlich um :{m}',
        'sched.descDaily': 'Täglich um {time}',
        'sched.descWeekly': '{days} um {time}',
        'sched.descMonthly': 'Monatlich am {day}. um {time}',
        'arch.allFolders': 'Alle Ordner',
        'arch.from': 'Von',
        'arch.to': 'Bis',
        'rf.whatToDo': 'Was tun',
        'rf.archiveOnlyOpt': 'Nur archivieren',
        'rf.archiveDeleteOpt': 'Archivieren, dann aus Postfach löschen',
        'rf.deleteHint': '⚠ Löscht nach dem Archivieren aus dem Postfach.',
        'rf.keepHint': 'Behält das Original im Postfach.',
        'rf.schedule': 'Zeitplan',
        'rf.nextRun': 'Nächster Lauf: {time}',
        'rf.invalidCron': 'Ungültiger Cron-Ausdruck',
        'rf.custom': 'Eigener…',
        'rf.enabled': 'Regel aktiv',
        'rf.saveRule': 'Regel speichern',
        'rf.errChooseMailbox': 'Wähle ein Postfach.',
        'rf.errName': 'Gib der Regel einen Namen.',
        'rf.errFolder': 'Wähle mindestens einen Ordner.',
        'rf.errCron': 'Der Zeitplan ist kein gültiger Cron-Ausdruck.',
        'rf.errSave': 'Regel konnte nicht gespeichert werden',

        'arch.subtitle': '{n} E-Mails gespeichert und durchsuchbar.',
        'arch.searchPh': 'Betreff, Absender, Empfänger, Inhalt durchsuchen…',
        'arch.allMailboxes': 'Alle Postfächer',
        'arch.nothing': 'Noch nichts hier',
        'arch.nothingDesc':
            'Sobald eine Regel Mails archiviert, erscheinen sie hier — volltextdurchsuchbar, als .eml herunterladbar.',
        'arch.noSubject': '(kein Betreff)',
        'arch.unknown': 'unbekannt',
        'arch.loadMore': 'Mehr laden (noch {n})',
        'arch.noContent': 'Kein Inhalt',
        'arch.plain': 'Text',
        'arch.formatted': 'Formatiert',
        'arch.delete': 'Aus Archiv löschen',
        'arch.deleteConfirm': 'Diese E-Mail aus dem Archiv löschen? Kann nicht rückgängig gemacht werden.',
        'arch.deleteFolder': 'Ordner löschen',
        'arch.deleteFolderConfirm': 'ALLE archivierten E-Mails in „{folder}" löschen? Kann nicht rückgängig gemacht werden.',

        'runs.subtitle': 'Jeder Regellauf — was archiviert und was aus der Quelle entfernt wurde.',
        'runs.none': 'Noch keine Aktivität',
        'runs.noneDesc': 'Läufe erscheinen hier, sobald eine Regel ausgeführt wird — geplant oder manuell.',
        'runs.colRule': 'Regel',
        'runs.colStatus': 'Status',
        'runs.colResult': 'Ergebnis',
        'runs.colWhen': 'Wann',
        'runs.deletedRule': 'Gelöschte Regel',
        'runs.resultLine': 'geprüft {s} · archiviert {a} · gelöscht {d}',
        'runs.searchPh': 'Regel oder Fehler durchsuchen…',
        'runs.statusAll': 'Alle Status',
        'runs.triggerAll': 'Alle Auslöser',
        'runs.triggerSchedule': 'Geplant',
        'runs.triggerManual': 'Manuell',
        'runs.clear': 'Filter zurücksetzen',
        'runs.count': '{n} Läufe',
        'runs.settings': 'Einstellungen',
        'runs.noMatch': 'Keine Läufe passen zum Filter',
        'runs.noMatchDesc': 'Erweitere den Zeitraum oder leere die Suche.',
        'runs.retentionTitle': 'Aktivitäts-Verlauf',
        'runs.retentionLabel': 'Maximal behalten',
        'runs.retentionUnit': 'Läufe',
        'runs.retentionHint': 'Ältere Läufe werden nach jedem Lauf automatisch entfernt. 0 = alles behalten.',
        'runs.retentionSaved': 'Gespeichert.',
        'runs.delete': 'Lauf löschen',
        'runs.deleteConfirm': 'Diesen Lauf aus dem Verlauf löschen?',
        'runs.clearAll': 'Alle löschen',
        'runs.clearAllConfirm': 'ALLE Läufe aus dem Verlauf löschen? Kann nicht rückgängig gemacht werden.',
        'runs.archivedTitle': 'In diesem Lauf archiviert',
        'runs.viewHint': 'Archivierte Mails anzeigen',
        'runs.noArchived': 'Keine archivierten Mails für diesen Lauf gefunden.',
        'runs.olderRunHint': 'Sie wurden evtl. inzwischen aus dem Archiv gelöscht.',

        'cron.daily0300': 'Täglich um 03:00',
        'cron.daily0400': 'Täglich um 04:00',
        'cron.sunday0300': 'Jeden Sonntag um 03:00',
        'cron.monthly0300': 'Am 1. jedes Monats um 03:00',
        'cron.hourly': 'Stündlich',
        'cron.every30': 'Alle 30 Minuten',
    },
};

/** Cron presets shown in the rule editor, label resolved via i18n key. */
export const CRON_PRESETS: { value: string; key: string }[] = [
    { value: '0 3 * * *', key: 'cron.daily0300' },
    { value: '0 4 * * *', key: 'cron.daily0400' },
    { value: '0 3 * * 0', key: 'cron.sunday0300' },
    { value: '0 3 1 * *', key: 'cron.monthly0300' },
    { value: '0 * * * *', key: 'cron.hourly' },
    { value: '*/30 * * * *', key: 'cron.every30' },
];

export function detectLang(): Lang {
    try {
        const saved = localStorage.getItem('sa_lang');
        if (saved === 'en' || saved === 'de') return saved;
    } catch {
        // localStorage may be unavailable; fall back to navigator
    }
    return typeof navigator !== 'undefined' && navigator.language?.toLowerCase().startsWith('de') ? 'de' : 'en';
}

export type TFunc = (key: string, vars?: Record<string, string | number>) => string;

interface I18nContextValue {
    lang: Lang;
    setLang: (lang: Lang) => void;
    t: TFunc;
}

const I18nContext = createContext<I18nContextValue | null>(null);

export function LanguageProvider({ children }: { children: ReactNode }) {
    const [lang, setLangState] = useState<Lang>(detectLang);

    useEffect(() => {
        document.documentElement.lang = lang;
    }, [lang]);

    const setLang = (next: Lang) => {
        try {
            localStorage.setItem('sa_lang', next);
        } catch {
            // ignore persistence failures
        }
        setLangState(next);
    };

    const t: TFunc = (key, vars) => {
        let value = STRINGS[lang][key] ?? STRINGS.en[key] ?? key;
        if (vars) {
            for (const [name, replacement] of Object.entries(vars)) {
                value = value.replaceAll(`{${name}}`, String(replacement));
            }
        }
        return value;
    };

    return <I18nContext.Provider value={{ lang, setLang, t }}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nContextValue {
    const ctx = useContext(I18nContext);
    if (!ctx) throw new Error('useI18n must be used within a LanguageProvider');
    return ctx;
}
