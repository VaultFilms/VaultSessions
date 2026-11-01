# Security

VaultSessions is experimental software that controls signed-in AI website tabs. Open source availability is not evidence of an independent security audit. Do not treat this project as offline, loopback-only, or guaranteed secure.

## Data flow

- The meeting interface, extension service worker, and content scripts exchange data inside the browser.
- Messages, role instructions, requested summaries, and selected images are submitted through official ChatGPT, Gemini, or Claude pages. Those pages communicate with their providers, under their own policies.
- When page sharing is enabled, readable page text may be included in the next AI request. Signed-in dashboards can contain private data. Query strings, fragments, and credentials are stripped from reference URLs, but page text is not automatically redacted.
- The optional Python server binds to `127.0.0.1:8766` and serves the `VaultSessions/` directory. Do not keep secrets in that directory. It is not an authentication or storage service.
- The source has one explicit `fetch`, for checking the fixed localhost meeting URL. Source inspection identified no separate analytics client, remote script/CDN dependency, or direct AI API client. This does not cover network behavior of the official AI websites, browser, other extensions, or future changes. A runtime network capture has not been performed for this release preparation.
- Public creator links and links inside AI replies open external sites when clicked.

## Permissions

| Permission | Purpose and scope |
| --- | --- |
| HTTP and HTTPS host access | Official chat DOM interaction and optional readable-page capture. The current manifest grants access beyond the three AI domains. |
| File URL host access | Registered local `meeting.html` bridge. Chrome's separate file-URL permission must be enabled by the user. The bridge checks the registered page URL. |
| `storage` | Temporary meeting snapshots and local preferences/role records. |
| `sidePanel` | Tab-specific meeting sidebar and view switching. |
| `scripting` | Injects the local `content-page.js` reader into a reference tab when its content script is not yet available. |

The manifest does not request cookies, browser history, debugger, or web-request interception permissions. The application does not copy login sessions. Broad DOM access is still sensitive and must not be equated with minimal permissions. Future permission narrowing requires compatibility testing; it has not been claimed here. Turning page sharing off does not revoke the declared permissions.

## Local data

Meeting snapshots use `chrome.storage.session`. Local settings and the registered file URL use browser-local storage. Conversations already submitted remain on the official provider site. Do not publish browser screenshots, copied conversations, local environment files, or account details as debugging attachments.

## Reporting a vulnerability

Use this repository's private security reporting feature if the maintainer has enabled it. If it is unavailable, open an issue containing only a request for a private reporting channel, without exploit details, credentials, or private data. Do not post sensitive reports publicly. No response-time or remediation guarantee is implied.

## Downloads and release integrity

Use this repository and its Releases page rather than unaffiliated download sites. No separate download website is designated here. A checksum detects changed bytes; it does not prove that software is safe or that a download source is authentic.

Release maintainers should publish a SHA-256 checksum for the exact downloadable archive after packaging. Do not reuse a hash from a different archive. No release archive has been packaged or hashed in this documentation update.

macOS:

```sh
shasum -a 256 VaultSessions.zip
```

Windows PowerShell:

```powershell
Get-FileHash .\VaultSessions.zip -Algorithm SHA256
```

## Before making network/privacy claims

Observe the extension service worker, meeting page, and official AI tabs separately. Exercise text, images, page sharing, summaries, file mode, and optional localhost mode. Distinguish extension-origin requests from provider-site traffic. Record the software version and tested flows, and publish only redacted evidence. Describe only the scope actually observed; a static search alone does not establish the absence of external traffic.
