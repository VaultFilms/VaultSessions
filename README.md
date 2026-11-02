<p align="center"><img src="VaultSessions/icons/leaf-128.png" width="64" height="64" alt="VaultSessions logo"></p>
<h1 align="center">VaultSessions</h1>

**An open-source meeting app where humans bring their own ChatGPT, Gemini, and Claude assistants—with their existing personalization and preferences—together to think, discuss, and collaborate.**

<p align="center">
  <a href="README.md">English</a> |
  <a href="docs/README.ja.md">日本語</a> |
  <a href="docs/README.fr.md">Français</a> |
  <a href="docs/README.de.md">Deutsch</a> |
  <a href="docs/README.es.md">Español</a> |
  <a href="docs/README.it.md">Italiano</a> |
  <a href="docs/README.id.md">Indonesia</a> |
  <a href="docs/README.pt-BR.md">Português</a> |
  <a href="docs/README.hi.md">हिन्दी</a>
</p>

<p align="center">
  <a href="https://www.youtube.com/watch?v=AN_3TevWWRk">
    <img src="docs/introduction-compact.gif" alt="VaultSessions Demo" width="700">
  </a>
</p>

## Features

- **Bring your own AI personalities.** Connect the official web chats you already use, with their existing conversations and personalization. No AI API keys are required.
- **Natural group discussions.** Connected AIs take turns, contribute new perspectives, and pass when they have nothing to add. One connected AI gives a single reply.
- **Choose a first speaker naturally.** Use `@GPT`, `@ChatGPT`, `@Gemini`, `@Claude`, or `To Gemini`. Otherwise, the first speaker is selected randomly.
- **Share visual context.** Attach or paste up to four images and discuss them by number.
- **Share the current page.** Optionally provide readable page text as meeting reference material.
- **Summarize and copy.** Generate a summary for your own review or a future meeting.
- **Sidebar and fullscreen views.** Switch layouts, hide participant controls, and adjust log text size.
- **Nine interface languages.** English, Japanese, French (France), German (Germany), Spanish (United States), Italian, Indonesian, Portuguese (Brazil), and Hindi. Initial selection follows browser preferences, with English as the fallback; manual choices are remembered. Dark mode follows the browser/system preference.

VaultSessions is a proof of concept for a meeting interface that brings different AI contexts, personalities, and human perspectives into one discussion. It is not affiliated with or endorsed by OpenAI, Google, or Anthropic.

## Installation

```text
VaultSessions/
├── README.md
├── LICENSE
├── SECURITY.md
├── docs/
└── VaultSessions/       ← Load this folder in Chrome
    ├── manifest.json
    ├── meeting.html
    ├── start.command
    ├── start.bat
    ├── serve.py
    ├── icons/
    ├── i18n/
    └── ...
```

1. Download or clone this repository into a permanent folder.
2. Open `chrome://extensions/` and enable **Developer mode**.
3. Click **Load unpacked** and select **`VaultSessions/`**, the folder containing `manifest.json` (not the repository root).
4. Open the official ChatGPT, Gemini, and/or Claude websites and sign in yourself.
5. Click the VaultSessions extension icon on the tab where you want the meeting sidebar.

Use a current Chrome release. The manifest minimum is Chrome 116, but browser API and provider UI compatibility can vary. No build step or server is needed for normal meetings.

After updating, reload the extension, the official AI tabs, and the meeting view.

### Fullscreen without a server

1. In the extension's **Details**, enable **Allow access to file URLs**.
2. Open `VaultSessions/meeting.html` in Chrome.
3. Click **Register this meeting page** to save its exact local URL in extension-local storage.
4. Use the header controls to switch between sidebar and fullscreen.

Moving the folder requires opening and registering the new `meeting.html`. Switching from the sidebar reuses the current tab; browser Back returns to the previous website. Logs are handed off, but AI connections may need to reconnect.

### Optional localhost mode

Some AI browser sidebars cannot interact with `file://` pages. For those integrations, install Python 3 and start the optional loopback server:

| Platform | Launcher                                   | Terminal alternative, from the `VaultSessions/` folder |
| -------- | ------------------------------------------ | ------------------------------------------------------ |
| macOS    | Double-click `VaultSessions/start.command` | `python3 serve.py`                                     |
| Windows  | Double-click `VaultSessions/start.bat`     | `py -3 serve.py` or `python serve.py`                  |

If the macOS launcher lost its executable bit, use `chmod +x start.command` or the Terminal command above. Keep the terminal window open; Ctrl+C stops the server. Port 8766 must be free.

In the file-based meeting, click **?**, then use the server check/open button in the help modal. It verifies the server and saves the current log before switching. The address is `http://127.0.0.1:8766/meeting.html`.

The server serves files from `VaultSessions/` on loopback only. Do not store secrets or personal files in that folder. The extension must remain enabled in both modes.

## Usage

### Start a meeting

Available AI tabs connect automatically. If a provider has multiple open tabs, choose the intended conversation. You can disconnect an AI without closing its tab; automatic reconnection pauses in the current meeting view until you connect it again.

Type a topic and press Enter. Shift+Enter inserts a newline; IME composition does not send. With multiple connected AIs, the first respondent is followed by the remaining participants in order. Mention a recipient anywhere in your message to choose the first respondent; matching is case-insensitive and the earliest explicit mention wins.

Default limits are **3 contributions** and **6 requests**. PASS counts toward requests, not contributions. All connected participants passing consecutively also ends a discussion. Use **Stop discussion** to stop subsequent turns; an in-flight response may still need to finish before input unlocks.

AI tabs are foregrounded during sending and response collection. Avoid editing or navigating those conversations during a turn. Input protection helps prevent accidental typing after focus changes. Role instructions are ordinary chat messages, not system roles; preservation of personality and instruction compliance cannot be guaranteed.

### Images and summaries

Attach up to four PNG, JPEG, or WebP images: **5 MB each, 10 MB total**. Paste images into the message field or use the attachment button. If pasted data contains an image, image handling takes precedence over text. Preview and remove attachments before sending.

VaultSessions passes images to the official AI tab inside the browser, without a project-operated relay server. The official website then uploads them to its provider when sent. Image numbers restart with each human message.

**Summarize discussion** randomly selects an available connected AI. It does not start another discussion round and has no 300-character recommendation. On success, the summary replaces the displayed log and ordinary app history. Copy it if you need to retain it. Failure preserves the previous log. Summaries are excluded from later app-generated discussion history and summary inputs; messages already sent remain in the provider's own conversation.

### Display and temporary storage

The header menu hides participant/settings controls. **A−**, **A＋**, and **Reset size** adjust log bodies, including summaries, from 75% to 175%. Text-size settings are shared between layouts and persist across browser restarts.

Temporary snapshots use `chrome.storage.session`, with up to 500 displayed rows and 500 ordinary history entries per saved snapshot. The active view may contain more. This is not a durable archive. Language, text size, page-sharing preference, and the registered file URL use local browser storage. Unsent image selections are not preserved through view switches.

### Privacy, permissions, and compatibility

**This is not an offline or loopback-only application.** Extension coordination and image handoff occur inside the browser, but the official AI sites send messages, images, and shared page text to their services. VaultSessions does not use AI API endpoints directly or require a project-operated relay server.

Static source inspection found one explicit `fetch`: the optional check of `http://127.0.0.1:8766/meeting.html`. No separate analytics client, remote script/CDN loader, or direct external AI API client was identified. This is a source-level finding, **not a recorded network-traffic audit** and not a claim that there is no external communication.

Page sharing can include private information visible on signed-in pages. Turn it off on pages you do not want to share. Removing URL query strings does not remove private data from page text. See [SECURITY.md](SECURITY.md) for the permission/data-flow details and security reporting guidance.

**VaultSessions automates signed-in official AI websites. This may conflict with a provider's terms or account rules. Review the applicable terms and use it at your own risk. Provider UI, browser API, feature, or terms changes may break functionality or require use to stop.** The app does not bypass CAPTCHA or rate limits. Being open source does not mean the software has been independently audited or is safe by default.

### Contributing

Contributions are welcome!

Fork this repository, improve VaultSessions, and submit a Pull Request.

Let's build a better way for humans and AI to think together.

The internal test suite is not included in this distribution. Please describe your verification steps when submitting a change, especially for provider DOM adapters. See [VaultSessions/i18n/README.md](VaultSessions/i18n/README.md) to add a language.

## License

[MIT](LICENSE) — Copyright (c) 2026 VaultFilms.

The software is provided **AS IS, without warranty**. Keep the copyright, permission, and warranty disclaimer notices when redistributing it. The license does not grant permission to disregard third-party service terms.

Created by [VaultFilms](https://www.youtube.com/channel/UCmiLs19uM0in4ubeyvPHLIQ).
