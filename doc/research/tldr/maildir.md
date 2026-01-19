# Maildir Format - Technical Specification TLDR

> **Sources**: D.J. Bernstein's qmail specification (cr.yp.to/proto/maildir.html), Courier Mail Server documentation (courier-mta.org), Wikipedia

## Overview

Maildir is a lockless email storage format invented by Daniel J. Bernstein (circa 1995) for qmail. Each email message is stored as a separate file with a unique name, enabling concurrent access without locking mechanisms.

---

## Directory Structure

```
Maildir/
├── tmp/          # Temporary storage during delivery
├── new/          # Newly delivered, unread messages
├── cur/          # Messages that have been seen/read
├── .Folder/      # Subfolder (Maildir++ extension)
│   ├── tmp/
│   ├── new/
│   ├── cur/
│   └── maildirfolder   # Empty marker file
└── maildirsize   # Quota tracking file (Maildir++ extension)
```

### Subdirectory Purposes

| Directory | Purpose                                                                                                 |
| --------- | ------------------------------------------------------------------------------------------------------- |
| `tmp/`    | Temporary files during message delivery. Files here are incomplete. Clean up files older than 36 hours. |
| `new/`    | Successfully delivered messages not yet seen by any mail reader.                                        |
| `cur/`    | Messages that have been accessed/seen by a mail reader.                                                 |

---

## Filename Format

### Basic Structure

```
<timestamp>.<delivery-id>.<hostname>
```

**Example**: `1705594200.M123456P12345.mail.example.com`

### Components

| Part                     | Description                                              |
| ------------------------ | -------------------------------------------------------- |
| **Left** (timestamp)     | Unix time from `time()` or seconds from `gettimeofday()` |
| **Middle** (delivery-id) | Unique identifier ensuring no collisions (see below)     |
| **Right** (hostname)     | Machine hostname (escape `/` as `\057`, `:` as `\072`)   |

### Delivery Identifier Options

Concatenate enough of these to guarantee uniqueness:

| Prefix | Meaning        | Format                            |
| ------ | -------------- | --------------------------------- |
| `M`    | Microseconds   | Decimal, from `gettimeofday()`    |
| `P`    | Process ID     | Decimal                           |
| `Q`    | Delivery count | Decimal, per-process counter      |
| `R`    | Random         | Hexadecimal, cryptographic random |
| `I`    | Inode          | Hexadecimal                       |
| `V`    | Device number  | Hexadecimal                       |

**Modern filename example**:

```
1705594200.M654321P12345V801Ia1b2c3.mail.example.com
```

### Size Suffix (Maildir++ Extension)

Append `,S=<bytes>` to encode message size in filename:

```
1705594200.M654321P12345.host,S=4096
```

This optimizes quota calculation by avoiding `stat()` calls.

---

## Message Flags (Info Suffix)

When moving from `new/` to `cur/`, append `:2,<flags>` to the filename:

```
<unique-name>:2,<flags>
```

### Standard Flags (MUST be in ASCII alphabetical order)

| Flag | Meaning                           |
| ---- | --------------------------------- |
| `D`  | Draft                             |
| `F`  | Flagged (user-defined importance) |
| `P`  | Passed (forwarded/resent/bounced) |
| `R`  | Replied                           |
| `S`  | Seen (message has been viewed)    |
| `T`  | Trashed (marked for deletion)     |

**Example**: A replied and seen message:

```
1705594200.M654321P12345.host,S=4096:2,RS
```

### Info Versions

- `:1,` - Experimental (deprecated)
- `:2,` - Current standard

---

## Delivery Protocol

### Step-by-Step Process

1. **Generate unique filename** using timestamp + delivery-id + hostname
2. **Check existence** with `stat()` on `tmp/<filename>`
   - If file exists (anything other than `ENOENT`): wait 2 seconds, regenerate
   - If `ENOENT`: proceed
3. **Write message** to `tmp/<filename>`
   - Message must NOT contain mbox "From " header
   - Message must NOT have `>` prefix escaping
   - Verify write() return values
4. **fstat() the file** to get device, inode, and size
5. **Rename atomically** to `new/<filename>,S=<size>`
   - Use `rename()` (atomic on POSIX) or `link()` + `unlink()`

### Critical Rules

- Never use locking
- Rename/move MUST be atomic
- Readers must NEVER look in `tmp/`
- Message file must be complete before moving to `new/`

---

## Reading Protocol

1. **Clean `tmp/`**: Delete files older than 36 hours
2. **Process `new/`**: Move messages to `cur/` with `:2,` suffix (no flags initially)
3. **Read from `cur/`**: Access messages, update flags as needed

### Moving Messages

- Use atomic `rename()` (link+unlink is non-atomic, may cause duplicates)
- Preserve the unique name portion
- Only modify the info suffix

---

## Maildir++ Extensions

### Subfolders

- Stored as subdirectories starting with `.` (e.g., `.Sent`, `.Drafts`)
- Each folder contains `tmp/`, `new/`, `cur/`
- Must contain empty `maildirfolder` file
- Folders are NOT physically nested (flat structure)
- Hierarchy represented by separator (e.g., `.Sent.2022` = Sent/2022)
- Reserved folder: `.Trash`

### Quota System

**`maildirsize` file format**:

```
<quota-spec>
<bytes> <count>
<bytes> <count>
...
```

**Quota specification**: `<number><type>[,<number><type>...]`

- `S` = Size in bytes
- `C` = Message count

**Example**:

```
10000000S,1000C
5242880 150
-102400 -1
```

### Quota Rules

- Recalculate when `maildirsize` ≥ 5120 bytes
- Recalculate when over quota and file is >15 minutes old
- Lines are typically padded to 14 bytes each
- Append negative values when deleting messages

---

## Filesystem Requirements

### Required Features

- Atomic `rename()` within same filesystem
- Unique filenames (no collision)
- Colon (`:`) allowed in filenames

### Colon Workaround

Systems without colon support (Windows, some NFS configs) may use:

- `;` (semicolon)
- `-` (hyphen)

**Note**: No standard alternative; may cause interoperability issues.

### NFS Considerations

- `link()` and `rename()` must work across the maildir
- Entire maildir must be on same filesystem/device
- Inode and device numbers may not be reliable over NFS

---

## Quick Reference

### Minimal Valid Delivery

```bash
# 1. Create unique name
FILENAME="$(date +%s).$$.$HOSTNAME"

# 2. Write to tmp
cat message.eml > Maildir/tmp/$FILENAME

# 3. Move to new
mv Maildir/tmp/$FILENAME Maildir/new/$FILENAME
```

### Flag a Message as Seen

```bash
# Move from new to cur with Seen flag
mv Maildir/new/1705594200.M654321P12345.host \
   Maildir/cur/1705594200.M654321P12345.host:2,S
```

### Check if Over Quota

1. Read first line of `maildirsize` for quota spec
2. Sum all subsequent lines for current usage
3. Compare totals against quota

---

## Software Compatibility

| Category | Examples                                           |
| -------- | -------------------------------------------------- |
| **MTA**  | qmail, Postfix, Exim, Sendmail, Courier, Dovecot   |
| **MDA**  | procmail, maildrop, getmail, fdm                   |
| **MUA**  | Mutt, KMail, Evolution, Thunderbird (experimental) |
| **IMAP** | Dovecot, Courier-IMAP                              |

---

## Common Pitfalls

1. **Don't parse unique names** - Treat them as opaque identifiers
2. **Don't read from `tmp/`** - Messages there are incomplete
3. **Don't use non-atomic moves** - Causes duplicates
4. **Don't forget flag order** - Must be alphabetical (DFPRST)
5. **Don't lock** - Maildir is designed to be lockless
6. **Don't assume inode availability** - Not reliable on NFS
