# Changelog

All notable changes to Nida are documented here. The `version` in
`custom_components/nida/manifest.json` is the source of truth for the current
release; newest entry on top.

## 2.5.1 — unreleased

- **Old sound files can be cleaned up.** Local files the library no longer
  lists (renamed or dropped from a manifest, e.g. the old `_3aa52989` names)
  had no delete button. The sound library now shows a notice with a Clean up
  button; the files are moved to `<config>/nida_trash/`, not deleted. Files in
  use by a setting, the sounds shipped with Nida and anything in a folder the
  library did not answer for are never touched.
- **Refresh button animates.** The catalog refresh icon spins while loading, for
  at least one turn, so a press is always visible.

## 2.5.0 — 2026-10-13

- **Fix: the pre-adhan jingle was cut off by the spoken announcement.** The
  jingle and the TTS used to start as two separate calls with a fixed pause
  between them, and nothing waited for the jingle to end, so a long jingle (or
  any jingle with Sonos announcements on) was cut off. They are now one
  sequence: the speakers are taken over once, the jingle plays to the end, and
  only then does the TTS speak, after a fixed 2 seconds of silence counted from
  the moment the jingle really ends, so short and long jingles get the same
  gap. The jingle's exact length is read from the file when needed,
  with or without mutagen installed (for non-Sonos speakers the player is
  simply watched until it stops). Music and volume come back at the end, not
  in between.
- **Removed: "Also mute my Mac".** The Shortcuts-notification workaround for
  muting a Mac's own audio is gone from the panel and from the code. A saved
  value for it is simply ignored.
- **Music fades back in.** After the pre-adhan (and the adhan, duas and
  previews that use the same path) the music you were playing now comes back
  gradually, over the same fade length used when it fades out, instead of
  returning at full volume in one step. Follows the existing fade setting.
- **Fix: settings saves failed for everyone but the owner.** A missing import
  made the settings-access check raise an error for any non-owner user.
- **Fix: Sonos music did not come back after the jingle plus announcement.**
  Sonos speakers are now saved and restored when a spoken announcement follows
  the jingle.
- **Fix: sound lengths were never read.** The length lookup treated an mp3
  without tags as "no data", so every length came back unknown even with
  mutagen installed. That made the Sonos wait after a jingle a flat 17
  seconds, and the Android TV notification use its fallback duration instead
  of the real adhan length. Lengths are now read correctly (with a built-in
  mp3 reader as a second line).
- **Test the whole pre-adhan.** A new "Test full pre-adhan" row under
  Pre-adhan plays the jingle, the pause and the spoken announcement over the
  selected speakers, exactly as it fires before a prayer (a part that is
  switched off is skipped). It says so in the row: the ▶ buttons on the rows
  above still play on the device you are using. The speaker button stops the
  whole sequence. Also available as `nida.test_pre_adhan`.
- **Dua trigger state.** Next to the trigger entity, each dua now has a
  "fires when it turns On / Off" choice, so a dua can play when e.g. night
  mode switches off as well as on. Default stays On (existing duas unchanged).
- **Live Activity for the next prayer.** The next prayer counts down on the
  iPhone lock screen and in the Dynamic Island (and as a live update on
  Android), using the Home Assistant Companion app. It appears two hours
  before the adhan (adjustable, 15 minutes to 6 hours), changes colour for
  the last 10 minutes, says "Now" at the adhan and clears itself five minutes
  later. The card shows the prayer name and time, uses a light card for Dhuhr and
  Asr and a dark one for Fajr, Maghrib and Isha, and is
  translated into all ten panel languages. Enable it under Notifications; it
  is sent to the mobile app targets selected there. Needs iOS 17.2+, Home
  Assistant 2026.7+ and a Home Assistant Companion app that supports Live
  Activities (at the time of writing the official docs list it as a Labs
  feature in the TestFlight build).

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
