# Repair notes

When developing or repairing VaultSessions with an AI, ask it to read the relevant entries first. These notes record observed symptoms, confirmed causes, changes, and verification. Recheck the current code and official UI: a previous fix is a useful clue, not proof of a new cause.

Keep new entries short, using the four fields below and a code reference. Label an unconfirmed cause as `Hypothesis`.

## 2026-11-13 — ChatGPT Writing mistaken for a chat draft

- **Symptom:** After generating a handoff document, VS reported `COMPOSER_DRAFT` even though the ChatGPT chat composer was empty.

- **Cause:** Confirmed from the live DOM. Both the Writing document editor and the chat composer used `ProseMirror` with `role="textbox"` and `contenteditable="true"`. The generic editor selector selected the Writing document first and interpreted its generated text as an unsent chat message. Reconnecting reran the same selector, so it selected the document again while that editor remained present.

- **Change:** Identify the chat composer using its `data-composer-markdown` marker and the existing `#prompt-textarea` selector. Restrict legacy ProseMirror selectors to composer containers or forms, and exclude editors inside `.writing-block-editor`. Preserve the checks that protect real unsent chat drafts and require confirmation before clearing them.

- **Verification:**
  - In the live page, the selected element had the chat-composer marker, was outside Writing, and had zero raw and normalized draft characters. The generated document remained unchanged.
  - Browser regression checks exercised the actual adapter with a Writing document before an empty chat composer. Sending used the chat composer, collected the next reply, and left the document unchanged. Modern, legacy, and form-scoped composer layouts were covered.
  - A real chat draft still blocked sending. Confirmed deletion cleared only the chat draft and preserved the document.
  - A page containing only the Writing editor reported no eligible chat composer and did not modify the document.

- **Code:** [VaultSessions/content-chatgpt.js](../VaultSessions/content-chatgpt.js) — `EDITORS`, `findEditor`, and the existing draft checks.
