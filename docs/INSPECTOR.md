# Inspector and Document Brief

Inspector is available in Debate mode. Select a connected AI and choose Inspect. The selected tab is inspected first, then the result is saved and displayed. VaultSessions shares that same report with every connected participant, including versioned maintenance guidance when that conversation has not received it. Delivery is confirmed from the official user-message DOM; no assistant reply is required or displayed. Each report is delivered at most once per conversation. Uncertain delivery is not automatically retried. Sharing failures are shown alongside the saved report and do not delete it.

The context lives in `VaultSessions/inspector-context.js`. Update its English guidance and increment `version` together. The delivery cache is separate from the connection Role and is retained in Chrome session storage.

Inspector reads the adapter's own selectors, match/visibility counts, current phase and bounded nearby DOM. It does not click controls, reload tabs or repair code. Message text, input values, link destinations and image sources are omitted from the serialized DOM. HTML is shown as text, never executed. Structural attributes are still diagnostic data: review records before sharing them externally. A snapshot may be truncated and a missing match is not proof of a cause.

Inspection records and successful discussion summaries are retained in Document Brief, oldest first. Opening the list scrolls to the latest record. Selecting a record displays it again without creating another stored copy. Copy exports the inspection JSON (including DOM fragments) or the complete summary text.

Records use the existing meeting session snapshot in `chrome.storage.session`; they survive meeting reloads and side panel/fullscreen handoffs but are cleared when Chrome exits. Up to 60 recent records are retained within a bounded text budget. Copy anything you want to keep. Clearing or summarizing the conversation does not clear the document list.

Inspection reports are explicitly delivered to all connected participants but do not enter the normal transcript or trigger automatic discussion. Summary results also stay outside subsequent AI conversation history.


## Development handoffs

In Debate mode, Create handoff sits next to Summarize discussion. It first asks one randomly selected available connected AI to identify candidate implementation, investigation, verification, technical consultation, or design-review tasks and return a bounded JSON topic list. A scrollable modal lets the user select one topic, even when only one exists. Only after selection does the same AI create an actionable document for Codex or Claude Code. It supports new applications, features, repairs, and work on other projects, as well as unresolved user questions and unexplained symptoms that need analysis. Investigation candidates do not require approval of a code change; their documents request read-only evidence gathering first and do not authorize edits or test creation. Healthy reports and successful usage reports alone do not create tasks. Explicitly deferred or cancelled tasks stay excluded until reopened. The document covers purpose, background and evidence, implementation requirements, and constraints and acceptance criteria. Confirmed decisions, proposals, and open questions must remain distinct.

The request includes displayed discussion and summaries plus saved Inspector reports from Document Brief. Previous handoffs, failed turns, and image-generation status rows are excluded. If the complete input exceeds the 20,000-character delivery limit, nothing is sent; evidence is never silently dropped. Image binaries and arbitrary local project files are not included.

An empty topic list displays a no-topics message; malformed output produces a separate error. Neither creates a document. Discovery replies stay outside the meeting log and Document Brief. Closing the selection modal cancels generation. If the chosen AI conversation changes or becomes unavailable, start again rather than silently choosing another AI. The meeting remains locked until the selection is completed or dismissed.

The final result appears in the meeting log with a copy button and is saved as a handoff in Document Brief. Creating it does not clear or replace the meeting log, start automatic discussion, or add the output to subsequent normal AI history or summary input. No code is executed. Errors leave the existing meeting and documents intact. Temporary storage and copy behavior are the same as other Document Brief records.
