# Changelog

All notable changes to Nida are documented here. The `version` in
`custom_components/nida/manifest.json` is the source of truth for the current
release; newest entry on top.

## 2.5.6 — 2026-11-27

- **Security fix: settings stay within Nida.** Nida's settings commands now
  only accept Nida's own configuration entry. Before, any logged-in user could
  use them to read the settings of another integration (for some integrations
  these include credentials), and a user with access to Nida's settings could
  change them. Updating is recommended.
- **Changes made elsewhere are no longer undone.** The panel and the card sent
  their whole copy of the settings with every change, so anything changed since
  they were opened (on another device, with the visitors mode switch or select,
  by its timer or by an automation) was quietly put back. Visitors mode could
  switch itself back on this way and silence every adhan. Now only the change
  is sent, and Home Assistant merges it into the stored settings.
- **Ramadan Edition works again.** Its settings drawer still asked the panel
  for a section that no longer exists, so the edition and its preview could not
  render and the panel stopped reacting to clicks. With the edition on by
  default, this would have hit everyone at the start of Ramadan. The drawer now
  shows the same sections as the settings column, including Volume and modes,
  Other audio and the Fajr wake-up alarm, and users without settings access see
  a notice instead. Its colours now follow the theme, so the sections are
  readable in daytime and in the light variant, where the drawer showed dark
  text on dark green.
- **Escaping everywhere.** The Hijri date in the Ramadan schedule card is
  escaped like everywhere else, and so are the remaining values from the server
  in the panel (list keys, city coordinates, calendar days). The donate button
  escapes its text and only opens http(s) links.
- **Safer sound downloads.** A sound is only downloaded when its address and
  file name match an item in the sound catalog, and only as an `.mp3`.
- **Notifications only through `notify`.** Notification targets from the
  settings are only ever called as `notify.<service>`, for real notifications
  and the test button alike.
- **Smaller fixes.** A timeout from the Aladhan calendar shows an empty month
  instead of an error. City and country are URL-encoded in the lookup by name,
  so a city with a space, `&` or accent works. A language code the panel does
  not know falls back to English instead of breaking the country list.

## 2.5.5 — 2026-11-26

- **Manifest fix.** `hassio` is now listed under `after_dependencies`. Nida
  uses it, when available, to recognise an AdGuard Home or Pi-hole add-on for
  the DNS-blocker repair; Home Assistant's validation (hassfest) requires it to
  be declared. No change in behaviour.
- **Brand images in line with Home Assistant.** `brand/icon.png` is now
  256 x 256 with a 512 x 512 `icon@2x.png`, and the notification icon moved
  out of `brand/` into `images/`. Its URL (`/local/nida/brand/...`) stays the
  same.

## 2.5.4 — 2026-11-26

- **Nida jingles: jingle and announcement in one.** The Sound Library has a new
  set of pre-adhan jingles that already speak the announcement, one per
  language. The library shows only the one in your panel language (the others
  sit under "Other languages"). While one is selected, the separate spoken
  announcement (TTS) steps aside so it is never said twice; pick a regular
  jingle again and your TTS settings come back as they were. Picked in your own
  language, the jingle follows along when you change the panel language. A new
  setup now starts on the Nida jingle in your language.
- **Prayer times survive a failed start.** When Home Assistant restarts while
  the Aladhan API is briefly unreachable (a transient TLS/SNI error from its
  edge servers, or no internet yet), Nida used to lose all its sensors until
  the API came back. It now caches the last good response to disk and serves
  those times so the sensors stay available, retrying every few minutes until
  fresh times arrive. Nothing changes when the API is reachable.
- **Clear guidance when a DNS blocker is the cause.** When the API stays
  unreachable, Nida now shows a repair under Settings → Repairs explaining that
  a DNS blocker (AdGuard Home, Pi-hole) may be blocking `api.aladhan.com` (via
  its `bahriya.app` CNAME) and giving the exact allowlist rules to fix it. It
  names AdGuard Home or Pi-hole when it can detect one, and clears itself once
  the API is reachable again.
- **Prayer time in the notification.** The adhan notification can now include
  the prayer's time with a new `[time]` placeholder, so the default reads
  "It's 16:45 time for Asr prayer". Existing installs that never changed the
  message are upgraded automatically; a message you customised is left as is.
- **Cleaner notification icon.** The notification logo lost its gold border:
  it is now a clean, full-bleed mosque that masks neatly into the round icon
  on both iOS and Android. An updated brand icon now also reaches installs
  that still had the previous one, while a custom icon you placed yourself in
  `www/nida/brand/` is kept. The icon's file name now carries a version tag
  (`icon_notify-<version>.png`), so phones fetch the new icon instead of
  showing an old cached one.
- **Nida logo on the left on iOS too.** Recent Home Assistant Companion apps
  show the notification icon (`icon_url`) on the left of an iOS notification,
  just like Android. The panel now says so, and the separate "Nida logo on
  iOS" switch is gone: it only added the same logo again as a thumbnail on the
  right.
- **Panel updates show up right away.** The panel and card scripts are now
  loaded under a URL that changes with their content, so the browser and the
  Companion app no longer keep showing an older cached panel.
- **Safer rendering of outside data.** The dashboard cards and the panel now
  escape entity states and server text before showing them. The Hijri date
  comes straight from the AlAdhan API, and was placed in the page as HTML;
  it is now always shown as plain text.
- **Visitors mode as entities.** Visitors mode (mute the adhan for a
  while) can now be set from dashboards and automations, not only from
  the panel. `select.nida_visitors_mode` is a list (Off, 1 to 24 hours,
  or until you turn it off) that works well in a Bubble Card "select"
  card, and `switch.nida_visitors_mode` is a plain on/off that starts it
  with the last chosen duration. Both show the end time as an `until`
  attribute. Visitors mode now also switches itself off at its end time,
  so the panel and the entities no longer show it as on after it ran out.

## 2.5.3 — 2026-11-10

- **No more disk access on Home Assistant's event loop.** Listing old sound
  files walked the bundled sounds folder on the event loop, and the sound
  library, the random adhan pick and the sound-length lookup each checked
  files there too. All of these now run in the executor, so Home Assistant
  stays responsive on slow storage.
- **Minimum Home Assistant version is now 2024.11.** The old value (2023.1)
  was wrong: Nida already needed a newer Home Assistant to load.
- **Housekeeping.** The options dialog no longer sets its own config entry
  (deprecated in Home Assistant), and the manifest drops an unused
  dependency (`network`) and an incorrect `loggers` entry.
- **The Sound Library keeps its place.** Pressing play, download or delete on
  a sound further down the list no longer jumps the list back to the top.
- **Dashboard cards in all ten languages.** The Next Prayer and Today cards
  were English and Dutch only; they now also speak Arabic, Turkish, German,
  French, Malay, Indonesian, Urdu and Persian, following Home Assistant's
  language.
- **Missing translations filled in.** The Fajr announcement volume texts in
  the panel and the options dialog (Settings, Devices & services, Nida,
  Configure) were English-only in eight languages.
- **All code comments are now in English.** The remaining Dutch comments,
  docstrings and in-file changelogs were translated; no behaviour changes.

## 2.5.2 — 2026-11-05

- **New README.** Rewritten for the 2.x panel, with Marketplace install instructions.
- **Separate volume for the Fajr announcement.** The spoken (TTS) announcement
  before Fajr can now have its own volume, set with a slider under the TTS row
  in the panel (option `volume_tts_fajr`). Until you move it, Fajr uses the
  pre-adhan jingle volume like every other prayer, so nothing changes by default.
  The Fajr jingle uses the same level, so jingle and spoken line always match.
- **The spoken pre-adhan line follows night mode.** Night mode and the
  open-contact volume now scale the TTS announcement like they already scaled
  the jingle, so at night the two stay at the same level.
- **The Today card can be collapsed.** Tap the header (title and date) to fold the
  list down to just the next prayer, so it is as compact as the Next Prayer card
  beside it; tap again to open it. Your choice is remembered in that browser.
  The new `collapsed: true` option in the card config sets the starting state,
  and there is a switch for it in the card editor.
- **Today and Next Prayer cards fill the height they are given.** In a Sections
  view, set `grid_options: rows: N` on the card and it stretches to that height
  (the list stays at the top), so the right-hand column can end level with the
  tiles on the left. Without `rows` nothing changes.

## 2.5.1 — 2026-10-21

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
