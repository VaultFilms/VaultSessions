# VaultSessions localization

Initial locale is selected from an explicit `?ui=` parameter, a saved manual choice (`vaultsessions.locale.manual`), or the browser language preference list, in that order. Regional language codes match a base-language catalog when available. Unsupported languages fall back to English (`en`). Automatic initialization does not save a manual override. Older `vaultsessions.locale` values are not used for initial selection because older versions also saved automatic choices. Interface and meeting response languages are synchronized; existing human/AI log bodies are never translated.

## Add a language

1. Copy `en.js`, for example to `fr.js`.
2. Set its registration code to `fr`, name to `Français`, short name to `FR`, and `meetingLanguage` to `French`.
3. Translate message values. Keep keys and placeholders such as `{0}` unchanged. Missing keys fall back to English.
4. Load the catalog in `meeting.html` before `meeting.js` using `<script src="i18n/fr.js" defer></script>`.
5. Check translations and plural forms in both meeting layouts.

Plural rules in a catalog use `Intl.PluralRules`. Preserve all named placeholders when translating singular/plural variants. Legacy Japanese status strings and provider selectors are intentionally retained for compatibility with Japanese official chat interfaces. They are not AI instruction prompts.


## Included catalogs

| Locale | Interface label | AI response language |
| --- | --- | --- |
| en | English | English |
| ja | 日本語 | Japanese |
| fr-FR | Français (France) | French as used in France |
| de-DE | Deutsch (Deutschland) | German as used in Germany |
| es-US | Español (Estados Unidos) | Spanish as used in the United States |
| it | Italiano | Italian |
| id | Bahasa Indonesia | Indonesian |
| pt-BR | Português (Brasil) | Brazilian Portuguese |
| hi | हिन्दी | Hindi |

An exact browser locale match takes priority. A matching base language falls back to the included regional variant (for example, `es` selects `es-US`, and `pt-PT` selects the available `pt-BR`). If none of the browser preferences matches a catalog, English is used. Explicit manual choices take priority over browser detection. Contributions and request/pass counts use locale-aware plural forms where applicable. Catalogs translate interface messages, not human/AI log bodies. Normal role, discussion, and summary instructions remain English and ask for the selected response language.
