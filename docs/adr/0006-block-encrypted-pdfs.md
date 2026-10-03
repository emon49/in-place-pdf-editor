# ADR-0006: Encrypted PDFs are blocked in v1

- **Status:** Accepted (2026-10-03)
- **Requirements:** UP-3

## Context

pdf-lib cannot write encrypted documents, and decrypting in the browser would require an extra library or a custom decryptor.

## Decision

On load, detect encryption (PDF.js `PasswordException`, or an `/Encrypt` entry in the trailer) and show a clear message: the file is password-protected or encrypted, and the user should remove protection in another tool and try again. No partial or view-only mode.

## Consequences

- Behaviour is predictable and honest about the limitation.
- Some users with owner-password-only PDFs (which open without a password) are also blocked. Revisit if this turns out to be common.
