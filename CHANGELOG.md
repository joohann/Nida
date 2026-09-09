# Changelog

All notable changes to Nida are documented here. The `version` in
`custom_components/nida/manifest.json` is the source of truth for the current
release; newest entry on top.

## 2.3.14 — 2026-09-09

First published release of the rebuilt 2.x line (the previously published
line was 1.1.x). This is a major architecture change.

- **Custom sidebar panel** holds all settings (prayer toggles, sound choice
  with audio preview, location), replacing the old config/options flow with
  nine per-prayer sound fields.
- **Single source of truth**: everything the integration needs — code,
  frontend bundle, default sounds and the sound catalog — lives inside
  `custom_components/nida/`. The release now ships `nida.zip` built from that
  directory only; the old `www/` sound and card bundling is gone.
- **Sound catalog**: only a few default sounds ship in the zip; the rest are
  listed in a JSON catalog and downloaded on demand.
- **Support the developer** button in the panel footer and welcome screen,
  with a confirmation popup, a Contact link to majikan.nl/contact-me, and the
  running integration version shown under it.
- **Show in sidebar** option (via the integration's Configure dialog) to hide
  the panel from the sidebar while keeping it reachable at `/nida`.
- Multi-language UI (English, Dutch, Arabic, Turkish, German, French, Malay,
  Indonesian, Urdu, Farsi).

Existing 1.1.x users: this is a full replacement. Review your settings in the
new panel after updating.
