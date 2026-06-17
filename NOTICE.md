# Notice

SelfArchiver is an **independent, original implementation** of a self-hosted
email archiver. It was written from scratch and shares no source code with any
other project.

The product concept — a self-hosted tool that connects to IMAP mailboxes and
archives mail — is a well-established category. SelfArchiver was inspired by the
general idea behind tools such as Mailpiler and OpenArchiver, but it does not
reuse, copy, or derive from their code, and it deliberately takes a different,
simpler technical approach (single container, SQLite + FTS5, file-based `.eml`
archive) with a focus on features those tools lack:

- selective per-folder archiving,
- a rule/filter engine,
- per-rule schedules, and
- archive-then-delete retention to keep source mailboxes small.

All code in this repository is licensed under the MIT License (see `LICENSE`).
