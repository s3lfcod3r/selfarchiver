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

        'nav.overview': 'Overview',
        'nav.mailboxes': 'Mailboxes',
        'nav.rules': 'Rules',
        'nav.archive': 'Archive',
        'nav.activity': 'Activity',
        'app.tagline': 'mailbox keeper',
        'action.signOut': 'Sign out',
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
        'form.username': 'Username',
        'form.password': 'Password',
        'form.passwordHintEdit': 'Leave empty to keep the current password.',
        'form.passwordHintNew': 'Use an app password where available.',
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
        'rules.metaLine': '{source} · older than {days}d · {schedule}',
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
        'rf.filterLegend': 'Filter (all conditions must match)',
        'rf.fromContains': 'From contains any of',
        'rf.fromPh': 'e.g. rechnung@, @amazon.de — press Enter',
        'rf.subjectContains': 'Subject contains any of',
        'rf.subjectPh': 'e.g. Rechnung, Invoice — press Enter',
        'rf.onlyAttachment': 'Only with attachment',
        'rf.onlyRead': 'Only already-read mail',
        'rf.neverFlagged': 'Never touch flagged mail',
        'rf.olderThan': 'Only mails older than',
        'rf.olderThanHint': 'Days. Younger mail is left in place.',
        'rf.days': 'days',
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

        'runs.subtitle': 'Every rule run, what it archived, and what it removed from source.',
        'runs.none': 'No activity yet',
        'runs.noneDesc': 'Runs appear here once a rule executes — on schedule or run manually.',
        'runs.colRule': 'Rule',
        'runs.colStatus': 'Status',
        'runs.colResult': 'Result',
        'runs.colWhen': 'When',
        'runs.deletedRule': 'Deleted rule',
        'runs.resultLine': 'scanned {s} · archived {a} · deleted {d}',

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

        'nav.overview': 'Übersicht',
        'nav.mailboxes': 'Postfächer',
        'nav.rules': 'Regeln',
        'nav.archive': 'Archiv',
        'nav.activity': 'Aktivität',
        'app.tagline': 'Postfach-Hüter',
        'action.signOut': 'Abmelden',
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
        'form.username': 'Benutzername',
        'form.password': 'Passwort',
        'form.passwordHintEdit': 'Leer lassen, um das aktuelle Passwort zu behalten.',
        'form.passwordHintNew': 'Wenn möglich ein App-Passwort verwenden.',
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
        'rules.metaLine': '{source} · älter als {days}T · {schedule}',
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
        'rf.filterLegend': 'Filter (alle Bedingungen müssen zutreffen)',
        'rf.fromContains': 'Absender enthält eines von',
        'rf.fromPh': 'z. B. rechnung@, @amazon.de — Enter drücken',
        'rf.subjectContains': 'Betreff enthält eines von',
        'rf.subjectPh': 'z. B. Rechnung, Invoice — Enter drücken',
        'rf.onlyAttachment': 'Nur mit Anhang',
        'rf.onlyRead': 'Nur bereits gelesene',
        'rf.neverFlagged': 'Geflaggte nie anfassen',
        'rf.olderThan': 'Nur Mails älter als',
        'rf.olderThanHint': 'Tage. Jüngere Mails bleiben liegen.',
        'rf.days': 'Tage',
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

        'runs.subtitle': 'Jeder Regellauf — was archiviert und was aus der Quelle entfernt wurde.',
        'runs.none': 'Noch keine Aktivität',
        'runs.noneDesc': 'Läufe erscheinen hier, sobald eine Regel ausgeführt wird — geplant oder manuell.',
        'runs.colRule': 'Regel',
        'runs.colStatus': 'Status',
        'runs.colResult': 'Ergebnis',
        'runs.colWhen': 'Wann',
        'runs.deletedRule': 'Gelöschte Regel',
        'runs.resultLine': 'geprüft {s} · archiviert {a} · gelöscht {d}',

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
