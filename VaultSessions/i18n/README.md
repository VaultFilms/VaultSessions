# VaultSessions localization

English (`en`) is the default. The selected locale is stored under `vaultsessions.locale`. Interface and meeting response languages are synchronized; existing human/AI log bodies are never translated.

## Add a language

1. Copy `en.js`, for example to `fr.js`.
2. Set its registration code to `fr`, name to `Français`, short name to `FR`, and `meetingLanguage` to `French`.
3. Translate message values. Keep keys and placeholders such as `{0}` unchanged. Missing keys fall back to English.
4. Load the catalog in `meeting.html` before `meeting.js` using `<script src="i18n/fr.js" defer></script>`.
5. Check translations and plural forms in both meeting layouts.

Plural rules in a catalog use `Intl.PluralRules`. Preserve all named placeholders when translating singular/plural variants. Legacy Japanese status strings and provider selectors are intentionally retained for compatibility with Japanese official chat interfaces. They are not AI instruction prompts.
