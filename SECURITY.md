# Security

VaultSessions is experimental software that controls signed-in AI website tabs. Open source availability is not evidence of an independent security audit. Do not treat this project as offline, loopback-only, or guaranteed secure.

## Data flow

- The meeting interface, extension service worker, and content scripts exchange data inside the browser.
- Messages, role instructions, requested summaries, and selected images are submitted through official ChatGPT, Gemini, or Claude pages. Those pages communicate with their providers, under their own policies.
- Clicking the page attachment button captures readable text locally. Sending the next message includes that text in requests to the AIs responding to the topic. Signed-in dashboards can contain private data. Query strings, fragments, and credentials are stripped from reference URLs, but page text is not automatically redacted.
- The optional Python server binds to `127.0.0.1:8766` and serves the `VaultSessions/` directory. Do not keep secrets in that directory. It is not an authentication or storage service.
- The source has one explicit `fetch`, for checking the fixed localhost meeting URL. Source inspection identified no separate analytics client, remote script/CDN dependency, or direct AI API client. This does not cover network behavior of the official AI websites, browser, other extensions, or future changes. A runtime network capture has not been performed for this release preparation.
- Public creator links and links inside AI replies open external sites when clicked.

## Permissions

| Permission | Purpose and scope |
| --- | --- |
| HTTP and HTTPS host access | Official chat DOM interaction and optional readable-page capture. The current manifest grants access beyond the three AI domains. |
| File URL host access | Registered local `meeting.html` bridge. Chrome's separate file-URL permission must be enabled by the user. The bridge checks the registered page URL. |
| `storage` | Temporary meeting snapshots and local preferences/role records. |
| `sidePanel` | Tab-specific meeting side panel and view switching. |
| `scripting` | Injects the local page reader when needed and reads the official Claude SVG preview frame for a verified image task. |

The manifest does not request cookies, browser history, debugger, or web-request interception permissions. The application does not copy login sessions. Broad DOM access is still sensitive and must not be equated with minimal permissions. Future permission narrowing requires compatibility testing; it has not been claimed here. 

## Local data

Meeting snapshots use `chrome.storage.session`. Local settings and the registered file URL use browser-local storage. Verified completed role revisions also persist in extension-local storage, keyed by provider and conversation URL (up to 500 records); role text and pending operations are not stored in that persistent record. Generated-image previews and pending image-task metadata can be included in temporary meeting snapshots. Previews are compressed locally from images already loaded by the official ChatGPT or Gemini page; VS does not fetch arbitrary image URLs. Claude SVG code and SVG file previews are sanitized with an element/attribute allowlist and rasterized locally; scripts, embedded HTML, stylesheets, and external references are not passed to the meeting UI. File previews are read only from the official `https://www.claudeusercontent.com` SVG viewer for the current matching task. Original images remain on the official site. Conversations already submitted remain on the official provider site. Do not publish browser screenshots, copied conversations, local environment files, or account details as debugging attachments.

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

### Rich response rendering

Official response DOM is untrusted. VaultSessions captures an allowlisted semantic tree rather than transferring raw HTML. The tree is validated again at extension-message and snapshot boundaries, and the meeting view constructs fresh HTML elements and text nodes with local classes. Source classes, IDs, styles, event attributes, SVG/MathML, scripts, forms, embedded documents, media, and remote images are not imported. MathML formulas fall back to inert text. Links accept only HTTP/HTTPS URLs and open with `noopener noreferrer`. Ordered-list numbering and bounded table cell spans are the only additional source attributes preserved. Depth, node count, text length, and serialized size are bounded; unsupported or oversized content falls back to plain text.

The renderer does not pass response data to `innerHTML`, `DOMParser`, or other HTML parsing sinks. This follows the safe DOM construction approach described in the [OWASP DOM-based XSS Prevention Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/DOM_based_XSS_Prevention_Cheat_Sheet.html). Rich presentation data is kept separate from the plain-text discussion transcript and is not collected for image-sharing replies.
