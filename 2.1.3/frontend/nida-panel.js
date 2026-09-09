/**
 * Nida panel — settings UI + companion column.
 *
 * Implements the approved design from references/design.md (mockup at
 * references/assets/panel-mockup.html): deep-emerald + gold palette, Cairo
 * headings + Inter body, two-column layout (settings 1.3fr / companion 1fr),
 * subtle 8-pointed-star lattice watermark and arabesque border motif.
 *
 * Data sources:
 *   - Settings: websocket commands nida/get_settings + nida/update_settings.
 *   - Hijri date + current/next prayer + countdown: live from sensor.nida_*
 *     entity states (see custom_components/nida/sensor.py).
 *   - Quote card + upcoming holiday card: placeholder TODO state — sources
 *     not yet decided (see references/design.md "Open items").
 *
 * i18n: own dictionary keyed by ISO 639-1 code. options.language stores
 *   "auto" (default) or an explicit code. When "auto" we follow
 *   hass.language. EN and NL are filled in; AR/TR/DE/FR/MS/ID/UR/FA are
 *   stubbed and fall back to EN until properly translated.
 *
 * Sounds: catalog.json does not exist yet, so each row shows the currently
 *   stored options.sound_<category> value with a "no catalog loaded"
 *   subtitle; play/chevron buttons are present but inactive until the
 *   catalog wiring is built.
 *
 * Changelog:
 *   2.1.3 (2026-07-08): Three fixes from Johann's review of the calendar
 *                        card: (1) .calendar-day.today now gets a solid,
 *                        theme-independent dark-green fill + ring instead
 *                        of the gold-tint that blended into the card
 *                        background ("ik zie niet wat de huidige dag
 *                        is"). (2) Overlay backdrop (.nida-overlay-portal
 *                        ::backdrop) is darker (0.55 → 0.72 alpha) and
 *                        now has a backdrop-filter: blur(4px), applies
 *                        to every popup. (3) Quote feature (rotating
 *                        Quran verse/hadith companion card) REMOVED
 *                        entirely per Johann's request: quotes.py
 *                        deleted, nida/get_quote websocket command
 *                        removed (websocket.py), "quote" dropped from
 *                        COMPANION_CARDS_DEFAULT_ORDER + renderers, all
 *                        quote_* translation keys and .quote-* CSS gone
 *                        (the .holiday-eyebrow/.holiday-explainer classes
 *                        they shared a selector with stay — the calendar
 *                        card's loading placeholder still uses them).
 *   2.1.2 (2026-07-08): Calendar month-grid companion card, replacing the
 *                        old bare "hijri" date card and the approximate
 *                        client-side "holiday" card with one Hijri
 *                        month-grid view modelled on the Nida Android
 *                        app's Calendar tab: prev/next month navigation,
 *                        event-dot day markers, an "Upcoming events" list
 *                        with countdown pills, and a tap-to-expand detail
 *                        overlay (icon, EN+AR name, Hijri+Gregorian date,
 *                        category pill, description). Backed by the new
 *                        nida/get_calendar_month websocket command
 *                        (islamic_calendar.py); event display metadata
 *                        (CALENDAR_EVENT_META: emoji/category/name/
 *                        description) lives in the panel, not the
 *                        backend, consistent with Nida's i18n split. Same
 *                        event keys as the Islamic Calendar reminders
 *                        section (2.1.0) — the grid visualises exactly
 *                        what those reminders fire for, single source of
 *                        truth. NIDA_PANEL_VERSION + manifest.json bumped
 *                        to 2.1.2 for this change (see the versioning
 *                        rule noted in the 2.1.1 entry below — bump on
 *                        every substantive panel change, not just at
 *                        explicit release requests).
 *   2.1.1 (2026-07-08): Version bump — NIDA_PANEL_VERSION and
 *                        manifest.json (2.1.0 → 2.1.1) for the Islamic
 *                        Calendar feature below, which shipped after
 *                        2.1.0's own version-bump entry further down this
 *                        log. Bumping on every panel update from now on,
 *                        not just at the end of a work session — see the
 *                        nida-ha-integration skill's release-workflow
 *                        note for the reminder (added after forgetting
 *                        this twice in one session).
 *   2.1.0 (2026-07-08): [continued] New "Islamic Calendar" section (after
 *                        Ramadan, before Setup/Backup) — four reminder
 *                        types ported from the Android app: Holidays
 *                        (with a configurable lead-time slider 0-30 days
 *                        and an optional second, closer reminder), Ashura
 *                        & Arafah fasting, White Days, Weekly Sunnah
 *                        fasting, plus a fire-time picker and its own
 *                        target list (calendar_notify_targets, separate
 *                        from the adhan/prayer notify_targets — same
 *                        target-picker pattern as Jumu'ah). Backend side:
 *                        scheduler.py/const.py/islamic_calendar.py (this
 *                        session's earlier changes). Also added as a step
 *                        in the manual setup wizard (not automatic mode —
 *                        no safe default to assume there, same reasoning
 *                        as Speakers/Jumu'ah). Also renamed the Setup
 *                        section's label to "Setup/Backup" per request —
 *                        it's always held the backup export/restore
 *                        entry points alongside the three setup modes,
 *                        the old label undersold that.
 *   2.1.0 (2026-07-08): Version bump for release — NIDA_PANEL_VERSION
 *                        (2.0.100 → 2.1.0) and manifest.json's version
 *                        (2.0.7 → 2.1.0, which had drifted well behind
 *                        what was actually running — worth a look at the
 *                        release workflow if that wasn't intentional).
 *                        Closes out the Setup/backup-export/backup-
 *                        restore/welcome-chaining/version-reset work
 *                        logged in the entries below. Backup restore
 *                        (schema version 1) stays forward-compatible
 *                        with whatever 2.1.x ships next as long as the
 *                        settings shape doesn't need a breaking change.
 *   2.1.0 (2026-07-08): [continued] Welcome reshows itself after a real
 *                        version upgrade, not just once ever. New option
 *                        last_seen_version + NIDA_PANEL_VERSION (2.1.0
 *                        note above) are compared on every load, at
 *                        major.minor granularity only — patches (this
 *                        integration ships them often) don't retrigger
 *                        it, only a minor/major bump does. On mismatch,
 *                        panel_welcome_seen resets to false, which the
 *                        existing first-visit check then picks up the
 *                        same tick, and which now also chains into Setup
 *                        (previous changelog entry). No baseline yet
 *                        (undefined last_seen_version) is treated as
 *                        "establish it silently" rather than "reset" —
 *                        covers both a genuinely fresh install (welcome
 *                        already shows on its own) and an existing
 *                        install upgrading from before this field
 *                        existed (shouldn't get a surprise popup for a
 *                        version it can't know it "missed").
 *   2.1.0 (2026-07-08): [continued] Welcome overlay now chains into Setup
 *                        on a fresh install: dismiss-welcome force-opens
 *                        the Setup accordion section (via _setOpenSection,
 *                        the same single-open-accordion mechanism the
 *                        normal accordion uses) and smooth-scrolls it
 *                        into view, instead of just closing. Doesn't pick
 *                        a mode on the user's behalf — the three entry
 *                        buttons are just immediately visible so Setup
 *                        genuinely follows Welcome rather than being
 *                        something the user has to go find. Gated on
 *                        !_hasExistingSetup() so this doesn't fire when
 *                        welcome is reshown on an already-configured
 *                        install after a version bump (task: last_seen_
 *                        version tracking) — nobody asked to reconfigure
 *                        there.
 *   2.1.0 (2026-07-08): [continued] Backup restore: the "Backup herstellen"
 *                        setup option is a real file picker now, not a
 *                        placeholder. Reads the chosen file with
 *                        file.text(), JSON.parse()s it, and validates it
 *                        has a settings object and nida_backup_version
 *                        === 1 (the only schema version that exists so
 *                        far — anything else is rejected rather than
 *                        guessed at) before showing a preview (export
 *                        date + source version) and enabling Restore.
 *                        Applying just calls the existing _saveSettings
 *                        with the backup's settings object — same
 *                        websocket command every other save already
 *                        uses, nothing backup-specific on the backend.
 *                        Parsed/errored file state resets both when the
 *                        restore dialog is (re)opened and when any
 *                        overlay closes, so a stale file from a previous
 *                        attempt never leaks into the next visit.
 *   2.1.0 (2026-07-08): [continued] Backup export: a small link under the
 *                        three Setup entry buttons downloads the current
 *                        settings (this._settings — already the complete
 *                        options object, no new backend command needed)
 *                        as a JSON file, wrapped in an envelope with a
 *                        nida_backup_version schema tag (for restore in
 *                        task 5 to check compatibility against) and the
 *                        panel version. Also introduces NIDA_PANEL_VERSION
 *                        as the single source of truth for the version
 *                        string shown in the footer — previously a
 *                        hardcoded literal there, now one constant to
 *                        bump at release time instead of two.
 *   2.1.0 (2026-07-08): [continued] Automatic-mode setup wizard now has
 *                        its own reduced step content instead of reusing
 *                        the manual step list as a placeholder: Location
 *                        only confirms the calculation method (location
 *                        itself follows the device — _applySetupAutoDefaults
 *                        sets location_mode: "device" and every
 *                        enabled_<prayer> to true the moment auto mode
 *                        starts); Prayers collapses to one pre-adhan
 *                        yes/no that applies fixed defaults (20 min +
 *                        5 min reminders, jingle + TTS both on) instead
 *                        of exposing the sliders; Notifications collapses
 *                        the 5 per-prayer "critical" toggles (existing
 *                        DND-bypass mechanism — turns out this was
 *                        already built, not a gap) into one bulk toggle.
 *                        Sounds/Sound Modes/Dua are skipped entirely
 *                        (bundled-default sounds apply as-is). Speakers
 *                        and Jumu'ah are unchanged from manual mode — full
 *                        questions, no safe default to assume there. Also
 *                        fixed a state bug from the first wizard-engine
 *                        change: opening a sub-overlay from inside a
 *                        wizard step (method picker, speakers picker, TTS
 *                        settings, ...) was silently kicking the user back
 *                        to the normal settings view on close, because
 *                        wizard visibility and sub-overlay visibility both
 *                        lived in the same _activeOverlay slot. Wizard
 *                        visibility now has its own flag
 *                        (_setupWizardActive), independent of whatever
 *                        sub-overlay _activeOverlay currently points at.
 *   2.1.0 (2026-07-08): [continued] Manual-mode setup wizard now has real
 *                        step content: it walks Location → Prayers →
 *                        Speakers → Sounds → Sound Modes → Dua →
 *                        Notifications → Jumu'ah (every section except
 *                        Setup/Ramadan), one at a time, with Back/Next
 *                        and a step counter. Each step reuses the exact
 *                        same section renderer as the normal accordion —
 *                        same data-input/data-action wiring, so fields
 *                        still auto-save as the user edits them; the
 *                        wizard adds guided navigation on top, nothing
 *                        more. Renders inline inside col-settings rather
 *                        than in the overlay portal, because the reused
 *                        section markup depends on .card/.toggle/
 *                        .select-field styling that only exists in the
 *                        shadow-DOM stylesheet, not the portal's — and
 *                        because col-settings content is never
 *                        position:fixed, this sidesteps the transform-
 *                        ancestor bug the portal exists to work around.
 *                        Automatic-mode's reduced/defaulted flow and the
 *                        backup-restore mode are still follow-up changes;
 *                        automatic currently reuses the manual step list
 *                        as a placeholder.
 *   2.1.0 (2026-07-08): New Setup section (last item in the settings
 *                        column, after Ramadan) — lets the user re-run
 *                        first-use setup at any time via three entry
 *                        modes: manual, automatic, or restore backup.
 *                        Clicking an entry mode opens a confirm overlay
 *                        first if the install already looks configured
 *                        (has a stored location), to avoid accidentally
 *                        overwriting a working config. This change adds
 *                        the section, the mode-picker buttons, the
 *                        confirm overlay and a wizard-overlay shell only
 *                        — actual per-mode step content (manual: every
 *                        section except Setup/Ramadan; automatic: reduced
 *                        flow with defaults) lands in follow-up changes.
 *   2.0.100 (2026-07-08): Samsung auto-detect for the TTS-workaround
 *                        (see websocket.py 2.0.100's new `manufacturer`
 *                        field on nida/list_notify_services). Two
 *                        changes: (1) the notify-targets overlay label
 *                        now shows "<service> · <manufacturer>" when
 *                        known, so a Samsung target is identifiable at
 *                        a glance instead of guessing from the service
 *                        name; (2) _toggleNotifyTarget pre-checks
 *                        notify_tts_workaround_targets automatically
 *                        the moment a detected-Samsung target is newly
 *                        selected as a notify target — only on add,
 *                        never overriding a choice already made either
 *                        way, and the triangle toggle stays fully
 *                        overridable afterwards. Goal: other HACS users
 *                        get this working without the multi-session
 *                        debugging it took to nail down here.
 *   2.0.99 (2026-07-08): FIXED: --nida-critical / --nida-critical-soft
 *                        were only ever declared inside the shadow-DOM
 *                        :host block, never re-declared for
 *                        .nida-overlay-portal (the <dialog> portaled to
 *                        document.body for overlays — see the 2.0.9
 *                        comment on why overlays live outside the shadow
 *                        root). Any var(--nida-critical) reference
 *                        inside the portal was therefore invalid,
 *                        silently falling back to the plain
 *                        --nida-border colour in BOTH the on and off
 *                        state of .toggle-mini.critical — which is
 *                        exactly why the new TTS-workaround toggle
 *                        (2.0.95, in the notify-targets overlay) looked
 *                        identical regardless of state ("groene rand"
 *                        either way, per the light theme's pale
 *                        --nida-border). Added the same theme-
 *                        independent red to the portal's base rule.
 *   2.0.98 (2026-07-08): Footer version string is no longer left stale —
 *                        bumping it on every change from now on (it was
 *                        stuck at "Nida 2.0.91" through several real
 *                        fixes, which cost real debugging time working
 *                        out whether a browser was even running the new
 *                        JS). Also added, then removed again once root-
 *                        caused, temporary console/log diagnostics for
 *                        the TTS-workaround toggle (turned out to be
 *                        working correctly all along — see the
 *                        2.0.95/2.0.97 conversation, the confusion was
 *                        two clicks netting back to the original state,
 *                        not a bug).
 *   2.0.97 (2026-07-08): _onTestNotifyPrayer / _onTestNotify / _onTestJumuah
 *                        now send `entry_id: this._entryId` with every
 *                        nida/test_notify + nida/test_jumuah call.
 *                        Root cause of the TTS-workaround toggle (2.0.95)
 *                        never taking effect: the backend commands read
 *                        the FIRST Nida config entry instead of the one
 *                        this panel session edits, so with more than one
 *                        entry present, saved settings and test results
 *                        pointed at two different entries. See
 *                        websocket.py 2.0.97 for the backend half.
 *   2.0.95 (2026-07-08): Per-target "spoken alert" toggle in the notify-
 *                        targets overlay (Samsung silent-mode workaround,
 *                        see scheduler.py 2.0.95). Only shown next to
 *                        targets already selected as a notify target;
 *                        reuses the existing .toggle-mini/.critical
 *                        visual (same icon-button as the per-prayer
 *                        critical flag) rather than inventing new
 *                        styling. _htmlOverlayList gained an optional
 *                        `secondary` config so this doesn't touch any of
 *                        the other 5 lists (speakers, jumuah-targets,
 *                        country, language, contact sensors) that reuse
 *                        the same renderer — passing nothing keeps their
 *                        markup byte-for-byte the same. New getter/
 *                        setter pair (_notifyTtsWorkaroundIds /
 *                        _toggleNotifyTtsWorkaround) mirror the existing
 *                        _notifyTargetIds pattern; persisted under
 *                        options.notify_tts_workaround_targets
 *                        (const.py).
 *   2.0.92 (2026-07-08): .app-bg (the landscape illustration layer) got a
 *                        bottom mask-image fade to transparent instead of
 *                        stopping dead at its 100vh height, which read as a
 *                        hard line where the flat --nida-bg colour took
 *                        over. Purely a mask on the decorative layer, no
 *                        content/scroll changes.
 *   2.0.91 (2026-07-07): Per-prayer test button. 2.0.90 made critical
 *                        per-prayer but left only the one blanket "Send
 *                        test notification" button at the bottom — no
 *                        way to actually verify a SPECIFIC prayer's
 *                        critical setting on a muted phone before
 *                        trusting it. Each per-prayer row now also gets
 *                        a small play-icon test button (visible whenever
 *                        the row's own toggles are, i.e. that prayer's
 *                        notification is on), disabled when no targets
 *                        are configured. Tap sends nida/test_notify with
 *                        {prayer: <id>} over the same websocket path as
 *                        the existing test button (_onTestNotifyPrayer /
 *                        new _runIconTest, a compact sibling of _runTest
 *                        for icon-only buttons: no room for text, so it
 *                        flashes gold/red via .test-success/.test-error
 *                        instead). The backend for nida/test_notify
 *                        lives outside the three files handed over so
 *                        far (services.py / scheduler.py / const.py all
 *                        checked — it's a websocket command, presumably
 *                        in a websocket.py that hasn't been shared);
 *                        this commit is FRONTEND ONLY. For the button to
 *                        do anything useful, that handler needs to (1)
 *                        accept an optional `prayer` param and (2) when
 *                        present, resolve that prayer's own message +
 *                        notify_critical_enabled_<prayer> and reuse
 *                        scheduler.py's _critical_notify_data — ideally
 *                        that helper moves somewhere shared so both
 *                        scheduler.py and the websocket handler call the
 *                        same code, rather than the test path
 *                        reimplementing the critical payload separately
 *                        and risking drift. New i18n
 *                        test_notify_prayer_tooltip (EN + NL). Footer
 *                        2.0.91.
 *   2.0.90 (2026-07-07): Critical notifications made per-prayer, replacing
 *                        2.0.89's single master toggle — "critical" is
 *                        clearly a per-prayer choice (e.g. Fajr yes, the
 *                        rest no), not an all-or-nothing switch. The
 *                        master toggle row and its options.
 *                        notify_critical_enabled key are gone. In their
 *                        place: each per-prayer row in the "Per-prayer
 *                        notifications" list now shows a small square
 *                        icon-toggle (warning-triangle glyph) next to
 *                        the existing on/off toggle — visible only while
 *                        that prayer's own notification is on, since
 *                        "critical" is meaningless for a prayer that
 *                        isn't notifying at all. Backed by new per-
 *                        prayer keys options.notify_critical_enabled_
 *                        <prayer> (_isNotifyCriticalFor /
 *                        _onToggleNotifyCriticalPrayer, action
 *                        toggle-notify-critical-prayer). A one-line hint
 *                        under the subsection header explains what the
 *                        icon does (new i18n notify_critical_sub,
 *                        reworded for the per-prayer framing; the old
 *                        notify_critical_label is now the icon's title-
 *                        attribute tooltip, "Critical"/"Kritiek"). New
 *                        ICONS.alertTriangle. Styling carries over from
 *                        2.0.89: --nida-critical / --nida-critical-soft
 *                        stay theme-independent red, now applied to
 *                        .toggle-mini.critical.on instead of the removed
 *                        .toggle.critical.on. Footer 2.0.90.
 *   2.0.89 (2026-07-07): Critical notifications toggle. New row in the
 *                        Notifications section, between the master "Send
 *                        notifications" toggle and the target picker:
 *                        "Critical notifications" (options.
 *                        notify_critical_enabled), applying to whichever
 *                        targets are already selected — no separate
 *                        target list, iOS and Android alike. What
 *                        "critical" means differs per platform and is a
 *                        backend/service concern (iOS: requires Apple's
 *                        critical-alert entitlement, sent via
 *                        interruption-level: critical; Android: high-
 *                        priority channel that can bypass Do Not Disturb
 *                        if the user's device settings allow it) — this
 *                        panel only exposes the on/off switch and stores
 *                        the flag; wiring it into the actual notify.*
 *                        payload is a services.py change, not done here.
 *                        Styling: this ONE row uses a new red toggle
 *                        variant (.toggle.critical, --nida-critical /
 *                        --nida-critical-soft, theme-independent so it
 *                        reads as "urgent" the same way in light/dark/
 *                        Ramadan) instead of the usual gold/green "on"
 *                        state — deliberately not applied to any other
 *                        toggle in the panel, so the rest of the UI
 *                        doesn't start looking like a wall of warnings.
 *                        New i18n keys notify_critical_label/_sub (EN +
 *                        NL). SUPERSEDED by 2.0.90 (master toggle → per-
 *                        prayer). Footer 2.0.89.
 *   2.0.88 (2026-07-07): Ramadan edition, part 2 — widgets + dual variant.
 *                        (1) The single "ramadan" theme is split into
 *                        "ramadan-dark" and "ramadan-light". Auto-activation
 *                        on Hijri month 9 stays, but now resolves the
 *                        variant from the stored base preference (light →
 *                        ramadan-light, dark → ramadan-dark, auto → OS
 *                        prefers-color-scheme). URL override accepts all
 *                        four values (?theme=ramadan-dark|ramadan-light|
 *                        light|dark; legacy "ramadan" maps to ramadan-dark).
 *                        The override is a testing aid only and is not
 *                        surfaced anywhere in the UI. It is read from the
 *                        query string, then a #theme= hash fallback, then
 *                        (when the panel is registered with embed_iframe,
 *                        where the element's own URL never carries the
 *                        typed query) the top window's URL. Verified in a
 *                        jsdom harness across all four values, the legacy
 *                        alias, the hash form and the iframe case. (2) ramadan-dark
 *                        swaps the 2.0.86 hand-drawn SVG hero for an
 *                        embedded photorealistic night scene (WebP, 17 KB:
 *                        crescent, palms, lit mosque, valley lights) with
 *                        a left-side scrim for text legibility; ramadan-
 *                        light gets its own watercolor daylight hero
 *                        (WebP, 38 KB) on the cream/sage palette with gold
 *                        Ramadan accents. Portal palettes for both. (3)
 *                        Now-card, Ramadan only: "Until Iftar" line under
 *                        the countdown when Maghrib is next ("Until
 *                        <prayer>" otherwise), an Iftar block (icon +
 *                        "Iftar time / Break your fast") while Maghrib is
 *                        next, and a LAST PRAYER mini-block (name + time)
 *                        replacing the current-prayer sub-line. (4)
 *                        Today-card, Ramadan only: Imsak row on top
 *                        (crescent glyph, past-check treatment) and an
 *                        "Iftar in X m" tag on the Maghrib row while it
 *                        is next, ticking per minute. (5) Imsak comes from
 *                        the new sensor.nida_imsak (Aladhan Imsak field;
 *                        backend change ships separately) minus a user
 *                        offset: new always-visible Ramadan section with
 *                        an "Imsak offset" slider (0-60 min earlier,
 *                        default 0, options.imsak_offset_min) for people
 *                        who need preparation time before suhoor. The row
 *                        hides gracefully while the sensor doesn't exist
 *                        yet. Footer 2.0.88.
 *   2.0.86 (2026-07-05): Ramadan edition (theme only, no widgets). A fourth
 *                        theme, "ramadan", auto-activates whenever the live
 *                        Hijri month is 9 (Ramaḍān) and reverts on its own
 *                        on the 1st of Shawwāl; it is not a manual step in
 *                        the dark/light/auto cycle. (1) _currentTheme()
 *                        short-circuits to "ramadan" via _currentHijri()
 *                        (falls back to the stored base theme until sensors
 *                        load). (2) _onCycleTheme() now cycles the stored
 *                        base preference rather than _currentTheme(), so the
 *                        forced "ramadan" value can't corrupt the cycle.
 *                        (3) During Ramadan the header theme pill is a
 *                        static badge (crescent + "Ramadan"), not a cycle
 *                        button. (4) New :host(.theme-ramadan) and the
 *                        matching portal palette: deep-emerald + gold from
 *                        the approved mockup legend (bg #08140F, surface
 *                        #11241B, green #36D98A countdown, gold #C9A227
 *                        accent). (5) Bespoke emerald night hero
 *                        (--img-heroramadan): crescent, hanging lantern,
 *                        mosque silhouette over a warm horizon glow, palms,
 *                        stars. Dark and light themes untouched. Footer 2.0.86.
 *   2.0.85 (2026-07-05): Mute button, both themes. Light lightened further
 *                        (fill 0.6->0.45, glyph 0.7->0.55). Dark now gets
 *                        the same soft treatment (no ring, translucent) but
 *                        in purple, the dark accent: fill
 *                        rgba(124,92,255,0.18), glyph rgba(124,92,255,0.8),
 *                        and right-aligned to the countdown edge (was the
 *                        old grey disc at right:12px with a ring).
 *   2.0.84 (2026-07-05): Light-theme mute button softened. Dropped the
 *                        ring (--nida-mute-border: none) and made both the
 *                        fill and the glyph translucent: fill
 *                        rgba(221,232,207,0.6), glyph rgba(78,110,59,0.7).
 *                        Light/auto only; dark defaults unchanged.
 *   2.0.83 (2026-07-05): Light-theme mute button restyle (now-card). The
 *                        silent-mode button was a grey disc with a pale
 *                        ring and muted glyph, sitting 16px past the
 *                        countdown's right edge. In the light theme it is
 *                        now a soft-green fill (--nida-surface-raised) with
 *                        a darker-green ring and glyph (--nida-gold-bright,
 *                        matching the countdown colour), right-aligned to
 *                        the REMAINING/countdown edge (right: 28px = card
 *                        padding). Done purely via new theme vars
 *                        (--nida-mute-bg / -border / -icon / -right) whose
 *                        :host defaults reproduce the old dark styling
 *                        exactly, so the dark theme is untouched. The
 *                        .active (silent-on) state is unchanged.
 *   2.0.82 (2026-07-05): Two fixes to the settings column.
 *                        (1) Background no longer shifts when a section
 *                        expands. The landscape illustration, star field
 *                        and lattice watermark were painted on .app, which
 *                        grows taller as sections open; cover-sizing then
 *                        rescaled the illustration and the percent-placed
 *                        stars redistributed, so the whole backdrop moved
 *                        (light and dark). Moved all three onto fixed
 *                        100vh top-anchored decoration layers: a new
 *                        .app-bg carries the illustration behind the
 *                        content, pattern-overlay + sky-decor sit above
 *                        it, and content was raised to z-index 1 so the
 *                        illustration stays behind it while the faint
 *                        overlays stay on top. Page growth no longer
 *                        touches any of them.
 *                        (2) Sections are now a single-open accordion:
 *                        opening one collapses the rest. Replaced the
 *                        per-section nida_collapsed_<id> flags with one
 *                        nida_open_section key holding the id of the open
 *                        section (empty = all closed), enforced at render
 *                        (_isSectionCollapsed) and on toggle (close the
 *                        others). Old per-section keys are now ignored.
 *                        Footer bumped to 2.0.82. No backend change.
 *   2.0.81 (2026-07-05): Silent-mode mute button polish on the now-card.
 *                        (1) The mute glyph was invisible: its SVG uses
 *                        fill:none with no stroke, and .now-mute-btn svg
 *                        never set one, so nothing drew. Added
 *                        stroke: currentColor (matching how every other
 *                        icon is coloured via CSS). (2) Button shrunk from
 *                        32px to 26px and moved lower/tighter into the
 *                        corner (bottom 14->10px, right 14->12px) so it no
 *                        longer crowds the countdown. (3) Popup note now
 *                        states that both the adhan and the pre-adhan
 *                        announcement are silenced (guest mode suppresses
 *                        both scheduled sounds at fire time; the pray
 *                        notification still comes through), EN + NL, and
 *                        dropped the em-dash. (4) Footer version, which was
 *                        stale at 2.0.78, bumped to 2.0.81. No backend
 *                        change; still the guest_mode_* keys under the hood.
 *   2.0.80 (2026-07-05): Guest-mode tile + banner removed from the
 *                        companion column entirely. In its place: a small
 *                        mute button, bottom-right of the now-card (the
 *                        "next prayer" hero tile), that opens a popup
 *                        asking how long silent mode should last (hour
 *                        dropdown: 1/2/3/4/6/8/12/24) and stating that
 *                        prayer notifications still come through — only
 *                        the adhan sound is muted. Confirm/turn-off
 *                        buttons in the popup; the button lights up gold
 *                        while active. Same guest_mode_* settings keys
 *                        under the hood, so no backend change. Dropped
 *                        the now-unused i18n keys (guest_mode_label/sub/
 *                        hours_label, guest_banner_title/action) and the
 *                        orphaned Sound-Modes guest-block-active CSS left
 *                        over from before 2.0.71.
 *   2.0.79 (2026-07-05): Sky decoration added behind the interface (dark
 *                        theme only, hidden in light via
 *                        --nida-sky-opacity: 0). 20 hand-placed twinkling
 *                        stars (fixed positions/timings, not Math.random,
 *                        so the field doesn't reshuffle on re-render) plus
 *                        3 very faint, slowly drifting blurred-circle
 *                        "clouds". Pure CSS animation (nida-twinkle,
 *                        nida-drift); silenced by the existing
 *                        prefers-reduced-motion rule. Purely decorative
 *                        (.sky-decor is aria-hidden), sits at z-index 0
 *                        alongside .pattern-overlay.
 *   2.0.78 (2026-07-05): Dark theme redesigned to the "Dark Premium" night
 *                        spec (light theme untouched). New palette: midnight
 *                        #081326 bg, #111D39 / #18254A cards, soft-purple
 *                        #7C5CFF accent (icons), warm-gold #F6C24A highlight,
 *                        white #F8F8FA / #B9BED4 text, subtle white dividers.
 *                        Hero gets a layered night scene (crescent, horizon
 *                        glow, mosque skyline silhouette) as an inline-SVG
 *                        card background with a soft purple ring; the page
 *                        background carries a faint star field (pattern
 *                        overlay). Current prayer now shows a gold outline +
 *                        soft gold glow (via --nida-next-* vars; light keeps
 *                        its green bar through the fallbacks). Cards get soft
 *                        floating shadows and 20px radius. First pass;
 *                        glassmorphism + hover polish to follow.
 *   2.0.77 (2026-07-05): Cleanup, no visual change. Removed ~132KB of dead
 *                        weight: the three unused embedded WebP assets from
 *                        earlier iterations (the boxed hero crop + the two
 *                        leaf cut-outs, all superseded by the single --img-
 *                        appbg illustration) and their now-constant toggle
 *                        vars (--nida-now-mosque, --nida-now-pad-left,
 *                        --nida-leaf-l/r) with the CSS that referenced them.
 *                        File ~495KB -> ~362KB.
 *   2.0.76 (2026-07-05): Fix: the light-theme background vanished in HA
 *                        because background-attachment: fixed renders blank
 *                        in the panel context. Removed fixed from both the
 *                        :host illustration and the pattern overlay; the
 *                        illustration now uses plain cover on :host, which
 *                        still spans the full width (no seam) and fills the
 *                        background at any size without the fixed trick.
 *   2.0.75 (2026-07-05): Responsive fixes for the light-theme background.
 *                        (1) The page illustration is now viewport-anchored
 *                        (background-attachment: fixed, size cover, left
 *                        bottom) so it fills a consistent ~25-35% of the
 *                        visible screen at any size, instead of collapsing
 *                        to a ~7% strip on tall/narrow (stacked) layouts;
 *                        left-bottom keeps the mosque in frame when narrow
 *                        crops the sides. (2) Phones (<=520px): the hero row
 *                        stacks the name above the countdown so neither is
 *                        squeezed. Column stacking (<=900px) unchanged.
 *                        (3) The illustration + geometric pattern moved from
 *                        the centred .app to :host / fixed so they span the
 *                        full panel width: no hard vertical seam at the
 *                        1180px content edge, the background flows edge to
 *                        edge and blends softly into the ivory margins.
 *   2.0.74 (2026-07-05): Light theme reworked to a "premium illustration
 *                        behind the interface" model per the updated design
 *                        system; dark unchanged. (1) The landscape
 *                        illustration is now the full-page background of
 *                        .app (light only): full width, anchored bottom so
 *                        the mosque sits lower-left and the ivory sky blends
 *                        softly into --nida-bg with no hard edge, instead of
 *                        being boxed inside the hero card. (2) Palette
 *                        updated to the new spec (bg #FAFAF2, primary
 *                        #5B7F46, accent #DDE8CF, text #243024, muted
 *                        #6D7568, border #E7EBD9); pop green #4E6E3B keeps
 *                        AA. (3) Cards: 24px radius, white, soft shadow
 *                        rgba(0,0,0,0.06), roomier padding. (4) Hero is now
 *                        a clean card (mosque removed from it); the separate
 *                        leaf cut-outs are gone since the corners live in
 *                        the page illustration. (5) Geometric star overlay
 *                        dropped to 2% (the illustration carries texture).
 *                        Display type stays Manrope (Cairo in dark).
 *   2.0.73 (2026-07-04): Light theme redesigned to the "premium prayer
 *                        companion" spec (Scandinavian, calm, natural
 *                        green); dark theme unchanged. (1) Exact palette:
 *                        bg #FAFAF2, surface #FFFFFF, primary #5B7F46,
 *                        accent #DDE8CF, text #243024; muted nudged to
 *                        #6D7568 and pop green to #4E6E3B so every text
 *                        pair clears WCAG 2.2 AA (>=4.5:1). (2) Hero uses
 *                        the design's landscape illustration (WebP) as the
 *                        hero-card background; text reflows over the sunlit
 *                        side and the last-prayer line moved under the
 *                        name. (3) Rounded 20px, soft card shadows, ambient green glow behind
 *                        the hero, geometric star pattern recoloured green
 *                        at 4%, botanical corners lifted from the design
 *                        (WebP). (5) Display type switched to Manrope in
 *                        the light theme (Cairo retained in dark) via a
 *                        --nida-display-font token, matching the brief's
 *                        modern-sans direction; body stays Inter.
 *                        (4) Today rows: completed prayers show a green
 *                        check-ring, others the sun/moon glyph. All
 *                        decoration is theme-var gated; assets embedded
 *                        once in :host. Supersedes the 2.0.72 watercolor
 *                        approach (never released).
 *   2.0.72 (2026-07-04): Visual redesign of the light theme to the
 *                        warm-cream + sage-green mockup (dark theme
 *                        untouched). (1) Light palette reskinned: cream
 *                        bg, white surfaces, green accents replacing gold
 *                        (tokens keep their --nida-gold* names, hold green
 *                        values); text-dim tuned to #6D7568 for WCAG 2.2
 *                        AA (>=4.5:1 on cream and white). (2) Per-prayer
 *                        sun/moon glyphs before each today-card row name;
 *                        decorative (aria-hidden), state also carried by
 *                        the existing check and highlight so it never
 *                        relies on colour alone. (3) Watercolor mosque
 *                        (WebP) as the now-card background in the light
 *                        theme, replacing the gold emoji tile; countdown
 *                        and eyebrow labels recoloured; header lattice
 *                        motif hidden in light. (4) Botanical leaf
 *                        artwork (WebP) in the bottom corners of both
 *                        columns, light theme only. (5) Brand mark gets an
 *                        accent rim + soft lift; header pills get a firmer
 *                        rim. All decorations are theme-var gated so dark
 *                        stays flat; assets embedded once in :host.
 *   2.0.71 (2026-07-04): Four UI improvements. (1) Guest mode moved
 *                        from Sound Modes to a companion-column card
 *                        (id "guest", default between now and today)
 *                        with toggle, slider and status, red accent
 *                        when active. (2) Dua name shows the catalog
 *                        display name ("Sleep") not the internal id;
 *                        underscores replaced by spaces. (3) Play/stop
 *                        is one toggle button tracking _duaPlaying
 *                        state. (4) Notification title field removed
 *                        from the GUI entirely (backend sends
 *                        "🕌 Nida²" unconditionally).
 *   2.0.70 (2026-07-04): Five UI/backend fixes. (1) TTS volume: the
 *                        backend now sets speaker volume before the
 *                        tts.speak call (jingle vol for scheduled, test
 *                        vol for test button). (2) Pre-adhan section
 *                        hides timing/active/test rows when both
 *                        jingle and TTS are off. (3) Missing i18n keys
 *                        dua_trigger_label, dua_no_trigger,
 *                        dua_trigger_sub added to EN + NL (were in the
 *                        template but never in the dictionaries).
 *                        (4) Notification title fixed to "🕌 Nida²",
 *                        no longer editable. (5) Default title updated
 *                        to include the superscript ².
 *   2.0.69 (2026-07-04): Random adhan moved into the Sound Library. The
 *                        toggle row in the Sounds/Adhan group is
 *                        replaced by a "Random" pseudo-entry (with
 *                        dice emoji) at the top of the fajr_adhan and
 *                        adhan lists in the library overlay. Selecting
 *                        it sets random_adhan_enabled; selecting any
 *                        specific adhan clears it. The sound rows
 *                        still show the gold italic subtitle when
 *                        random is active, just without the
 *                        "this choice is the fallback" suffix.
 *   2.0.68 (2026-07-04): Softer fard reminder. The prayers_note text is
 *                        rewritten as a gentle du'a-style reminder
 *                        instead of a strict doctrinal statement, in
 *                        both EN and NL. Companion: __init__.py 2.0.68
 *                        adds settings backup/restore.
 *   2.0.67 (2026-07-04): No panel changes — companion release for the
 *                        __init__.py device "Configure" button
 *                        (configuration_url). Footer bump only.
 *   2.0.66 (2026-07-04): Welcome overlay scroll fix. On mobile the
 *                        welcome panel was taller than the viewport:
 *                        scrolling leaked to the background and the CTA
 *                        was unreachable. The overlay container is now
 *                        overflow-y auto with overscroll-behavior
 *                        contain, the welcome panel removes max-height
 *                        and scrolls internally, align-items switches
 *                        to flex-start via :has(.welcome-panel) so the
 *                        panel can scroll past the top, and a 600px
 *                        media query tightens padding and centres the
 *                        text/feature list on narrow screens.
 *   2.0.65 (2026-07-04): Layout polish. (1) Settings sections default
 *                        to collapsed on a fresh visit — the polarity
 *                        of the localStorage key is inverted (missing
 *                        key = closed, "0" = open). Existing users who
 *                        already have keys get a one-time visual reset
 *                        which self-corrects as they reopen sections.
 *                        (2) Companion column top padding reduced from
 *                        69px to 28px so the first card aligns with
 *                        the first section icon ("balletje") instead of
 *                        floating below it.
 *   2.0.64 (2026-07-04): Quote card goes live. Rotating Quran verse /
 *                        hadith (alternating every 4h slot, same slot
 *                        model as quotes.py backend) fetched via the
 *                        new nida/get_quote websocket command in the
 *                        panel language. Short Arabic shown above the
 *                        translation, reference bottom-right in gold;
 *                        slot flips refetch via the live tick. i18n:
 *                        quote_todo_* replaced by quote_eyebrow,
 *                        quote_error, quote_kind_quran,
 *                        quote_kind_hadith (EN + NL). Companion files:
 *                        quotes.py (new) + websocket.py 2.0.64.
 *   2.0.63 (2026-07-04): Country can be cleared again. The country
 *                        overlay gets a "Clear country" entry at the
 *                        top (shown only while a country is set) that
 *                        saves country: "" — the row falls back to its
 *                        placeholder and the city search goes back to
 *                        worldwide. New i18n key country_clear (EN +
 *                        NL).
 *   2.0.62 (2026-07-04): Today card in the companion column. New
 *                        draggable card (id "today", default between
 *                        the now-card and the quote placeholder) that
 *                        lists all five prayers of today: past prayers
 *                        dimmed with a gold check, the next prayer
 *                        highlighted with a gold left bar + compact
 *                        remaining time (live per tick), footer shows
 *                        when the prayer sensors last received fresh
 *                        times (newest last_updated across the five —
 *                        no backend change). A next-prayer flip
 *                        triggers one full re-render (cached, same
 *                        pattern as the guest flip). New i18n keys
 *                        today_card_title, today_last_updated,
 *                        today_remaining (EN + NL); new refresh icon.
 *   2.0.61 (2026-07-03): Dua triggers in the panel. Each dua row gains a
 *                        Trigger select (door/window/opening/garage,
 *                        motion/occupancy/presence binary_sensors, all
 *                        switches and input_booleans, read from HA
 *                        state) writing trigger_entity on the dua;
 *                        handled by the delegated change listener. The
 *                        backend (__init__.py 2.0.61) plays the dua on
 *                        the entity's transition to on/open, max once
 *                        per minute per dua. New i18n keys
 *                        dua_trigger_label, dua_no_trigger,
 *                        dua_trigger_sub (EN + NL).
 *   2.0.60 (2026-07-03): Dua stop button. A second round button next to
 *                        play calls media_player.media_stop on the
 *                        dua's own player (stateless — harmless when
 *                        nothing plays). New i18n key dua_stop (EN +
 *                        NL). Companion release next to __init__.py
 *                        2.0.60, which stops dua add/remove from
 *                        reloading the whole entry (the panel-crash
 *                        cause).
 *   2.0.59 (2026-07-03): Dua playback unblocked + round play button.
 *                        (1) The dua media-player select is now handled
 *                        by a delegated change listener on the shadow
 *                        root (same fix as 2.0.58 did for the TTS
 *                        language select) — the per-element wiring
 *                        never fired on the affected browser, so
 *                        media_player stayed empty and play_dua
 *                        silently refused. (2) The dua Play action is
 *                        now the same round icon button as the sound
 *                        rows, rendered inert (dimmed, no pointer)
 *                        while the dua has no media player, with the
 *                        no-player hint as tooltip. (3) _onDuaPlay
 *                        guards and logs, so a refused play is visible
 *                        in the console instead of looking dead.
 *   2.0.58 (2026-07-03): TTS language select wired via delegation. The
 *                        per-element change listener never fired on at
 *                        least one browser (empty console with the
 *                        2.0.57 tracing), so the language was never
 *                        saved and TTS kept the panel language. The
 *                        select is now handled by a delegated change
 *                        listener on the overlay portal (same pattern
 *                        as clicks), which survives re-renders by
 *                        construction; the per-element wiring is
 *                        removed. Delegation logs its catch.
 *   2.0.57 (2026-07-03): TTS reset hardening. Reset-to-default now reads
 *                        the language straight from the dropdown as
 *                        rendered (live DOM value) instead of stored
 *                        settings, so the written sentence always
 *                        matches what the user sees, immune to save
 *                        races. Language change and reset both log
 *                        their decision (old/new code, default match,
 *                        written patch) to the browser console.
 *   2.0.56 (2026-07-03): TTS default message follows the language. The
 *                        message input's placeholder now shows the
 *                        default sentence of the effective TTS language,
 *                        the hint explains the auto-follow behaviour
 *                        (new key tts_msg_hint_full), and a "Reset to
 *                        default" button (tts_reset_default) writes that
 *                        sentence verbatim so exact-match detection and
 *                        auto-switching re-engage after customisation.
 *                        Backend counterpart: DEFAULT_TTS_MESSAGES in
 *                        const.py + _resolve_tts_message in services.py.
 *   2.0.55 (2026-07-03): Random adhan reflected on the sound rows. While
 *                        random_adhan_enabled is on, the Fajr adhan and
 *                        Adhan rows no longer show the fixed sound name
 *                        (which will not necessarily play) but a gold
 *                        italic note that a random downloaded adhan
 *                        plays and the fixed choice is only the
 *                        fallback. New i18n key sound_row_random_sub
 *                        (EN + NL). Toggling refreshes the rows via the
 *                        existing full re-render.
 *   2.0.54 (2026-07-02): Dua select made explicit + heart fix. (1) Dua
 *                        rows in the Sound Library get a "Use" button
 *                        next to play/delete; row-tap still works but
 *                        selection no longer depends on knowing that.
 *                        Dua assignment now awaits the settings save
 *                        (backend errors surface before the overlay
 *                        closes) and logs to the console for
 *                        debugging. (2) Support-link heart icon was
 *                        invisible: the shared icons rely on the
 *                        container setting stroke, .support-link svg
 *                        now sets stroke: currentColor.
 *   2.0.53 (2026-07-02): Support Nida footer link. Quiet themed pill
 *                        with a heart icon under the sections, opening
 *                        NIDA_SUPPORT_URL (buymeacoffee.com/joohann,
 *                        single configurable constant) in a new tab.
 *                        Plain link only: no popups, no reminders.
 *   2.0.52 (2026-07-02): Random adhan toggle in the Sounds/Adhan
 *                        subgroup (options.random_adhan_enabled).
 *                        services.py picks a random locally downloaded
 *                        adhan from the prayer's category at play time.
 *   2.0.51 (2026-07-02): Duas. New top-level Duas section: per dua a
 *                        sound (picked from the Sound Library's new
 *                        dua category, download-on-demand from the dua
 *                        manifest), its OWN media player, volume,
 *                        test-play (nida.play_dua) and remove. Deleting
 *                        a sound file clears it from any dua using it.
 *                        Backend pairs this with per-dua button
 *                        entities (button.py). New i18n keys (EN + NL).
 *   2.0.50 (2026-07-02): Sound modes readability. The card now has
 *                        three subgroup headers (Guest mode, Night
 *                        mode, Window or door open) so the modes read
 *                        as blocks; the toggle rows show their
 *                        descriptive text as label. The guest block
 *                        gets a red accent bar + red header while
 *                        active, matching the banner red.
 *   2.0.49 (2026-07-02): Sound modes promoted + louder banner. (1) The
 *                        "Sound modes" subgroup (guest mode, night mode,
 *                        open-contact volume) moved out of the Sounds
 *                        card into its own top-level accordion section
 *                        between Sounds and Notifications, with a new
 *                        mixer/sliders icon and its own collapse state
 *                        (nida_collapsed_sound_modes). i18n key
 *                        sounds_group_volume_adjust replaced by
 *                        section_sound_modes. (2) Guest-mode banner red
 *                        brightened: saturated border + gradient and a
 *                        high-contrast title color, the old palette
 *                        washed out on the cream background.
 *   2.0.48 (2026-07-02): Prayers section fard reminder. A quiet note at
 *                        the top of the Prayers card states that all
 *                        five daily prayers are obligatory (fard) even
 *                        when the adhan is switched off. New i18n key
 *                        prayers_note (EN + NL) and a reusable
 *                        .card-note style.
 *   2.0.47 (2026-07-02): Guest mode infinite position. The duration
 *                        slider gains an extra rightmost stop (25 =
 *                        sentinel) rendered as an infinity sign: guest
 *                        mode then writes guest_mode_until = null, which
 *                        services.py already treats as "muted until
 *                        manually off". Row subtext and the red banner
 *                        say "Muted until you turn it off" instead of an
 *                        end time; sliding to/from the sentinel while
 *                        active rewrites until accordingly (null vs
 *                        now + hours). New i18n key
 *                        guest_mode_until_manual (EN + NL). No backend
 *                        changes.
 *   2.0.46 (2026-07-02): Guest mode gets a duration + visibility. (1)
 *                        Duration slider (1-24h, default 4) under the
 *                        guest-mode row; toggling on writes
 *                        guest_mode_until = now + hours, the backend
 *                        checks it lazily at fire time, so forgetting to
 *                        switch it off can no longer silence the adhan
 *                        forever. Moving the slider while active
 *                        re-anchors the window from now. (2) Red status
 *                        banner at the top of the companion column while
 *                        active, showing the until-time; tapping it turns
 *                        guest mode off. The 1s live tick re-renders when
 *                        the active-state flips so banner + toggle expire
 *                        by themselves. Toggle reflects ACTIVE state, not
 *                        the raw enabled flag. Companion to services.py +
 *                        const.py 2.0.46.
 *   2.0.45 (2026-07-02): Guest mode + subgroup rename. The Sounds
 *                        "Volume adjustments" subgroup is now "Sound
 *                        modes" ("Geluidsmodi") and gains a Guest-mode
 *                        toggle at the top: while on, the backend skips
 *                        all scheduled adhan + pre-adhan audio (jingle
 *                        and TTS); the test buttons keep working.
 *                        Companion to services.py + const.py 2.0.45.
 *   2.0.44 (2026-07-02): Companion release naast services.py — TTS
 *                        language is now tried per engine (bare code →
 *                        regional locale → engine default) with blocking
 *                        calls so rejections are caught. Fixes HA Cloud /
 *                        OpenAI TTS "Language 'en' not supported" while
 *                        Google worked. Panel: footer version only.
 *   2.0.43 (2026-07-01): TTS overlay fixes. (1) Engine picker is now
 *                        single-select (radio behaviour) — multi-select
 *                        fanned the same message to every engine on the
 *                        same speakers, playing the announcement N times;
 *                        the option stays a list for services.py compat
 *                        but never holds more than one entry from the
 *                        panel. (2) Always-visible "[prayer]" hint line
 *                        under the message field (the placeholder hint
 *                        vanished as soon as the user typed). (3)
 *                        .test-btn styles added to the portal stylesheet
 *                        so the Test-announcement button matches the rest
 *                        of the design (same body-portal scoping trap as
 *                        2.0.30). (4) EN now-card sub-line label
 *                        "Previous prayer" → "Last prayer" (NL stays
 *                        "Vorig gebed").
 *   2.0.42 (2026-07-01): Now-card sub-line label changed from "Current
 *                        prayer" to "Previous prayer" ("Vorig gebed" in
 *                        NL). The value shown is the prayer whose time
 *                        most recently passed, which reads as "previous"
 *                        once the countdown points at the next one. The
 *                        translation KEY stays current_prayer so no DOM
 *                        hooks or backend keys change — label-only.
 *   2.0.41 (2026-07-01): Volume-aanpassingen. The Sounds "Night mode"
 *                        subgroup is renamed to a "Volume adjustments"
 *                        umbrella that now holds two conditions: night
 *                        mode (unchanged) and a new "window or door open"
 *                        block. The latter has a master toggle, a
 *                        multi-select of contact binary_sensors (built
 *                        from hass.states, device_class door/window/
 *                        opening/garage_door, so no new WS command) and a
 *                        volume-factor slider (% of normal, default 130 =
 *                        louder). Backend (const.py + services.py) reads
 *                        the live sensor state at fire time and, when
 *                        several conditions apply, uses the lowest factor
 *                        (quietest wins).
 *   2.0.40 (2026-07-01): UX pass on the Sound Library. (1) A failed
 *                        catalog fetch (502, timeout, offline host) now
 *                        shows a friendly "no connection" card with a
 *                        Retry button, a muted technical-detail line and a
 *                        secondary "report it" link to the GitHub issues
 *                        page, instead of dumping the raw error code.
 *                        (2) The Sounds rows show a human-readable name
 *                        for the selected sound (e.g. "Ahmed Saeed Al
 *                        Omrany") derived from the stored file path via
 *                        _prettySoundName, instead of the raw
 *                        adhan/..._<hash>.mp3 path. (3) Frontend now
 *                        honours a per-sound `default`/`bundled` flag from
 *                        the catalog: such rows show a "default" chip and
 *                        a lock instead of a delete button, and
 *                        _deleteSound refuses them. NOTE: the catalog
 *                        (majikan.nl manifest + catalog.py) must set that
 *                        flag on the bundled sounds for the protection to
 *                        take effect; without it nothing is marked
 *                        default, exactly as before.
 *   2.0.39 (2026-07-01): Fixed next/current prayer + countdown across the
 *                        midnight boundary. In high-latitude summer (e.g.
 *                        NL) Isha falls after midnight (~00:09) and thus
 *                        sits BEFORE Fajr on the clock; the old _countdown
 *                        targeted today's Fajr and blind-added 24h, which
 *                        skipped tonight's Isha and produced a ~19h
 *                        countdown. next/current/target are now derived by
 *                        sorting the five timestamp sensors and taking
 *                        cyclic neighbours, wrapping the earliest by +24h
 *                        only when every prayer today has passed. The
 *                        countdown also ticks seconds (HH:MM:SS) on a 1s
 *                        interval instead of 30s / HH:MM. New helpers
 *                        _prayerSchedule + _nextPrayerInfo; _nextPrayer /
 *                        _currentPrayer / _nextPrayerDate now read from
 *                        them instead of trusting sensor.nida_next_prayer,
 *                        so the card is correct even if the backend
 *                        mishandles the after-midnight Isha.
 *
 *   2.0.38 (2026-06-29): Pre-adhan subgroep herontworpen. Was: 7
 *                        warrige rijen met door elkaar lopende
 *                        concerns. Nu: (1) wat-er-speelt (jingle-rij
 *                        met audio-toggle inline + TTS-rij), (2) TIMING
 *                        subheader met first reminder slider + 2e
 *                        reminder toggle + sub-indent slider voor
 *                        interval, (3) "Actief voor gebeden" picker
 *                        met chevron-overlay voor per-gebed
 *                        suppressie (Fajr om 04:30 hoef je niet meer
 *                        te slikken), (4) test-rij. "Play pre-adhan
 *                        audio" als losse rij is weg — die toggle zit
 *                        nu in de jingle-rij waar 'ie logisch hoort.
 *                        Nieuwe overlay pre-adhan-prayers met 5
 *                        toggles. Backend: per-prayer
 *                        pre_adhan_enabled_<prayer> opt (default True
 *                        = backward compat), scheduler skipt
 *                        gates pre-reminders erop.
 *
 *   2.0.37 (2026-06-29): TTS-talenlijst gestuurd vanuit de bestaande
 *                        panel-LANGUAGES const i.p.v. een aparte
 *                        TTS_LANGUAGES dup. Eén bron van waarheid:
 *                        een nieuwe paneeltaal verschijnt automatisch
 *                        in de TTS-picker. Default-berichten dict
 *                        uitgebreid van 6 naar 10 talen (en/nl/ar/tr/
 *                        de/fr/ms/id/ur/fa) zodat alle paneel-talen
 *                        een localised seed-bericht krijgen.
 *
 *   2.0.36 (2026-06-29): TTS taalkeuze. Picker in de TTS-overlay
 *                        boven het bericht-veld: auto / en / nl / ar /
 *                        id / de / fr. Wisselen van taal triggert
 *                        slimme auto-update van het bericht: als het
 *                        huidige bericht een van de bekende defaults
 *                        is (in welke taal dan ook) of leeg, vervangen
 *                        we het door de nieuwe taal-default. Zelf
 *                        getypte tekst wordt nooit overschreven.
 *                        Backend: nieuwe OPT_TTS_PRE_ADHAN_LANGUAGE,
 *                        services.py leest 'm vóór de panel-language
 *                        fallback.
 *
 *   2.0.32 (2026-06-29): TTS pre-adhan announcement. Nieuwe rij in
 *                        de Pre-adhan-subgroep met master toggle +
 *                        chevron naar TTS settings overlay. Multi-
 *                        select van HA's tts.* entities (Google Cloud,
 *                        Nabu Casa Cloud, Piper, ...) en een bericht-
 *                        veld met [prayer] placeholder. Backend:
 *                        nieuwe nida.speak_pre_adhan service, nieuwe
 *                        WS command nida/list_tts_services,
 *                        scheduler chained na pre_adhan_jingle met
 *                        configurable delay (default 5s) zodat de
 *                        jingle eerst kan finishen. Taal volgt
 *                        paneel-instelling (auto → HA system lang).
 *                        Multi-select fanned out — alle geselecteerde
 *                        engines spreken hetzelfde bericht parallel,
 *                        bedoeld voor multi-zone setups waar
 *                        verschillende speakers aan verschillende
 *                        TTS engines hangen.
 *
 *   2.0.31 (2026-06-29): Sound Library krijgt category-scope. Chevron-
 *                        rechts op een sound-rij opent de library nu
 *                        gescoped naar die ene categorie i.p.v. alle
 *                        drie. Daardoor is het onmogelijk om per
 *                        ongeluk een Fajr-adhan te kiezen vanuit de
 *                        Adhan-rij (wat in 2.0.30 stilletjes naar
 *                        sound_fajr_adhan schreef terwijl Asr-tijd
 *                        sound_adhan leest — gevolg: bundled default
 *                        speelde af, "verkeerde adhan"-bug). Overlay-
 *                        titel toont de categorienaam wanneer gescoped,
 *                        category-headers verbergen zich (redundant).
 *                        scope wordt gereset op overlay-close zodat
 *                        een latere open zonder argument weer alle
 *                        categorieën toont.
 *
 *   2.0.30 (2026-06-29): Sound Library CSS-scoping fix. 2.0.28's
 *                        styles waren toegevoegd aan de shadow-DOM
 *                        stylesheet, maar de overlay rendert in een
 *                        body-level <dialog> portal die zijn eigen
 *                        stylesheet heeft (zoek op .nida-overlay-portal
 *                        in de source). Resultaat: geen van mijn
 *                        .sl-* regels werd toegepast — items vielen
 *                        terug op default block-layout, daarom stond
 *                        de play-knop op de regel onder de naam in
 *                        plaats van ernaast, en was de actieve-state
 *                        amper zichtbaar. Verplaatst naar de juiste
 *                        portal-scope. Tegelijk de actieve-state
 *                        opgewaardeerd: gouden linker-balk + getinte
 *                        gradient + gouden vetgedrukte naam + check-
 *                        icoon in een gouden cirkel ervoor. Niet meer
 *                        te missen.
 *
 *   2.0.29 (2026-06-29): Sound Library adapter aangepast op de echte
 *                        majikan.nl/nida/adhan/manifest.json structuur:
 *                        `items[]` met `type`/`label`/`id`/`url`/
 *                        `sizeBytes`/`sha256` i.p.v. mijn aanvankelijke
 *                        `sounds[]` met `category`/`name`/`rel_path`.
 *                        Type → category mapping: fajr→fajr_adhan,
 *                        day→adhan, jingle→pre_adhan_jingle. `tarhim`
 *                        wordt nu geskipt (komt later met Ramadan-
 *                        features). rel_path wordt afgeleid uit
 *                        category-folder + id. Label-prefix
 *                        ("Adhan Day ", "Nadir Jingle ", ...) wordt
 *                        gestript zodat de picker "Amer Marei" toont
 *                        i.p.v. "Adhan Day Amer Marei". Default
 *                        catalog_url staat nu op majikan.nl manifest.
 *                        Geen frontend wijzigingen — paneel ziet nog
 *                        steeds de genormaliseerde shape.
 *
 *   2.0.28 (2026-06-29): Sound Library — catalog-driven adhan picker.
 *                        Chevron-rechts naast elke sound-row opent een
 *                        overlay met alle beschikbare sounds gegroepeerd
 *                        per categorie. Backend leest catalog.json van
 *                        options.catalog_url (user-gehoste server),
 *                        cached in memory. Per-row acties: play (browser
 *                        Audio met sound.url, vraagt CORS), download
 *                        (WS naar nida/download_sound → atomic write
 *                        in www/nida/sounds/<rel_path>), delete (X-knop
 *                        op gedownloade items → nida/delete_sound),
 *                        tap-row-naam selecteert als actieve sound voor
 *                        die categorie (writes options.sound_<cat>).
 *                        Niet-gedownloade selectie triggert
 *                        download-eerst-dan-select om 404 bij adhan-
 *                        tijd te voorkomen. Catalog-url-prompt
 *                        verschijnt wanneer leeg. Refresh-knop in
 *                        header forceert re-fetch (omzeilt cache).
 *
 *   2.0.27 (2026-06-29): Companion-cards zijn sleepbaar om de volgorde
 *                        te bepalen. HTML5 native drag&drop (werkt op
 *                        desktop en Safari/iPad-pencil; touch op
 *                        telefoon zou een pointer-event-fallback
 *                        vereisen — niet nu gebouwd). Volgorde gaat in
 *                        localStorage als JSON-array onder
 *                        nida_companion_order. Missende key = defaults
 *                        ("hijri", "now", "quote", "holiday") — dat
 *                        maakt clear-localStorage = layout-reset.
 *                        Sanity-filter bij read: onbekende ids worden
 *                        verwijderd, ontbrekende defaults achteraan
 *                        toegevoegd, zodat een nieuwe card in een
 *                        volgende versie automatisch verschijnt voor
 *                        bestaande users. Visuele feedback: bron-card
 *                        wordt half-transparent + lichtjes geschaald,
 *                        drop-target krijgt een gouden top-accent.
 *                        Drag-handle (6 dots) verschijnt rechtsboven
 *                        on hover; hele kaart is sleepbaar (handle is
 *                        affordance, niet hit-target).
 *
 *   2.0.26 (2026-06-29): Now-card herontworpen om visueel gelijk te
 *                        lopen met de nida-card. Was: tall centered
 *                        layout (eyebrow → grote naam → "Starts at
 *                        HH:MM" → divider → twee hours/minutes-boxes).
 *                        Wordt: compact horizontaal — 🕌 gold-gradient
 *                        icon links, NEXT PRAYER + grote naam in het
 *                        midden, REMAINING + HH:MM countdown rechts,
 *                        op één rij. Daaronder optioneel "Current
 *                        prayer · Dhuhr" sub-line (verbergt zichzelf
 *                        wanneer current prayer ontbreekt, via :empty
 *                        selector). Live-update writer schrijft nu
 *                        ook naar data-live="cd-combined" voor het
 *                        nieuwe samengevoegde HH:MM veld; per-unit
 *                        cd-h/cd-m writes blijven voor backward-compat
 *                        tijdens deploy-window (browser-cache kan nog
 *                        het oude DOM hebben).
 *
 *   2.0.25 (2026-06-29): Holiday-card aangesloten + kolommen omgedraaid.
 *                        (1) Holiday: Aladhan's /specialDays endpoint
 *                        bleek te breed (honderden commemoraties incl.
 *                        Sufi-urs); status-doc merkte al op dat een
 *                        vetted source nodig was. Daarom een
 *                        gecureerde HIJRI_HOLIDAYS-lijst van de tien
 *                        universeel-erkende Soenni feestdagen binnen
 *                        het paneel zelf — vertaalbare namen (i.p.v.
 *                        Engelse-only Aladhan strings), nul extra API
 *                        calls, nul backend wijzigingen. Card leest
 *                        de huidige Hijri datum uit sensor.nida_hijri_
 *                        day/month/year en zoekt de eerstvolgende
 *                        holiday in de lijst — "Today: <name>" als
 *                        dag matcht, anders "Upcoming: <name>" met
 *                        Hijri datum als secundaire regel. Match op
 *                        maandnaam is tolerant (NFD + strip diacritics
 *                        + strip ʾ/ʿ) zodat varianten als "Shaʿbān",
 *                        "Sha'ban", "Shaban" allemaal werken.
 *                        (2) Kolommen omgedraaid: companion-cards
 *                        (hijri/now/quote/holiday) staan nu LINKS en
 *                        settings RECHTS. Zowel DOM-volgorde als
 *                        grid-template-columns (nu 1fr 1.3fr i.p.v.
 *                        1.3fr 1fr) zijn aangepast zodat visuele
 *                        layout en tab-volgorde overeenkomen.
 *                        border-right op .col-settings is border-left
 *                        geworden om de scheidingslijn op de juiste
 *                        plek te houden.
 *
 *   2.0.24 (2026-06-29): Drie kleine fixes (Release D + alignment).
 *                        (1) Test-rijen (Speakers + Pre-adhan) hebben nu
 *                            een onzichtbare .chevron-btn.spacer aan het
 *                            eind zodat de play-knop in lijn staat met
 *                            de play-knoppen van sound-rijen erboven.
 *                            visibility:hidden behoudt de breedte; geen
 *                            display:none — dat zou de uitlijning juist
 *                            wegnemen.
 *                        (2) Opslaan-feedback: na elke succesvolle
 *                            _saveSettings verschijnt rechtsonder een
 *                            subtiele toast-pil ("Opgeslagen"/"Saved")
 *                            die na 1500ms uitfadet. Bij snel-achter-
 *                            elkaar saven wordt de timer gereset; geen
 *                            stack. Errors triggeren 'm niet (de
 *                            inline error-banner blijft de bron-van-
 *                            waarheid voor faal).
 *                        (3) Manual-mode waarschuwing: wanneer
 *                            location_mode=manual maar er staat geen
 *                            latitude/longitude in settings (typisch:
 *                            stad ingetypt zonder uit suggesties te
 *                            kiezen), toont Location-card een amber
 *                            warning-rij met uitleg dat HA-home-coords
 *                            worden gebruikt tot er een stad uit
 *                            suggesties is gekozen.
 *
 *   2.0.23 (2026-06-28): Vier paneel-wijzigingen.
 *                        (1) Sounds-sectie gesplitst in drie subgroepen:
 *                            "Adhan" (fajr_adhan + adhan rijen),
 *                            "Pre-adhan" (jingle rij + minuten-blok + audio
 *                            toggle + tweede reminder + play/stop test met
 *                            eigen volume), en "Nachtmodus" (verplaatst uit
 *                            zijn eigen sectie). Subgroepen tonen een
 *                            kleine subheader binnen dezelfde card.
 *                        (2) Pre-adhan test-knop is nu een play/stop knop
 *                            in Sounds-rij-stijl met eigen volume_pre_adhan_test
 *                            slider — mirror van het Speakers-test patroon.
 *                            Play roept nida.play_pre_adhan_test aan; Stop
 *                            roept media_player.media_stop op de geselecteerde
 *                            speakers. Auto-reset na 8s als safety net.
 *                        (3) Aparte Night-mode sectie verwijderd uit render
 *                            (_htmlSectionNightMode is nu inline in Sounds).
 *                        (4) Alle paneel-secties zijn nu inklapbare
 *                            <details>-elementen met per-sectie open/dicht
 *                            geheugen in localStorage onder de key
 *                            nida_collapsed_<sectionId>. Custom chevron
 *                            rechts in de header die 180° draait bij [open].
 *                            Defaults: alle secties open op eerste bezoek.
 *                            Reden voor <details>: native browser-state,
 *                            keyboard- en a11y-vriendelijk out-of-the-box,
 *                            en het 'toggle'-event is genoeg om naar
 *                            localStorage te schrijven zonder height-tween
 *                            JS te bouwen.
 *
 *   2.0.22 (2026-06-28): Drie features in één release. (1) Pre-adhan
 *                        audio playback — nieuwe toggle "Audio
 *                        afspelen" in de pre-adhan block (default
 *                        aan); scheduler vuurt nu ook
 *                        nida.play_pre_adhan_jingle af. Plus test-
 *                        knop in de pre-adhan block. (2) Speakers
 *                        test refactor — was een one-shot knop, is
 *                        nu een Sounds-rij stijl met label/sub +
 *                        eigen volume slider (volume_test, default
 *                        30) + play/stop knop. Stop call't
 *                        media_player.media_stop op de gekozen
 *                        speakers. Auto-reset na 8s safety-net.
 *                        (3) Nachtmodus sectie — toggle + start/end
 *                        tijd inputs (HH:MM) + volume factor slider
 *                        (% van normaal). Backend past het toe op
 *                        alle play_* services.
 *   2.0.21 (2026-06-28): Companion release — binary_sensor platform
 *                        toegevoegd in de Python-kant. Geen panel-
 *                        wijzigingen behalve de footer-versie.
 *   2.0.20 (2026-06-28): theme_auto label van "Auto" → "Automatic" (EN)
 *                        / "Automatisch" (NL), parallel aan de taal-
 *                        pill ernaast. Cosmetisch only.
 *   2.0.19 (2026-06-28): CSS-fix voor de "box-in-a-box" look van een
 *                        enkele select-field in een card. Speakers,
 *                        Notify-targets en Jumu'ah-targets gebruiken
 *                        nu de nieuwe .select-field.flat variant —
 *                        zelfde klik-gedrag maar zonder eigen border
 *                        en background. Voorkomt de cream-rechthoek-
 *                        in-witte-card mismatch die Johann zag in
 *                        light mode.
 *   2.0.18 (2026-06-28): Twee functionele wijzigingen. (1) Jumu'ah heeft
 *                        nu een eigen targets-rij in het paneel, los
 *                        van de algemene notify-targets. Klik opent
 *                        dezelfde overlay-stijl als de gewone
 *                        targets-picker. Test-knop in Jumu'ah-sectie
 *                        is disabled tot er minstens één Jumu'ah-
 *                        target gekozen is. (2) Speakers-test gebruikt
 *                        nu nida.play_test_sound i.p.v. play_adhan —
 *                        speelt een speciaal test_jingle.mp3 bestand
 *                        op de gekozen speakers met de adhan-volume.
 *                        Vereist dat de gebruiker zelf
 *                        sounds/test/test_jingle.mp3 plaatst in zijn
 *                        Nida-installatie.
 *   2.0.17 (2026-06-28): Three things at once. (1) Speakers-sectie heeft
 *                        nu een subtitle ("Gebruikt bij elk adhan-
 *                        moment") en een test-knop die nida.play_adhan
 *                        rechtstreeks aanroept met "dhuhr" als
 *                        representatief geluid. (2) Light theme +
 *                        theme-picker pill in de header naast taal —
 *                        cycle Dark → Light → Auto → Dark. Auto volgt
 *                        de OS-voorkeur via prefers-color-scheme. CSS-
 *                        vars worden via :host(.theme-*) en
 *                        .nida-overlay-portal.theme-* per stand
 *                        gewisseld. (3) Theme-pill toont een glyph
 *                        (☾ / ☀ / ◐) + label, en de portal-class
 *                        wordt bij elke open op het juiste theme
 *                        gezet zodat overlay en host nooit uit
 *                        elkaar lopen.
 *   2.0.16 (2026-06-28): Test-knoppen toegevoegd onder de Notifications-
 *                        en Jumu'ah-secties. Klikken stuurt direct
 *                        naar de geconfigureerde targets via twee
 *                        nieuwe ws-commands (nida/test_notify,
 *                        nida/test_jumuah). Knop-tekst geeft feedback:
 *                        "Sending…" tijdens de call, "Sent (2/3)" op
 *                        success met aantal geslaagde vs totaal,
 *                        "Failed" of "Choose targets first" op fout.
 *                        Disabled-state als er geen targets gekozen
 *                        zijn — voorkomt onbedoelde no-op klikken.
 *   2.0.15 (2026-06-28): Release B — notifications + Jumu'ah. New
 *                        Notifications section (master toggle, multi-
 *                        select targets via overlay backed by
 *                        nida/list_notify_services, title + message
 *                        inputs, per-prayer toggles). Defaults for
 *                        title/message are seeded in the panel's
 *                        active language at first init via
 *                        _seedLanguageDefaults — afterwards we never
 *                        overwrite user edits (switching language
 *                        later doesn't retranslate already-saved
 *                        strings, by design). Separate Jumu'ah section
 *                        with a Friday reminder toggle, a 30-120
 *                        minutes-before slider, and its own message
 *                        template with [minutes] placeholder.
 *                        Scheduler picks up all of this; both fire
 *                        through the same notify_targets list.
 *   2.0.14 (2026-06-28): ² positie aangepast: top -0.8em → -0.4em
 *                        (lager), left -5px → 0 (rechter). Cosmetisch
 *                        only — geen functionele wijzigingen.
 *   2.0.13 (2026-06-28): Four follow-up changes after Release A landed.
 *                        (1) Default volumes lowered to Johanns voorkeur:
 *                        fajr 10%, adhan 20%, pre-adhan 20%.
 *                        (2) Pre-adhan minutes is now a 2-30 slider, not
 *                        a number input. Added optional second reminder
 *                        with a toggle — second slider only appears
 *                        when the toggle is on. Scheduler plants both
 *                        reminders side by side with distinct
 *                        notification-ids.
 *                        (3) City pick-bug fixed — clicking a suggestion
 *                        used to be overwritten by the deferred blur
 *                        callback (200ms) reading a stale typed value
 *                        from the now-detached input. _cityJustPicked
 *                        flag short-circuits that path.
 *                        (4) Resolved-location row now shows Nominatim
 *                        reverse-geocode display_name (e.g. "Breukelen,
 *                        Stichtse Vecht, Utrecht, Nederland") instead
 *                        of "Production · 52.18° N, 5.00° E". Falls
 *                        back to the old format if the reverse call
 *                        failed.
 *   2.0.12 (2026-06-28): Release A — adhan configuration completed in the
 *                        panel. (1) Volume slider per sound category in
 *                        the Sounds section (fajr_adhan / adhan /
 *                        pre_adhan_jingle), 0-100 in 5% steps, saves on
 *                        slider release. (2) Pre-adhan reminder minutes
 *                        as a number input row at the bottom of the
 *                        Sounds section, 0-60 (0 disables); scheduler
 *                        already reads this option since 2.0.7 — only
 *                        the UI was missing. (3) Nida² superscript
 *                        spacing tightened (sup left -2 → -5px) so the
 *                        ² sits closer to the "a". Companion to
 *                        websocket.py + services.py + const.py.
 *   2.0.11 (2026-06-28): Two follow-up fixes to 2.0.10. (1) Overlay
 *                        portal now uses a <dialog> element with
 *                        showModal() instead of a plain <div>. The
 *                        plain div was still trapped by whatever
 *                        transform-bearing ancestor sits between body
 *                        and the panel (probably HA's own chrome).
 *                        showModal puts the dialog in the browser's
 *                        top layer, which is above ALL stacking
 *                        contexts and immune to transforms — that's
 *                        the contract of <dialog> with showModal. The
 *                        ::backdrop pseudo-element handles the dim
 *                        background; the inner .overlay div just
 *                        centers its panel. (2) City input bug — every
 *                        keystroke triggered _render() which destroyed
 *                        the <input> mid-typing, so typed characters
 *                        never showed. Fix: _renderCitySuggestions()
 *                        does a partial DOM update on only the
 *                        .city-suggestions container, leaving the
 *                        input alone. _onCityInput and _searchCities
 *                        both use it now.
 *   2.0.10 (2026-06-28): Two fixes that hung together. (1) Overlay now
 *                        portals to document.body via a top-level
 *                        .nida-overlay-portal div, with its CSS injected
 *                        into <head> on first connect. Reason: a
 *                        transform-bearing ancestor in HA's panel chrome
 *                        was demoting our `position: fixed` overlay to
 *                        effectively `position: absolute`, so it drifted
 *                        with scroll — Johann saw it pop up wherever the
 *                        click landed instead of viewport-centered.
 *                        Portaling out of shadow root + out of .app
 *                        fixes that for good. (2) Manual-mode city input
 *                        now has Nominatim-backed autocomplete: the
 *                        new nida/search_cities ws command queries
 *                        OpenStreetMap by country code + free-text query,
 *                        and picking a suggestion writes city + lat +
 *                        lon to options. Coordinator can use those
 *                        coords in manual mode and avoid the Aladhan
 *                        country-name-vs-ISO-code mismatch entirely.
 *   2.0.9 (2026-06-28): Two panel additions tied to ws commands of the
 *                       same release: (1) device-mode now shows the
 *                       resolved HA location (name + lat/lon in gold)
 *                       between the segmented control and Calculation
 *                       method, fetched via nida/get_ha_info; (2) new
 *                       Speakers section between Prayers and Sounds,
 *                       with a multi-select overlay listing all
 *                       media_player entities (nida/list_media_players),
 *                       writing the selection to options.adhan_media_players
 *                       so services.py picks it up without further wiring.
 *                       Auto-saves on every toggle, mirroring prayers.
 *   2.0.7 (2026-06-28): Country overlay is now searchable — added a
 *                       text input above the list that live-filters on
 *                       name or ISO code. Empty-results state shows a
 *                       "no matches" line. _htmlOverlayList grew an
 *                       options.searchable parameter so we can reuse
 *                       the same machinery for method/language pickers
 *                       later if 24/11 items ever need it.
 *   2.0.6 (2026-06-28): One-shot welcome overlay added — shown on first
 *                       visit to /nida, dismissed via "Get started"
 *                       button, persistence via options.panel_welcome_seen.
 *                       This replaces the config-flow welcome which
 *                       didn't render reliably in Johann's HA setup.
 *                       Welcome content lives in JS (WELCOME_CONTENT),
 *                       not strings.json, so it's independent of HA's
 *                       translation pipeline.
 *   2.0.4 (2026-06-28): Country list now uses a hardcoded ISO 3166-1
 *                       alpha-2 list instead of Intl.supportedValuesOf
 *                       (which was returning empty in Johann's browser,
 *                       producing a "Country ✕"-only overlay). Localized
 *                       names still come from Intl.DisplayNames at
 *                       render time.
 *   2.0.3 (2026-06-28): Sound preview buttons enabled — play/stop toggle
 *                       via inline <audio> element pointing at
 *                       /local/nida/sounds/<path>, no media_player needed
 *                       for browser-side preview. Country in manual mode
 *                       is now an ISO 3166 dropdown (was a free text
 *                       field) with localized country names via
 *                       Intl.DisplayNames. Order swapped: country now
 *                       shown above city. Footer version bumped.
 *   2.0.1 (2026-06-28): Bugfix — click delegator was being re-registered on
 *                       every _render(), causing stacked listeners and the
 *                       "first toggle works, then nothing" symptom Johann
 *                       reported. Listener now attached once in
 *                       connectedCallback and removed in disconnectedCallback.
 *                       Click body extracted to _handleClick.
 *   2.0.0 (2026-06-28): Full settings + companion UI per references/design.md
 *                       (replaces 2.0.0 placeholder). Adds i18n scaffolding,
 *                       live sensor reads, calculation-method picker (24
 *                       Aladhan methods), language picker (10 + auto),
 *                       degraded sound-row state pending catalog wiring,
 *                       TODO placeholders for quote + holiday cards.
 *   2.0.0 (2026-06-27): Initial placeholder — only verified panel registration
 *                       and websocket roundtrip; no real settings UI.
 */

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const PRAYERS = ["fajr", "dhuhr", "asr", "maghrib", "isha"];

// ─────────────────────────────────────────────────────────────────────────────
// Hijri month canonical names (Aladhan API format). Index = month number - 1.
// Used to map sensor.nida_hijri_month's textual state back to a number so we
// can compute day-of-year and find the next holiday. Match is tolerant:
// lowercase + strip diacritics before comparing. The "alt" variants cover
// the most common alternative transliterations Aladhan may emit across
// versions/locales.
// ─────────────────────────────────────────────────────────────────────────────
const HIJRI_MONTHS = [
  { number: 1,  primary: "Muḥarram",          alts: ["Muharram"] },
  { number: 2,  primary: "Ṣafar",             alts: ["Safar"] },
  { number: 3,  primary: "Rabīʿ al-awwal",    alts: ["Rabi al-awwal", "Rabi' al-awwal", "Rabi I"] },
  { number: 4,  primary: "Rabīʿ al-thānī",    alts: ["Rabi al-thani", "Rabi' al-thani", "Rabi II"] },
  { number: 5,  primary: "Jumādá al-ūlá",     alts: ["Jumada al-Ula", "Jumada I", "Jumada al-awwal"] },
  { number: 6,  primary: "Jumādá al-ākhirah", alts: ["Jumada al-Akhirah", "Jumada II", "Jumada al-thani"] },
  { number: 7,  primary: "Rajab",             alts: [] },
  { number: 8,  primary: "Shaʿbān",           alts: ["Shaban", "Sha'ban"] },
  { number: 9,  primary: "Ramaḍān",           alts: ["Ramadan"] },
  { number: 10, primary: "Shawwāl",           alts: ["Shawwal"] },
  { number: 11, primary: "Dhū al-Qaʿdah",     alts: ["Dhu al-Qadah", "Dhu al-Qa'dah", "Zul Qadah"] },
  { number: 12, primary: "Dhū al-Ḥijjah",     alts: ["Dhu al-Hijjah", "Zul Hijjah"] },
];

// 2.1.2 — replaces the old client-side approximate HIJRI_HOLIDAYS list.
// Event *display* metadata (emoji, category, translated name/description)
// deliberately lives here in the panel, never in the backend — the
// backend (islamic_calendar.py's events_for_hijri_day) only ever deals in
// the bare key string, consistent with Nida's i18n split (UI-facing text
// belongs in TRANSLATIONS). Keys match exactly what
// nida/get_calendar_month returns, which in turn come straight from
// const.py's ISLAMIC_HOLIDAYS / ASHURA_ARAFAH_DATES / WHITE_DAYS /
// WEEKLY_SUNNAH_WEEKDAYS tables — the calendar view and the push-reminder
// feature (Islamic Calendar section) always agree on what counts as an
// event because both read from the same source of truth.
const CALENDAR_EVENT_META = {
  islamic_new_year: { emoji: "🎉", category: "holiday", nameKey: "cal_event_islamic_new_year_name", arKey: "cal_event_islamic_new_year_ar", descKey: "cal_event_islamic_new_year_desc" },
  mawlid:           { emoji: "🕌", category: "holiday", nameKey: "cal_event_mawlid_name", arKey: "cal_event_mawlid_ar", descKey: "cal_event_mawlid_desc" },
  eid_al_fitr:      { emoji: "🌙", category: "holiday", nameKey: "cal_event_eid_al_fitr_name", arKey: "cal_event_eid_al_fitr_ar", descKey: "cal_event_eid_al_fitr_desc" },
  eid_al_adha:      { emoji: "🐑", category: "holiday", nameKey: "cal_event_eid_al_adha_name", arKey: "cal_event_eid_al_adha_ar", descKey: "cal_event_eid_al_adha_desc" },
  ashura_pre:       { emoji: "🌒", category: "fasting", nameKey: "cal_event_ashura_pre_name", arKey: "cal_event_ashura_ar", descKey: "cal_event_ashura_desc" },
  ashura:           { emoji: "🌒", category: "fasting", nameKey: "cal_event_ashura_name", arKey: "cal_event_ashura_ar", descKey: "cal_event_ashura_desc" },
  ashura_post:      { emoji: "🌒", category: "fasting", nameKey: "cal_event_ashura_post_name", arKey: "cal_event_ashura_ar", descKey: "cal_event_ashura_desc" },
  arafah:           { emoji: "🕋", category: "fasting", nameKey: "cal_event_arafah_name", arKey: "cal_event_arafah_ar", descKey: "cal_event_arafah_desc" },
  white_days:       { emoji: "⚪", category: "fasting", nameKey: "cal_event_white_days_name", arKey: "cal_event_white_days_ar", descKey: "cal_event_white_days_desc" },
  weekly_sunnah:    { emoji: "🤍", category: "fasting", nameKey: "cal_event_weekly_sunnah_name", arKey: "cal_event_weekly_sunnah_ar", descKey: "cal_event_weekly_sunnah_desc" },
};

// The subset of CALENDAR_EVENT_META worth showing as an "upcoming events"
// countdown (annual, once-a-year occasions). white_days/weekly_sunnah are
// deliberately excluded here — they recur every month/week and would
// dominate the list; they still get dots on the grid itself. daysOff is
// computed with the same 30-day-per-Hijri-month tabular approximation the
// old _findNextHoliday used (fine for a countdown pill, never meant to be
// exact to the day — moon-sighting can shift real dates by a day anyway).
const CALENDAR_SPECIAL_EVENTS = [
  { month: 1,  day: 1,  key: "islamic_new_year" },
  { month: 1,  day: 10, key: "ashura" },
  { month: 3,  day: 12, key: "mawlid" },
  { month: 10, day: 1,  key: "eid_al_fitr" },
  { month: 12, day: 9,  key: "arafah" },
  { month: 12, day: 10, key: "eid_al_adha" },
];

const SOUND_CATEGORIES = [
  { key: "fajr_adhan", label_key: "sound_fajr_adhan", subtitle_key: "sound_fajr_adhan_sub" },
  { key: "adhan", label_key: "sound_adhan", subtitle_key: "sound_adhan_sub" },
  { key: "pre_adhan_jingle", label_key: "sound_pre_adhan_jingle", subtitle_key: "sound_pre_adhan_jingle_sub" },
];

// 2.0.51 — dua is a library-only category: it appears in the Sound
// Library overlay but deliberately NOT in the Sounds card (SOUND_CATEGORIES
// drives that card's sound_<category> rows; duas are configured per-dua
// in the Duas section instead).
const DUA_CATEGORY = { key: "dua", label_key: "sound_dua", subtitle_key: "sound_dua_sub" };
const LIBRARY_CATEGORIES = [...SOUND_CATEGORIES, DUA_CATEGORY];

// 24 Aladhan calculation methods — source: architecture.md §9.1.
// ID 6 is intentionally absent (never assigned by Aladhan).
const CALCULATION_METHODS = [
  { id: 0, name: "Shia Ithna-Ashari, Leva Institute, Qum" },
  { id: 1, name: "University of Islamic Sciences, Karachi" },
  { id: 2, name: "Islamic Society of North America" },
  { id: 3, name: "Muslim World League" },
  { id: 4, name: "Umm Al-Qura University, Makkah" },
  { id: 5, name: "Egyptian General Authority of Survey" },
  { id: 7, name: "Institute of Geophysics, University of Tehran" },
  { id: 8, name: "Gulf Region" },
  { id: 9, name: "Kuwait" },
  { id: 10, name: "Qatar" },
  { id: 11, name: "Majlis Ugama Islam Singapura" },
  { id: 12, name: "Union Organization Islamic de France" },
  { id: 13, name: "Diyanet İşleri Başkanlığı, Turkey" },
  { id: 14, name: "Spiritual Administration of Muslims of Russia" },
  { id: 15, name: "Moonsighting Committee Worldwide" },
  { id: 16, name: "Dubai" },
  { id: 17, name: "Jabatan Kemajuan Islam Malaysia" },
  { id: 18, name: "Tunisia" },
  { id: 19, name: "Algeria" },
  { id: 20, name: "Kementerian Agama Republik Indonesia" },
  { id: 21, name: "Morocco" },
  { id: 22, name: "Comunidade Islamica de Lisboa" },
  { id: 23, name: "Ministry of Awqaf, Jordan" },
  { id: 99, name: "Custom" },
];

const DEFAULT_METHOD_ID = 3;

// Languages: "auto" + 10 explicit. Labels in their own language (native form).
const LANGUAGES = [
  { code: "auto", label: "Automatic" },
  { code: "en", label: "English" },
  { code: "nl", label: "Nederlands" },
  { code: "ar", label: "العربية" },
  { code: "tr", label: "Türkçe" },
  { code: "de", label: "Deutsch" },
  { code: "fr", label: "Français" },
  { code: "ms", label: "Bahasa Melayu" },
  { code: "id", label: "Bahasa Indonesia" },
  { code: "ur", label: "اردو" },
  { code: "fa", label: "فارسی" },
];

// 2.0.47 — slider position 25 is the "infinite" sentinel: guest mode
// stays on until manually switched off (guest_mode_until = null, which
// services.py::_guest_mode_active already treats as "no expiry").
const GUEST_HOURS_INF = 25;

// Only EN + NL are filled in. Other languages fall through to EN until they
// are properly translated (SKILL.md rule 6). Keys are stable across languages.
const TRANSLATIONS = {
  en: {
    section_location: "Location and method",
    section_prayers: "Prayers",
    prayers_note: "A gentle reminder: all five daily prayers remain an obligation, regardless of the adhan setting here \u2014 may Allah make them easy for you.",
    section_dua: "Duas",
    sound_dua: "Dua",
    sound_dua_sub: "Manually played supplications",
    dua_none: "No duas configured yet. Add one to play it from a button, dashboard or automation.",
    dua_add: "Add dua",
    dua_sound_label: "Sound",
    dua_sound_none: "No sound selected",
    dua_player_label: "Media player",
    dua_no_player: "Choose a media player",
    dua_volume_label: "Volume",
    dua_play_test: "Play",
    dua_stop: "Stop",
    dua_remove: "Remove",
    dua_use: "Use",
    dua_trigger_label: "Trigger",
    dua_no_trigger: "No trigger",
    dua_trigger_sub: "Plays when the chosen entity turns on or opens (max once per minute)",
    random_adhan_label: "Random adhan",
    random_adhan_sub: "Play a random downloaded adhan at each prayer",
    sound_row_random_sub: "Random from downloaded adhans",
    support_nida: "Support Nida",
    section_speakers: "Speakers",
    section_sounds: "Sounds",
    section_notifications: "Notifications",
    section_jumuah: "Jumu'ah (Friday)",
    section_night_mode: "Night mode",
    location_use_device: "Use device location",
    location_set_manually: "Set manually",
    city: "City",
    country: "Country",
    calculation_method: "Calculation method",
    prayer_fajr: "Fajr",
    prayer_dhuhr: "Dhuhr",
    prayer_asr: "Asr",
    prayer_maghrib: "Maghrib",
    prayer_isha: "Isha",
    sound_fajr_adhan: "Fajr adhan",
    sound_fajr_adhan_sub: "Used for Fajr",
    sound_adhan: "Adhan",
    sound_adhan_sub: "Used for Dhuhr, Asr, Maghrib, Isha",
    sound_pre_adhan_jingle: "Pre-adhan jingle",
    sound_pre_adhan_jingle_sub: "Played before each adhan",
    sound_default: "default",
    sounds_group_adhan: "Adhan",
    sounds_group_pre_adhan: "Pre-adhan",
    sounds_group_night: "Night mode",
    section_sound_modes: "Sound modes",
    guest_mode_hours_unit: "h",
    guest_mode_until_manual: "Muted until you turn it off",
    silent_mode_button_label: "Silent mode",
    silent_mode_popup_title: "Silent mode",
    silent_mode_popup_duration_label: "How long?",
    silent_mode_popup_note: "You'll still get notifications to pray. Both the adhan and the pre-adhan sound are silenced.",
    silent_mode_popup_confirm: "Turn on",
    silent_mode_popup_update: "Update",
    silent_mode_popup_turn_off: "Turn off silent mode",
    silent_mode_active_until: "Silent until",
    open_contact_label: "Window or door open",
    open_contact_sub: "Use a different volume while a contact sensor is open",
    open_contact_sensors_label: "Contact sensors",
    open_contact_sensors_none: "None selected",
    open_contact_pick_title: "Choose contact sensors",
    open_contact_no_sensors: "No door/window sensors found in Home Assistant.",
    open_contact_factor_label: "Volume while open (% of normal)",
    pre_adhan_test_label: "Test pre-adhan jingle",
    pre_adhan_test_sub: "Plays the jingle with the test volume below",
    volume_label: "Volume",
    pre_adhan_minutes_label: "First reminder",
    pre_adhan_minutes_sub: "Minutes before each prayer",
    pre_adhan_two_label: "Add second reminder",
    pre_adhan_two_sub: "A second notification at a different interval",
    pre_adhan_minutes_2_label: "Second reminder",
    pre_adhan_minutes_2_sub: "Minutes before each prayer",
    minutes_short: "min",
    current_prayer: "Last prayer",
    next_prayer: "Next prayer",
    remaining: "Remaining",
    starts_at: "Starts at",
    hours: "Hours",
    minutes: "Minutes",
    today_card_title: "Today",
    today_last_updated: "Last updated",
    today_remaining: "in {h} h {m} m",
    language_label: "Panel language",
    method_pick_title: "Calculation method",
    language_pick_title: "Panel language",
    country_pick_title: "Country",
    country_clear: "Clear country",
    speakers_pick_title: "Choose speakers",
    speakers_label: "Adhan speakers",
    speakers_sub: "Used at every adhan time",
    speakers_none: "None selected",
    speakers_count_suffix: "selected",
    test_speakers_btn: "Test on selected speakers",
    speakers_test_label: "Test playback",
    speakers_test_sub: "Plays test_jingle.mp3 with the test volume",
    pre_adhan_audio_label: "Play pre-adhan audio",
    pre_adhan_audio_sub: "Plays the jingle on speakers, not just notification",
    test_pre_adhan_btn: "Test pre-adhan jingle on speakers",
    night_mode_label: "Enable night mode",
    night_mode_sub: "Reduces volume during the time window below",
    night_start_label: "Start time",
    night_end_label: "End time",
    night_volume_label: "Volume during night (% of normal)",
    theme_label: "Theme",
    theme_dark: "Dark",
    theme_light: "Light",
    theme_auto: "Automatic",
    theme_ramadan: "Ramadan",
    targets_pick_title: "Choose notification targets",
    notify_master_label: "Send notifications",
    notify_master_sub: "Push notification at each adhan time",
    notify_critical_label: "Critical",
    notify_critical_sub: "The warning icon marks a prayer's notification as critical, so it can bypass silent mode / Do Not Disturb on iOS and Android.",
    test_notify_prayer_tooltip: "Send a test notification for this prayer (uses its current critical setting)",
    notify_targets_label: "Notification targets",
    notify_targets_none: "None selected",
    notify_tts_workaround_label: "Spoken alert (Samsung silent-mode workaround): critical notifications to this device are read aloud instead of played as a normal notification sound — some Samsung phones block apps from overriding regular notification sound, so this is the one thing that reliably rings through silent mode / Do Not Disturb.",
    notify_title_label: "Title",
    notify_message_label: "Message",
    notify_message_hint: "Use [prayer] for the prayer name",
    notify_per_prayer_label: "Per-prayer notifications",
    notify_default_title: "🕌 Nida²",
    notify_default_message: "It's time for [prayer] prayer",
    test_notify_btn: "Send test notification",
    test_jumuah_btn: "Send test reminder",
    test_sending: "Sending…",
    test_sent: "Sent",
    test_no_targets: "Choose targets first",
    test_failed: "Failed",
    jumuah_reminder_label: "Friday reminder",
    jumuah_reminder_sub: "Notify before Jumu'ah on Fridays",
    jumuah_minutes_label: "Minutes before Dhuhr",
    jumuah_message_label: "Message",
    jumuah_message_hint: "Use [minutes] for the minutes-before value",
    jumuah_default_message: "Jumu'ah prayer is in [minutes] minutes",
    jumuah_targets_label: "Jumu'ah targets",
    jumuah_targets_pick_title: "Choose Jumu'ah targets",
    jumuah_targets_none: "None — uses HA notification drawer",
    section_ramadan: "Ramadan",
    imsak_offset_label: "Imsak offset",
    imsak_offset_sub: "Show Imsak earlier, e.g. to allow time for suhoor preparation",
    section_islamic_calendar: "Islamic Calendar",
    calendar_intro: "Reminders for Islamic holidays and recommended fasting days.",
    days_short: "d",
    calendar_holidays_head: "Holidays",
    calendar_holidays_label: "Holiday reminders",
    calendar_holidays_sub: "Eid al-Fitr, Eid al-Adha, Mawlid, Islamic New Year",
    calendar_holidays_lead_label: "Reminder lead time",
    calendar_holidays_second_label: "Second reminder",
    calendar_holidays_second_lead_label: "Second reminder lead time",
    calendar_ashura_head: "Fasting on Special Days",
    calendar_ashura_label: "Ashura & Arafah fasting reminders",
    calendar_ashura_sub: "Ashura fasting (9, 10, 11 Muharram) and Day of Arafah (9 Dhul Hijjah)",
    calendar_white_days_head: "White Days (Ayyam al-Beed)",
    calendar_white_days_label: "White Days reminders",
    calendar_white_days_sub: "13th, 14th and 15th of each Hijri month — recommended fasting days",
    calendar_sunnah_head: "Weekly Sunnah Fasting",
    calendar_sunnah_label: "Monday & Thursday",
    calendar_sunnah_sub: "Weekly Sunnah fasting reminders — every Monday and Thursday",
    calendar_delivery_head: "Delivery",
    calendar_targets_label: "Calendar targets",
    calendar_targets_pick_title: "Choose calendar reminder targets",
    calendar_fire_time_label: "Reminder time",
    calendar_fire_time_sub: "All Islamic Calendar reminders fire at this time",
    // 2.1.2 — calendar month-grid companion card (replaces the old
    // client-side approximate holiday card) + its event detail overlay.
    calendar_upcoming_title: "Upcoming events",
    calendar_no_events: "No upcoming events",
    calendar_today_label: "Today",
    calendar_tomorrow_label: "Tomorrow",
    calendar_days_countdown: "{n} days",
    calendar_prev_month: "Previous month",
    calendar_next_month: "Next month",
    calendar_weekdays_short: "Mon,Tue,Wed,Thu,Fri,Sat,Sun",
    calendar_loading: "Loading…",
    calendar_error: "Calendar unavailable right now.",
    calendar_detail_title: "Event details",
    cal_category_holiday: "Holiday",
    cal_category_fasting: "Fasting",
    cal_event_islamic_new_year_name: "Islamic New Year",
    cal_event_islamic_new_year_ar: "رأس السنة الهجرية",
    cal_event_islamic_new_year_desc: "The first day of Muharram marks the start of the Hijri calendar, commemorating the Prophet Muhammad's ﷺ migration (Hijrah) from Makkah to Madinah in 622 CE. It's a time for quiet reflection rather than celebration — many Muslims mark it with extra prayer and remembrance.",
    cal_event_mawlid_name: "Mawlid an-Nabi",
    cal_event_mawlid_ar: "المولد النبوي",
    cal_event_mawlid_desc: "Commemorates the birth of the Prophet Muhammad ﷺ. Observance varies widely across the Muslim world — from gatherings, storytelling and charity to communities that mark the day quietly, reflecting differing scholarly views on how it should be observed.",
    cal_event_eid_al_fitr_name: "Eid al-Fitr",
    cal_event_eid_al_fitr_ar: "عيد الفطر",
    cal_event_eid_al_fitr_desc: "The 'Festival of Breaking the Fast' marks the end of Ramadan. The day begins with a special congregational prayer, followed by Zakat al-Fitr (charity to the poor), festive meals, new clothes, and visiting family and friends.",
    cal_event_eid_al_adha_name: "Eid al-Adha",
    cal_event_eid_al_adha_ar: "عيد الأضحى",
    cal_event_eid_al_adha_desc: "The 'Festival of Sacrifice' honours Ibrahim's ﷺ willingness to sacrifice his son in obedience to God. It falls during Hajj season and is marked with a congregational prayer, the Udhiyah/Qurbani sacrifice, and sharing meat with family, neighbours and those in need.",
    cal_event_ashura_pre_name: "Ashura fasting (9 Muharram)",
    cal_event_ashura_name: "Ashura fasting (10 Muharram)",
    cal_event_ashura_post_name: "Ashura fasting (11 Muharram)",
    cal_event_ashura_ar: "عاشوراء",
    cal_event_ashura_desc: "Ashura (10 Muharram) commemorates the day God saved Musa (Moses) and the Israelites from Pharaoh. Many Muslims fast on this day, often alongside the 9th and/or 11th, following the Prophet's ﷺ guidance to fast an extra day so the observance differs from other traditions.",
    cal_event_arafah_name: "Day of Arafah",
    cal_event_arafah_ar: "يوم عرفة",
    cal_event_arafah_desc: "The Day of Arafah is the most sacred day of the Islamic year, when pilgrims performing Hajj gather at Mount Arafah. For those not on Hajj, fasting this day is highly recommended — the Prophet ﷺ said it expiates the sins of the past and coming year.",
    cal_event_white_days_name: "White Days",
    cal_event_white_days_ar: "الأيام البيض",
    cal_event_white_days_desc: "The 'White Days' — the 13th, 14th and 15th of every Hijri month, named for the full moon that lights them. Fasting these three days each month is a well-established Sunnah, roughly equivalent in reward to fasting the whole year.",
    cal_event_weekly_sunnah_name: "Weekly Sunnah fasting",
    cal_event_weekly_sunnah_ar: "صيام الاثنين والخميس",
    cal_event_weekly_sunnah_desc: "The Prophet ﷺ regularly fasted on Mondays and Thursdays, saying that deeds are presented to God on these days and he liked his deeds to be presented while fasting. A simple, recurring act of devotion outside Ramadan.",
    section_setup: "Setup/Backup",
    setup_section_intro: "Run the setup again at any time — for example after moving, or to start over from scratch.",
    setup_mode_manual_title: "Manual",
    setup_mode_manual_sub: "Walk through every setting yourself, step by step.",
    setup_mode_auto_title: "Automatic",
    setup_mode_auto_sub: "Detect your location and use sensible defaults; you only confirm the essentials.",
    setup_mode_restore_title: "Restore backup",
    setup_mode_restore_sub: "Load a previously exported settings file.",
    setup_confirm_title: "Overwrite current settings?",
    setup_confirm_body: "Nida is already set up. Running setup again will change your current settings.",
    setup_wizard_title: "Setup",
    setup_step_label: "Step",
    setup_wizard_prev: "Back",
    setup_wizard_next: "Next",
    setup_wizard_finish: "Finish",
    setup_restore_intro: "Choose a Nida backup file to restore. This overwrites your current settings.",
    setup_restore_choose_file: "Choose file…",
    setup_restore_error_json: "This isn't a valid JSON file.",
    setup_restore_error_shape: "This file doesn't look like a Nida backup.",
    setup_restore_error_version: "This backup's format isn't recognised — it may be from a different Nida version.",
    setup_restore_preview_title: "Backup ready to restore",
    setup_restore_apply: "Restore",
    setup_auto_location_note: "Your location is detected automatically from Home Assistant. Just confirm the calculation method.",
    setup_auto_prayers_note: "Every prayer starts enabled.",
    setup_auto_pre_adhan_label: "Pre-adhan reminder",
    setup_auto_pre_adhan_sub: "A first reminder 20 minutes before, a second 5 minutes before — jingle + spoken announcement.",
    setup_auto_dnd_label: "Bypass Do Not Disturb",
    setup_export_backup: "Download current settings as a backup",
    cancel: "Cancel",
    continue: "Continue",
    prayer_imsak: "Imsak",
    until_iftar: "Until Iftar",
    until_prayer: "Until {prayer}",
    iftar_time_label: "Iftar time",
    iftar_time_sub: "Break your fast",
    last_prayer: "Last prayer",
    iftar_in_tag: "Iftar in {m} m",
    iftar_in_tag_hm: "Iftar in {h} h {m} m",
    resolved_location_sub: "From Home Assistant settings",
    search_placeholder: "Search…",
    search_no_results: "No matches",
    close: "Close",
    loading: "Loading…",
    error_prefix: "Error",
    save_toast_saved: "Saved",
    location_warning_manual_no_coords_title: "No city selected",
    location_warning_manual_no_coords_body: "Pick a city from the search suggestions. Until you do, Home Assistant's home coordinates are used.",
    sl_title: "Sound Library",
    sl_refresh: "Refresh catalog",
    sl_preview: "Preview",
    sl_download: "Download",
    sl_delete: "Delete",
    sl_retry: "Retry",
    sl_empty: "No sounds in catalog yet.",
    sl_error_prefix: "Catalog error",
    sl_url_prompt: "Set the URL of your catalog.json — the panel will then list available sounds.",
    sl_save_url: "Save",
    sl_error_conn_title: "No connection",
    sl_error_conn_body: "The sound catalog can't be reached right now. Check your connection and try again in a moment.",
    sl_error_detail_label: "Technical detail",
    sl_report_link: "Keeps happening? Report it",
    tts_label: "TTS announcement",
    tts_sub_empty: "Tap › to pick a TTS engine and message",
    tts_agent: "agent",
    tts_agents: "agents",
    tts_no_message: "no message set",
    tts_title: "Pre-adhan TTS",
    tts_pick_agents: "TTS engines",
    tts_no_services: "No TTS engines configured in Home Assistant.",
    tts_message_label: "Announcement message",
    tts_reset_default: "Reset to default",
    tts_msg_hint_full: "Use [prayer] for the prayer name · the default sentence follows the selected language until you customise it",
    tts_message_hint: "It's almost time for [prayer] prayer",
    tts_test: "Test announcement",
    tts_lang_label: "Language",
    tts_lang_auto: "Auto (follow panel)",
    pre_adhan_timing_head: "Timing",
    pre_adhan_minutes_2_label_short: "Interval",
    pre_adhan_active_for_label: "Active for prayers",
    pre_adhan_active_for_none: "No prayers selected",
    pre_adhan_active_for_all: "All prayers",
    pre_adhan_prayers_title: "Pre-adhan for prayers",
  },
  nl: {
    section_location: "Locatie en methode",
    section_prayers: "Gebeden",
    prayers_note: "Een vriendelijke herinnering: alle vijf dagelijkse gebeden blijven verplicht, ongeacht de adhan-instelling hier \u2014 moge Allah ze je gemakkelijk maken.",
    section_dua: "Dua's",
    sound_dua: "Dua",
    sound_dua_sub: "Handmatig afgespeelde smeekbeden",
    dua_none: "Nog geen dua's ingesteld. Voeg er een toe om hem via een knop, dashboard of automatisering af te spelen.",
    dua_add: "Dua toevoegen",
    dua_sound_label: "Geluid",
    dua_sound_none: "Geen geluid gekozen",
    dua_player_label: "Mediaspeler",
    dua_no_player: "Kies een mediaspeler",
    dua_volume_label: "Volume",
    dua_play_test: "Afspelen",
    dua_stop: "Stop",
    dua_remove: "Verwijderen",
    dua_use: "Gebruik",
    dua_trigger_label: "Trigger",
    dua_no_trigger: "Geen trigger",
    dua_trigger_sub: "Speelt af zodra de gekozen entiteit aan of open gaat (max eens per minuut)",
    random_adhan_label: "Willekeurige adhan",
    random_adhan_sub: "Speel bij elk gebed een willekeurige gedownloade adhan",
    sound_row_random_sub: "Willekeurig uit gedownloade adhans",
    support_nida: "Steun Nida",
    section_speakers: "Speakers",
    section_sounds: "Geluiden",
    section_notifications: "Notificaties",
    section_jumuah: "Jumu'ah (vrijdag)",
    section_night_mode: "Nachtmodus",
    location_use_device: "Apparaatlocatie gebruiken",
    location_set_manually: "Handmatig instellen",
    city: "Stad",
    country: "Land",
    calculation_method: "Berekeningsmethode",
    prayer_fajr: "Fajr",
    prayer_dhuhr: "Dhuhr",
    prayer_asr: "Asr",
    prayer_maghrib: "Maghrib",
    prayer_isha: "Isha",
    sound_fajr_adhan: "Fajr-adhan",
    sound_fajr_adhan_sub: "Gebruikt voor Fajr",
    sound_adhan: "Adhan",
    sound_adhan_sub: "Gebruikt voor Dhuhr, Asr, Maghrib, Isha",
    sound_pre_adhan_jingle: "Pre-adhan-jingle",
    sound_pre_adhan_jingle_sub: "Speelt voor elke adhan",
    sound_default: "standaard",
    sounds_group_adhan: "Adhan",
    sounds_group_pre_adhan: "Pre-adhan",
    sounds_group_night: "Nachtmodus",
    section_sound_modes: "Geluidsmodi",
    guest_mode_hours_unit: "uur",
    guest_mode_until_manual: "Gedempt tot je het uitzet",
    silent_mode_button_label: "Stille modus",
    silent_mode_popup_title: "Stille modus",
    silent_mode_popup_duration_label: "Hoe lang?",
    silent_mode_popup_note: "Je krijgt nog steeds meldingen om te bidden. Zowel het adhan-geluid als de pre-adhan worden gedempt.",
    silent_mode_popup_confirm: "Inschakelen",
    silent_mode_popup_update: "Bijwerken",
    silent_mode_popup_turn_off: "Stille modus uitzetten",
    silent_mode_active_until: "Stil tot",
    open_contact_label: "Raam of deur open",
    open_contact_sub: "Ander volume zolang een contactsensor open staat",
    open_contact_sensors_label: "Contactsensoren",
    open_contact_sensors_none: "Geen geselecteerd",
    open_contact_pick_title: "Kies contactsensoren",
    open_contact_no_sensors: "Geen deur-/raamsensoren gevonden in Home Assistant.",
    open_contact_factor_label: "Volume bij open (% van normaal)",
    pre_adhan_test_label: "Test pre-adhan jingle",
    pre_adhan_test_sub: "Speelt de jingle met onderstaand test-volume",
    volume_label: "Volume",
    pre_adhan_minutes_label: "Eerste herinnering",
    pre_adhan_minutes_sub: "Minuten voor elk gebed",
    pre_adhan_two_label: "Tweede herinnering toevoegen",
    pre_adhan_two_sub: "Een tweede melding op een andere interval",
    pre_adhan_minutes_2_label: "Tweede herinnering",
    pre_adhan_minutes_2_sub: "Minuten voor elk gebed",
    minutes_short: "min",
    current_prayer: "Vorig gebed",
    next_prayer: "Volgend gebed",
    remaining: "Resterend",
    starts_at: "Begint om",
    hours: "Uren",
    minutes: "Minuten",
    today_card_title: "Vandaag",
    today_last_updated: "Laatst bijgewerkt",
    today_remaining: "over {h} u {m} m",
    language_label: "Paneeltaal",
    method_pick_title: "Berekeningsmethode",
    language_pick_title: "Paneeltaal",
    country_pick_title: "Land",
    country_clear: "Land wissen",
    speakers_pick_title: "Kies speakers",
    speakers_label: "Adhan-speakers",
    speakers_sub: "Gebruikt bij elk adhan-moment",
    speakers_none: "Geen geselecteerd",
    speakers_count_suffix: "geselecteerd",
    test_speakers_btn: "Test op gekozen speakers",
    speakers_test_label: "Test-afspeel",
    speakers_test_sub: "Speelt test_jingle.mp3 met het test-volume",
    pre_adhan_audio_label: "Pre-adhan audio afspelen",
    pre_adhan_audio_sub: "Speelt de jingle op speakers, niet alleen notificatie",
    test_pre_adhan_btn: "Test pre-adhan jingle op speakers",
    night_mode_label: "Nachtmodus aan",
    night_mode_sub: "Verlaagt volume binnen onderstaande tijd-window",
    night_start_label: "Begintijd",
    night_end_label: "Eindtijd",
    night_volume_label: "Volume tijdens nacht (% van normaal)",
    theme_label: "Thema",
    theme_dark: "Donker",
    theme_light: "Licht",
    theme_auto: "Automatisch",
    theme_ramadan: "Ramadan",
    targets_pick_title: "Kies notificatie-doelen",
    notify_master_label: "Notificaties versturen",
    notify_master_sub: "Push-notificatie bij elk adhan-moment",
    notify_critical_label: "Kritiek",
    notify_critical_sub: "Het waarschuwingsicoon markeert de melding van dat gebed als kritiek, zodat die stille modus / niet storen kan doorbreken op zowel iOS als Android.",
    test_notify_prayer_tooltip: "Stuur een testmelding voor dit gebed (met de huidige kritiek-instelling)",
    notify_targets_label: "Notificatie-doelen",
    notify_targets_none: "Geen geselecteerd",
    notify_tts_workaround_label: "Gesproken melding (Samsung stille-standworkaround): kritieke meldingen naar dit toestel worden hardop voorgelezen in plaats van als gewone meldingstoon afgespeeld — sommige Samsung-telefoons blokkeren apps in het overschrijven van het gewone meldingsgeluid, dus dit is het enige dat betrouwbaar doorbreekt bij stille stand / niet storen.",
    notify_title_label: "Titel",
    notify_message_label: "Bericht",
    notify_message_hint: "Gebruik [prayer] voor de naam van het gebed",
    notify_per_prayer_label: "Notificaties per gebed",
    notify_default_title: "🕌 Nida²",
    notify_default_message: "Het is tijd voor het [prayer]-gebed",
    test_notify_btn: "Test-notificatie versturen",
    test_jumuah_btn: "Test-herinnering versturen",
    test_sending: "Versturen…",
    test_sent: "Verstuurd",
    test_no_targets: "Kies eerst doelen",
    test_failed: "Mislukt",
    jumuah_reminder_label: "Vrijdag-herinnering",
    jumuah_reminder_sub: "Melding voor Jumu'ah op vrijdag",
    jumuah_minutes_label: "Minuten voor Dhuhr",
    jumuah_message_label: "Bericht",
    jumuah_message_hint: "Gebruik [minutes] voor het aantal minuten",
    jumuah_default_message: "Jumu'ah-gebed is over [minutes] minuten",
    jumuah_targets_label: "Jumu'ah-doelen",
    jumuah_targets_pick_title: "Kies Jumu'ah-doelen",
    jumuah_targets_none: "Geen — gebruikt HA-meldingen",
    section_ramadan: "Ramadan",
    imsak_offset_label: "Imsak-afwijking",
    imsak_offset_sub: "Toon Imsak eerder, bijvoorbeeld voor suhoor-voorbereiding",
    section_islamic_calendar: "Islamitische kalender",
    calendar_intro: "Herinneringen voor islamitische feestdagen en aanbevolen vastendagen.",
    days_short: "d",
    calendar_holidays_head: "Feestdagen",
    calendar_holidays_label: "Feestdag-herinneringen",
    calendar_holidays_sub: "Eid al-Fitr, Eid al-Adha, Mawlid, Islamitisch Nieuwjaar",
    calendar_holidays_lead_label: "Herinnering vooraf",
    calendar_holidays_second_label: "Tweede herinnering",
    calendar_holidays_second_lead_label: "Tweede herinnering vooraf",
    calendar_ashura_head: "Vasten op bijzondere dagen",
    calendar_ashura_label: "Ashura- & Arafah-vasten herinneringen",
    calendar_ashura_sub: "Ashura-vasten (9, 10, 11 Muharram) en Dag van Arafah (9 Dhul Hijjah)",
    calendar_white_days_head: "Witte Dagen (Ayyam al-Beed)",
    calendar_white_days_label: "Witte Dagen-herinneringen",
    calendar_white_days_sub: "13e, 14e en 15e van elke Hijri-maand — aanbevolen vastendagen",
    calendar_sunnah_head: "Wekelijks Sunnah-vasten",
    calendar_sunnah_label: "Maandag & donderdag",
    calendar_sunnah_sub: "Wekelijkse Sunnah-vasten herinneringen — elke maandag en donderdag",
    calendar_delivery_head: "Bezorging",
    calendar_targets_label: "Kalender-doelen",
    calendar_targets_pick_title: "Kies kalender-herinneringsdoelen",
    calendar_fire_time_label: "Herinneringstijd",
    calendar_fire_time_sub: "Alle islamitische-kalender-herinneringen vuren op dit tijdstip",
    calendar_upcoming_title: "Aankomende gebeurtenissen",
    calendar_no_events: "Geen aankomende gebeurtenissen",
    calendar_today_label: "Vandaag",
    calendar_tomorrow_label: "Morgen",
    calendar_days_countdown: "{n} dagen",
    calendar_prev_month: "Vorige maand",
    calendar_next_month: "Volgende maand",
    calendar_weekdays_short: "ma,di,wo,do,vr,za,zo",
    calendar_loading: "Laden…",
    calendar_error: "Kalender nu niet beschikbaar.",
    calendar_detail_title: "Details",
    cal_category_holiday: "Feestdag",
    cal_category_fasting: "Vasten",
    cal_event_islamic_new_year_name: "Islamitisch Nieuwjaar",
    cal_event_islamic_new_year_ar: "رأس السنة الهجرية",
    cal_event_islamic_new_year_desc: "De eerste dag van Muharram markeert het begin van de Hijri-kalender, ter herdenking van de Hijrah — de tocht van de Profeet Mohammed ﷺ van Mekka naar Medina in 622 n.Chr. Het is een moment van bezinning, niet van feestelijkheid; veel moslims markeren de dag met extra gebed en dhikr.",
    cal_event_mawlid_name: "Mawlid an-Nabi",
    cal_event_mawlid_ar: "المولد النبوي",
    cal_event_mawlid_desc: "Herdenkt de geboorte van de Profeet Mohammed ﷺ. De invulling verschilt sterk binnen de moslimwereld — van bijeenkomsten, verhalen en liefdadigheid tot gemeenschappen die de dag bewust sober houden, als weerspiegeling van uiteenlopende geleerdenopvattingen.",
    cal_event_eid_al_fitr_name: "Eid al-Fitr",
    cal_event_eid_al_fitr_ar: "عيد الفطر",
    cal_event_eid_al_fitr_desc: "Het 'Feest van het Verbreken van het Vasten' markeert het einde van Ramadan. De dag begint met een speciaal gezamenlijk gebed, gevolgd door Zakat al-Fitr (liefdadigheid aan de armen), feestelijke maaltijden, nieuwe kleding en familiebezoek.",
    cal_event_eid_al_adha_name: "Eid al-Adha",
    cal_event_eid_al_adha_ar: "عيد الأضحى",
    cal_event_eid_al_adha_desc: "Het 'Offerfeest' eert de bereidheid van Ibrahim ﷺ om zijn zoon te offeren uit gehoorzaamheid aan God. Het valt in het Hajj-seizoen en wordt gevierd met een gezamenlijk gebed, de Udhiyah/Qurbani-offergave en het delen van vlees met familie, buren en behoeftigen.",
    cal_event_ashura_pre_name: "Ashura-vasten (9 Muharram)",
    cal_event_ashura_name: "Ashura-vasten (10 Muharram)",
    cal_event_ashura_post_name: "Ashura-vasten (11 Muharram)",
    cal_event_ashura_ar: "عاشوراء",
    cal_event_ashura_desc: "Ashura (10 Muharram) herdenkt de dag waarop God Musa (Mozes) en de Israëlieten redde van Farao. Veel moslims vasten deze dag, vaak samen met de 9e en/of 11e — volgens de aanwijzing van de Profeet ﷺ om een extra dag te vasten zodat de observantie afwijkt van andere tradities.",
    cal_event_arafah_name: "Dag van Arafah",
    cal_event_arafah_ar: "يوم عرفة",
    cal_event_arafah_desc: "De Dag van Arafah is de meest gezegende dag van het islamitische jaar, wanneer pelgrims tijdens de Hajj samenkomen bij de berg Arafah. Voor wie niet op Hajj is, wordt vasten op deze dag sterk aanbevolen — de Profeet ﷺ zei dat het de zonden van het afgelopen en het komende jaar uitwist.",
    cal_event_white_days_name: "Witte Dagen",
    cal_event_white_days_ar: "الأيام البيض",
    cal_event_white_days_desc: "De 'Witte Dagen' — de 13e, 14e en 15e van elke Hijri-maand, genoemd naar de volle maan die ze verlicht. Vasten op deze drie dagen per maand is een gevestigde sunnah, met een beloning die ongeveer gelijkstaat aan een heel jaar vasten.",
    cal_event_weekly_sunnah_name: "Wekelijks sunnah-vasten",
    cal_event_weekly_sunnah_ar: "صيام الاثنين والخميس",
    cal_event_weekly_sunnah_desc: "De Profeet ﷺ vastte regelmatig op maandag en donderdag, en zei dat daden op deze dagen aan God worden voorgelegd — hij wilde dat zijn daden werden voorgelegd terwijl hij vastte. Een eenvoudige, terugkerende vorm van toewijding buiten Ramadan.",
    section_setup: "Setup/Backup",
    setup_section_intro: "Doorloop de setup op elk moment opnieuw — bijvoorbeeld na een verhuizing, of om helemaal opnieuw te beginnen.",
    setup_mode_manual_title: "Handmatig",
    setup_mode_manual_sub: "Doorloop elke instelling zelf, stap voor stap.",
    setup_mode_auto_title: "Automatisch",
    setup_mode_auto_sub: "Locatie wordt gedetecteerd en verstandige standaardwaarden worden gebruikt; jij bevestigt alleen het belangrijkste.",
    setup_mode_restore_title: "Backup herstellen",
    setup_mode_restore_sub: "Laad een eerder geëxporteerd instellingenbestand.",
    setup_confirm_title: "Huidige instellingen overschrijven?",
    setup_confirm_body: "Nida is al ingesteld. Setup opnieuw doorlopen wijzigt je huidige instellingen.",
    setup_wizard_title: "Setup",
    setup_step_label: "Stap",
    setup_wizard_prev: "Terug",
    setup_wizard_next: "Volgende",
    setup_wizard_finish: "Voltooien",
    setup_restore_intro: "Kies een Nida-backupbestand om te herstellen. Dit overschrijft je huidige instellingen.",
    setup_restore_choose_file: "Kies bestand…",
    setup_restore_error_json: "Dit is geen geldig JSON-bestand.",
    setup_restore_error_shape: "Dit bestand lijkt geen Nida-backup te zijn.",
    setup_restore_error_version: "Het formaat van deze backup wordt niet herkend — mogelijk van een andere Nida-versie.",
    setup_restore_preview_title: "Backup klaar om te herstellen",
    setup_restore_apply: "Herstellen",
    setup_auto_location_note: "Je locatie wordt automatisch gedetecteerd via Home Assistant. Bevestig alleen de rekenmethode.",
    setup_auto_prayers_note: "Elk gebed staat standaard aan.",
    setup_auto_pre_adhan_label: "Pre-adhan herinnering",
    setup_auto_pre_adhan_sub: "Een eerste herinnering 20 minuten vooraf, een tweede 5 minuten vooraf — jingle + gesproken aankondiging.",
    setup_auto_dnd_label: "Niet storen doorbreken",
    setup_export_backup: "Download huidige instellingen als backup",
    cancel: "Annuleren",
    continue: "Doorgaan",
    prayer_imsak: "Imsak",
    until_iftar: "Tot Iftar",
    until_prayer: "Tot {prayer}",
    iftar_time_label: "Iftar-tijd",
    iftar_time_sub: "Verbreek je vasten",
    last_prayer: "Vorige gebed",
    iftar_in_tag: "Iftar over {m} m",
    iftar_in_tag_hm: "Iftar over {h} u {m} m",
    resolved_location_sub: "Uit Home Assistant-instellingen",
    search_placeholder: "Zoeken…",
    search_no_results: "Geen treffers",
    close: "Sluiten",
    loading: "Laden…",
    error_prefix: "Fout",
    save_toast_saved: "Opgeslagen",
    location_warning_manual_no_coords_title: "Geen stad gekozen",
    location_warning_manual_no_coords_body: "Kies een stad uit de zoeksuggesties. Tot je dat doet worden Home Assistant's home-coördinaten gebruikt.",
    sl_title: "Geluidsbibliotheek",
    sl_refresh: "Catalogus verversen",
    sl_preview: "Voorbeeld",
    sl_download: "Downloaden",
    sl_delete: "Verwijderen",
    sl_retry: "Opnieuw",
    sl_empty: "Nog geen geluiden in catalogus.",
    sl_error_prefix: "Catalogus-fout",
    sl_url_prompt: "Stel de URL van je catalog.json in — daarna toont het paneel de beschikbare geluiden.",
    sl_save_url: "Opslaan",
    sl_error_conn_title: "Geen verbinding",
    sl_error_conn_body: "De geluidscatalogus is op dit moment niet bereikbaar. Controleer je verbinding en probeer het zo opnieuw.",
    sl_error_detail_label: "Technisch detail",
    sl_report_link: "Blijft dit gebeuren? Meld het",
    tts_label: "TTS-melding",
    tts_sub_empty: "Tik op › om een TTS-engine en bericht te kiezen",
    tts_agent: "engine",
    tts_agents: "engines",
    tts_no_message: "geen bericht ingesteld",
    tts_title: "Pre-adhan TTS",
    tts_pick_agents: "TTS-engines",
    tts_no_services: "Geen TTS-engines in Home Assistant gevonden.",
    tts_message_label: "Aankondiging",
    tts_reset_default: "Herstel standaard",
    tts_msg_hint_full: "Gebruik [prayer] voor de gebedsnaam · de standaardzin volgt de gekozen taal totdat je hem aanpast",
    tts_message_hint: "Het is bijna tijd voor [prayer]",
    tts_test: "Test aankondiging",
    tts_lang_label: "Taal",
    tts_lang_auto: "Auto (volgt paneel)",
    pre_adhan_timing_head: "Timing",
    pre_adhan_minutes_2_label_short: "Interval",
    pre_adhan_active_for_label: "Actief voor gebeden",
    pre_adhan_active_for_none: "Geen gebeden geselecteerd",
    pre_adhan_active_for_all: "Alle gebeden",
    pre_adhan_prayers_title: "Pre-adhan per gebed",
  },
  // Stubs — fall back to en until translated. SKILL.md rule 6 covers the
  // full target set; keep these keys present even when empty so missing-key
  // detection is easy during translation.
  ar: {}, tr: {}, de: {}, fr: {}, ms: {}, id: {}, ur: {}, fa: {},
};

// Mirror of DEFAULT_SOUNDS in const.py. Kept in sync manually — when those
// change in Python the JS list must follow, since the panel reads file
// paths directly from /local/nida/sounds/ for preview playback (the
// scheduler's actual playback uses the Python value, not this one).
const DEFAULT_SOUND_PATHS = {
  fajr_adhan: "adhan/adhan_fajr_ahmed_saeed_al-omrany.mp3",
  adhan: "adhan/adhan_day_ahmed_saeed_al-omrany.mp3",
  pre_adhan_jingle: "pre_adhan_jingle/announcement.mp3",
};

// Where the Sound Library "report it" link points on a connection error.
// Public issues on the repo — a shared, searchable channel beats a private
// inbox for a HACS integration, and links to the list (not /new) so people
// can spot an existing report for the same outage first.
const NIDA_ISSUES_URL = "https://github.com/joohann/Nida/issues";
// 2.0.53 — single source of truth for the donation link; change it
// here if the page ever moves.
const NIDA_SUPPORT_URL = "https://buymeacoffee.com/joohann";
// 2.1.0 — single source of truth for the panel's own version string.
// Used in the footer and tagged onto backup exports (so a future restore
// can tell how old a backup file is). Bump this alongside manifest.json
// at release time — see the "Versiebump" changelog task.
const NIDA_PANEL_VERSION = "2.1.3";

// SVG icons used throughout. Inline so we have one shadow-DOM-safe source of
// truth; copying out of the mockup verbatim per design.md guidance.
const ICONS = {
  brand: `<svg viewBox="0 0 24 24" fill="none" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 21h18M5 21V10l7-7 7 7v11M9 21v-6h6v6"/></svg>`,
  globe: `<svg viewBox="0 0 24 24" fill="none" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 010 18 14 14 0 010-18z"/></svg>`,
  location: `<svg viewBox="0 0 24 24" fill="none" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><polygon points="12 7 13.5 10.5 17 12 13.5 13.5 12 17 10.5 13.5 7 12 10.5 10.5"/></svg>`,
  clock: `<svg viewBox="0 0 24 24" fill="none" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 3"/></svg>`,
  speaker: `<svg viewBox="0 0 24 24" fill="none" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M11 5L6 9H3v6h3l5 4V5z"/><path d="M16 8a5 5 0 010 8"/></svg>`,
  // 2.0.80 — speaker-with-slash for the silent-mode mute button on the
  // now-card, same 1.8 stroke style as the rest.
  mute: `<svg viewBox="0 0 24 24" fill="none" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M11 5L6 9H3v6h3l5 4V5z"/><path d="M23 9l-6 6M17 9l6 6"/></svg>`,
  // 2.0.49 — mixer/sliders icon for the Sound modes section: three
  // vertical tracks with a knob each, same 1.8 stroke as the rest.
  sliders: `<svg viewBox="0 0 24 24" fill="none" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M6 4v6M6 14v6M12 4v2M12 10v10M18 4v10M18 18v2"/><circle cx="6" cy="12" r="2"/><circle cx="12" cy="8" r="2"/><circle cx="18" cy="16" r="2"/></svg>`,
  refresh: `<svg viewBox="0 0 24 24" fill="none" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M20 11a8 8 0 10.9 4"/><path d="M20 4v7h-7"/></svg>`,
  // 2.0.51 — open book for the Duas section, same 1.8 stroke style.
  dua: `<svg viewBox="0 0 24 24" fill="none" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 6c-1.5-1.3-3.6-2-6-2-1 0-2 .13-3 .4V19c1-.27 2-.4 3-.4 2.4 0 4.5.7 6 2 1.5-1.3 3.6-2 6-2 1 0 2 .13 3 .4V4.4c-1-.27-2-.4-3-.4-2.4 0-4.5.7-6 2z"/><path d="M12 6v14.6"/></svg>`,
  // 2.0.53 — heart for the Support Nida footer link.
  heart: `<svg viewBox="0 0 24 24" fill="none" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M20.4 4.6a5.5 5.5 0 00-7.8 0L12 5.2l-.6-.6a5.5 5.5 0 00-7.8 7.8l.6.6L12 20.8l7.8-7.8.6-.6a5.5 5.5 0 000-7.8z"/></svg>`,
  bell: `<svg viewBox="0 0 24 24" fill="none" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8a6 6 0 10-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M10 21a2 2 0 004 0"/></svg>`,
  // 2.0.89 — small alert-triangle marking the per-prayer critical
  // toggle, same 1.8 stroke style as the rest.
  alertTriangle: `<svg viewBox="0 0 24 24" fill="none" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 4l9 16H3z"/><path d="M12 10v4"/><path d="M12 17.5v.01"/></svg>`,
  calendar: `<svg viewBox="0 0 24 24" fill="none" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/></svg>`,
  play: `<svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>`,
  stop: `<svg viewBox="0 0 24 24"><rect x="6" y="6" width="12" height="12" rx="1"/></svg>`,
  chevronRight: `<svg viewBox="0 0 24 24" fill="none" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18l6-6-6-6"/></svg>`,
  // 2.1.2 — month-nav prev arrow for the calendar card, mirrors chevronRight.
  chevronLeft: `<svg viewBox="0 0 24 24" fill="none" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M15 18l-6-6 6-6"/></svg>`,
  chevronDown: `<svg viewBox="0 0 24 24" fill="none" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6"/></svg>`,
  // Six-dot drag handle, mirrors the convention used by HA-native
  // sortable lists. Filled circles read better at small sizes than
  // outline circles, so this one uses fill not stroke.
  dragHandle: `<svg viewBox="0 0 24 24" fill="currentColor"><circle cx="9" cy="6" r="1.6"/><circle cx="15" cy="6" r="1.6"/><circle cx="9" cy="12" r="1.6"/><circle cx="15" cy="12" r="1.6"/><circle cx="9" cy="18" r="1.6"/><circle cx="15" cy="18" r="1.6"/></svg>`,
  refresh: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>`,
  star: `<svg viewBox="0 0 24 24" fill="none" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2l2.5 6.5L21 10l-5 4.5L17.5 21 12 17.5 6.5 21 8 14.5 3 10l6.5-1.5z"/></svg>`,
  check: `<svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12l5 5L20 7"/></svg>`,
  // 2.0.72 — per-prayer sun/moon glyphs shown before each row name in the
  // today card. Same 1.6 stroke family as the rest of the set; the stroke
  // colour is supplied by CSS (.today-icon), never hardcoded here, so the
  // three row states (upcoming, next, past) recolour via the cascade.
  sunrise: `<svg viewBox="0 0 24 24" fill="none" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M3 18h18"/><path d="M8 18a4 4 0 018 0"/><path d="M12 5.5v2"/><path d="M6 12l1.4 1.4"/><path d="M18 12l-1.4 1.4"/><path d="M10.5 8L12 6.5 13.5 8"/></svg>`,
  sun: `<svg viewBox="0 0 24 24" fill="none" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 3.5v2M12 18.5v2M3.5 12h2M18.5 12h2"/><path d="M6 6l1.4 1.4M16.6 16.6L18 18M18 6l-1.4 1.4M7.4 16.6L6 18"/></svg>`,
  sunHigh: `<svg viewBox="0 0 24 24" fill="none" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="10.5" cy="11" r="3.2"/><path d="M10.5 4.5v1.6M4.7 11H6.3M6.4 6.9l1.1 1.1"/><path d="M13 17.5h5.2a2.4 2.4 0 000-4.8 3.2 3.2 0 00-6-1"/></svg>`,
  sunset: `<svg viewBox="0 0 24 24" fill="none" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M3 18h18"/><path d="M8 18a4 4 0 018 0"/><path d="M12 8V6"/><path d="M6 12l1.4 1.4"/><path d="M18 12l-1.4 1.4"/><path d="M10.5 6L12 7.5 13.5 6"/></svg>`,
  moon: `<svg viewBox="0 0 24 24" fill="none" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M20.5 14.2A8.2 8.2 0 1110 3.6a6.4 6.4 0 1010.5 10.6z"/><path d="M17 5.5l.5 1.3 1.3.5-1.3.5-.5 1.3-.5-1.3-1.3-.5 1.3-.5z"/></svg>`,
  // 2.0.73 — completed prayers show a check inside a ring (matches the
  // redesign mockup); replaces the weather glyph on past rows.
  checkCircle: `<svg viewBox="0 0 24 24" fill="none" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M8 12l2.6 2.6L16 9"/></svg>`,
  // 2.0.88 — Iftar block on the Ramadan now-card: covered dish (cloche),
  // same 1.6 stroke family as the prayer glyphs.
  iftar: `<svg viewBox="0 0 24 24" fill="none" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M4 15a8 8 0 0116 0"/><path d="M2.5 15h19"/><path d="M2.5 15c0 1.6 1 3 2.5 3h14c1.5 0 2.5-1.4 2.5-3"/><path d="M12 7V5.5"/><circle cx="12" cy="4.5" r="1"/></svg>`,
};

// 2.0.72 — maps each prayer id to its today-row glyph. Asr uses the
// sun-with-cloud variant so it reads distinctly from midday Dhuhr.
const PRAYER_ICON = { fajr: "sunrise", dhuhr: "sun", asr: "sunHigh", maghrib: "sunset", isha: "moon" };

// Google Fonts injected once globally (shadow DOM can use fonts loaded into
// the document). Stable href reused if already present.
const FONTS_HREF = "https://fonts.googleapis.com/css2?family=Cairo:wght@500;600;700&family=Inter:wght@400;500;600&family=Manrope:wght@500;600;700;800&display=swap";

// Overlay styles live in document <head>, not in the panel's shadow root.
// Reason: overlays are portaled to document.body to escape transform-bearing
// ancestors that turn `position: fixed` into `position: absolute`. We saw
// the overlay drift with scroll position in 2.0.9 because HA's panel
// chrome (or some ancestor) creates a containing block for fixed children.
// Portaling fixes that, but body children don't see shadow-root CSS, so
// these rules need a global scope. The .nida-overlay-portal class is the
// namespace and also re-declares CSS vars so the dark/gold palette
// survives the move out of shadow.
const NIDA_OVERLAY_CSS = `
.nida-overlay-portal {
  --nida-bg: #081326;
  --nida-surface: #111D39;
  --nida-surface-raised: #18254A;
  --nida-gold: #7C5CFF;
  --nida-gold-soft: #34386A;
  --nida-gold-bright: #F6C24A;
  --nida-text: #F8F8FA;
  --nida-text-dim: #B9BED4;
  --nida-border: #232A45;
  --nida-radius: 12px;
  /* 2.0.99 — FIXED: --nida-critical / --nida-critical-soft were never
     declared for the portal, only inside the shadow-DOM :host block
     (nida-panel.js ~7165). The portal is a <dialog> appended to
     document.body, outside the shadow root, so it can't see that value
     at all — var(--nida-critical) resolved to nothing, making the
     border-color declaration invalid and falling back to the plain
     --nida-border colour, IDENTICAL in both the on and off state. This
     is exactly what made the new TTS-workaround toggle (2.0.95) in the
     notify-targets overlay impossible to read visually. Theme-
     independent by design (matches the shadow-DOM original: "should
     read as urgent consistently, not shift with the palette"), so one
     declaration here covers every .theme-* variant below, same as the
     shadow DOM only needs it once on :host. */
  --nida-critical: #E5484D;
  --nida-critical-soft: rgba(229, 72, 77, 0.16);
  /* Override <dialog> defaults to fill the viewport. The browser already
     placed us in the top layer thanks to showModal(), so this sizing is
     immune to any transform-bearing ancestor.  */
  position: fixed;
  inset: 0;
  width: 100vw;
  height: 100vh;
  max-width: 100vw;
  max-height: 100vh;
  border: 0;
  padding: 0;
  margin: 0;
  background: transparent;
  color: var(--nida-text);
  font-family: 'Inter', sans-serif;
  overflow: hidden;
}
.nida-overlay-portal.theme-light {
  /* 2.0.72 — dialogs share the cream + sage-green light palette so the
     settings overlays match the reskinned panel. */
  --nida-bg: #FAFAF2;
  --nida-surface: #ffffff;
  --nida-surface-raised: #DDE8CF;
  --nida-gold: #5B7F46;
  --nida-gold-soft: #E7EBD9;
  --nida-gold-bright: #4E6E3B;
  --nida-text: #243024;
  --nida-text-dim: #6D7568;
  --nida-border: #E7EBD9;
}
.nida-overlay-portal.theme-ramadan-dark {
  /* 2.0.86 — dialogs share the Ramadan emerald + gold palette.
     2.0.88 — renamed from .theme-ramadan (dark/light variant split). */
  --nida-bg: #08140F;
  --nida-surface: #11241B;
  --nida-surface-raised: #163327;
  --nida-gold: #C9A227;
  --nida-gold-soft: #2A3E30;
  --nida-gold-bright: #36D98A;
  --nida-text: #F5F7F5;
  --nida-text-dim: #A7B3A7;
  --nida-border: rgba(246, 194, 74, 0.15);
}
.nida-overlay-portal.theme-ramadan-light {
  /* 2.0.88 — light Ramadan variant: cream/sage with gold accents. */
  --nida-bg: #FAFAF2;
  --nida-surface: #ffffff;
  --nida-surface-raised: #DDE8CF;
  --nida-gold: #A67C1A;
  --nida-gold-soft: #E7EBD9;
  --nida-gold-bright: #4E6E3B;
  --nida-text: #243024;
  --nida-text-dim: #6D7568;
  --nida-border: #E7EBD9;
}
@media (prefers-color-scheme: light) {
  .nida-overlay-portal.theme-auto {
    --nida-bg: #FAFAF2;
    --nida-surface: #ffffff;
    --nida-surface-raised: #DDE8CF;
    --nida-gold: #5B7F46;
    --nida-gold-soft: #E7EBD9;
    --nida-gold-bright: #4E6E3B;
    --nida-text: #243024;
    --nida-text-dim: #6D7568;
    --nida-border: #E7EBD9;
  }
}
.nida-overlay-portal::backdrop {
  /* 2.1.3 — darker + a soft blur so the popup separates more clearly
     from the panel behind it (Johann: background should be darker and
     a bit blurred). backdrop-filter isn't supported by every engine
     that renders <dialog>::backdrop, but degrades gracefully to the
     plain darker scrim when unsupported. */
  background: rgba(0, 0, 0, 0.72);
  backdrop-filter: blur(4px);
  -webkit-backdrop-filter: blur(4px);
}
.nida-overlay-portal * { box-sizing: border-box; margin: 0; padding: 0; }
.nida-overlay-portal .overlay {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
  /* 2.0.66 — the overlay itself scrolls when its content exceeds the
     viewport (welcome panel on mobile). overflow-y auto here plus
     overscroll-behavior contain stops the scroll from leaking into the
     background page behind the dialog. */
  overflow-y: auto;
  overscroll-behavior: contain;
  -webkit-overflow-scrolling: touch;
}
.nida-overlay-portal .overlay-panel {
  background: var(--nida-surface);
  border: 1px solid var(--nida-border);
  border-radius: var(--nida-radius);
  width: 100%;
  max-width: 460px;
  max-height: 80vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
/* 2.0.66 — the welcome panel is wider and taller than the settings
   overlays; let it use more vertical space on mobile so it doesn't
   clip. align-items flex-start (not center) lets it scroll past the
   top when content exceeds the viewport. */
.nida-overlay-portal .overlay:has(.welcome-panel) {
  align-items: flex-start;
}
.nida-overlay-portal .overlay-panel.welcome-panel {
  max-height: none;
}
.nida-overlay-portal .overlay-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 18px;
  border-bottom: 1px solid var(--nida-border);
  font-family: var(--nida-display-font, 'Cairo', sans-serif);
  font-weight: 600;
  font-size: 15px;
  color: var(--nida-text);
}
.nida-overlay-portal .overlay-close {
  background: transparent;
  border: none;
  color: var(--nida-text-dim);
  font-size: 16px;
  line-height: 1;
  padding: 4px 8px;
  cursor: pointer;
}
.nida-overlay-portal .overlay-close:hover { color: var(--nida-text); }
.nida-overlay-portal .overlay-list { overflow-y: auto; flex: 1; }
.nida-overlay-portal .overlay-item {
  padding: 12px 18px;
  font-size: 14px;
  color: var(--nida-text);
  border-bottom: 1px solid var(--nida-border);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}
.nida-overlay-portal .overlay-item:last-child { border-bottom: none; }
.nida-overlay-portal .overlay-item:hover { background: var(--nida-surface-raised); }
.nida-overlay-portal .overlay-item.active { color: var(--nida-gold-bright); }
/* 2.0.95 — mirrors the shadow-DOM ruleset below (this is the <dialog>
   top-layer portal copy; see the "HA transform-ancestors" note in the
   architecture reference for why overlays are duplicated like this). */
.nida-overlay-portal .overlay-item-controls {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-shrink: 0;
}
.nida-overlay-portal .overlay-check svg { width: 16px; height: 16px; stroke: var(--nida-gold-bright); }
.nida-overlay-portal .toggle-mini {
  width: 26px;
  height: 26px;
  border-radius: 8px;
  background: var(--nida-bg);
  border: 1px solid var(--nida-border);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  cursor: pointer;
}
.nida-overlay-portal .toggle-mini svg { width: 14px; height: 14px; stroke: var(--nida-text-dim); }
.nida-overlay-portal .toggle-mini.critical.on {
  background: var(--nida-critical-soft);
  border-color: var(--nida-critical);
}
.nida-overlay-portal .toggle-mini.critical.on svg { stroke: var(--nida-critical); }
.nida-overlay-portal .overlay-search {
  padding: 12px 18px;
  border-bottom: 1px solid var(--nida-border);
}
.nida-overlay-portal .overlay-search input {
  width: 100%;
  background: var(--nida-bg);
  border: 1px solid var(--nida-border);
  border-radius: 8px;
  padding: 9px 12px;
  font-size: 14px;
  color: var(--nida-text);
  font-family: inherit;
  outline: none;
}
.nida-overlay-portal .overlay-search input:focus { border-color: var(--nida-gold-soft); }
.nida-overlay-portal .overlay-empty {
  padding: 24px 18px;
  text-align: center;
  font-size: 13px;
  color: var(--nida-text-dim);
}
.nida-overlay-portal .welcome-panel {
  max-width: 560px;
  padding: 36px 40px 32px;
  text-align: center;
  /* 2.0.66 — welcome is the tallest overlay; on mobile it overflows
     max-height. Allow the panel itself to scroll so the CTA button is
     always reachable, and shrink padding on narrow screens. */
  overflow-y: auto;
  overscroll-behavior: contain;
}
@media (max-width: 600px) {
  .nida-overlay-portal .welcome-panel {
    padding: 28px 22px 24px;
    max-height: 90vh;
  }
  .nida-overlay-portal .welcome-text,
  .nida-overlay-portal .welcome-features li {
    text-align: center;
  }
}
.nida-overlay-portal .welcome-bismillah {
  font-family: var(--nida-display-font, 'Cairo', sans-serif);
  font-size: 22px;
  line-height: 1.6;
  color: var(--nida-gold-bright);
  margin-bottom: 18px;
  direction: rtl;
}
.nida-overlay-portal .welcome-salam {
  font-family: var(--nida-display-font, 'Cairo', sans-serif);
  font-weight: 700;
  font-size: 18px;
  color: var(--nida-text);
  margin-bottom: 22px;
}
.nida-overlay-portal .welcome-text {
  font-size: 14px;
  line-height: 1.6;
  color: var(--nida-text);
  margin-bottom: 14px;
  text-align: left;
}
.nida-overlay-portal .welcome-divider {
  height: 1px;
  background: var(--nida-border);
  margin: 20px 0;
}
.nida-overlay-portal .welcome-features {
  list-style: none;
  padding: 0;
  margin: 0;
  text-align: left;
}
.nida-overlay-portal .welcome-features li {
  font-size: 13px;
  color: var(--nida-text-dim);
  padding: 6px 0;
}
.nida-overlay-portal .welcome-thanks {
  font-size: 13px;
  color: var(--nida-text);
  font-style: italic;
  margin-bottom: 6px;
}
.nida-overlay-portal .welcome-author {
  font-size: 12px;
  color: var(--nida-text-dim);
  margin-bottom: 26px;
}
.nida-overlay-portal .welcome-cta {
  background: var(--nida-gold);
  color: var(--nida-bg);
  border: none;
  border-radius: 8px;
  padding: 11px 28px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  font-family: inherit;
  transition: background 0.15s;
}
.nida-overlay-portal .welcome-cta:hover { background: var(--nida-gold-bright); }
.nida-overlay-portal .welcome-cta:disabled {
  /* 2.1.0 — the restore dialog's "Restore" button is disabled until a
     valid backup file is loaded; needed a disabled state, which the
     welcome overlay's own CTA never required. */
  opacity: 0.4;
  cursor: default;
  background: var(--nida-gold);
}

/* Sound Library overlay (2.0.30) — scoped to the portal because the
   overlay is rendered into a body-level <dialog>, not the shadow DOM.
   2.0.28's first cut had these rules in the shadow stylesheet so none
   applied. */
.nida-overlay-portal .sound-library-panel {
  max-width: 540px;
  width: 92vw;
  max-height: 85vh;
  display: flex;
  flex-direction: column;
  padding: 0;
}
.nida-overlay-portal .sound-library-panel .overlay-header {
  padding: 16px 18px;
  border-bottom: 1px solid var(--nida-border);
}
.nida-overlay-portal .overlay-header-actions {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-left: auto;
}
.nida-overlay-portal .sl-refresh-btn {
  background: transparent;
  border: 1px solid var(--nida-border);
  border-radius: 8px;
  color: var(--nida-text);
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  padding: 0;
}
.nida-overlay-portal .sl-refresh-btn svg { width: 14px; height: 14px; }
.nida-overlay-portal .sl-refresh-btn:hover { background: var(--nida-surface-raised); }
.nida-overlay-portal .sl-refresh-btn:disabled { opacity: 0.5; cursor: wait; }

.nida-overlay-portal .sound-library-body {
  flex: 1;
  overflow-y: auto;
}
.nida-overlay-portal .sl-cat-head {
  padding: 16px 18px 8px;
  font-family: var(--nida-display-font, 'Cairo', sans-serif);
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--nida-gold-bright);
  background: var(--nida-surface-raised);
  border-bottom: 1px solid var(--nida-border);
}
.nida-overlay-portal .sl-cat-head:not(:first-child) {
  border-top: 1px solid var(--nida-border);
}
.nida-overlay-portal .sl-list {
  display: flex;
  flex-direction: column;
}
/* Each row is a horizontal flex. Buttons get flex-shrink:0 so the
   name (flex:1) is what gives way when the panel is narrow, never
   the controls. */
.nida-overlay-portal .sl-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 18px;
  border-bottom: 1px solid var(--nida-border);
  cursor: pointer;
  transition: background 120ms ease;
}
.nida-overlay-portal .sl-row:hover { background: var(--nida-surface-raised); }
/* Active state is loud on purpose — the previous gold-soft background
   alone was almost invisible on the dark theme. Gold left-bar +
   tinted background + bold name + checkmark icon = unmissable. */
.nida-overlay-portal .sl-row.active {
  background: linear-gradient(
    90deg,
    rgba(218, 165, 32, 0.18) 0%,
    rgba(218, 165, 32, 0.04) 100%
  );
  box-shadow: 4px 0 0 0 var(--nida-gold-bright) inset;
}
.nida-overlay-portal .sl-row.active .sl-name {
  color: var(--nida-gold-bright);
  font-weight: 600;
}
.nida-overlay-portal .sl-name {
  flex: 1 1 auto;
  min-width: 0;
  font-size: 14px;
  color: var(--nida-text);
  display: flex;
  align-items: center;
  gap: 8px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.nida-overlay-portal .sl-active-dot {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: var(--nida-gold-bright);
  color: var(--nida-bg);
  font-size: 11px;
  flex-shrink: 0;
}
.nida-overlay-portal .sl-active-dot svg {
  width: 12px;
  height: 12px;
  stroke: var(--nida-bg);
  stroke-width: 3;
}
.nida-overlay-portal .sl-btn {
  width: 34px;
  height: 34px;
  border-radius: 8px;
  background: transparent;
  border: 1px solid var(--nida-gold-soft);
  color: var(--nida-text);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  font-size: 16px;
  flex-shrink: 0;
}
.nida-overlay-portal .sl-btn:hover { background: var(--nida-surface-raised); }
.nida-overlay-portal .sl-btn svg { width: 14px; height: 14px; fill: currentColor; }
.nida-overlay-portal .sl-btn.sl-use {
  /* 2.0.54 — explicit select affordance for dua rows; width auto
     because it holds text rather than an icon. */
  width: auto;
  padding: 0 12px;
  font-size: 12.5px;
  color: var(--nida-gold-bright);
}
.nida-overlay-portal .sl-btn.delete {
  color: #c25a4f;
  border-color: rgba(194, 90, 79, 0.45);
}
.nida-overlay-portal .sl-btn.delete:hover { background: rgba(194, 90, 79, 0.12); }
.nida-overlay-portal .sl-btn:disabled { opacity: 0.5; cursor: wait; }
.nida-overlay-portal .sl-empty {
  padding: 32px 24px;
  text-align: center;
  color: var(--nida-text-dim);
  font-size: 14px;
}
.nida-overlay-portal .sl-error { color: #c25a4f; }
.nida-overlay-portal .sl-error .test-btn { margin-top: 12px; }

/* 2.0.40 — friendlier connection-error card (replaces the raw code dump).
   Amber/gold tone rather than alarm-red, since a 502/timeout is usually
   transient. Retry is the primary action; the report link is a quiet
   secondary; the raw code lives in a muted detail line for debugging. */
.nida-overlay-portal .sl-error-icon {
  font-size: 26px;
  line-height: 1;
  color: var(--nida-gold-bright);
  margin-bottom: 8px;
}
.nida-overlay-portal .sl-error-title {
  font-family: var(--nida-display-font, 'Cairo', sans-serif);
  font-weight: 700;
  font-size: 16px;
  color: var(--nida-text);
  margin-bottom: 6px;
}
.nida-overlay-portal .sl-error-body {
  font-size: 13px;
  color: var(--nida-text-dim);
  line-height: 1.5;
  max-width: 340px;
  margin: 0 auto 14px;
}
.nida-overlay-portal .sl-error-actions {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
}
.nida-overlay-portal .sl-error-actions .test-btn { margin-top: 0; }
.nida-overlay-portal .sl-report-link {
  font-size: 12px;
  color: var(--nida-gold-bright);
  text-decoration: none;
  border-bottom: 1px solid transparent;
}
.nida-overlay-portal .sl-report-link:hover {
  border-bottom-color: var(--nida-gold-soft);
}
.nida-overlay-portal .sl-error-detail {
  margin-top: 14px;
  font-family: 'Inter', monospace, sans-serif;
  font-size: 11px;
  color: var(--nida-text-dim);
  opacity: 0.7;
  word-break: break-word;
}

/* 2.1.0 — setup-wizard confirm/shell overlay. Body text + action row,
   same structural idea as the sl-error card above but neutral (not
   amber/red — this is a routine confirmation, not an error state). */
.nida-overlay-portal .setup-confirm-body {
  padding: 18px;
}
.nida-overlay-portal .setup-confirm-text {
  font-size: 13px;
  color: var(--nida-text-dim);
  line-height: 1.5;
  margin-bottom: 16px;
}
.nida-overlay-portal .setup-confirm-actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
}

/* 2.1.0 — backup restore: file picker + preview/error state, reusing
   .setup-confirm-body/.setup-confirm-text/.setup-confirm-actions above
   for the surrounding layout. */
.nida-overlay-portal .setup-restore-file-label {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 4px 0 12px;
  padding: 10px 12px;
  background: var(--nida-bg);
  border: 1px dashed var(--nida-border);
  border-radius: 8px;
  font-size: 13px;
  color: var(--nida-text-dim);
  cursor: pointer;
}
.nida-overlay-portal .setup-restore-file-label:hover {
  border-color: var(--nida-gold-soft);
}
.nida-overlay-portal .setup-restore-file-label input[type="file"] {
  /* Native control hidden — the label itself is the clickable target,
     matching the rest of the panel's row-as-button pattern. */
  position: absolute;
  width: 1px;
  height: 1px;
  opacity: 0;
  overflow: hidden;
}
.nida-overlay-portal .setup-restore-error {
  font-size: 13px;
  color: #c25a4f;
  margin-bottom: 12px;
}
.nida-overlay-portal .setup-restore-preview {
  background: var(--nida-bg);
  border: 1px solid var(--nida-gold-soft);
  border-radius: 8px;
  padding: 10px 12px;
  margin-bottom: 12px;
}
.nida-overlay-portal .setup-restore-preview-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--nida-text);
  margin-bottom: 2px;
}
.nida-overlay-portal .setup-restore-preview-line {
  font-size: 12px;
  color: var(--nida-text-dim);
}

/* 2.1.2 — calendar event detail overlay (opened from a calendar-card day
   cell or an "upcoming events" list item). Plain text/icon content, no
   .card/.toggle/.select-field reuse needed, so — unlike the calendar card
   itself — this is a normal portal dialog. Multiple events on the same
   day (e.g. White Days + Weekly Sunnah coinciding) render as stacked
   .calendar-detail-block sections separated by a divider. */
.nida-overlay-portal .calendar-detail-panel { max-width: 420px; }
.nida-overlay-portal .calendar-detail-body {
  padding: 18px 20px 20px;
  overflow-y: auto;
}
.nida-overlay-portal .calendar-detail-block { text-align: center; }
.nida-overlay-portal .calendar-detail-emoji {
  font-size: 34px;
  margin-bottom: 8px;
}
.nida-overlay-portal .calendar-detail-name {
  font-family: var(--nida-display-font, 'Cairo', sans-serif);
  font-weight: 700;
  font-size: 17px;
  color: var(--nida-text);
  margin-bottom: 4px;
}
.nida-overlay-portal .calendar-detail-ar {
  font-family: 'Cairo', serif;
  font-size: 16px;
  color: var(--nida-gold-bright);
  margin-bottom: 6px;
}
.nida-overlay-portal .calendar-detail-dates {
  font-size: 12px;
  color: var(--nida-text-dim);
  margin-bottom: 8px;
}
.nida-overlay-portal .calendar-detail-category {
  display: inline-block;
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--nida-gold-bright);
  background: var(--nida-gold-soft);
  border-radius: 999px;
  padding: 3px 10px;
  margin-bottom: 12px;
}
.nida-overlay-portal .calendar-detail-desc {
  font-size: 13px;
  line-height: 1.6;
  color: var(--nida-text-dim);
  text-align: left;
}
.nida-overlay-portal .calendar-detail-divider {
  height: 1px;
  background: var(--nida-border);
  margin: 18px 0;
}

/* 2.0.40 — bundled-default sounds: a small "default" chip next to the
   name and a lock in place of the delete button. Rendered only when the
   catalog marks a sound as default/bundled. */
.nida-overlay-portal .sl-default-chip {
  flex-shrink: 0;
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--nida-gold-bright);
  border: 1px solid var(--nida-gold-soft);
  border-radius: 999px;
  padding: 1px 8px;
  margin-left: 4px;
}
.nida-overlay-portal .sl-btn.locked {
  border-color: transparent;
  cursor: default;
  opacity: 0.55;
  font-size: 14px;
}
.nida-overlay-portal .sl-btn.locked:hover { background: transparent; }
.nida-overlay-portal .sl-url-prompt {
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.nida-overlay-portal .sl-url-explain {
  font-size: 13px;
  color: var(--nida-text-dim);
  line-height: 1.4;
}
.nida-overlay-portal .sl-url-input {
  width: 100%;
  padding: 10px 12px;
  background: var(--nida-bg);
  border: 1px solid var(--nida-border);
  border-radius: 8px;
  color: var(--nida-text);
  font-family: 'Inter', sans-serif;
  font-size: 13px;
  box-sizing: border-box;
}
.nida-overlay-portal .tts-section-head {
  padding: 16px 18px 8px;
  font-family: var(--nida-display-font, 'Cairo', sans-serif);
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--nida-gold-bright);
  background: var(--nida-surface-raised);
  border-bottom: 1px solid var(--nida-border);
}
.nida-overlay-portal .tts-section-head:not(:first-child) {
  border-top: 1px solid var(--nida-border);
}
.nida-overlay-portal .tts-pick-row .sl-name {
  flex: 1 1 auto;
  min-width: 0;
}
.nida-overlay-portal .tts-entity-id {
  flex-shrink: 0;
  font-family: 'Inter', monospace, sans-serif;
  font-size: 11px;
  color: var(--nida-text-dim);
  background: var(--nida-surface-raised);
  padding: 3px 8px;
  border-radius: 4px;
  margin-left: 8px;
  max-width: 220px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.nida-overlay-portal .tts-message-wrap {
  padding: 12px 18px 8px;
}
.nida-overlay-portal .tts-lang-row {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 12px;
}
.nida-overlay-portal .tts-lang-label {
  font-size: 13px;
  color: var(--nida-text-dim);
  flex-shrink: 0;
}
.nida-overlay-portal .tts-lang-select {
  flex: 1;
  padding: 8px 12px;
  background: var(--nida-bg);
  border: 1px solid var(--nida-border);
  border-radius: 8px;
  color: var(--nida-text);
  font-family: 'Inter', sans-serif;
  font-size: 13px;
  cursor: pointer;
}
.nida-overlay-portal .tts-test-row {
  padding: 12px 18px 16px;
}
/* 2.0.43 — .test-btn styling for the portal. The shadow-DOM stylesheet
   already has it, but this overlay renders in the body-level <dialog>
   portal (same scoping trap as 2.0.30's sl-* rules), so the Test-
   announcement button fell back to the browser default look. */
.nida-overlay-portal .test-btn {
  background: transparent;
  border: 1px solid var(--nida-gold-soft);
  color: var(--nida-gold-bright);
  font-family: inherit;
  font-size: 13px;
  font-weight: 500;
  padding: 8px 16px;
  border-radius: 8px;
  cursor: pointer;
  transition: background 0.12s, border-color 0.12s;
}
.nida-overlay-portal .test-btn:hover:not(:disabled) {
  background: var(--nida-surface-raised);
  border-color: var(--nida-gold);
}
.nida-overlay-portal .test-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.nida-overlay-portal .test-btn.test-success {
  border-color: var(--nida-gold);
  background: var(--nida-surface-raised);
}
.nida-overlay-portal .test-btn.test-error {
  border-color: #b8543b;
  color: #f5b6a3;
}
/* 2.0.43 — always-visible [prayer] hint under the TTS message field.
   The placeholder hint disappears the moment the user types, which is
   exactly when they need to remember the [prayer] token. */
.nida-overlay-portal .tts-msg-hint {
  margin-top: 6px;
  font-size: 11px;
  color: var(--nida-text-dim);
}
.nida-overlay-portal .tts-msg-hint-row {
  /* 2.0.56 — hint left, reset-to-default button right. */
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}
.nida-overlay-portal .tts-reset-btn {
  flex-shrink: 0;
  font-size: 11.5px;
  padding: 4px 10px;
}
.nida-overlay-portal .tts-reset-btn[disabled] {
  opacity: 0.45;
  cursor: default;
}
.nida-overlay-portal .pap-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 18px;
  border-bottom: 1px solid var(--nida-border);
  cursor: pointer;
}
.nida-overlay-portal .pap-row .sl-name {
  flex: 1;
  font-size: 15px;
}
.nida-overlay-portal .pap-row:hover { background: var(--nida-surface-raised); }
.nida-overlay-portal .pap-row .toggle {
  width: 44px;
  height: 24px;
  border-radius: 999px;
  background: var(--nida-border);
  display: flex;
  align-items: center;
  padding: 0 3px;
  transition: background 120ms ease;
  flex-shrink: 0;
}
.nida-overlay-portal .pap-row .toggle.on {
  background: var(--nida-gold-bright);
  justify-content: flex-end;
}
.nida-overlay-portal .pap-row .toggle-knob {
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: var(--nida-bg);
}

/* Silent mode popup (2.0.80) — small form: status line (when already
   active), a duration dropdown, a note that prayer notifications still
   come through, and confirm/turn-off buttons. Reuses the base
   .overlay-panel sizing (max-width 460px). */
.nida-overlay-portal .silent-mode-panel {
  max-width: 380px;
}
.nida-overlay-portal .silent-mode-body {
  padding: 18px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.nida-overlay-portal .silent-mode-status {
  font-size: 13px;
  font-weight: 600;
  color: var(--nida-gold-bright);
}
.nida-overlay-portal .silent-mode-label {
  font-size: 13px;
  color: var(--nida-text-dim);
}
.nida-overlay-portal .silent-mode-select {
  width: 100%;
  padding: 10px 12px;
  background: var(--nida-bg);
  border: 1px solid var(--nida-border);
  border-radius: 8px;
  color: var(--nida-text);
  font-family: 'Inter', sans-serif;
  font-size: 14px;
  cursor: pointer;
}
.nida-overlay-portal .silent-mode-note {
  font-size: 12.5px;
  line-height: 1.5;
  color: var(--nida-text-dim);
}
.nida-overlay-portal .silent-mode-actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 10px;
  margin-top: 4px;
}
.nida-overlay-portal .silent-mode-off {
  border-color: #b8543b;
  color: #f5b6a3;
  margin-right: auto;
}
.nida-overlay-portal .silent-mode-confirm {
  background: var(--nida-gold);
  border-color: var(--nida-gold);
  color: var(--nida-bg);
}
.nida-overlay-portal .silent-mode-confirm:hover {
  background: var(--nida-gold-bright);
  border-color: var(--nida-gold-bright);
}
`;


// Hardcoded ISO 3166-1 alpha-2 country codes — used as the source of
// truth for the country dropdown. Intl.supportedValuesOf("region") would
// be more elegant but isn't available in every browser/HA setup; this
// list is stable enough that maintenance cost is near zero. Names are
// looked up at render time via Intl.DisplayNames so we get localized
// display in every supported panel language without shipping translations.
const COUNTRY_CODES = [
  "AD","AE","AF","AG","AI","AL","AM","AO","AQ","AR","AS","AT","AU","AW","AX","AZ",
  "BA","BB","BD","BE","BF","BG","BH","BI","BJ","BL","BM","BN","BO","BQ","BR","BS","BT","BV","BW","BY","BZ",
  "CA","CC","CD","CF","CG","CH","CI","CK","CL","CM","CN","CO","CR","CU","CV","CW","CX","CY","CZ",
  "DE","DJ","DK","DM","DO","DZ",
  "EC","EE","EG","EH","ER","ES","ET",
  "FI","FJ","FK","FM","FO","FR",
  "GA","GB","GD","GE","GF","GG","GH","GI","GL","GM","GN","GP","GQ","GR","GS","GT","GU","GW","GY",
  "HK","HM","HN","HR","HT","HU",
  "ID","IE","IL","IM","IN","IO","IQ","IR","IS","IT",
  "JE","JM","JO","JP",
  "KE","KG","KH","KI","KM","KN","KP","KR","KW","KY","KZ",
  "LA","LB","LC","LI","LK","LR","LS","LT","LU","LV","LY",
  "MA","MC","MD","ME","MF","MG","MH","MK","ML","MM","MN","MO","MP","MQ","MR","MS","MT","MU","MV","MW","MX","MY","MZ",
  "NA","NC","NE","NF","NG","NI","NL","NO","NP","NR","NU","NZ",
  "OM",
  "PA","PE","PF","PG","PH","PK","PL","PM","PN","PR","PS","PT","PW","PY",
  "QA",
  "RE","RO","RS","RU","RW",
  "SA","SB","SC","SD","SE","SG","SH","SI","SJ","SK","SL","SM","SN","SO","SR","SS","ST","SV","SX","SY","SZ",
  "TC","TD","TF","TG","TH","TJ","TK","TL","TM","TN","TO","TR","TT","TV","TW","TZ",
  "UA","UG","UM","US","UY","UZ",
  "VA","VC","VE","VG","VI","VN","VU",
  "WF","WS",
  "YE","YT",
  "ZA","ZM","ZW",
];

function listCountries(lang) {
  let dn = null;
  try {
    dn = new Intl.DisplayNames([lang], { type: "region" });
  } catch {
    // Intl.DisplayNames missing too — fall back to raw codes.
  }
  return COUNTRY_CODES
    .map((code) => ({ code, name: dn ? (dn.of(code) || code) : code }))
    .sort((a, b) => a.name.localeCompare(b.name, lang));
}

function localizedCountryName(code, lang) {
  if (!code) return "";
  try {
    return new Intl.DisplayNames([lang], { type: "region" }).of(code) || code;
  } catch {
    return code;
  }
}

// Welcome overlay content — shown once on first visit to /nida. Kept here
// in JS rather than via strings.json because HA's config-flow description
// rendering proved unreliable in Johann's setup; this lives entirely in
// the panel and works regardless of HA's translation pipeline.
const WELCOME_CONTENT = {
  bismillah: "بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ",
  salam: "Assalamu Alaikum wa Rahmatullahi wa Barakatuh 🌙",
  intro: "Welcome to <strong>Nida</strong> for Home Assistant — a complete and customizable Islamic prayer companion for your smart home.",
  blessing: "May Allah ﷺ accept your prayers and make this integration a means of khayr (goodness) in your household.",
  features: [
    "🕌 Location-based prayer times via the AlAdhan API",
    "🔔 Pre-adhan reminders with sound and spoken message",
    "🌅 Dedicated Fajr adhan",
    "📢 Adhan for all prayers with day and night volume",
    "📱 Device notifications to mobile and speakers",
    "🌙 Ramadan features — Suhoor alarm and Tarhim",
    "📅 Hijri calendar with Islamic holidays",
  ],
  thanks: "May Allah reward the team at aladhan.com abundantly. Ameen. 🤲",
  author: "— Iftikhar Farzan Izz Al Din Muhsin",
  cta: "Get started",
};

// ─────────────────────────────────────────────────────────────────────────────
// Custom element
// ─────────────────────────────────────────────────────────────────────────────

class NidaPanel extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._hass = null;
    this._entryId = null;
    this._settings = null;
    this._haInfo = null;                  // {location_name, latitude, longitude}
    this._mediaPlayers = [];              // [{entity_id, name, state}]
    this._duaPickId = null;               // dua id being edited in the library, or "new"
    this._notifyServices = [];            // [{service, full}] from nida/list_notify_services
    this._error = null;
    this._loaded = false;
    this._activeOverlay = null;          // "method" | "language" | "country" | "speakers" | "notify-targets" | "welcome" | null
    this._countdownInterval = null;
    this._currentAudio = null;            // {category, audioEl} while previewing
    this._overlaySearchQuery = "";        // live filter text for searchable overlays
    this._overlayPortal = null;           // body-attached div for overlays (escapes shadow + transform ancestors)
    this._citySuggestions = [];           // Nominatim hits for the city input
    this._cityQuery = "";                 // last typed city query (for stale-response filtering)
    this._cityDebounce = null;            // pending setTimeout for the next city search
    this._cityJustPicked = false;         // suppress the deferred blur right after a pick
    // Stable bound reference so add/removeEventListener match the same fn.
    this._clickHandler = this._handleClick.bind(this);
  }

  // ───── Lifecycle ──────────────────────────────────────────────────────────

  set hass(hass) {
    const firstTime = !this._hass;
    this._hass = hass;
    if (firstTime) {
      this._render();
      this._init().then(() => this._render());
    } else if (this._loaded) {
      // Subsequent state-change updates: only refresh dynamic nodes; leaving
      // settings UI alone keeps focus/typing intact.
      this._updateLiveNodes();
    }
  }

  set panel(_panel) {
    // panel.config currently unused — accepted for HA's panel_custom contract.
  }

  connectedCallback() {
    this._injectGlobalsOnce();
    // Register the click delegator ONCE on the shadow root. Re-registering in
    // _render() (as the 2.0.0 placeholder did) caused listeners to stack up:
    // after N renders every click fired N times, which on toggle/save flows
    // produced "first action works, every subsequent action looks dead".
    this.shadowRoot.addEventListener("click", this._clickHandler);
    // 2.0.59 — delegated change handling for <select> fields in the
    // main panel, mirroring the portal fix of 2.0.58: the per-element
    // listener for the dua player select used the same wiring that
    // demonstrably never fired for the TTS language select, leaving
    // media_player empty and play_dua silently refusing. Registered
    // once here (like the click delegator) so it survives every
    // innerHTML re-render.
    this.shadowRoot.addEventListener("change", (e) => {
      const which = e.target?.dataset?.input;
      if (which === "dua-player") {
        console.info(
          "Nida: delegated change caught for dua-player:",
          e.target.dataset.duaId, "→", e.target.value
        );
        this._onDuaPatch(e.target.dataset.duaId, { media_player: e.target.value });
      } else if (which === "dua-trigger") {
        console.info(
          "Nida: delegated change caught for dua-trigger:",
          e.target.dataset.duaId, "→", e.target.value
        );
        this._onDuaPatch(e.target.dataset.duaId, { trigger_entity: e.target.value });
      }
    });
    this._render();
    this._startCountdown();
  }

  disconnectedCallback() {
    this.shadowRoot.removeEventListener("click", this._clickHandler);
    this._removePortal();
    this._stopSoundPreview();
    this._stopCountdown();
  }

  _injectGlobalsOnce() {
    if (!document.head.querySelector(`link[href="${FONTS_HREF}"]`)) {
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = FONTS_HREF;
      document.head.appendChild(link);
    }
    if (!document.head.querySelector("style[data-nida-overlay-css]")) {
      const style = document.createElement("style");
      style.setAttribute("data-nida-overlay-css", "");
      style.textContent = NIDA_OVERLAY_CSS;
      document.head.appendChild(style);
    }
  }

  // ───── Data loading ───────────────────────────────────────────────────────

  async _init() {
    try {
      const entries = await this._hass.callWS({
        type: "config_entries/get",
        domain: "nida",
      });
      this._entryId = entries && entries.length ? entries[0].entry_id : null;
      if (!this._entryId) {
        this._error = "Nida config entry not found";
      } else {
        await this._loadSettings();
        // Load HA-derived metadata (location name for device-mode display,
        // media_player list for the Speakers picker, notify services for
        // the Notifications picker). All read-only, refreshed only on
        // init — restart-or-reload is the right cadence for these.
        await Promise.all([
          this._loadHaInfo(),
          this._loadMediaPlayers(),
          this._loadNotifyServices(),
        ]);
        this._ensureCalendarMonthReady();
        // Seed notification text-defaults in the active panel language
        // if they haven't been set yet. Run AFTER _loadSettings so we
        // don't clobber a user-chosen string from a prior session.
        this._seedLanguageDefaults();
        // 2.1.0 — reset panel_welcome_seen on a real version upgrade
        // (major.minor only) before the welcome check below, so an
        // upgrade re-triggers welcome the same tick it's detected.
        this._checkVersionForWelcomeReset();
        // Trigger the one-shot welcome overlay on first visit (or after
        // the reset above). We persist the dismissal flag in
        // entry.options so it survives reloads and is per-config-entry
        // rather than per-browser.
        if (this._settings && !this._settings.panel_welcome_seen) {
          this._activeOverlay = "welcome";
        }
      }
    } catch (e) {
      this._error = `${this.t("error_prefix")}: ${e.message || e}`;
    }
    this._loaded = true;
  }

  async _loadSettings() {
    try {
      this._settings = await this._hass.callWS({
        type: "nida/get_settings",
        entry_id: this._entryId,
      });
    } catch (e) {
      this._error = `${this.t("error_prefix")}: ${e.message || e}`;
    }
  }

  _currentMajorMinor() {
    return NIDA_PANEL_VERSION.split(".").slice(0, 2).join(".");
  }

  _checkVersionForWelcomeReset() {
    // Compares the major.minor the user last dismissed welcome at
    // (last_seen_version) against the panel's current major.minor. A
    // mismatch means a real upgrade happened since then — not just an HA
    // restart on the same code — so welcome (and the setup-wizard
    // chaining in dismiss-welcome) shows again. Deliberately major.minor
    // only, not the full patch version: patches ship often and
    // reshowing welcome on every one would be noise, not a feature.
    if (!this._settings) return;
    const current = this._currentMajorMinor();
    const seen = this._settings.last_seen_version;
    if (seen === undefined) {
      // No baseline yet — either a genuinely fresh install (welcome
      // shows on its own via the existing panel_welcome_seen check
      // right after this runs) or an upgrade from a pre-2.1.0 version
      // that predates this field. Either way, just establish the
      // baseline silently rather than surprising an existing,
      // already-configured install with an unexpected welcome popup.
      this._saveSettings({ last_seen_version: current });
      return;
    }
    if (seen !== current) {
      this._saveSettings({ last_seen_version: current, panel_welcome_seen: false });
    }
  }

  async _loadHaInfo() {
    try {
      this._haInfo = await this._hass.callWS({ type: "nida/get_ha_info" });
    } catch (e) {
      // Non-fatal: device-mode just falls back to no resolved-location row.
      console.warn("Nida: get_ha_info failed:", e);
      this._haInfo = null;
    }
  }

  async _loadMediaPlayers() {
    try {
      this._mediaPlayers = await this._hass.callWS({ type: "nida/list_media_players" });
    } catch (e) {
      // Non-fatal: Speakers section still renders, just with an empty list.
      console.warn("Nida: list_media_players failed:", e);
      this._mediaPlayers = [];
    }
  }

  async _loadNotifyServices() {
    try {
      this._notifyServices = await this._hass.callWS({ type: "nida/list_notify_services" });
    } catch (e) {
      console.warn("Nida: list_notify_services failed:", e);
      this._notifyServices = [];
    }
  }

  _seedLanguageDefaults() {
    // Fill notification text-defaults in the active panel language only
    // when the user hasn't picked their own yet. Once set, we don't
    // overwrite — switching language later doesn't retranslate the
    // already-saved strings (that would silently undo user edits).
    const s = this._settings || {};
    const patch = {};
    if (!s.notify_title) patch.notify_title = this.t("notify_default_title");
    if (!s.notify_message) patch.notify_message = this.t("notify_default_message");
    if (!s.jumuah_message) patch.jumuah_message = this.t("jumuah_default_message");
    if (Object.keys(patch).length) {
      this._saveSettings(patch);
    }
  }

  async _saveSettings(patch) {
    if (!this._entryId) return;
    const next = { ...(this._settings || {}), ...patch };
    this._settings = next;
    try {
      await this._hass.callWS({
        type: "nida/update_settings",
        entry_id: this._entryId,
        options: next,
      });
    } catch (e) {
      this._error = `${this.t("error_prefix")}: ${e.message || e}`;
      this._render();
      return;
    }
    this._render();
    this._showSaveToast();
  }

  _showSaveToast() {
    // Subtle bottom-right pill that fades out after 1500ms. Multiple
    // rapid saves (e.g. dragging a slider) cancel any pending fade-out
    // and restart it — keeps a single toast visible rather than
    // stacking N of them. Toast is rendered inside shadowRoot so it
    // inherits Nida theming and doesn't pollute the global DOM.
    const root = this.shadowRoot;
    if (!root) return;
    let toast = root.querySelector(".save-toast");
    if (!toast) {
      toast = document.createElement("div");
      toast.className = "save-toast";
      // Innards built once; we just toggle visibility/text.
      toast.innerHTML = `
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
             stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M5 12l5 5L20 7"/>
        </svg>
        <span class="save-toast-label"></span>
      `;
      root.appendChild(toast);
    }
    const labelEl = toast.querySelector(".save-toast-label");
    if (labelEl) labelEl.textContent = this.t("save_toast_saved");
    // Force a reflow so the transition fires every time, even if the
    // toast is already shown — otherwise rapid saves just leave it at
    // full opacity without re-confirming.
    toast.classList.remove("visible");
    // eslint-disable-next-line no-unused-expressions
    void toast.offsetWidth;
    toast.classList.add("visible");
    if (this._saveToastTimer) clearTimeout(this._saveToastTimer);
    this._saveToastTimer = setTimeout(() => {
      toast.classList.remove("visible");
    }, 1500);
  }

  // ───── i18n ───────────────────────────────────────────────────────────────

  t(key) {
    const lang = this._effectiveLanguage();
    const dict = TRANSLATIONS[lang] || {};
    if (dict[key] != null) return dict[key];
    return TRANSLATIONS.en[key] ?? key;
  }

  _effectiveLanguage() {
    const stored = this._settings?.language ?? "auto";
    if (stored !== "auto") return stored;
    const hassLang = (this._hass?.language || "en").slice(0, 2).toLowerCase();
    return TRANSLATIONS[hassLang] ? hassLang : "en";
  }

  // ───── Sensor reads ───────────────────────────────────────────────────────

  _sensorState(name) {
    const s = this._hass?.states?.[`sensor.nida_${name}`];
    return s && s.state !== "unknown" && s.state !== "unavailable" ? s.state : null;
  }

  _hijriDateText() {
    const day = this._sensorState("hijri_day");
    const month = this._sensorState("hijri_month");
    const year = this._sensorState("hijri_year");
    if (!day || !month || !year) return "—";
    return `${day} ${month} ${year}`;
  }

  _gregorianDateText() {
    const lang = this._effectiveLanguage();
    try {
      return new Date().toLocaleDateString(lang === "auto" ? undefined : lang, {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric",
      });
    } catch {
      return new Date().toDateString();
    }
  }

  _prayerSchedule() {
    // All five prayers as {prayer, date} built from today's timestamp
    // sensors (sensor.nida_fajr ... sensor.nida_isha), sorted ascending
    // by time. In high-latitude summer Isha can be ~00:09, i.e. BEFORE
    // Fajr on the clock. Sorting by the actual Date value handles that
    // instead of assuming a fixed Fajr..Isha order. Unparseable/missing
    // sensors are skipped so a partial set still yields a usable list.
    const list = [];
    for (const p of PRAYERS) {
      const ts = this._sensorState(p);
      if (!ts) continue;
      const d = new Date(ts);
      if (isNaN(d.getTime())) continue;
      list.push({ prayer: p, date: d });
    }
    list.sort((a, b) => a.date - b.date);
    return list;
  }

  _nextPrayerInfo() {
    // Robust next/current/target across the midnight boundary. Take the
    // soonest prayer strictly after now; if every prayer today has
    // passed, the next is the earliest one tomorrow (approximated as
    // today + 24h, since prayer times drift only ~1 min/day). Current is
    // the cyclic neighbour before next, so "the prayer we're in" stays
    // correct even when Isha has the smallest clock value (e.g. 00:09).
    const sched = this._prayerSchedule();
    if (sched.length === 0) return null;
    const now = Date.now();
    const DAY = 24 * 3600 * 1000;
    let idx = sched.findIndex((e) => e.date.getTime() > now);
    let nextDate;
    if (idx === -1) {
      idx = 0;
      nextDate = new Date(sched[0].date.getTime() + DAY);
    } else {
      nextDate = sched[idx].date;
    }
    const cur = (idx - 1 + sched.length) % sched.length;
    return { next: sched[idx].prayer, current: sched[cur].prayer, nextDate };
  }

  _nextPrayer() {
    const info = this._nextPrayerInfo();
    return info ? info.next : null;
  }

  _currentPrayer() {
    const info = this._nextPrayerInfo();
    return info ? info.current : null;
  }

  _nextPrayerDate() {
    const info = this._nextPrayerInfo();
    return info ? info.nextDate : null;
  }

  _nextPrayerStartText() {
    const d = this._nextPrayerDate();
    if (!d) return "";
    const hh = String(d.getHours()).padStart(2, "0");
    const mm = String(d.getMinutes()).padStart(2, "0");
    return `${this.t("starts_at")} ${hh}:${mm}`;
  }

  _countdown() {
    // Time remaining until nextDate. _nextPrayerInfo already guarantees
    // nextDate is in the future (it wraps the earliest prayer by +24h
    // when all of today's have passed), so the old "diff < 0 → add 24h"
    // patch is gone — we just clamp to 0 as a defensive guard against a
    // sub-second race between the tick and now. Returns h/m/s so the
    // now-card can show a live HH:MM:SS countdown (2.0.39).
    const d = this._nextPrayerDate();
    if (!d) return { h: "—", m: "—", s: "—" };
    let diff = d.getTime() - Date.now();
    if (diff < 0) diff = 0;
    const h = Math.floor(diff / 3600000);
    const m = Math.floor((diff % 3600000) / 60000);
    const s = Math.floor((diff % 60000) / 1000);
    return {
      h: String(h).padStart(2, "0"),
      m: String(m).padStart(2, "0"),
      s: String(s).padStart(2, "0"),
    };
  }

  _capitalize(s) {
    return s ? s[0].toUpperCase() + s.slice(1) : "";
  }

  // ───── Countdown timer ────────────────────────────────────────────────────

  _startCountdown() {
    this._stopCountdown();
    // 1s tick so the HH:MM:SS countdown advances every second (2.0.39).
    // Was 30s, which was fine for an HH:MM display but left the seconds
    // field frozen between updates.
    this._countdownInterval = setInterval(() => this._updateLiveNodes(), 1000);
  }

  _stopCountdown() {
    if (this._countdownInterval) {
      clearInterval(this._countdownInterval);
      this._countdownInterval = null;
    }
  }

  _updateLiveNodes() {
    const root = this.shadowRoot;
    if (!root) return;

    // 2.0.46 — guest mode expiry is lazy (no timer in the backend), so
    // the panel checks each tick whether the active-state flipped (the
    // until-moment passed, or another browser toggled it). On a flip we
    // do one full re-render so the banner and toggle disappear/appear
    // by themselves. The cached flag prevents a render loop.
    const gActive = this._guestModeActive();
    if (this._guestActiveCache !== undefined && this._guestActiveCache !== gActive) {
      this._guestActiveCache = gActive;
      this._render();
      return;
    }
    this._guestActiveCache = gActive;

    const next = this._nextPrayer();
    const current = this._currentPrayer();

    const setText = (sel, txt) => {
      const el = root.querySelector(sel);
      if (el) el.textContent = txt;
    };

    setText('[data-live="hijri-date"]', this._hijriDateText());
    setText('[data-live="hijri-greg"]', this._gregorianDateText());

    if (current) {
      setText('[data-live="current-label"]', `${this.t("current_prayer")} · ${this.t("prayer_" + current)}`);
    } else {
      setText('[data-live="current-label"]', "");
    }
    if (next) {
      setText('[data-live="next-name"]', this.t("prayer_" + next));
      setText('[data-live="next-time"]', this._nextPrayerStartText());
    }

    setText('[data-live="today-remaining"]', this._todayRemainingText());
    // 2.0.88 — Ramadan live nodes: the "Iftar in X m" tag on the Maghrib
    // row and the "Until Iftar / Until <prayer>" line under the countdown.
    // Both no-op via setText when the nodes aren't in the markup.
    setText('[data-live="iftar-tag"]', this._iftarTagText());
    setText('[data-live="until-label"]', this._untilLabelText());
    // 2.1.2 — sensors may not have been ready when init first tried this;
    // retry on every live-tick until _calendarHijriMonth gets seeded.
    if (this._calendarHijriMonth === undefined) {
      this._ensureCalendarMonthReady();
    }
    // 2.0.62 — the today-card's past/next row states are baked into the
    // markup; when the next prayer flips, do one full re-render so the
    // gold bar moves and the finished prayer gets its check. Cached to
    // avoid a render loop, same pattern as the guest-mode flip above.
    if (this._todayNextCache !== undefined && this._todayNextCache !== next) {
      this._todayNextCache = next;
      this._render();
      return;
    }
    this._todayNextCache = next;

    const cd = this._countdown();
    // Combined HH:MM:SS for the redesigned now-card (2.0.39 added seconds).
    const cdText = (cd.h === "—" || cd.m === "—") ? "—:—:—" : `${cd.h}:${cd.m}:${cd.s}`;
    setText('[data-live="cd-combined"]', cdText);
    // Backward-compat: the old per-unit nodes may still exist in
    // cached panel HTML during a deploy window; keep writing them too.
    setText('[data-live="cd-h"]', cd.h);
    setText('[data-live="cd-m"]', cd.m);
  }

  // ───── Event handlers ─────────────────────────────────────────────────────

  _onTogglePrayer(prayer) {
    const key = `enabled_${prayer}`;
    const curr = this._isPrayerEnabled(prayer);
    this._saveSettings({ [key]: !curr });
  }

  _isPrayerEnabled(prayer) {
    const val = this._settings?.[`enabled_${prayer}`];
    return val === undefined ? true : !!val; // default ON
  }

  _onLocationMode(mode) {
    this._saveSettings({ location_mode: mode });
  }

  _locationMode() {
    return this._settings?.location_mode || "device";
  }

  _onCityBlur(value) {
    // If the user just clicked a suggestion, the pick already saved the
    // correct city + coords. Skip this blur — it would otherwise read a
    // stale value from the detached input and clobber the pick.
    if (this._cityJustPicked) {
      this._cityJustPicked = false;
      return;
    }
    if (value === this._settings?.city) return;
    this._saveSettings({ city: value, latitude: null, longitude: null });
  }

  _onCityInput(value) {
    // Debounce Nominatim searches — 1 req/sec is the published limit, and
    // we never want to fire on every keystroke. 300ms is fast enough to
    // feel responsive and slow enough to absorb normal typing speed.
    //
    // CRITICAL: do NOT call _render() here. _render() overwrites the
    // shadow root innerHTML, which destroys the input element while the
    // user is typing — the browser would reflect the keystroke on a node
    // that is then thrown away. Use _renderCitySuggestions() to update
    // only the suggestions container in-place.
    this._cityQuery = value;
    if (this._cityDebounce) clearTimeout(this._cityDebounce);
    if (!value || value.trim().length < 2) {
      this._citySuggestions = [];
      this._renderCitySuggestions();
      return;
    }
    this._cityDebounce = setTimeout(() => this._searchCities(value.trim()), 300);
  }

  async _searchCities(query) {
    const country = this._settings?.country;
    if (!country) return;
    try {
      const results = await this._hass.callWS({
        type: "nida/search_cities",
        country_code: country,
        query: query,
      });
      // Only apply if this query is still the latest one — avoids
      // out-of-order responses overwriting a newer search result.
      if (this._cityQuery && this._cityQuery.trim() === query) {
        this._citySuggestions = Array.isArray(results) ? results : [];
        this._renderCitySuggestions();
      }
    } catch (e) {
      console.warn("Nida: search_cities failed:", e);
    }
  }

  _renderCitySuggestions() {
    // Partial DOM update: only the .city-suggestions container is touched,
    // so the city <input> keeps its current value and focus while typing.
    const field = this.shadowRoot && this.shadowRoot.querySelector(".city-field");
    if (!field) return;
    let container = field.querySelector(".city-suggestions");
    const itemsHtml = this._htmlCitySuggestionsItems();
    if (!itemsHtml) {
      if (container) container.remove();
      return;
    }
    if (!container) {
      container = document.createElement("div");
      container.className = "city-suggestions";
      field.appendChild(container);
    }
    container.innerHTML = itemsHtml;
  }

  _htmlCitySuggestionsItems() {
    if (!this._citySuggestions || this._citySuggestions.length === 0) return "";
    return this._citySuggestions.map((s) => `
      <div class="city-suggestion"
           data-action="pick-city"
           data-name="${this._escape(s.name)}"
           data-lat="${s.lat}"
           data-lon="${s.lon}">
        <div class="city-suggestion-name">${this._escape(s.name)}</div>
        <div class="city-suggestion-sub">${this._escape(s.display_name)}</div>
      </div>
    `).join("");
  }

  _onPickCity(name, lat, lon) {
    // Set a flag so the deferred blur callback (200ms after the click)
    // won't overwrite our picked value with whatever the user had typed.
    // Without this, a click-on-suggestion fires blur first (with the
    // original typed text in e.target.value), then click, then _render,
    // then the blur setTimeout finally fires and reads stale value from
    // the detached input — wiping the saved city back to "Breu" or
    // worse to empty.
    this._cityJustPicked = true;
    this._citySuggestions = [];
    this._cityQuery = name;
    this._saveSettings({ city: name, latitude: lat, longitude: lon });
  }

  _htmlCitySuggestions() {
    const items = this._htmlCitySuggestionsItems();
    if (!items) return "";
    return `<div class="city-suggestions">${items}</div>`;
  }

  _onCountryBlur(value) {
    this._saveSettings({ country: value });
  }

  _onPickCountry(code) {
    this._saveSettings({ country: code });
    this._closeOverlay();
  }

  // ───── Sound preview ──────────────────────────────────────────────────────

  _soundUrlFor(category) {
    const stored = this._settings?.[`sound_${category}`];
    const rel = stored || DEFAULT_SOUND_PATHS[category];
    return rel ? `/local/nida/sounds/${rel}` : null;
  }

  _playSoundPreview(category) {
    // If a different category is already playing, stop it first.
    this._stopSoundPreview();

    const url = this._soundUrlFor(category);
    if (!url) {
      console.warn("Nida: no sound URL for category", category);
      return;
    }

    const audio = new Audio(url);
    this._currentAudio = { category, audio };

    audio.addEventListener("ended", () => {
      if (this._currentAudio && this._currentAudio.audio === audio) {
        this._currentAudio = null;
        this._render();
      }
    });
    audio.addEventListener("error", () => {
      this._currentAudio = null;
      this._render();
    });

    audio.play().catch((err) => {
      // Autoplay/CORS/404 failures land here. Just reset state so the
      // play button comes back; the browser console shows the actual error.
      console.warn("Nida: cannot play preview:", err);
      this._currentAudio = null;
      this._render();
    });

    this._render();
  }

  _stopSoundPreview() {
    if (this._currentAudio?.audio) {
      try {
        this._currentAudio.audio.pause();
        this._currentAudio.audio.currentTime = 0;
      } catch {
        // ignore — browser may already have torn down the element
      }
    }
    this._currentAudio = null;
  }

  _methodId() {
    const v = this._settings?.method;
    return v === undefined || v === null ? DEFAULT_METHOD_ID : Number(v);
  }

  _methodName(id) {
    const m = CALCULATION_METHODS.find((x) => x.id === Number(id));
    return m ? m.name : String(id);
  }

  _onPickMethod(id) {
    this._saveSettings({ method: id });
    this._closeOverlay();
  }

  _onPickLanguage(code) {
    this._saveSettings({ language: code });
    this._closeOverlay();
  }

  _openOverlay(which) {
    this._activeOverlay = which;
    this._overlaySearchQuery = "";  // fresh search every time
    this._render();
  }

  _closeOverlay() {
    // 2.0.51 — a stale dua pick target must never leak into a later
    // library visit opened from a normal sound row.
    this._duaPickId = null;
    this._activeOverlay = null;
    this._overlaySearchQuery = "";
    this._libraryCategory = null;
    // 2.1.0 — a stale parsed/errored restore file must not leak into the
    // next time the restore dialog is opened.
    this._restoreParsed = null;
    this._restoreErrorCode = null;
    this._restoreFileName = "";
    this._render();
  }

  _languageLabel() {
    const stored = this._settings?.language || "auto";
    const lang = LANGUAGES.find((l) => l.code === stored);
    return lang ? lang.label : "English";
  }

  // ───── Render ─────────────────────────────────────────────────────────────

  _render() {
    if (!this.shadowRoot) return;
    this._applyThemeToHost();
    this.shadowRoot.innerHTML = this._html();
    this._attachInputListeners(this.shadowRoot);
    this._attachSectionToggleListeners();
    this._attachCompanionDragListeners();
    this._updateLiveNodes();
    this._renderPortal();
  }

  _renderPortal() {
    // Overlays are rendered into a div appended to document.body so they
    // sit at the top of the stacking context and aren't trapped by any
    // transform-bearing ancestor that demotes `position: fixed` to
    // effectively `position: absolute`. If no overlay is active, tear
    // the portal down.
    //
    // 2.1.0 — the manual/auto setup wizard renders inline inside
    // col-settings instead (see _htmlSetupWizardInline / _setupWizardActive
    // in _html()), so it can reuse the section markup's existing
    // .card/.toggle/.select-field styling, which only exists in the
    // shadow-DOM stylesheet, not the portal's. It's driven by
    // _setupWizardActive, never by _activeOverlay, so it never opens this
    // dialog — sub-overlays opened from within a wizard step (method
    // picker, speakers picker, etc.) use _activeOverlay/this portal
    // exactly like they do from the normal accordion. Restore mode
    // ("setup-restore") does use the portal — simple text, no reused
    // components.
    if (!this._activeOverlay) {
      this._removePortal();
      return;
    }
    this._ensurePortal();
    this._overlayPortal.innerHTML = this._htmlOverlay();
    this._attachInputListeners(this._overlayPortal);
  }

  _ensurePortal() {
    if (this._overlayPortal && this._overlayPortal.isConnected) {
      // Theme may have changed since the portal opened — keep its class in sync.
      this._overlayPortal.className = `nida-overlay-portal theme-${this._currentTheme()}`;
      return;
    }
    const portal = document.createElement("dialog");
    portal.className = `nida-overlay-portal theme-${this._currentTheme()}`;
    document.body.appendChild(portal);
    portal.addEventListener("click", this._clickHandler);
    // 2.0.58 — delegated change handling for the TTS language select.
    // The per-element listener attached after each innerHTML render
    // proved unreliable on at least one browser (empty console: handler
    // never fired). Change events bubble, so catching them on the
    // portal itself, exactly like clicks, survives every re-render by
    // construction. Guarded by data-input so other selects are
    // unaffected; the old per-element listener is removed so the
    // handler cannot fire twice.
    portal.addEventListener("change", (e) => {
      const which = e.target?.dataset?.input;
      if (which === "tts-language") {
        console.info("Nida: delegated change caught for tts-language:", e.target.value);
        this._onTtsLanguageChange(e.target.value);
      }
    });
    portal.addEventListener("close", () => {
      if (this._activeOverlay) this._closeOverlay();
    });
    this._overlayPortal = portal;
    portal.showModal();
  }

  _removePortal() {
    if (!this._overlayPortal) return;
    this._overlayPortal.removeEventListener("click", this._clickHandler);
    try { this._overlayPortal.close(); } catch { /* already closed */ }
    this._overlayPortal.remove();
    this._overlayPortal = null;
  }

  // 2.0.79 — sky decoration: twinkling stars + faint drifting clouds
  // behind the interface (dark theme only, hidden in light via
  // --nida-sky-opacity: 0). Star positions/timings are a fixed hand-picked
  // set rather than Math.random() so the field doesn't reshuffle on every
  // re-render (countdown tick, settings save, etc).
  _htmlSkyDecor() {
    const stars = [
      [4, 8, 1.6, 0.0, 3.2], [9, 22, 1.2, 0.6, 4.0], [14, 5, 1.8, 1.2, 3.6],
      [19, 34, 1.0, 1.8, 4.4], [23, 14, 1.4, 0.3, 3.8], [28, 45, 1.1, 2.1, 4.2],
      [33, 9, 1.7, 0.9, 3.4], [38, 28, 1.3, 1.5, 4.6], [44, 18, 1.5, 0.4, 3.9],
      [49, 40, 1.0, 2.4, 4.1], [54, 6, 1.8, 1.1, 3.5], [59, 32, 1.2, 0.7, 4.3],
      [64, 12, 1.6, 1.9, 3.7], [69, 48, 1.1, 0.2, 4.5], [74, 20, 1.4, 1.4, 3.3],
      [79, 7, 1.7, 2.2, 4.0], [83, 36, 1.0, 0.5, 4.4], [87, 15, 1.5, 1.7, 3.6],
      [91, 42, 1.2, 1.0, 4.2], [95, 25, 1.8, 0.8, 3.9],
    ];
    const starEls = stars.map(([x, y, size, delay, dur]) =>
      `<i class="star" style="--x:${x}%;--y:${y}%;--size:${size}px;--delay:${delay}s;--dur:${dur}s"></i>`
    ).join("");
    return `
      <div class="sky-decor" aria-hidden="true">
        ${starEls}
        <div class="cloud cloud-a"></div>
        <div class="cloud cloud-b"></div>
        <div class="cloud cloud-c"></div>
      </div>
    `;
  }

  _html() {
    if (!this._loaded) return this._htmlLoading();
    if (this._error && !this._settings) return this._htmlError();

    return `
      <style>${this._css()}</style>
      <div class="app">
        <div class="app-bg"></div>
        <div class="pattern-overlay"></div>
        ${this._htmlSkyDecor()}
        ${this._htmlHeader()}
        <div class="layout">
          <div class="col-companion">
            ${this._htmlCompanionCards()}
          </div>
          <div class="col-settings">
            <div class="content">
              ${this._setupWizardActive
                ? this._htmlSetupWizardInline()
                : `
                  ${this._htmlSectionLocation()}
                  ${this._htmlSectionPrayers()}
                  ${this._htmlSectionSpeakers()}
                  ${this._htmlSectionSounds()}
                  ${this._htmlSectionSoundModes()}
                  ${this._htmlSectionDua()}
                  ${this._htmlSectionNotifications()}
                  ${this._htmlSectionJumuah()}
                  ${this._htmlSectionRamadan()}
                  ${this._htmlSectionIslamicCalendar()}
                  ${this._htmlSectionSetup()}
                `}
            </div>
          </div>
        </div>
        <div class="footer-support">
          <a class="support-link" href="${NIDA_SUPPORT_URL}"
             target="_blank" rel="noopener noreferrer">
            ${ICONS.heart} ${this.t("support_nida")}
          </a>
        </div>
        <div class="footer-note">Nida ${NIDA_PANEL_VERSION}</div>
      </div>
    `;
  }

  _htmlLoading() {
    return `
      <style>${this._cssBase()}</style>
      <div class="app">
        <div class="loading-state">${this.t("loading")}</div>
      </div>
    `;
  }

  _htmlError() {
    return `
      <style>${this._cssBase()}</style>
      <div class="app">
        <div class="loading-state error">${this._error}</div>
      </div>
    `;
  }

  _htmlHeader() {
    const theme = this._currentTheme();
    // 2.0.88 — two Ramadan variants; both show the static badge.
    const isRamadan = theme.startsWith("ramadan");
    const themeIcon = isRamadan ? "🌙"
      : theme === "light" ? "☀" : theme === "auto" ? "◐" : "☾";
    // 2.0.86 — during Ramadan the theme is auto-forced, so the pill is a
    // static badge (no data-action) instead of a cycle button. The base
    // dark/light/auto preference resumes automatically after the month.
    const themePill = isRamadan
      ? `<span class="lang-pill theme-badge" title="${this.t("theme_ramadan")}">
              <span class="theme-glyph">${themeIcon}</span>
              <span>${this.t("theme_ramadan")}</span>
            </span>`
      : `<button class="lang-pill" data-action="cycle-theme" title="${this.t("theme_label")}">
              <span class="theme-glyph">${themeIcon}</span>
              <span>${this.t("theme_" + theme)}</span>
            </button>`;
    return `
      <div class="header">
        <div class="header-row">
          <div class="brand">
            <div class="brand-mark">${ICONS.brand}</div>
            <div class="brand-title">Nida<sup>2</sup></div>
          </div>
          <div class="header-pills">
            ${themePill}
            <button class="lang-pill" data-action="open-language">
              ${ICONS.globe}
              <span>${this._languageLabel()}</span>
            </button>
          </div>
        </div>
        <div class="border-motif"></div>
      </div>
    `;
  }

  _themeOverride() {
    // 2.0.88 — testing-only URL override, never surfaced in the UI:
    //   /nida?theme=ramadan-dark | ramadan-light | light | dark
    //   /nida#theme=...           (hash fallback)
    // Legacy "?theme=ramadan" (2.0.86) maps to ramadan-dark. When the
    // panel is registered with embed_iframe the element runs inside an
    // iframe whose own URL never carries the query the user typed, so
    // we also try the top window's URL (guarded: cross-origin top
    // throws on access and we just skip it).
    const read = (loc) => {
      if (!loc) return null;
      const q = new URLSearchParams(loc.search || "").get("theme");
      if (q) return q;
      const h = String(loc.hash || "").replace(/^#/, "");
      return h ? new URLSearchParams(h).get("theme") : null;
    };
    let v = read(window.location);
    if (!v && window.top !== window) {
      try { v = read(window.top.location); } catch (_e) { /* cross-origin */ }
    }
    if (v === "ramadan") return "ramadan-dark";
    return ["light", "dark", "ramadan-dark", "ramadan-light"].includes(v) ? v : null;
  }

  _currentTheme() {
    const override = this._themeOverride();
    if (override) return override;

    // 2.0.86 — Ramadan auto-activation on Hijri month 9. 2.0.88 — the
    // variant follows the stored base preference so someone who runs the
    // panel in light mode gets ramadan-light, not a forced dark month.
    if (this._currentHijri()?.monthNum === 9) {
      return this._ramadanVariant();
    }

    const t = this._settings?.theme;
    return (t === "light" || t === "auto" || t === "dark") ? t : "dark";
  }

  _ramadanVariant() {
    // Resolve which Ramadan variant matches the user's base theme.
    // "auto" defers to the OS, same source the theme-auto CSS uses.
    const base = this._settings?.theme;
    if (base === "light") return "ramadan-light";
    if (base === "auto" && window.matchMedia &&
        window.matchMedia("(prefers-color-scheme: light)").matches) {
      return "ramadan-light";
    }
    return "ramadan-dark";
  }

  _isRamadanTheme() {
    return this._currentTheme().startsWith("ramadan");
  }

  _onCycleTheme() {
    // Three-state cycle: dark → light → auto → dark. 2.0.86 — cycle over
    // the stored base preference, NOT _currentTheme(): during Ramadan the
    // latter returns "ramadan" (auto-only, never a manual step), which
    // isn't in `order` and would make indexOf wrap unexpectedly.
    const order = ["dark", "light", "auto"];
    const base = this._settings?.theme;
    const cur = order.includes(base) ? base : "dark";
    const next = order[(order.indexOf(cur) + 1) % order.length];
    this._saveSettings({ theme: next });
  }

  _applyThemeToHost() {
    // Mirror the theme onto the shadow host element so the CSS-vars
    // override block on :host(.theme-light) etc. kicks in. The
    // portal element (when open) is themed in _ensurePortal.
    const cls = `theme-${this._currentTheme()}`;
    // Remove any previous theme-* classes, add the current one.
    for (const c of [...this.classList]) {
      if (c.startsWith("theme-")) this.classList.remove(c);
    }
    this.classList.add(cls);
  }

  // ───── Section accordion ────────────────────────────────────────────────
  // Each top-level section in the settings column is wrapped in a
  // <details>. 2.0.82 — this is now a single-open accordion: at most one
  // section is open at a time, and opening one collapses the rest. Sections
  // still default to all-collapsed on a fresh visit (nothing stored yet).
  // The store is a single localStorage key nida_open_section holding the id
  // of the open section (see _openSectionId / _setOpenSection below). The
  // per-section nida_collapsed_<id> flags from 2.0.65 are retired; any left
  // over are ignored.
  //
  // <details>/<summary> is used over a hand-rolled accordion because
  // it gives us keyboard support, accessibility, and a synchronous
  // 'toggle' event for free. Native disclosure marker is hidden via
  // CSS (::-webkit-details-marker + list-style on summary); we draw
  // our own chevron in the header and rotate it on [open].

  // 2.0.82 — single-open accordion. One key, nida_open_section, holds the
  // id of the currently-open section ("" / missing = all closed). This
  // replaces the per-section nida_collapsed_<id> flags from 2.0.65 and
  // enforces "at most one open" both at render (_isSectionCollapsed) and at
  // runtime (_attachSectionToggleListeners closes the others). Old keys are
  // simply ignored now.
  _openSectionId() {
    try {
      return localStorage.getItem("nida_open_section");
    } catch (e) {
      return null;
    }
  }

  _setOpenSection(id) {
    try {
      if (id) {
        localStorage.setItem("nida_open_section", id);
      } else {
        localStorage.removeItem("nida_open_section");
      }
    } catch (e) {
      // Private-mode Safari or storage disabled — silently ignore.
    }
  }

  _isSectionCollapsed(id) {
    // A section is open only when it is the one stored in nida_open_section;
    // everything else is collapsed. Missing key = nothing open.
    return this._openSectionId() !== id;
  }

  _sectionWrapper(id, iconHtml, titleHtml, cardInner) {
    // Single source of truth for section markup. Pass icon + title +
    // the inner contents of the .card div; the helper builds the
    // <details> envelope with the right open-state and chevron.
    // 2.1.0 — _forceSectionOpen lets the setup wizard reuse this exact
    // markup for a single step (see _htmlWizardStepBody) without
    // depending on the real accordion's collapsed/open localStorage
    // state. Only ever set while rendering into the overlay portal,
    // which is a separate DOM tree from the real settings column, so
    // this never affects the accordion the user sees behind the wizard.
    const openAttr =
      this._forceSectionOpen === id || !this._isSectionCollapsed(id) ? "open" : "";
    return `
      <details class="section" data-section-id="${id}" ${openAttr}>
        <summary class="section-head">
          <div class="section-icon">${iconHtml}</div>
          <div class="section-title">${titleHtml}</div>
          <div class="section-chevron">${ICONS.chevronDown}</div>
        </summary>
        <div class="card">
          ${cardInner}
        </div>
      </details>
    `;
  }

  _attachSectionToggleListeners() {
    // One 'toggle' listener per <details>. 2.0.82 — single-open accordion:
    // opening a section records it as the open one and closes the others;
    // collapsing the open section clears the store (all closed). We tag each
    // element so re-renders don't stack listeners.
    const root = this.shadowRoot;
    if (!root) return;
    const all = root.querySelectorAll("details.section[data-section-id]");
    all.forEach((el) => {
      if (el._nidaToggleWired) return;
      el._nidaToggleWired = true;
      el.addEventListener("toggle", () => {
        const id = el.getAttribute("data-section-id");
        if (!id) return;
        if (el.open) {
          // Record first, then close the others. Their toggle handlers take
          // the else-branch below and, since the stored id is already the
          // newly-opened one, they won't clear it.
          this._setOpenSection(id);
          all.forEach((other) => {
            if (other !== el && other.open) other.open = false;
          });
        } else if (this._openSectionId() === id) {
          // The user collapsed the open section — now nothing is open.
          this._setOpenSection(null);
        }
      });
    });
  }

  _htmlSectionLocation() {
    const mode = this._locationMode();
    const city = this._settings?.city ?? "";
    const country = this._settings?.country ?? "";
    const lang = this._effectiveLanguage();
    const countryDisplay = country
      ? localizedCountryName(country, lang)
      : this.t("country_pick_title");
    const methodName = this._methodName(this._methodId());

    const cardInner = `
      <div class="seg-control">
        <div class="seg-btn ${mode === "device" ? "active" : ""}" data-action="loc-device">
          ${this.t("location_use_device")}
        </div>
        <div class="seg-btn ${mode === "manual" ? "active" : ""}" data-action="loc-manual">
          ${this.t("location_set_manually")}
        </div>
      </div>
      ${this._htmlManualNoCoordsWarning(mode)}
      ${mode === "device" ? this._htmlResolvedLocation() : ""}
      ${mode === "manual" ? `
        <div class="select-field" data-action="open-country">
          <span>${this.t("country")}</span>
          <span class="select-value">${this._escape(countryDisplay)} ${ICONS.chevronRight}</span>
        </div>
        <div class="text-field city-field">
          <label>${this.t("city")}</label>
          <input type="text" data-input="city" value="${this._escape(city)}" autocomplete="off">
          ${this._htmlCitySuggestions()}
        </div>
      ` : ""}
      <div class="select-field" data-action="open-method">
        <span>${this.t("calculation_method")}</span>
        <span class="select-value">${methodName} ${ICONS.chevronRight}</span>
      </div>
    `;
    return this._sectionWrapper(
      "location",
      ICONS.location,
      this.t("section_location"),
      cardInner
    );
  }

  _htmlManualNoCoordsWarning(mode) {
    // Manual mode silently falls back to HA's home coords when there's
    // no lat/lon in settings (= user typed a city but never picked from
    // suggestions, or picked the country but no city yet). Without a
    // warning the user thinks manual mode = "the location I typed" but
    // it actually = HA's home until they pick from suggestions.
    if (mode !== "manual") return "";
    const lat = this._settings?.latitude;
    const lon = this._settings?.longitude;
    if (typeof lat === "number" && typeof lon === "number") return "";
    return `
      <div class="manual-warning" role="status">
        <div class="manual-warning-icon">⚠</div>
        <div class="manual-warning-body">
          <div class="manual-warning-title">${this.t("location_warning_manual_no_coords_title")}</div>
          <div class="manual-warning-text">${this.t("location_warning_manual_no_coords_body")}</div>
        </div>
      </div>
    `;
  }

  _htmlResolvedLocation() {
    if (!this._haInfo) return "";
    // Prefer Nominatim's display_name (e.g. "Breukelen, Stichtse Vecht,
    // Utrecht, Nederland") when available — that's what the reverse
    // endpoint returns at zoom=10. Fall back to HA's location_name (the
    // user's "Home" label like "Production") plus raw coords if reverse
    // geocoding failed or hasn't completed.
    const display = this._haInfo.location_display;
    const name = this._haInfo.location_name || "";
    const lat = this._haInfo.latitude;
    const lon = this._haInfo.longitude;
    const coordStr =
      typeof lat === "number" && typeof lon === "number"
        ? `${lat.toFixed(2)}° ${lat >= 0 ? "N" : "S"}, ${Math.abs(lon).toFixed(2)}° ${lon >= 0 ? "E" : "W"}`
        : "";
    let primary;
    if (display) {
      primary = this._escape(display);
    } else if (name) {
      primary = `${this._escape(name)}${coordStr ? ` · ${coordStr}` : ""}`;
    } else {
      primary = coordStr;
    }
    if (!primary) return "";
    return `
      <div class="resolved-location">
        <div class="resolved-location-icon">${ICONS.location}</div>
        <div class="resolved-location-body">
          <div class="resolved-location-primary">${primary}</div>
          <div class="resolved-location-sub">${this.t("resolved_location_sub")}</div>
        </div>
      </div>
    `;
  }

  _htmlSectionPrayers() {
    // Reminder note first: switching a prayer off here only silences the
    // adhan for it — the obligation of the prayer itself stays.
    const cardInner = `
      <div class="card-note">${this.t("prayers_note")}</div>
    ` + PRAYERS.map((p) => `
      <div class="row">
        <span class="row-label">${this.t("prayer_" + p)}</span>
        <div class="toggle ${this._isPrayerEnabled(p) ? "on" : ""}" data-action="toggle-prayer" data-prayer="${p}">
          <div class="toggle-knob"></div>
        </div>
      </div>
    `).join("");
    return this._sectionWrapper(
      "prayers",
      ICONS.clock,
      this.t("section_prayers"),
      cardInner
    );
  }

  _htmlSectionSpeakers() {
    const selected = this._selectedSpeakerIds();
    const byId = new Map(this._mediaPlayers.map((m) => [m.entity_id, m]));
    const selectedNames = selected
      .map((id) => (byId.get(id) ? byId.get(id).name : id))
      .filter(Boolean);

    let summary;
    if (selectedNames.length === 0) {
      summary = this.t("speakers_none");
    } else if (selectedNames.length <= 2) {
      summary = selectedNames.join(", ");
    } else {
      summary = `${selectedNames.length} ${this.t("speakers_count_suffix")}`;
    }

    const testVol = this._volumeTest();
    const testPlaying = !!this._speakerTestPlaying;

    const cardInner = `
      <div class="select-field flat" data-action="open-speakers">
        <div class="sound-info">
          <div class="sound-name">${this.t("speakers_label")}</div>
          <div class="row-sub">${this.t("speakers_sub")}</div>
        </div>
        <span class="select-value">${this._escape(summary)} ${ICONS.chevronRight}</span>
      </div>
      <div class="sound-row">
        <div class="sound-info">
          <div class="sound-name">${this.t("speakers_test_label")}</div>
          <div class="row-sub">${this.t("speakers_test_sub")}</div>
          <div class="volume-row">
            <input type="range" min="0" max="100" step="1"
                   value="${testVol}"
                   data-input="volume-test"
                   class="volume-slider"
                   aria-label="${this.t("speakers_test_label")}">
            <span class="volume-value" data-test-volume-display>${testVol}%</span>
          </div>
        </div>
        <div class="play-btn ${testPlaying ? 'playing' : ''}"
             data-action="${testPlaying ? 'stop-speaker-test' : 'play-speaker-test'}"
             ${selected.length === 0 ? 'data-disabled="true"' : ''}>
          ${testPlaying ? ICONS.stop : ICONS.play}
        </div>
        <div class="chevron-btn spacer">${ICONS.chevronRight}</div>
      </div>
    `;
    return this._sectionWrapper(
      "speakers",
      ICONS.speaker,
      this.t("section_speakers"),
      cardInner
    );
  }

  _volumeTest() {
    const raw = this._settings?.volume_test;
    const n = parseInt(raw, 10);
    if (Number.isFinite(n) && n >= 0 && n <= 100) return n;
    return 30;
  }

  _onVolumeTestChange(value) {
    let n = parseInt(value, 10);
    if (!Number.isFinite(n)) return;
    n = Math.max(0, Math.min(100, n));
    this._saveSettings({ volume_test: n });
  }

  _selectedSpeakerIds() {
    const v = this._settings?.adhan_media_players;
    if (Array.isArray(v)) return v;
    if (typeof v === "string" && v) return [v];
    return [];
  }

  _toggleSpeaker(entityId) {
    const current = this._selectedSpeakerIds();
    const next = current.includes(entityId)
      ? current.filter((id) => id !== entityId)
      : [...current, entityId];
    this._saveSettings({ adhan_media_players: next });
  }

  _htmlSectionSounds() {
    // Two subgroups under one card: Adhan (fajr_adhan + adhan) and
    // Pre-adhan (jingle row + minutes block + audio toggle + 2nd
    // reminder + play/stop test). Subgroup separator is a styled
    // subheader row inside the same card — visually grouped but still
    // one logical section for the accordion. The former "Sound modes"
    // subgroup moved to its own top-level section in 2.0.49
    // (_htmlSectionSoundModes).
    const cardInner = `
      ${this._htmlSoundsGroupAdhan()}
      ${this._htmlSoundsGroupPreAdhan()}
    `;
    return this._sectionWrapper(
      "sounds",
      ICONS.speaker,
      this.t("section_sounds"),
      cardInner
    );
  }

  _htmlSoundsGroupAdhan() {
    // Fajr + day adhan rows. Same per-row pattern as before, just
    // filtered to the two adhan categories.
    const adhanCats = SOUND_CATEGORIES.filter(
      (c) => c.key === "fajr_adhan" || c.key === "adhan"
    );
    // 2.0.52 — random adhan. Moved into the Sound Library in 2.0.69
    // as a pseudo-entry at the top of each adhan category list, so
    // the user picks "Random" in the same place they pick a muezzin.
    return `
      <div class="sounds-group-head">${this.t("sounds_group_adhan")}</div>
      ${adhanCats.map((cat) => this._htmlSoundRow(cat)).join("")}
    `;
  }

  _htmlSoundsGroupPreAdhan() {
    // 2.0.38 — rewritten layout. Was: 7 mixed-concern rows scattered
    // (jingle, TTS, minutes slider, "Play pre-adhan audio" toggle,
    // 2nd reminder toggle, 2nd reminder slider, test). Now:
    //   1. WHAT plays: jingle row (with the audio toggle merged in,
    //      mirroring the TTS-row pattern) + TTS row
    //   2. TIMING subheader → first reminder slider, 2nd reminder
    //      toggle + conditional 2nd slider
    //   3. Active-for-prayers picker (per-prayer suppression)
    //   4. Test row at the bottom
    // The "Play pre-adhan audio" row is gone — its toggle moved INTO
    // the jingle row as the right-most control before the chevron.
    const jingleCat = SOUND_CATEGORIES.find((c) => c.key === "pre_adhan_jingle");
    const jingleEnabled = !!this._settings?.pre_adhan_audio_enabled;
    const ttsEnabled = !!this._settings?.tts_pre_adhan_enabled;
    // 2.0.70 — if BOTH jingle and TTS are off, the timing/active/test
    // rows serve no purpose (nothing will fire). Hide them so the
    // section stays clean when the user only wants the adhan itself.
    const anythingFires = jingleEnabled || ttsEnabled;
    return `
      <div class="sounds-group-head">${this.t("sounds_group_pre_adhan")}</div>
      ${jingleCat ? this._htmlSoundRow(jingleCat, { audioToggle: true }) : ""}
      ${this._htmlTtsRow()}
      ${anythingFires ? `
        <div class="pre-adhan-subhead">${this.t("pre_adhan_timing_head")}</div>
        ${this._htmlPreAdhanTimingBlock()}
        ${this._htmlPreAdhanActiveForRow()}
        ${this._htmlPreAdhanTestRow()}
      ` : ""}
    `;
  }

  _htmlPreAdhanTimingBlock() {
    const value1 = this._preAdhanMinutes(1);
    const value2 = this._preAdhanMinutes(2);
    const twoEnabled = this._preAdhanTwoEnabled();
    return `
      <div class="pre-adhan-block">
        <div class="minutes-row">
          <div class="sound-info">
            <div class="sound-name">${this.t("pre_adhan_minutes_label")}</div>
            <div class="row-sub">${this.t("pre_adhan_minutes_sub")}</div>
            <div class="volume-row">
              <input type="range" min="2" max="30" step="1"
                     value="${value1}"
                     data-input="pre-adhan-minutes-1"
                     class="volume-slider"
                     aria-label="${this.t("pre_adhan_minutes_label")}">
              <span class="volume-value" data-minutes-display="1">${value1} ${this.t("minutes_short")}</span>
            </div>
          </div>
        </div>
        <div class="row">
          <div class="row-info">
            <span class="row-label">${this.t("pre_adhan_two_label")}</span>
            <span class="row-sub">${this.t("pre_adhan_two_sub")}</span>
          </div>
          <div class="toggle ${twoEnabled ? "on" : ""}" data-action="toggle-pre-adhan-two">
            <div class="toggle-knob"></div>
          </div>
        </div>
        ${twoEnabled ? `
          <div class="minutes-row sub-indent">
            <div class="sound-info">
              <div class="sound-name">${this.t("pre_adhan_minutes_2_label_short")}</div>
              <div class="volume-row">
                <input type="range" min="2" max="30" step="1"
                       value="${value2}"
                       data-input="pre-adhan-minutes-2"
                       class="volume-slider"
                       aria-label="${this.t("pre_adhan_minutes_2_label_short")}">
                <span class="volume-value" data-minutes-display="2">${value2} ${this.t("minutes_short")}</span>
              </div>
            </div>
          </div>
        ` : ""}
      </div>
    `;
  }

  _htmlPreAdhanActiveForRow() {
    // Subtitle lists the prayer names that are currently enabled,
    // comma-separated. The chevron opens an overlay with 5 toggles.
    const enabled = PRAYERS.filter((p) => this._isPreAdhanEnabledFor(p));
    const summary = enabled.length === 0
      ? this.t("pre_adhan_active_for_none")
      : enabled.length === PRAYERS.length
        ? this.t("pre_adhan_active_for_all")
        : enabled.map((p) => this.t("prayer_" + p)).join(" · ");
    return `
      <div class="row clickable" data-action="open-pre-adhan-prayers">
        <div class="row-info">
          <span class="row-label">${this.t("pre_adhan_active_for_label")}</span>
          <span class="row-sub">${this._escape(summary)}</span>
        </div>
        <div class="chevron-btn">${ICONS.chevronRight}</div>
      </div>
    `;
  }

  _isPreAdhanEnabledFor(prayer) {
    const v = this._settings?.[`pre_adhan_enabled_${prayer}`];
    return v === undefined ? true : !!v;
  }

  _onTogglePreAdhanForPrayer(prayer) {
    const cur = this._isPreAdhanEnabledFor(prayer);
    this._saveSettings({ [`pre_adhan_enabled_${prayer}`]: !cur });
  }

  _htmlTtsRow() {
    // 2.0.32 — TTS announcement row in the Pre-adhan subgroup.
    // Subtitle summarises: "N agents · message preview", or a hint
    // when nothing's configured yet. Toggle on the right + chevron
    // to open the picker overlay.
    const enabled = !!this._settings?.tts_pre_adhan_enabled;
    const agents = (this._settings?.tts_pre_adhan_services || []).length;
    const msg = this._settings?.tts_pre_adhan_message || "";
    const sub = agents === 0
      ? this.t("tts_sub_empty")
      : `${agents} ${this.t(agents === 1 ? "tts_agent" : "tts_agents")} · ${msg || this.t("tts_no_message")}`;
    return `
      <div class="sound-row">
        <div class="sound-info">
          <div class="sound-name">${this.t("tts_label")}</div>
          <div class="row-sub">${this._escape(sub)}</div>
        </div>
        <div class="toggle ${enabled ? "on" : ""}" data-action="toggle-tts-master">
          <div class="toggle-knob"></div>
        </div>
        <div class="chevron-btn" data-action="open-tts-settings">${ICONS.chevronRight}</div>
      </div>
    `;
  }

  _htmlSectionSoundModes() {
    // 2.0.49 — own top-level section (was a subgroup inside Sounds since
    // 2.0.41/2.0.45): every condition that changes what (or how loud)
    // Nida plays. Guest mode mutes scheduled adhan + pre-adhan entirely
    // (test buttons stay live); night mode and open-contact adjust the
    // volume by a factor. services.py reads the live state at fire time
    // and, when several volume factors apply, uses the lowest (quietest
    // wins).
    // 2.0.71 — guest mode moved to the companion column as a card;
    // Sound Modes now starts with night mode.
    const nEnabled = this._nightModeEnabled();
    const nStart = this._nightStart();
    const nEnd = this._nightEnd();
    const nFactor = this._nightVolumeFactor();

    const oEnabled = this._openContactEnabled();
    const oCount = this._openContactSensors().length;
    const oFactor = this._openContactVolumeFactor();
    const oSummary = oCount === 0
      ? this.t("open_contact_sensors_none")
      : `${oCount} ${this.t("speakers_count_suffix")}`;

    const cardInner = `
      <div class="sounds-group-head">${this.t("sounds_group_night")}</div>
      <div class="row">
        <div class="row-info">
          <span class="row-label">${this.t("night_mode_sub")}</span>
        </div>
        <div class="toggle ${nEnabled ? "on" : ""}" data-action="toggle-night-mode">
          <div class="toggle-knob"></div>
        </div>
      </div>
      ${nEnabled ? `
        <div class="row">
          <span class="row-label">${this.t("night_start_label")}</span>
          <input type="time" data-input="night-start"
                 value="${this._escape(nStart)}" class="time-input">
        </div>
        <div class="row">
          <span class="row-label">${this.t("night_end_label")}</span>
          <input type="time" data-input="night-end"
                 value="${this._escape(nEnd)}" class="time-input">
        </div>
        <div class="minutes-row">
          <div class="sound-info">
            <div class="sound-name">${this.t("night_volume_label")}</div>
            <div class="volume-row">
              <input type="range" min="0" max="100" step="5"
                     value="${nFactor}"
                     data-input="night-volume-factor"
                     class="volume-slider"
                     aria-label="${this.t("night_volume_label")}">
              <span class="volume-value" data-night-factor-display>${nFactor}%</span>
            </div>
          </div>
        </div>
      ` : ""}

      <div class="sounds-group-head">${this.t("open_contact_label")}</div>
      <div class="row">
        <div class="row-info">
          <span class="row-label">${this.t("open_contact_sub")}</span>
        </div>
        <div class="toggle ${oEnabled ? "on" : ""}" data-action="toggle-open-contact">
          <div class="toggle-knob"></div>
        </div>
      </div>
      ${oEnabled ? `
        <div class="select-field flat" data-action="open-open-contact-sensors">
          <span>${this.t("open_contact_sensors_label")}</span>
          <span class="select-value">${this._escape(oSummary)} ${ICONS.chevronRight}</span>
        </div>
        <div class="minutes-row">
          <div class="sound-info">
            <div class="sound-name">${this.t("open_contact_factor_label")}</div>
            <div class="volume-row">
              <input type="range" min="0" max="150" step="5"
                     value="${oFactor}"
                     data-input="open-contact-factor"
                     class="volume-slider"
                     aria-label="${this.t("open_contact_factor_label")}">
              <span class="volume-value" data-open-contact-factor-display>${oFactor}%</span>
            </div>
          </div>
        </div>
      ` : ""}
    `;
    return this._sectionWrapper(
      "sound_modes",
      ICONS.sliders,
      this.t("section_sound_modes"),
      cardInner
    );
  }

  _htmlSectionDua() {
    // 2.0.51 — manually played supplications. Each dua block: sound
    // (picked from the Sound Library's dua category), its OWN media
    // player, a volume, a test-play and a remove. Playback goes through
    // nida.play_dua; button.py exposes one button entity per dua so
    // sensors/automations/dashboards can trigger it.
    const duas = this._duas();
    const players = this._mediaPlayers || [];
    const triggerCandidates = this._listDuaTriggerCandidates();
    const blocks = duas.map((d) => {
      const id = this._escape(String(d.id));
      const name = this._escape(String(d.name || d.id).replace(/_/g, " "));
      // 2.0.71 — show the human-readable catalog name of the sound
      // ("Sleep") not the internal rel_path or id. Fall back gracefully.
      const soundName = d.sound
        ? this._escape(this._prettySoundName(d.sound, "dua"))
        : this.t("dua_sound_none");
      const vol = Number.isFinite(parseInt(d.volume, 10))
        ? Math.max(0, Math.min(100, parseInt(d.volume, 10)))
        : 40;
      const opts = players.map((m) => `
        <option value="${this._escape(m.entity_id)}"
                ${m.entity_id === d.media_player ? "selected" : ""}>
          ${this._escape(m.name || m.entity_id)}
        </option>`).join("");
      const triggerOpts = triggerCandidates.map((c) => `
        <option value="${this._escape(c.entity_id)}"
                ${c.entity_id === d.trigger_entity ? "selected" : ""}>
          ${this._escape(c.name)}
        </option>`).join("");
      return `
        <div class="sounds-group-head">${name}</div>
        <div class="select-field flat" data-action="dua-pick-sound" data-dua-id="${id}">
          <span>${this.t("dua_sound_label")}</span>
          <span class="select-value">${soundName} ${ICONS.chevronRight}</span>
        </div>
        <div class="row">
          <span class="row-label">${this.t("dua_player_label")}</span>
          <select class="dua-player-select" data-input="dua-player" data-dua-id="${id}">
            <option value="">${this.t("dua_no_player")}</option>
            ${opts}
          </select>
        </div>
        <div class="row">
          <div class="row-info">
            <span class="row-label">${this.t("dua_trigger_label")}</span>
            <span class="row-sub">${this.t("dua_trigger_sub")}</span>
          </div>
          <select class="dua-player-select" data-input="dua-trigger" data-dua-id="${id}">
            <option value="">${this.t("dua_no_trigger")}</option>
            ${triggerOpts}
          </select>
        </div>
        <div class="minutes-row">
          <div class="sound-info">
            <div class="sound-name">${this.t("dua_volume_label")}</div>
            <div class="volume-row">
              <input type="range" min="0" max="100" step="5"
                     value="${vol}"
                     data-input="dua-volume" data-dua-id="${id}"
                     class="volume-slider"
                     aria-label="${this.t("dua_volume_label")}">
              <span class="volume-value" data-dua-volume-display="${id}">${vol}%</span>
            </div>
          </div>
        </div>
        <div class="row dua-actions">
          <div class="play-btn ${d.media_player ? "" : "disabled"}"
               data-action="${this._duaPlaying === id ? "dua-stop" : "dua-play"}" data-dua-id="${id}"
               title="${d.media_player ? (this._duaPlaying === id ? this.t("dua_stop") : this.t("dua_play_test")) : this.t("dua_no_player")}">
            ${this._duaPlaying === id ? ICONS.stop : ICONS.play}
          </div>
          <button class="test-btn dua-remove" data-action="dua-remove" data-dua-id="${id}">
            ${this.t("dua_remove")}
          </button>
        </div>
      `;
    }).join("");
    const cardInner = `
      ${duas.length ? blocks : `<div class="card-note">${this.t("dua_none")}</div>`}
      <div class="row dua-actions">
        <button class="test-btn" data-action="dua-add">${this.t("dua_add")}</button>
      </div>
    `;
    return this._sectionWrapper(
      "dua",
      ICONS.dua,
      this.t("section_dua"),
      cardInner
    );
  }

  // ───── Open-contact volume (2.0.41) ────────────────────────────────────
  // A door/window-open condition that adjusts the play volume, sitting next
  // to night mode under "Volume adjustments". Contact sensors are listed
  // straight from hass.states (device_class door/window/opening/garage_door)
  // so no backend WS command is needed. The chosen entity_ids + factor go to
  // options; services.py reads them (and the live sensor state) at fire time.

  _openContactEnabled() {
    return !!this._settings?.open_contact_enabled;
  }

  _guestModeEnabled() {
    return !!this._settings?.guest_mode_enabled;
  }

  _guestModeHours() {
    const n = parseInt(this._settings?.guest_mode_hours, 10);
    if (Number.isFinite(n) && n >= 1 && n <= GUEST_HOURS_INF) return n;
    return 4;
  }

  _fmtGuestHours(n) {
    // Slider value formatter — the infinite sentinel renders as a bare
    // infinity sign, everything else as "<n> <unit>".
    return n === GUEST_HOURS_INF ? "\u221E" : `${n} ${this.t("guest_mode_hours_unit")}`;
  }

  _guestModeUntil() {
    const raw = this._settings?.guest_mode_until;
    if (!raw) return null;
    const d = new Date(raw);
    return isNaN(d.getTime()) ? null : d;
  }

  _guestModeActive() {
    // Mirrors services.py::_guest_mode_active — enabled AND until not
    // passed; missing until = on until manually off.
    if (!this._guestModeEnabled()) return false;
    const until = this._guestModeUntil();
    return !until || until.getTime() > Date.now();
  }

  _fmtHHMM(d) {
    return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  }

  // 2.0.80 — silent mode is now started/stopped from a small popup
  // (opened via the mute button on the now-card) instead of the old
  // guest-mode tile/banner. The popup's <select> is read directly at
  // confirm time; "until" is always (re)anchored from now, which covers
  // both starting fresh and updating an already-active window. The
  // underlying settings keys (guest_mode_*) are unchanged so the backend
  // needs no update.
  _onOpenSilentMode() {
    this._openOverlay("silent-mode");
  }

  _onConfirmSilentMode() {
    const root = this._overlayPortal || this.shadowRoot;
    const select = root?.querySelector('[data-input="silent-mode-hours"]');
    let hours = parseInt(select?.value, 10);
    if (!Number.isFinite(hours)) hours = 2;
    hours = Math.max(1, Math.min(GUEST_HOURS_INF, hours));
    const until = new Date(Date.now() + hours * 3600 * 1000).toISOString();
    this._saveSettings({ guest_mode_enabled: true, guest_mode_hours: hours, guest_mode_until: until });
    this._closeOverlay();
  }

  _onTurnOffSilentMode() {
    this._saveSettings({ guest_mode_enabled: false, guest_mode_until: null });
    this._closeOverlay();
  }

  _openContactSensors() {
    const v = this._settings?.open_contact_sensors;
    if (Array.isArray(v)) return v;
    if (typeof v === "string" && v) return [v];
    return [];
  }

  _openContactVolumeFactor() {
    const n = parseInt(this._settings?.open_contact_volume_factor, 10);
    if (Number.isFinite(n) && n >= 0 && n <= 150) return n;
    return 130;
  }

  _onToggleOpenContact() {
    this._saveSettings({ open_contact_enabled: !this._openContactEnabled() });
  }

  _onOpenContactFactorChange(value) {
    let n = parseInt(value, 10);
    if (!Number.isFinite(n)) return;
    n = Math.max(0, Math.min(150, n));
    this._saveSettings({ open_contact_volume_factor: n });
  }

  _toggleOpenContactSensor(entityId) {
    const current = this._openContactSensors();
    const next = current.includes(entityId)
      ? current.filter((id) => id !== entityId)
      : [...current, entityId];
    this._saveSettings({ open_contact_sensors: next });
  }

  _listContactSensors() {
    // Door/window/opening binary_sensors, read directly from HA state.
    const states = this._hass?.states || {};
    const wanted = new Set(["door", "window", "opening", "garage_door"]);
    const out = [];
    for (const entityId of Object.keys(states)) {
      if (!entityId.startsWith("binary_sensor.")) continue;
      const st = states[entityId];
      const dc = st?.attributes?.device_class;
      if (!wanted.has(dc)) continue;
      const name = st?.attributes?.friendly_name || entityId;
      out.push({ entity_id: entityId, name });
    }
    out.sort((a, b) => a.name.localeCompare(b.name));
    return out;
  }

  _listDuaTriggerCandidates() {
    // 2.0.61 — entities a dua can be triggered by: contact-like
    // binary_sensors (plus motion/occupancy/presence), every switch and
    // every input_boolean. Read directly from HA state like the
    // contact-sensor picker above.
    const states = this._hass?.states || {};
    const sensorClasses = new Set([
      "door", "window", "opening", "garage_door",
      "motion", "occupancy", "presence",
    ]);
    const out = [];
    for (const entityId of Object.keys(states)) {
      const st = states[entityId];
      if (entityId.startsWith("binary_sensor.")) {
        if (!sensorClasses.has(st?.attributes?.device_class)) continue;
      } else if (
        !entityId.startsWith("switch.") && !entityId.startsWith("input_boolean.")
      ) {
        continue;
      }
      out.push({
        entity_id: entityId,
        name: st?.attributes?.friendly_name || entityId,
      });
    }
    out.sort((a, b) => a.name.localeCompare(b.name));
    return out;
  }

  _htmlSoundRow(cat, opts) {
    // Extracted from the old _htmlSectionSounds() map. One sound
    // row — name, default-or-custom subtitle, volume slider,
    // preview play/stop. Identical to 2.0.22 behaviour.
    // 2.0.38: optional opts.audioToggle slot — for the pre-adhan
    // jingle, a master "play on speakers" toggle now lives in the
    // row itself (replacing the standalone "Play pre-adhan audio"
    // row). Mirror of the TTS row's toggle position.
    const stored = this._settings?.[`sound_${cat.key}`];
    // 2.0.55 — while random adhan is on, the fixed pick on the two adhan
    // rows is only the fallback; say so instead of implying it will play.
    const randomActive =
      !!this._settings?.random_adhan_enabled &&
      (cat.key === "fajr_adhan" || cat.key === "adhan");
    const subtitle = randomActive
      ? this.t("sound_row_random_sub")
      : stored
        ? this._prettySoundName(stored, cat.key)
        : `${this.t(cat.subtitle_key)} · ${this.t("sound_default")}`;
    const isPlaying = this._currentAudio?.category === cat.key;
    const btnIcon = isPlaying ? ICONS.stop : ICONS.play;
    const btnAction = isPlaying ? "stop-sound" : "play-sound";
    const volume = this._volumeFor(cat.key);
    const showToggle = !!(opts && opts.audioToggle);
    const audioEnabled = showToggle ? this._preAdhanAudioEnabled() : false;
    return `
      <div class="sound-row">
        <div class="sound-info">
          <div class="sound-name">${this.t(cat.label_key)}</div>
          <div class="row-sub ${randomActive ? "random-active" : ""}">${this._escape(subtitle)}</div>
          <div class="volume-row">
            <input type="range" min="0" max="100" step="5"
                   value="${volume}"
                   data-input="volume-${cat.key}"
                   class="volume-slider"
                   aria-label="${this.t("volume_label")}">
            <span class="volume-value" data-volume-display="${cat.key}">${volume}%</span>
          </div>
        </div>
        ${showToggle ? `
          <div class="toggle ${audioEnabled ? "on" : ""}" data-action="toggle-pre-adhan-audio"
               title="${this.t("pre_adhan_audio_label")}">
            <div class="toggle-knob"></div>
          </div>
        ` : ""}
        <div class="play-btn ${isPlaying ? 'playing' : ''}" data-action="${btnAction}" data-category="${cat.key}">${btnIcon}</div>
        <div class="chevron-btn" data-action="open-sound-library" data-category="${cat.key}">${ICONS.chevronRight}</div>
      </div>
    `;
  }

  _prettySoundName(relPath, category) {
    // Turn a stored sound path like
    // "adhan/adhan_fajr_ahmed_saeed_al_omrany_62832690.mp3" into a
    // human-readable "Ahmed Saeed Al Omrany" for the Sounds row. Strips
    // the folder, the category filename-prefix, a trailing content-hash
    // segment and the extension, then spaces + title-cases. This mirrors
    // how the catalog derives its display names, so a selected sound reads
    // the same here as it does in the picker without needing the catalog
    // loaded. Honorifics (e.g. "Hafiz") are kept on purpose — stripping
    // them is fragile and would diverge from the picker name. Falls back
    // to the raw path if nothing sensible remains.
    if (!relPath) return "";
    const PREFIXES = {
      fajr_adhan: ["adhan_fajr_", "fajr_"],
      adhan: ["adhan_day_", "adhan_", "day_"],
      pre_adhan_jingle: ["pre_adhan_jingle_", "nadir_jingle_", "jingle_"],
    };
    let base = String(relPath).split("/").pop().replace(/\.[a-z0-9]+$/i, "");
    for (const p of (PREFIXES[category] || [])) {
      if (base.toLowerCase().startsWith(p)) { base = base.slice(p.length); break; }
    }
    base = base.replace(/_[0-9a-f]{6,}$/i, "");            // drop trailing hash
    base = base.replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim();
    if (!base) return String(relPath);
    return base
      .split(" ")
      .map((w) => (w ? w[0].toUpperCase() + w.slice(1) : w))
      .join(" ");
  }

  _htmlPreAdhanTestRow() {
    // Mirror of the Speakers test row in _htmlSectionSpeakers:
    // single sound-row with its own volume slider (volume_pre_adhan_test)
    // and a play/stop toggle button. Disabled when no speakers selected
    // — same data-disabled="true" pattern so the click handler can short-
    // circuit early without disabling the slider next to it.
    const selected = this._selectedSpeakerIds();
    const testVol = this._volumePreAdhanTest();
    const playing = !!this._preAdhanTestPlaying;
    return `
      <div class="sound-row">
        <div class="sound-info">
          <div class="sound-name">${this.t("pre_adhan_test_label")}</div>
          <div class="row-sub">${this.t("pre_adhan_test_sub")}</div>
          <div class="volume-row">
            <input type="range" min="0" max="100" step="1"
                   value="${testVol}"
                   data-input="volume-pre-adhan-test"
                   class="volume-slider"
                   aria-label="${this.t("pre_adhan_test_label")}">
            <span class="volume-value" data-pre-adhan-test-volume-display>${testVol}%</span>
          </div>
        </div>
        <div class="play-btn ${playing ? 'playing' : ''}"
             data-action="${playing ? 'stop-pre-adhan-test' : 'play-pre-adhan-test'}"
             ${selected.length === 0 ? 'data-disabled="true"' : ''}>
          ${playing ? ICONS.stop : ICONS.play}
        </div>
        <div class="chevron-btn spacer">${ICONS.chevronRight}</div>
      </div>
    `;
  }

  _volumePreAdhanTest() {
    const raw = this._settings?.volume_pre_adhan_test;
    const n = parseInt(raw, 10);
    if (Number.isFinite(n) && n >= 0 && n <= 100) return n;
    return 30;
  }

  _onVolumePreAdhanTestChange(value) {
    let n = parseInt(value, 10);
    if (!Number.isFinite(n)) return;
    n = Math.max(0, Math.min(100, n));
    this._saveSettings({ volume_pre_adhan_test: n });
  }

  async _onPlayPreAdhanTest(btn) {
    // Same shape as _onPlaySpeakerTest. 8s auto-reset so a user who
    // walked away doesn't see a stuck "Stop" button forever.
    if (!this._selectedSpeakerIds().length) return;
    this._preAdhanTestPlaying = true;
    this._renderPlayBtnOnly(btn, /*playing=*/true, "stop-pre-adhan-test");
    try {
      await this._hass.callService("nida", "play_pre_adhan_test", {});
    } catch (e) {
      console.warn("Nida: play_pre_adhan_test failed:", e);
    }
    if (this._preAdhanTestTimer) clearTimeout(this._preAdhanTestTimer);
    this._preAdhanTestTimer = setTimeout(() => {
      this._preAdhanTestPlaying = false;
      this._renderPlayBtnOnly(btn, false, "play-pre-adhan-test");
    }, 8000);
  }

  async _onStopPreAdhanTest(btn) {
    if (this._preAdhanTestTimer) {
      clearTimeout(this._preAdhanTestTimer);
      this._preAdhanTestTimer = null;
    }
    this._preAdhanTestPlaying = false;
    this._renderPlayBtnOnly(btn, false, "play-pre-adhan-test");
    const speakers = this._selectedSpeakerIds();
    if (!speakers.length) return;
    try {
      await this._hass.callService("media_player", "media_stop", {
        entity_id: speakers,
      });
    } catch (e) {
      console.warn("Nida: media_stop failed:", e);
    }
  }

  _preAdhanAudioEnabled() {
    const v = this._settings?.pre_adhan_audio_enabled;
    return v === undefined ? true : !!v;
  }

  _onTogglePreAdhanAudio() {
    const next = !this._preAdhanAudioEnabled();
    this._saveSettings({ pre_adhan_audio_enabled: next });
  }

  async _onTestPreAdhan(btn) {
    if (!btn || btn.disabled) return;
    const originalLabel = btn.textContent;
    btn.disabled = true;
    btn.textContent = this.t("test_sending");
    btn.classList.remove("test-success", "test-error");
    try {
      await this._hass.callService("nida", "play_pre_adhan_jingle", {});
      btn.textContent = this.t("test_sent");
      btn.classList.add("test-success");
    } catch (e) {
      btn.textContent = this.t("test_failed");
      btn.classList.add("test-error");
      console.warn("Nida: test pre-adhan failed:", e);
    }
    setTimeout(() => {
      if (!btn.isConnected) return;
      btn.disabled = false;
      btn.textContent = originalLabel;
      btn.classList.remove("test-success", "test-error");
    }, 3000);
  }

  _preAdhanMinutes(slot) {
    const key = slot === 2 ? "pre_adhan_minutes_2" : "pre_adhan_minutes";
    const fallback = slot === 2 ? 10 : 25;
    const raw = this._settings?.[key];
    const n = parseInt(raw, 10);
    if (Number.isFinite(n) && n >= 2 && n <= 30) return n;
    return fallback;
  }

  _preAdhanTwoEnabled() {
    return !!this._settings?.pre_adhan_two_enabled;
  }

  _onPreAdhanMinutesChange(slot, value) {
    let n = parseInt(value, 10);
    if (!Number.isFinite(n)) return;
    n = Math.max(2, Math.min(30, n));
    const key = slot === 2 ? "pre_adhan_minutes_2" : "pre_adhan_minutes";
    this._saveSettings({ [key]: n });
  }

  _onTogglePreAdhanTwo() {
    const next = !this._preAdhanTwoEnabled();
    this._saveSettings({ pre_adhan_two_enabled: next });
  }

  _volumeFor(category) {
    // Defaults match const.py DEFAULT_VOLUMES — keep them in sync.
    // Fajr lower than the day-adhan since it fires at dawn.
    const DEFAULTS = { fajr_adhan: 10, adhan: 20, pre_adhan_jingle: 20 };
    const raw = this._settings?.[`volume_${category}`];
    const n = parseInt(raw, 10);
    if (Number.isFinite(n) && n >= 0 && n <= 100) return n;
    return DEFAULTS[category] ?? 20;
  }

  _onVolumeChange(category, value) {
    // change event (mouseup/touchend) fires once per slide gesture, so this
    // doesn't spam the backend during dragging. The input event handles
    // the live "85%" label update without persisting.
    let n = parseInt(value, 10);
    if (!Number.isFinite(n)) return;
    n = Math.max(0, Math.min(100, n));
    this._saveSettings({ [`volume_${category}`]: n });
  }

  _htmlSectionNotifications() {
    const enabled = !!this._settings?.notify_enabled;
    const targets = this._notifyTargetIds();
    const targetsByFull = new Map(this._notifyServices.map((n) => [n.full, n]));
    const targetNames = targets
      .map((t) => (targetsByFull.get(t) ? targetsByFull.get(t).service : t))
      .filter(Boolean);
    let targetsSummary;
    if (targetNames.length === 0) {
      targetsSummary = this.t("notify_targets_none");
    } else if (targetNames.length <= 2) {
      targetsSummary = targetNames.join(", ");
    } else {
      targetsSummary = `${targetNames.length} ${this.t("speakers_count_suffix")}`;
    }
    const title = this._settings?.notify_title ?? "";
    const message = this._settings?.notify_message ?? "";

    const cardInner = `
      <div class="row">
        <div class="row-info">
          <span class="row-label">${this.t("notify_master_label")}</span>
          <span class="row-sub">${this.t("notify_master_sub")}</span>
        </div>
        <div class="toggle ${enabled ? "on" : ""}" data-action="toggle-notify-master">
          <div class="toggle-knob"></div>
        </div>
      </div>
      ${enabled ? `
        <div class="select-field flat" data-action="open-notify-targets">
          <span>${this.t("notify_targets_label")}</span>
          <span class="select-value">${this._escape(targetsSummary)} ${ICONS.chevronRight}</span>
        </div>
        <div class="text-field">
          <label>${this.t("notify_message_label")}</label>
          <input type="text" data-input="notify-message"
                 value="${this._escape(message)}" autocomplete="off"
                 placeholder="${this._escape(this.t("notify_message_hint"))}">
        </div>
        <div class="subsection-head">${this.t("notify_per_prayer_label")}</div>
        <div class="notify-critical-hint">${this.t("notify_critical_sub")}</div>
        ${PRAYERS.map((p) => {
          const prayerEnabled = this._isNotifyEnabledFor(p);
          const prayerCritical = this._isNotifyCriticalFor(p);
          const noTargets = this._notifyTargetIds().length === 0;
          return `
          <div class="row notify-prayer-row">
            <span class="row-label">${this.t("prayer_" + p)}</span>
            <div class="notify-prayer-toggles">
              ${prayerEnabled ? `
                <div class="toggle-mini test-mini ${noTargets ? "disabled" : ""}"
                     data-action="${noTargets ? "" : "test-notify-prayer"}" data-prayer="${p}"
                     title="${this._escape(this.t("test_notify_prayer_tooltip"))}">
                  ${ICONS.play}
                </div>
                <div class="toggle-mini critical ${prayerCritical ? "on" : ""}"
                     data-action="toggle-notify-critical-prayer" data-prayer="${p}"
                     title="${this._escape(this.t("notify_critical_label"))}">
                  ${ICONS.alertTriangle}
                </div>
              ` : ""}
              <div class="toggle ${prayerEnabled ? "on" : ""}"
                   data-action="toggle-notify-prayer" data-prayer="${p}">
                <div class="toggle-knob"></div>
              </div>
            </div>
          </div>
        `;
        }).join("")}
        <div class="test-row">
          <button class="test-btn" data-action="test-notify"
                  ${this._notifyTargetIds().length === 0 ? "disabled" : ""}>
            ${this.t("test_notify_btn")}
          </button>
        </div>
      ` : ""}
    `;
    return this._sectionWrapper(
      "notifications",
      ICONS.bell || ICONS.speaker,
      this.t("section_notifications"),
      cardInner
    );
  }

  _htmlSectionJumuah() {
    const enabled = this._jumuahEnabled();
    const minutes = this._jumuahMinutes();
    const message = this._settings?.jumuah_message ?? "";
    const jumuahTargets = this._jumuahTargetIds();
    const targetsByFull = new Map(this._notifyServices.map((n) => [n.full, n]));
    const jumuahTargetNames = jumuahTargets
      .map((t) => (targetsByFull.get(t) ? targetsByFull.get(t).service : t))
      .filter(Boolean);
    let jumuahTargetsSummary;
    if (jumuahTargetNames.length === 0) {
      jumuahTargetsSummary = this.t("jumuah_targets_none");
    } else if (jumuahTargetNames.length <= 2) {
      jumuahTargetsSummary = jumuahTargetNames.join(", ");
    } else {
      jumuahTargetsSummary = `${jumuahTargetNames.length} ${this.t("speakers_count_suffix")}`;
    }
    const cardInner = `
      <div class="row">
        <div class="row-info">
          <span class="row-label">${this.t("jumuah_reminder_label")}</span>
          <span class="row-sub">${this.t("jumuah_reminder_sub")}</span>
        </div>
        <div class="toggle ${enabled ? "on" : ""}" data-action="toggle-jumuah">
          <div class="toggle-knob"></div>
        </div>
      </div>
      ${enabled ? `
        <div class="select-field flat" data-action="open-jumuah-targets">
          <span>${this.t("jumuah_targets_label")}</span>
          <span class="select-value">${this._escape(jumuahTargetsSummary)} ${ICONS.chevronRight}</span>
        </div>
        <div class="minutes-row">
          <div class="sound-info">
            <div class="sound-name">${this.t("jumuah_minutes_label")}</div>
            <div class="volume-row">
              <input type="range" min="30" max="120" step="5"
                     value="${minutes}"
                     data-input="jumuah-minutes"
                     class="volume-slider"
                     aria-label="${this.t("jumuah_minutes_label")}">
              <span class="volume-value" data-jumuah-minutes-display>${minutes} ${this.t("minutes_short")}</span>
            </div>
          </div>
        </div>
        <div class="text-field">
          <label>${this.t("jumuah_message_label")}</label>
          <input type="text" data-input="jumuah-message"
                 value="${this._escape(message)}" autocomplete="off"
                 placeholder="${this._escape(this.t("jumuah_message_hint"))}">
        </div>
        <div class="test-row">
          <button class="test-btn" data-action="test-jumuah"
                  ${jumuahTargets.length === 0 ? "disabled" : ""}>
            ${this.t("test_jumuah_btn")}
          </button>
        </div>
      ` : ""}
    `;
    return this._sectionWrapper(
      "jumuah",
      ICONS.bell || ICONS.speaker,
      this.t("section_jumuah"),
      cardInner
    );
  }

  _htmlSectionRamadan() {
    // 2.0.88 — always visible (people set this up before the month
    // starts), currently holding one control: the Imsak offset. The
    // panel shows Imsak this many minutes EARLIER than the API value,
    // for people who need preparation time before suhoor.
    const offset = this._imsakOffset();
    const cardInner = `
      <div class="minutes-row">
        <div class="sound-info">
          <div class="sound-name">${this.t("imsak_offset_label")}</div>
          <div class="row-sub">${this.t("imsak_offset_sub")}</div>
          <div class="volume-row">
            <input type="range" min="0" max="60" step="5"
                   value="${offset}"
                   data-input="imsak-offset"
                   class="volume-slider"
                   aria-label="${this.t("imsak_offset_label")}">
            <span class="volume-value" data-imsak-offset-display>${offset} ${this.t("minutes_short")}</span>
          </div>
        </div>
      </div>
    `;
    return this._sectionWrapper(
      "ramadan",
      ICONS.moon,
      this.t("section_ramadan"),
      cardInner
    );
  }

  // ───── Islamic Calendar (2.1.0) ─────────────────────────────────────────
  // Four independent reminder types tied to fixed Hijri dates — ported
  // from the Nida Android app's "Islamic Calendar" screen. Holidays is the
  // only type with a lead-time concept; the other three fire on the day
  // itself (backend: scheduler.py's calendar check, once daily at
  // calendar_fire_time). Own target list (calendar_notify_targets),
  // separate from the adhan/prayer notify_targets — see const.py's
  // OPT_CALENDAR_* section for the full backend design.

  _htmlSectionIslamicCalendar() {
    const holidaysEnabled = !!this._settings?.calendar_holidays_enabled;
    const secondEnabled = !!this._settings?.calendar_holidays_second_enabled;
    const lead1 = this._calendarHolidaysLeadDays(1);
    const lead2 = this._calendarHolidaysLeadDays(2);
    const ashuraEnabled = !!this._settings?.calendar_ashura_arafah_enabled;
    const whiteDaysEnabled = !!this._settings?.calendar_white_days_enabled;
    const sunnahEnabled = !!this._settings?.calendar_weekly_sunnah_enabled;
    const fireTime = this._settings?.calendar_fire_time || "05:30";

    const targets = this._calendarTargetIds();
    const targetsByFull = new Map(this._notifyServices.map((n) => [n.full, n]));
    const targetNames = targets
      .map((t) => (targetsByFull.get(t) ? targetsByFull.get(t).service : t))
      .filter(Boolean);
    let targetsSummary;
    if (targetNames.length === 0) {
      targetsSummary = this.t("notify_targets_none");
    } else if (targetNames.length <= 2) {
      targetsSummary = targetNames.join(", ");
    } else {
      targetsSummary = `${targetNames.length} ${this.t("speakers_count_suffix")}`;
    }

    const cardInner = `
      <div class="card-note">${this.t("calendar_intro")}</div>

      <div class="subsection-head">${this.t("calendar_holidays_head")}</div>
      <div class="row">
        <div class="row-info">
          <span class="row-label">${this.t("calendar_holidays_label")}</span>
          <span class="row-sub">${this.t("calendar_holidays_sub")}</span>
        </div>
        <div class="toggle ${holidaysEnabled ? "on" : ""}" data-action="toggle-calendar-holidays">
          <div class="toggle-knob"></div>
        </div>
      </div>
      ${holidaysEnabled ? `
        <div class="minutes-row">
          <div class="sound-info">
            <div class="sound-name">${this.t("calendar_holidays_lead_label")}</div>
            <div class="volume-row">
              <input type="range" min="0" max="30" step="1"
                     value="${lead1}"
                     data-input="calendar-holidays-lead-1"
                     class="volume-slider"
                     aria-label="${this.t("calendar_holidays_lead_label")}">
              <span class="volume-value" data-calendar-lead-display="1">${lead1} ${this.t("days_short")}</span>
            </div>
          </div>
        </div>
        <div class="row">
          <div class="row-info">
            <span class="row-label">${this.t("calendar_holidays_second_label")}</span>
          </div>
          <div class="toggle ${secondEnabled ? "on" : ""}" data-action="toggle-calendar-holidays-second">
            <div class="toggle-knob"></div>
          </div>
        </div>
        ${secondEnabled ? `
          <div class="minutes-row sub-indent">
            <div class="sound-info">
              <div class="sound-name">${this.t("calendar_holidays_second_lead_label")}</div>
              <div class="volume-row">
                <input type="range" min="0" max="30" step="1"
                       value="${lead2}"
                       data-input="calendar-holidays-lead-2"
                       class="volume-slider"
                       aria-label="${this.t("calendar_holidays_second_lead_label")}">
                <span class="volume-value" data-calendar-lead-display="2">${lead2} ${this.t("days_short")}</span>
              </div>
            </div>
          </div>
        ` : ""}
      ` : ""}

      <div class="subsection-head">${this.t("calendar_ashura_head")}</div>
      <div class="row">
        <div class="row-info">
          <span class="row-label">${this.t("calendar_ashura_label")}</span>
          <span class="row-sub">${this.t("calendar_ashura_sub")}</span>
        </div>
        <div class="toggle ${ashuraEnabled ? "on" : ""}" data-action="toggle-calendar-ashura">
          <div class="toggle-knob"></div>
        </div>
      </div>

      <div class="subsection-head">${this.t("calendar_white_days_head")}</div>
      <div class="row">
        <div class="row-info">
          <span class="row-label">${this.t("calendar_white_days_label")}</span>
          <span class="row-sub">${this.t("calendar_white_days_sub")}</span>
        </div>
        <div class="toggle ${whiteDaysEnabled ? "on" : ""}" data-action="toggle-calendar-white-days">
          <div class="toggle-knob"></div>
        </div>
      </div>

      <div class="subsection-head">${this.t("calendar_sunnah_head")}</div>
      <div class="row">
        <div class="row-info">
          <span class="row-label">${this.t("calendar_sunnah_label")}</span>
          <span class="row-sub">${this.t("calendar_sunnah_sub")}</span>
        </div>
        <div class="toggle ${sunnahEnabled ? "on" : ""}" data-action="toggle-calendar-sunnah">
          <div class="toggle-knob"></div>
        </div>
      </div>

      <div class="subsection-head">${this.t("calendar_delivery_head")}</div>
      <div class="select-field flat" data-action="open-calendar-targets">
        <span>${this.t("calendar_targets_label")}</span>
        <span class="select-value">${this._escape(targetsSummary)} ${ICONS.chevronRight}</span>
      </div>
      <div class="row">
        <div class="row-info">
          <span class="row-label">${this.t("calendar_fire_time_label")}</span>
          <span class="row-sub">${this.t("calendar_fire_time_sub")}</span>
        </div>
        <input type="time" data-input="calendar-fire-time" value="${this._escape(fireTime)}">
      </div>
    `;
    return this._sectionWrapper(
      "islamic_calendar",
      ICONS.calendar,
      this.t("section_islamic_calendar"),
      cardInner
    );
  }

  _calendarHolidaysLeadDays(slot) {
    const key = slot === 2 ? "calendar_holidays_second_lead_days" : "calendar_holidays_lead_days";
    const fallback = slot === 2 ? 1 : 7;
    const raw = this._settings?.[key];
    const n = parseInt(raw, 10);
    if (Number.isFinite(n) && n >= 0 && n <= 30) return n;
    return fallback;
  }

  _onCalendarLeadChange(slot, value) {
    let n = parseInt(value, 10);
    if (!Number.isFinite(n)) return;
    n = Math.max(0, Math.min(30, n));
    const key = slot === 2 ? "calendar_holidays_second_lead_days" : "calendar_holidays_lead_days";
    this._saveSettings({ [key]: n });
  }

  _onToggleCalendarHolidays() {
    this._saveSettings({ calendar_holidays_enabled: !this._settings?.calendar_holidays_enabled });
  }

  _onToggleCalendarHolidaysSecond() {
    this._saveSettings({ calendar_holidays_second_enabled: !this._settings?.calendar_holidays_second_enabled });
  }

  _onToggleCalendarAshura() {
    this._saveSettings({ calendar_ashura_arafah_enabled: !this._settings?.calendar_ashura_arafah_enabled });
  }

  _onToggleCalendarWhiteDays() {
    this._saveSettings({ calendar_white_days_enabled: !this._settings?.calendar_white_days_enabled });
  }

  _onToggleCalendarSunnah() {
    this._saveSettings({ calendar_weekly_sunnah_enabled: !this._settings?.calendar_weekly_sunnah_enabled });
  }

  _onCalendarFireTimeChange(value) {
    if (!/^\d{2}:\d{2}$/.test(value)) return;
    this._saveSettings({ calendar_fire_time: value });
  }

  _calendarTargetIds() {
    const v = this._settings?.calendar_notify_targets;
    if (Array.isArray(v)) return v;
    if (typeof v === "string" && v) return [v];
    return [];
  }

  _toggleCalendarTarget(fullServiceName) {
    const current = this._calendarTargetIds();
    const next = current.includes(fullServiceName)
      ? current.filter((t) => t !== fullServiceName)
      : [...current, fullServiceName];
    this._saveSettings({ calendar_notify_targets: next });
  }

  _onImsakOffsetChange(value) {
    let n = parseInt(value, 10);
    if (!Number.isFinite(n)) return;
    n = Math.max(0, Math.min(60, n));
    this._saveSettings({ imsak_offset_min: n });
  }

  // ───── Setup (2.1.0) ────────────────────────────────────────────────────
  // Always the last section in the settings column. Lets the user re-run
  // the first-use setup at any time via one of three entry modes:
  // "manual" (walk every section), "auto" (device-detected defaults,
  // fewer questions) or "restore" (load a previously exported backup).
  // If the install already looks configured, a confirm overlay warns
  // before anything is overwritten. Step content for manual/auto lands in
  // separate follow-up changes; this is the entry point + shell only.

  _htmlSectionSetup() {
    const cardInner = `
      <div class="row-sub setup-intro">${this.t("setup_section_intro")}</div>
      <div class="setup-options">
        <button class="setup-option-btn" data-action="setup-start" data-mode="manual">
          <div class="setup-option-title">${this.t("setup_mode_manual_title")}</div>
          <div class="setup-option-sub">${this.t("setup_mode_manual_sub")}</div>
        </button>
        <button class="setup-option-btn" data-action="setup-start" data-mode="auto">
          <div class="setup-option-title">${this.t("setup_mode_auto_title")}</div>
          <div class="setup-option-sub">${this.t("setup_mode_auto_sub")}</div>
        </button>
        <button class="setup-option-btn" data-action="setup-start" data-mode="restore">
          <div class="setup-option-title">${this.t("setup_mode_restore_title")}</div>
          <div class="setup-option-sub">${this.t("setup_mode_restore_sub")}</div>
        </button>
      </div>
      <div class="setup-export-row">
        <button class="setup-export-link" data-action="setup-export-backup">
          ${this.t("setup_export_backup")}
        </button>
      </div>
    `;
    return this._sectionWrapper("setup", ICONS.refresh, this.t("section_setup"), cardInner);
  }

  _onExportBackup() {
    // Client-side only — this._settings already holds the complete,
    // current options object (it's what drives the whole panel), so
    // there's no need for a new backend/websocket command just to read
    // it back out again. nida_backup_version is a schema tag for
    // restore (task 5) to check compatibility against, independent of
    // nida_panel_version which is just informational.
    const envelope = {
      nida_backup_version: 1,
      nida_panel_version: NIDA_PANEL_VERSION,
      exported_at: new Date().toISOString(),
      settings: this._settings || {},
    };
    const json = JSON.stringify(envelope, null, 2);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const stamp = new Date().toISOString().slice(0, 10);
    const a = document.createElement("a");
    a.href = url;
    a.download = `nida-backup-${stamp}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  _hasExistingSetup() {
    // Proxy for "this isn't a fresh install": a location has already
    // been picked or resolved. Good enough for the overwrite warning —
    // doesn't need to be exhaustive.
    return Boolean(this._settings?.latitude || this._settings?.city);
  }

  _startSetupWizard(mode) {
    this._pendingSetupMode = null;
    if (mode === "restore") {
      // Not a stepped wizard — a single portal dialog. Reset any leftover
      // parsed/errored file from a previous attempt this session.
      this._restoreParsed = null;
      this._restoreErrorCode = null;
      this._restoreFileName = "";
      this._activeOverlay = "setup-restore";
      this._render();
      return;
    }
    // 2.1.0 — _setupWizardActive (not _activeOverlay) is what col-settings
    // checks to decide whether to show the wizard. Steps in the wizard
    // open sub-overlays exactly like the normal accordion does (method
    // picker, speakers picker, notify targets, TTS settings, ...), and
    // those all use _activeOverlay/the portal same as always. Keeping
    // the two separate means opening e.g. the method picker from inside
    // the wizard doesn't kick the user back out to the normal settings
    // view when they close it — closing a sub-overlay only ever resets
    // _activeOverlay, never _setupWizardActive.
    this._setupMode = mode; // "manual" | "auto"
    this._setupStepIndex = 0;
    this._setupWizardActive = true;
    this._activeOverlay = null;
    if (mode === "auto") this._applySetupAutoDefaults();
    this._render();
  }

  _applySetupAutoDefaults() {
    // Applied immediately on entering automatic mode, not asked as
    // questions: location follows the device (Location step only asks
    // to confirm the calculation method), and every prayer starts
    // enabled (Prayers step only asks about the pre-adhan reminder).
    const patch = { location_mode: "device" };
    for (const p of PRAYERS) patch[`enabled_${p}`] = true;
    this._saveSettings(patch);
  }

  _htmlOverlaySetupConfirm() {
    return `
      <div class="overlay">
        <div class="overlay-panel" data-stop>
          <div class="overlay-header">
            <div class="overlay-title">${this.t("setup_confirm_title")}</div>
            <button class="overlay-close" data-action="setup-confirm-cancel"
                    aria-label="${this.t("cancel")}">×</button>
          </div>
          <div class="setup-confirm-body">
            <div class="setup-confirm-text">${this.t("setup_confirm_body")}</div>
            <div class="setup-confirm-actions">
              <button class="test-btn" data-action="setup-confirm-cancel">${this.t("cancel")}</button>
              <button class="welcome-cta" data-action="setup-confirm-proceed">${this.t("continue")}</button>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  // Steps in settings-column order, skipping Setup itself and Ramadan
  // (Ramadan/fasting isn't built out yet — see nida-status). "manual"
  // walks every section; "auto" drops Sounds/Sound Modes/Dua entirely
  // (bundled-default sounds are used as-is) and shows reduced, custom
  // step content for Location and Prayers — see _htmlWizardStepBody.
  _setupWizardSteps() {
    if (this._setupMode === "auto") {
      return ["location", "prayers", "speakers", "notifications", "jumuah"];
    }
    return [
      "location", "prayers", "speakers", "sounds",
      "sound_modes", "dua", "notifications", "jumuah", "islamic_calendar",
    ];
  }

  _setupStepTitleKey(stepId) {
    return {
      location: "section_location",
      prayers: "section_prayers",
      speakers: "section_speakers",
      sounds: "section_sounds",
      sound_modes: "section_sound_modes",
      dua: "section_dua",
      notifications: "section_notifications",
      jumuah: "section_jumuah",
      islamic_calendar: "section_islamic_calendar",
    }[stepId] || "";
  }

  _htmlWizardStepBody(stepId) {
    // Reuses the exact same section renderer (and therefore the exact
    // same data-input/data-action wiring) as the normal accordion for
    // every step that isn't reduced in auto mode — the wizard is a
    // guided view onto the same fields, not a separate implementation.
    // _forceSectionOpen makes _sectionWrapper render it expanded
    // regardless of the real accordion's collapsed state.
    if (this._setupMode === "auto") {
      if (stepId === "location") return this._htmlWizardStepLocationAuto();
      if (stepId === "prayers") return this._htmlWizardStepPrayersAuto();
      if (stepId === "notifications") return this._htmlWizardStepNotificationsAuto();
    }
    const renderers = {
      location: () => this._htmlSectionLocation(),
      prayers: () => this._htmlSectionPrayers(),
      speakers: () => this._htmlSectionSpeakers(),
      sounds: () => this._htmlSectionSounds(),
      sound_modes: () => this._htmlSectionSoundModes(),
      dua: () => this._htmlSectionDua(),
      notifications: () => this._htmlSectionNotifications(),
      jumuah: () => this._htmlSectionJumuah(),
      islamic_calendar: () => this._htmlSectionIslamicCalendar(),
    };
    const renderFn = renderers[stepId];
    if (!renderFn) return "";
    const prev = this._forceSectionOpen;
    this._forceSectionOpen = stepId;
    const html = renderFn();
    this._forceSectionOpen = prev;
    return html;
  }

  // ─── Automatic-mode reduced steps ────────────────────────────────────
  // Fewer questions than manual: location is device-detected (only the
  // calculation method is confirmed), every prayer starts enabled (only
  // the pre-adhan reminder is asked about, with fixed defaults), and
  // notifications collapse the 5 per-prayer critical toggles into one
  // bulk DND-bypass question. Plain .card wrappers, not _sectionWrapper —
  // there's nothing to collapse, the wizard step itself is the header.

  _htmlWizardStepLocationAuto() {
    const methodName = this._methodName(this._methodId());
    return `
      <div class="card">
        <div class="card-note">${this.t("setup_auto_location_note")}</div>
        ${this._htmlResolvedLocation()}
        <div class="select-field" data-action="open-method">
          <span>${this.t("calculation_method")}</span>
          <span class="select-value">${methodName} ${ICONS.chevronRight}</span>
        </div>
      </div>
    `;
  }

  _htmlWizardStepPrayersAuto() {
    const enabled = !!this._settings?.pre_adhan_audio_enabled || !!this._settings?.tts_pre_adhan_enabled;
    const agentsCount = (this._settings?.tts_pre_adhan_services || []).length;
    return `
      <div class="card">
        <div class="card-note">${this.t("setup_auto_prayers_note")}</div>
        <div class="row">
          <div class="row-info">
            <span class="row-label">${this.t("setup_auto_pre_adhan_label")}</span>
            <span class="row-sub">${this.t("setup_auto_pre_adhan_sub")}</span>
          </div>
          <div class="toggle ${enabled ? "on" : ""}" data-action="setup-auto-toggle-pre-adhan">
            <div class="toggle-knob"></div>
          </div>
        </div>
        ${enabled ? `
          <div class="row clickable" data-action="open-tts-settings">
            <div class="row-info">
              <span class="row-label">${this.t("tts_pick_agents")}</span>
              <span class="row-sub">${agentsCount === 0 ? this.t("tts_sub_empty") : `${agentsCount} ${this.t(agentsCount === 1 ? "tts_agent" : "tts_agents")}`}</span>
            </div>
            <div class="chevron-btn">${ICONS.chevronRight}</div>
          </div>
        ` : ""}
      </div>
    `;
  }

  _htmlWizardStepNotificationsAuto() {
    const enabled = !!this._settings?.notify_enabled;
    const targets = this._notifyTargetIds();
    const targetsByFull = new Map(this._notifyServices.map((n) => [n.full, n]));
    const targetNames = targets
      .map((t) => (targetsByFull.get(t) ? targetsByFull.get(t).service : t))
      .filter(Boolean);
    let targetsSummary;
    if (targetNames.length === 0) {
      targetsSummary = this.t("notify_targets_none");
    } else if (targetNames.length <= 2) {
      targetsSummary = targetNames.join(", ");
    } else {
      targetsSummary = `${targetNames.length} ${this.t("speakers_count_suffix")}`;
    }
    const allCritical = PRAYERS.every((p) => this._isNotifyCriticalFor(p));
    return `
      <div class="card">
        <div class="row">
          <div class="row-info">
            <span class="row-label">${this.t("notify_master_label")}</span>
            <span class="row-sub">${this.t("notify_master_sub")}</span>
          </div>
          <div class="toggle ${enabled ? "on" : ""}" data-action="toggle-notify-master">
            <div class="toggle-knob"></div>
          </div>
        </div>
        ${enabled ? `
          <div class="select-field flat" data-action="open-notify-targets">
            <span>${this.t("notify_targets_label")}</span>
            <span class="select-value">${this._escape(targetsSummary)} ${ICONS.chevronRight}</span>
          </div>
          <div class="row">
            <div class="row-info">
              <span class="row-label">${this.t("setup_auto_dnd_label")}</span>
              <span class="row-sub">${this.t("notify_critical_sub")}</span>
            </div>
            <div class="toggle ${allCritical ? "on" : ""}" data-action="setup-auto-toggle-critical">
              <div class="toggle-knob"></div>
            </div>
          </div>
        ` : ""}
      </div>
    `;
  }

  // Portal overlay — simple file picker + preview/error, no reused
  // section components, so the portal's own styling is sufficient (no
  // shadow-DOM-only classes needed here, unlike the manual/auto wizard).

  async _onRestoreFileChange(file) {
    this._restoreErrorCode = null;
    this._restoreParsed = null;
    this._restoreFileName = file ? file.name : "";
    if (!file) {
      this._render();
      return;
    }
    let data;
    try {
      const text = await file.text();
      data = JSON.parse(text);
    } catch (e) {
      this._restoreErrorCode = "json";
      this._render();
      return;
    }
    if (!data || typeof data !== "object" || typeof data.settings !== "object" || data.settings === null) {
      this._restoreErrorCode = "shape";
    } else if (data.nida_backup_version !== 1) {
      // Only schema version 1 exists so far (see _onExportBackup). An
      // unrecognised version — older or newer — isn't safe to apply
      // blindly since we don't know what changed.
      this._restoreErrorCode = "version";
    } else {
      this._restoreParsed = data;
    }
    this._render();
  }

  _formatRestoreDate(iso) {
    try {
      const d = new Date(iso);
      if (Number.isNaN(d.getTime())) return iso;
      return d.toLocaleString();
    } catch (e) {
      return iso;
    }
  }

  _htmlOverlaySetupRestore() {
    const fileName = this._restoreFileName;
    const parsed = this._restoreParsed;
    const errorCode = this._restoreErrorCode;

    let statusHtml = "";
    if (errorCode) {
      statusHtml = `<div class="setup-restore-error">${this.t("setup_restore_error_" + errorCode)}</div>`;
    } else if (parsed) {
      const when = parsed.exported_at ? this._formatRestoreDate(parsed.exported_at) : "";
      const ver = parsed.nida_panel_version || "?";
      statusHtml = `
        <div class="setup-restore-preview">
          <div class="setup-restore-preview-title">${this.t("setup_restore_preview_title")}</div>
          <div class="setup-restore-preview-line">${this._escape(when)}${when ? " · " : ""}Nida ${this._escape(ver)}</div>
        </div>
      `;
    }

    return `
      <div class="overlay">
        <div class="overlay-panel" data-stop>
          <div class="overlay-header">
            <div class="overlay-title">${this.t("setup_mode_restore_title")}</div>
            <button class="overlay-close" data-action="close-overlay"
                    aria-label="${this.t("close")}">×</button>
          </div>
          <div class="setup-confirm-body">
            <div class="setup-confirm-text">${this.t("setup_restore_intro")}</div>
            <label class="setup-restore-file-label">
              <input type="file" accept="application/json,.json" data-input="restore-file">
              <span>${fileName ? this._escape(fileName) : this.t("setup_restore_choose_file")}</span>
            </label>
            ${statusHtml}
            <div class="setup-confirm-actions">
              <button class="test-btn" data-action="close-overlay">${this.t("cancel")}</button>
              <button class="welcome-cta" data-action="setup-restore-apply" ${parsed ? "" : "disabled"}>
                ${this.t("setup_restore_apply")}
              </button>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  _htmlSetupWizardInline() {
    // Renders inline inside col-settings (not the portal) so the reused
    // section markup gets its normal shadow-DOM styling for free — see
    // the 2.1.0 note in _renderPortal for why.
    const steps = this._setupWizardSteps();
    const idx = Math.max(0, Math.min(this._setupStepIndex, steps.length - 1));
    const stepId = steps[idx];
    const isFirst = idx === 0;
    const isLast = idx === steps.length - 1;

    return `
      <div class="setup-wizard-inline">
        <div class="setup-wizard-header">
          <div class="setup-wizard-title">${this.t("setup_wizard_title")} — ${this.t(this._setupStepTitleKey(stepId))}</div>
          <button class="overlay-close" data-action="setup-wizard-exit"
                  aria-label="${this.t("close")}">×</button>
        </div>
        <div class="setup-wizard-progress">
          ${this.t("setup_step_label")} ${idx + 1} / ${steps.length}
        </div>
        ${this._htmlWizardStepBody(stepId)}
        <div class="setup-wizard-nav">
          <button class="test-btn" data-action="setup-wizard-prev" ${isFirst ? "disabled" : ""}>
            ${this.t("setup_wizard_prev")}
          </button>
          <button class="welcome-cta" data-action="${isLast ? "setup-wizard-finish" : "setup-wizard-next"}">
            ${isLast ? this.t("setup_wizard_finish") : this.t("setup_wizard_next")}
          </button>
        </div>
      </div>
    `;
  }

  _jumuahTargetIds() {
    const v = this._settings?.jumuah_targets;
    if (Array.isArray(v)) return v;
    if (typeof v === "string" && v) return [v];
    return [];
  }

  _toggleJumuahTarget(fullServiceName) {
    const current = this._jumuahTargetIds();
    const next = current.includes(fullServiceName)
      ? current.filter((t) => t !== fullServiceName)
      : [...current, fullServiceName];
    this._saveSettings({ jumuah_targets: next });
  }

  _notifyTargetIds() {
    const v = this._settings?.notify_targets;
    if (Array.isArray(v)) return v;
    if (typeof v === "string" && v) return [v];
    return [];
  }

  _isNotifyEnabledFor(prayer) {
    const v = this._settings?.[`notify_enabled_${prayer}`];
    return v === undefined ? true : !!v;
  }

  _isNotifyCriticalFor(prayer) {
    return !!this._settings?.[`notify_critical_enabled_${prayer}`];
  }

  _onToggleNotifyMaster() {
    const next = !this._settings?.notify_enabled;
    this._saveSettings({ notify_enabled: next });
  }

  _onToggleNotifyPrayer(prayer) {
    const next = !this._isNotifyEnabledFor(prayer);
    this._saveSettings({ [`notify_enabled_${prayer}`]: next });
  }

  _onToggleNotifyCriticalPrayer(prayer) {
    const next = !this._isNotifyCriticalFor(prayer);
    this._saveSettings({ [`notify_critical_enabled_${prayer}`]: next });
  }

  _toggleNotifyTarget(fullServiceName) {
    const current = this._notifyTargetIds();
    const isAdding = !current.includes(fullServiceName);
    const next = isAdding
      ? [...current, fullServiceName]
      : current.filter((t) => t !== fullServiceName);
    const patch = { notify_targets: next };
    // 2.0.99 — auto-suggest the TTS/alarm-stream workaround the moment a
    // Samsung target is newly selected, instead of requiring the user to
    // separately discover and enable it (the manual-only flow that made
    // this feature so hard to find/verify in the first place). Only
    // fires on ADD, never on remove, and never overrides a choice the
    // user already made for this target either way. Still just a
    // pre-check — the triangle toggle stays fully overridable.
    if (isAdding) {
      const svc = this._notifyServices.find((n) => n.full === fullServiceName);
      const isSamsung = !!svc?.manufacturer
        && svc.manufacturer.toLowerCase().includes("samsung");
      if (isSamsung && !this._notifyTtsWorkaroundIds().includes(fullServiceName)) {
        patch.notify_tts_workaround_targets = [
          ...this._notifyTtsWorkaroundIds(),
          fullServiceName,
        ];
      }
    }
    this._saveSettings(patch);
  }

  // 2.0.95 — per-target opt-in for the Samsung TTS/alarm-stream
  // workaround (see scheduler.py's _tts_critical_notify_data docstring
  // for why this exists and what it changes: a spoken message instead
  // of a normal notification tone for critical alerts on that target).
  _notifyTtsWorkaroundIds() {
    const v = this._settings?.notify_tts_workaround_targets;
    if (Array.isArray(v)) return v;
    if (typeof v === "string" && v) return [v];
    return [];
  }

  _toggleNotifyTtsWorkaround(fullServiceName) {
    const current = this._notifyTtsWorkaroundIds();
    const next = current.includes(fullServiceName)
      ? current.filter((t) => t !== fullServiceName)
      : [...current, fullServiceName];
    this._saveSettings({ notify_tts_workaround_targets: next });
  }

  _onNotifyTitleBlur(value) {
    if (value === this._settings?.notify_title) return;
    this._saveSettings({ notify_title: value });
  }

  _onNotifyMessageBlur(value) {
    if (value === this._settings?.notify_message) return;
    this._saveSettings({ notify_message: value });
  }

  _jumuahEnabled() {
    const v = this._settings?.jumuah_reminder_enabled;
    return v === undefined ? true : !!v;
  }

  _jumuahMinutes() {
    const raw = this._settings?.jumuah_reminder_minutes;
    const n = parseInt(raw, 10);
    if (Number.isFinite(n) && n >= 30 && n <= 120) return n;
    return 60;
  }

  _onToggleJumuah() {
    const next = !this._jumuahEnabled();
    this._saveSettings({ jumuah_reminder_enabled: next });
  }

  _onJumuahMinutesChange(value) {
    let n = parseInt(value, 10);
    if (!Number.isFinite(n)) return;
    n = Math.max(30, Math.min(120, n));
    this._saveSettings({ jumuah_reminder_minutes: n });
  }

  _onJumuahMessageBlur(value) {
    if (value === this._settings?.jumuah_message) return;
    this._saveSettings({ jumuah_message: value });
  }

  async _onTestNotify(btn) {
    await this._runTest(btn, "nida/test_notify");
  }

  async _onTestNotifyPrayer(btn) {
    const prayer = btn && btn.dataset && btn.dataset.prayer;
    if (!prayer) return;
    await this._runIconTest(btn, "nida/test_notify", { prayer });
  }

  async _runIconTest(btn, wsType, params = {}) {
    // Compact sibling of _runTest for the small square icon-buttons
    // (per-prayer test) where there's no room for text feedback — the
    // icon itself flashes green/red via CSS classes instead.
    if (!btn || !btn.isConnected || btn.classList.contains("test-busy")) return;
    btn.classList.add("test-busy");
    btn.classList.remove("test-success", "test-error");
    try {
      // 2.0.97 — entry_id is required now that ws_test_notify resolves
      // the SAME config entry the panel is editing (websocket.py 2.0.97)
      // instead of blindly grabbing the first Nida entry, which could
      // silently read a different, stale entry's options.
      await this._hass.callWS({ type: wsType, entry_id: this._entryId, ...params });
      btn.classList.add("test-success");
    } catch (e) {
      btn.classList.add("test-error");
      console.warn("Nida: per-prayer test notify failed:", e);
    }
    setTimeout(() => {
      if (!btn.isConnected) return;
      btn.classList.remove("test-busy", "test-success", "test-error");
    }, 2000);
  }

  async _onTestJumuah(btn) {
    await this._runTest(btn, "nida/test_jumuah");
  }

  async _onTestSpeakers(btn) {
    // Legacy single-shot test path — kept around in case any old
    // automation/markup still calls it. The new play/stop path is in
    // _onPlaySpeakerTest below. Forwards to the same service.
    if (!btn || btn.disabled) return;
    const originalLabel = btn.textContent;
    btn.disabled = true;
    btn.textContent = this.t("test_sending");
    btn.classList.remove("test-success", "test-error");
    try {
      await this._hass.callService("nida", "play_test_sound", {});
      btn.textContent = this.t("test_sent");
      btn.classList.add("test-success");
    } catch (e) {
      btn.textContent = this.t("test_failed");
      btn.classList.add("test-error");
    }
    setTimeout(() => {
      if (!btn.isConnected) return;
      btn.disabled = false;
      btn.textContent = originalLabel;
      btn.classList.remove("test-success", "test-error");
    }, 3000);
  }

  async _onPlaySpeakerTest(btn) {
    // Plays the test jingle on the selected speakers via
    // nida.play_test_sound. The button visual flips to "Stop" so the
    // user can interrupt; we also auto-reset after 8s as a safety net
    // for cases where the user walked away and we never got a stop
    // click. 8s is comfortably longer than the typical 1-3s jingle.
    if (!this._selectedSpeakerIds().length) return;
    this._speakerTestPlaying = true;
    this._renderPlayBtnOnly(btn, /*playing=*/true, "stop-speaker-test");
    try {
      await this._hass.callService("nida", "play_test_sound", {});
    } catch (e) {
      console.warn("Nida: play_test_sound failed:", e);
    }
    // Auto-reset timer; cancelled if user explicitly stops first.
    if (this._speakerTestTimer) clearTimeout(this._speakerTestTimer);
    this._speakerTestTimer = setTimeout(() => {
      this._speakerTestPlaying = false;
      this._renderPlayBtnOnly(btn, false, "play-speaker-test");
    }, 8000);
  }

  async _onStopSpeakerTest(btn) {
    if (this._speakerTestTimer) {
      clearTimeout(this._speakerTestTimer);
      this._speakerTestTimer = null;
    }
    this._speakerTestPlaying = false;
    this._renderPlayBtnOnly(btn, false, "play-speaker-test");
    const speakers = this._selectedSpeakerIds();
    if (!speakers.length) return;
    try {
      await this._hass.callService("media_player", "media_stop", {
        entity_id: speakers,
      });
    } catch (e) {
      console.warn("Nida: media_stop failed:", e);
    }
  }

  _renderPlayBtnOnly(btn, playing, action) {
    // Update just this one button's visual + data-action without
    // calling _render() (which would tear down the rest of the
    // sliders mid-interaction).
    if (!btn || !btn.isConnected) return;
    btn.classList.toggle("playing", playing);
    btn.setAttribute("data-action", action);
    btn.innerHTML = playing ? ICONS.stop : ICONS.play;
  }

  async _runTest(btn, wsType) {
    // Inline DOM manipulation for feedback — the panel doesn't re-render
    // during a test, so this is safe. State on the button itself rather
    // than in a global "_testState" so two parallel test buttons don't
    // step on each other.
    if (!btn || btn.disabled) return;
    const originalLabel = btn.textContent;
    btn.disabled = true;
    btn.textContent = this.t("test_sending");
    btn.classList.remove("test-success", "test-error");
    try {
      // 2.0.97 — see _runIconTest's comment: entry_id now required.
      const result = await this._hass.callWS({ type: wsType, entry_id: this._entryId });
      const sent = (result && result.sent) || [];
      const total = (result && result.total) || sent.length;
      btn.textContent = `${this.t("test_sent")} (${sent.length}/${total})`;
      btn.classList.add("test-success");
    } catch (e) {
      const code = e && e.code;
      btn.textContent = code === "no_targets"
        ? this.t("test_no_targets")
        : this.t("test_failed");
      btn.classList.add("test-error");
      console.warn("Nida: test notify failed:", e);
    }
    // Restore the button after 3s. If the panel re-renders during this
    // window the button is replaced anyway, which is also fine.
    setTimeout(() => {
      if (!btn.isConnected) return;
      btn.disabled = false;
      btn.textContent = originalLabel;
      btn.classList.remove("test-success", "test-error");
    }, 3000);
  }

  _htmlSectionNightMode() {
    // DEPRECATED in 2.0.23 — Night mode moved into the Sounds card as
    // a subgroup, which in 2.0.49 became its own section (see
    // _htmlSectionSoundModes). This method is no longer
    // called from _html() but kept around in case external code or a
    // future split-out reference it. Safe to remove later.
    const enabled = this._nightModeEnabled();
    const start = this._nightStart();
    const end = this._nightEnd();
    const factor = this._nightVolumeFactor();
    return `
      <div class="section">
        <div class="section-head">
          <div class="section-icon">${ICONS.clock || ICONS.bell}</div>
          <div class="section-title">${this.t("section_night_mode")}</div>
        </div>
        <div class="card">
          <div class="row">
            <div class="row-info">
              <span class="row-label">${this.t("night_mode_label")}</span>
              <span class="row-sub">${this.t("night_mode_sub")}</span>
            </div>
            <div class="toggle ${enabled ? "on" : ""}" data-action="toggle-night-mode">
              <div class="toggle-knob"></div>
            </div>
          </div>
          ${enabled ? `
            <div class="row">
              <span class="row-label">${this.t("night_start_label")}</span>
              <input type="time" data-input="night-start"
                     value="${this._escape(start)}" class="time-input">
            </div>
            <div class="row">
              <span class="row-label">${this.t("night_end_label")}</span>
              <input type="time" data-input="night-end"
                     value="${this._escape(end)}" class="time-input">
            </div>
            <div class="minutes-row">
              <div class="sound-info">
                <div class="sound-name">${this.t("night_volume_label")}</div>
                <div class="volume-row">
                  <input type="range" min="0" max="100" step="5"
                         value="${factor}"
                         data-input="night-volume-factor"
                         class="volume-slider"
                         aria-label="${this.t("night_volume_label")}">
                  <span class="volume-value" data-night-factor-display>${factor}%</span>
                </div>
              </div>
            </div>
          ` : ""}
        </div>
      </div>
    `;
  }

  _nightModeEnabled() { return !!this._settings?.night_mode_enabled; }
  _nightStart() {
    const v = this._settings?.night_start;
    return /^\d{2}:\d{2}$/.test(v) ? v : "22:00";
  }
  _nightEnd() {
    const v = this._settings?.night_end;
    return /^\d{2}:\d{2}$/.test(v) ? v : "07:00";
  }
  _nightVolumeFactor() {
    const n = parseInt(this._settings?.night_volume_factor, 10);
    if (Number.isFinite(n) && n >= 0 && n <= 100) return n;
    return 50;
  }
  _onToggleNightMode() {
    this._saveSettings({ night_mode_enabled: !this._nightModeEnabled() });
  }
  _onNightStartChange(value) {
    if (!/^\d{2}:\d{2}$/.test(value)) return;
    this._saveSettings({ night_start: value });
  }
  _onNightEndChange(value) {
    if (!/^\d{2}:\d{2}$/.test(value)) return;
    this._saveSettings({ night_end: value });
  }
  _onNightFactorChange(value) {
    let n = parseInt(value, 10);
    if (!Number.isFinite(n)) return;
    n = Math.max(0, Math.min(100, n));
    this._saveSettings({ night_volume_factor: n });
  }

  // ───── Companion cards: order + drag-to-reorder (2.0.27) ────────────────
  // Companion column renders three cards (calendar, now, today) in
  // an order the user can rearrange by dragging. Order is persisted in
  // localStorage as a JSON array under nida_companion_order. We never
  // persist the default order — a missing key means "use defaults",
  // which is the friendliest reset behaviour (clearing localStorage
  // restores the original layout).
  //
  // 2.1.2 — "hijri" (bare date display) and "holiday" (approximate,
  // client-side-only upcoming holiday) are RETIRED, replaced by a single
  // "calendar" card (see _htmlCalendarCard). 2.1.3 — "quote" (rotating
  // Quran verse/hadith card) is RETIRED too, per Johann's request; the
  // backend command (nida/get_quote) and quotes.py are removed alongside
  // it. Both retirements rely on _companionOrder's existing sanitisation
  // (filter to known ids, then append missing defaults) for migration:
  // any stored order still containing an old id drops it (no longer in
  // `known`) and gains "calendar" appended — no explicit migration code
  // needed.
  //
  // HTML5 native drag is used: each card is wrapped in a draggable
  // .card-slot. On dragstart we stash the source id; on dragover we
  // preventDefault to allow the drop (and flag the target visually);
  // on drop we splice the source out and re-insert before the target,
  // then re-render. Touch devices don't fire these events out of the
  // box — that's a known limitation; if needed later we can add
  // pointer-event handlers as a fallback.
  static get COMPANION_CARDS_DEFAULT_ORDER() {
    return ["calendar", "now", "today"];
  }

  _companionOrder() {
    const defaults = NidaPanel.COMPANION_CARDS_DEFAULT_ORDER;
    let stored = null;
    try {
      const raw = localStorage.getItem("nida_companion_order");
      if (raw) stored = JSON.parse(raw);
    } catch (e) {
      stored = null;
    }
    if (!Array.isArray(stored)) return defaults;
    // Defensive: filter to known ids, then append any defaults that
    // got dropped (corruption / new card added in a later version).
    const known = new Set(defaults);
    const sanitised = stored.filter((id) => known.has(id));
    for (const id of defaults) {
      if (!sanitised.includes(id)) sanitised.push(id);
    }
    return sanitised;
  }

  _setCompanionOrder(order) {
    try {
      localStorage.setItem("nida_companion_order", JSON.stringify(order));
    } catch (e) {
      // Private-mode Safari etc — ignore; in-memory order still applies
      // for this session.
    }
  }

  _htmlCompanionCards() {
    const renderers = {
      calendar: () => this._htmlCalendarCard(),
      now: () => this._htmlNowCard(),
      today: () => this._htmlTodayCard(),
    };
    return this._companionOrder()
      .map((id) => `
        <div class="card-slot" draggable="true" data-card-id="${id}">
          <div class="drag-handle" aria-hidden="true">${ICONS.dragHandle || ICONS.chevronRight}</div>
          ${renderers[id]()}
        </div>
      `)
      .join("");
  }

  _attachCompanionDragListeners() {
    const root = this.shadowRoot;
    if (!root) return;
    const slots = root.querySelectorAll(".card-slot");
    slots.forEach((slot) => {
      if (slot._nidaDragWired) return;
      slot._nidaDragWired = true;

      slot.addEventListener("dragstart", (e) => {
        const id = slot.getAttribute("data-card-id");
        if (!id) return;
        this._dragSourceId = id;
        slot.classList.add("dragging");
        // Required for Firefox; dataTransfer must carry something.
        try { e.dataTransfer.setData("text/plain", id); } catch (_) {}
        if (e.dataTransfer) e.dataTransfer.effectAllowed = "move";
      });

      slot.addEventListener("dragend", () => {
        slot.classList.remove("dragging");
        root.querySelectorAll(".card-slot.drop-target")
          .forEach((el) => el.classList.remove("drop-target"));
        this._dragSourceId = null;
      });

      slot.addEventListener("dragover", (e) => {
        if (!this._dragSourceId) return;
        // preventDefault enables drop; without this the drop event
        // never fires.
        e.preventDefault();
        if (e.dataTransfer) e.dataTransfer.dropEffect = "move";
        const targetId = slot.getAttribute("data-card-id");
        if (targetId && targetId !== this._dragSourceId) {
          slot.classList.add("drop-target");
        }
      });

      slot.addEventListener("dragleave", () => {
        slot.classList.remove("drop-target");
      });

      slot.addEventListener("drop", (e) => {
        e.preventDefault();
        const sourceId = this._dragSourceId;
        const targetId = slot.getAttribute("data-card-id");
        if (!sourceId || !targetId || sourceId === targetId) return;
        const order = this._companionOrder();
        const fromIdx = order.indexOf(sourceId);
        const toIdx = order.indexOf(targetId);
        if (fromIdx === -1 || toIdx === -1) return;
        order.splice(fromIdx, 1);
        // Insert at the target's index (the visual rule: dropping ON a
        // card places the source where that card was, pushing it down).
        const insertAt = order.indexOf(targetId);
        const finalIdx = fromIdx < toIdx ? insertAt + 1 : insertAt;
        order.splice(finalIdx, 0, sourceId);
        this._setCompanionOrder(order);
        this._render();
      });
    });
  }

  _htmlNowCard() {
    // 2.0.26 — rebuilt to mirror the nida-card "next-block" pattern:
    // 🕌 gold icon + NEXT PRAYER label + big prayer name on the left,
    // REMAINING label + big HH:MM:SS countdown on the right. Drops the
    // separate "Starts at HH:MM" subtext (the countdown conveys
    // urgency; the start time isn't load-bearing). The current-prayer
    // eyebrow is moved into a tiny sub-line under the icon for users
    // who want the context. 2.0.39: countdown now shows seconds.
    // 2.0.80 — the old guest-mode tile/banner are gone; a small mute
    // button now sits bottom-right of this card and opens the silent-mode
    // popup (duration dropdown + note that prayer notifications still
    // come through). Lit up (active class) while silent mode runs.
    const next = this._nextPrayer();
    const current = this._currentPrayer();
    const cd = this._countdown();
    const nextName = next ? this.t("prayer_" + next) : "—";
    const cdText = (cd.h === "—" || cd.m === "—") ? "—:—:—" : `${cd.h}:${cd.m}:${cd.s}`;
    const currentLine = current
      ? `${this.t("current_prayer")} · ${this.t("prayer_" + current)}`
      : "";
    const silentActive = this._guestModeActive();

    // 2.0.88 — Ramadan-only extras, per the approved dark mockup: an
    // "Until Iftar" line under the countdown (generic "Until <prayer>"
    // for the other four), an Iftar block while Maghrib is next, and a
    // LAST PRAYER mini-block replacing the current-prayer sub-line.
    // Everything below renders exactly as before outside Ramadan.
    const ramadan = this._isRamadanTheme();
    const untilLine = ramadan
      ? `<span class="now-until" data-live="until-label">${this._untilLabelText()}</span>`
      : "";
    const iftarBlock = (ramadan && next === "maghrib")
      ? `
        <div class="now-iftar">
          <div class="now-iftar-ico">${ICONS.iftar}</div>
          <div class="now-iftar-lbl">
            <b>${this.t("iftar_time_label")}</b>
            <span>${this.t("iftar_time_sub")}</span>
          </div>
        </div>`
      : "";
    const last = ramadan ? this._lastPrayerInfo() : null;
    const lastBlock = last
      ? `
        <div class="now-divider"></div>
        <div class="now-last">
          <span class="now-eyebrow">${this.t("last_prayer")}</span>
          <span class="now-last-name">${this.t("prayer_" + last.prayer)}</span>
          <span class="now-last-time">${this._fmtHHMM(last.date)}</span>
        </div>`
      : "";
    const currentSub = ramadan ? "" :
      `<span class="now-current" data-live="current-label">${currentLine}</span>`;

    return `
      <div class="now-card">
        <div class="now-row">
          <div class="now-icon">🕌</div>
          <div class="now-text">
            <span class="now-eyebrow">${this.t("next_prayer")}</span>
            <span class="now-name" data-live="next-name">${nextName}</span>
            ${currentSub}
          </div>
          <div class="now-right">
            <span class="now-eyebrow">${this.t("remaining")}</span>
            <span class="now-countdown-big" data-live="cd-combined">${cdText}</span>
            ${untilLine}
          </div>
        </div>
        ${iftarBlock}
        ${lastBlock}
        <button class="now-mute-btn ${silentActive ? "active" : ""}"
                data-action="open-silent-mode"
                aria-label="${this.t("silent_mode_button_label")}"
                title="${this.t("silent_mode_button_label")}">
          ${ICONS.mute}
        </button>
      </div>
    `;
  }

  _todayRemainingText() {
    // Compact remaining time for the today-card's next-prayer row:
    // hours + minutes only (the now-card already carries the precise
    // per-second countdown). Uses the same _countdown() source.
    const cd = this._countdown();
    if (cd.h === "—" || cd.m === "—") return "";
    return this.t("today_remaining")
      .replace("{h}", String(parseInt(cd.h, 10)))
      .replace("{m}", String(parseInt(cd.m, 10)));
  }

  _todayLastUpdatedText() {
    // Newest last_updated across the five prayer sensors ≈ the moment
    // the coordinator last wrote fresh times. Comes straight from the
    // HA state objects, no backend change needed.
    let newest = null;
    for (const p of PRAYERS) {
      const s = this._hass?.states?.[`sensor.nida_${p}`];
      const lu = s?.last_updated ? new Date(s.last_updated) : null;
      if (lu && !isNaN(lu) && (!newest || lu > newest)) newest = lu;
    }
    if (!newest) return "—";
    return this._fmtHHMM(newest);
  }

  // ───── 2.0.88 — Ramadan helpers ────────────────────────────────────────

  _untilLabelText() {
    // Sub-line under the now-card countdown, Ramadan only. Maghrib is the
    // fast-breaking moment, so it reads "Until Iftar"; every other prayer
    // gets the generic "Until <prayer>".
    const next = this._nextPrayer();
    if (!next) return "";
    if (next === "maghrib") return this.t("until_iftar");
    return this.t("until_prayer").replace("{prayer}", this.t("prayer_" + next));
  }

  _lastPrayerInfo() {
    // Latest prayer of today that has already passed, or null when none
    // has (i.e. before Fajr) — the LAST PRAYER block simply hides then.
    const now = new Date();
    let last = null;
    for (const e of this._prayerSchedule()) {
      if (e.date <= now && (!last || e.date > last.date)) last = e;
    }
    return last;
  }

  _imsakOffset() {
    // Minutes to show Imsak EARLIER than the API value (0-60, default 0).
    // People who need preparation time before suhoor set this up; the
    // shift is display-side only for now (the backend keeps the raw API
    // Imsak on the sensor).
    const n = parseInt(this._settings?.imsak_offset_min, 10);
    if (!Number.isFinite(n)) return 0;
    return Math.max(0, Math.min(60, n));
  }

  _imsakDate() {
    // Imsak from sensor.nida_imsak (Aladhan "Imsak" field; the sensor is
    // a separate backend change) minus the user offset. Returns null when
    // the sensor is missing/unparseable so the row hides gracefully on
    // installs that haven't picked up the backend yet.
    const ts = this._hass?.states?.["sensor.nida_imsak"]?.state;
    if (!ts) return null;
    const d = new Date(ts);
    if (isNaN(d.getTime())) return null;
    return new Date(d.getTime() - this._imsakOffset() * 60 * 1000);
  }

  _iftarTagText() {
    // "Iftar in 45 m" tag on the today-card Maghrib row while Maghrib is
    // next, Ramadan only. Ticks per minute via the live-node pass.
    if (!this._isRamadanTheme() || this._nextPrayer() !== "maghrib") return "";
    const cd = this._countdown();
    if (cd.h === "—" || cd.m === "—") return "";
    const h = parseInt(cd.h, 10);
    const m = parseInt(cd.m, 10);
    if (h > 0) {
      return this.t("iftar_in_tag_hm")
        .replace("{h}", String(h)).replace("{m}", String(m));
    }
    return this.t("iftar_in_tag").replace("{m}", String(m));
  }

  _htmlTodayCard() {
    // 2.0.62 — companion card: all five prayers of today at a glance.
    // Past prayers dimmed with a gold check, the next prayer gets a
    // gold left bar + tint + compact remaining time (per-minute, via
    // the live-node tick), upcoming prayers in normal ink. Footer shows
    // when the prayer sensors last received fresh times; the right
    // corner is deliberately empty (user choice over showing the
    // calculation method there).
    const schedule = this._prayerSchedule();
    const next = this._nextPrayer();
    const now = new Date();
    // 2.0.88 — Ramadan only: the "Iftar in X m" tag replaces the generic
    // remaining text on the highlighted Maghrib row.
    const ramadan = this._isRamadanTheme();
    const rows = schedule.map(({ prayer, date }) => {
      const isNext = prayer === next;
      const isPast = !isNext && date < now;
      const name = this.t("prayer_" + prayer);
      const time = this._fmtHHMM(date);
      // 2.0.73 — leading glyph: a check-in-ring for completed prayers,
      // otherwise the prayer's sun/moon weather glyph. Decorative
      // (aria-hidden); state is also carried by the ring-vs-weather shape,
      // the next-row highlight and the dimming, never colour alone.
      const glyph = ICONS[PRAYER_ICON[prayer]] || "";
      const leadIcon = isPast ? ICONS.checkCircle : glyph;
      if (isNext) {
        const remaining = (ramadan && prayer === "maghrib")
          ? `<span class="today-iftar-tag" data-live="iftar-tag">${this._iftarTagText()}</span>`
          : `<span class="today-remaining" data-live="today-remaining">${this._todayRemainingText()}</span>`;
        return `
          <div class="today-row next">
            <span class="today-name">
              <span class="today-icon" aria-hidden="true">${leadIcon}</span>${name}
            </span>
            ${remaining}
            <span class="today-time">${time}</span>
          </div>`;
      }
      return `
        <div class="today-row ${isPast ? "past" : ""}">
          <span class="today-name">
            <span class="today-icon" aria-hidden="true">${leadIcon}</span>${name}
          </span>
          <span class="today-time">${time}</span>
        </div>`;
    }).join("");

    // 2.0.88 — Ramadan only: Imsak on top of the list (from
    // sensor.nida_imsak minus the user offset; hidden while the sensor
    // doesn't exist). Styled like a prayer row: dimmed + check once
    // passed, crescent glyph while upcoming.
    let imsakRow = "";
    if (ramadan) {
      const imsak = this._imsakDate();
      if (imsak) {
        const imsakPast = imsak < now;
        const lead = imsakPast ? ICONS.checkCircle : ICONS.moon;
        imsakRow = `
          <div class="today-row imsak ${imsakPast ? "past" : ""}">
            <span class="today-name">
              <span class="today-icon" aria-hidden="true">${lead}</span>${this.t("prayer_imsak")}
            </span>
            <span class="today-time">${this._fmtHHMM(imsak)}</span>
          </div>`;
      }
    }

    return `
      <div class="today-card">
        <div class="today-head">
          <span class="today-title">${this.t("today_card_title")}</span>
          <span class="today-hijri" data-live="hijri-date">${this._hijriDateText()}</span>
        </div>
        <div class="today-list">${imsakRow}${rows || "—"}</div>
        <div class="today-foot">
          <span>${ICONS.refresh || ""}${this.t("today_last_updated")} ${this._todayLastUpdatedText()}</span>
        </div>
      </div>
    `;
  }

  // ───── Calendar card (2.1.2) ────────────────────────────────────────────
  // Replaces the old bare-date "hijri" card and the approximate,
  // client-side-only "holiday" card with a single Hijri month-grid view,
  // modelled on the Nida Android app's Calendar tab. Backed by the real
  // nida/get_calendar_month websocket command (islamic_calendar.py's
  // async_get_hijri_month_calendar) for the grid itself; the "Upcoming
  // events" list below stays a lightweight client-side approximation
  // (same 30-day-per-month tabular distance the old _findNextHoliday
  // used) so opening the card never needs more than one network call.

  _fmtIsoDate(d) {
    const p = (n) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
  }

  _fmtCalendarGregorianDate(iso) {
    if (!iso) return "";
    const d = new Date(`${iso}T00:00:00`);
    if (isNaN(d.getTime())) return iso;
    return d.toLocaleDateString(undefined, { day: "numeric", month: "long", year: "numeric" });
  }

  _ensureCalendarMonthReady() {
    // Seeds the viewed Hijri month/year from today's real Hijri date (via
    // the same sensor-backed _currentHijri() the rest of the panel uses)
    // and kicks off the first fetch. No-ops once seeded — month
    // navigation (_onCalendarPrevMonth/NextMonth) moves _calendarHijri*
    // directly and calls _loadCalendarMonth itself. If sensors aren't
    // ready yet (HA still loading), this is retried on the next live-tick
    // pass (see the check in _updateLiveNodes) and on every
    // _htmlCalendarCard() render — cheap once _calendarHijriMonth is set.
    if (this._calendarHijriMonth !== undefined) return;
    const anchor = this._currentHijri();
    if (!anchor) return;
    this._calendarHijriMonth = anchor.monthNum;
    this._calendarHijriYear = parseInt(anchor.year, 10);
    // Deferred to a microtask: _htmlCalendarCard() (the main caller of
    // this method) runs inside _html() inside _render() — calling
    // _loadCalendarMonth synchronously here would re-enter _render() (it
    // sets a loading flag and re-renders before its first await) while
    // the outer render is still building its HTML string. Queueing avoids
    // that re-entrancy; the fetch still starts on the very next tick.
    const month = this._calendarHijriMonth;
    const year = this._calendarHijriYear;
    queueMicrotask(() => this._loadCalendarMonth(month, year));
  }

  async _loadCalendarMonth(hijriMonth, hijriYear) {
    if (!this._calendarCache) this._calendarCache = {};
    const cacheKey = `${hijriMonth}-${hijriYear}`;
    if (this._calendarCache[cacheKey] !== undefined) return; // already cached (incl. a null error marker)
    this._calendarLoading = true;
    this._render();
    try {
      const res = await this._hass.callWS({
        type: "nida/get_calendar_month",
        hijri_month: hijriMonth,
        hijri_year: hijriYear,
      });
      this._calendarCache[cacheKey] = (res && res.days) || [];
    } catch (e) {
      console.warn("Nida: get_calendar_month failed:", e);
      this._calendarCache[cacheKey] = null; // null = error, distinct from [] = empty-but-ok
    }
    this._calendarLoading = false;
    this._render();
  }

  _onCalendarPrevMonth() {
    if (this._calendarHijriMonth === undefined) return;
    let m = this._calendarHijriMonth - 1;
    let y = this._calendarHijriYear;
    if (m < 1) { m = 12; y -= 1; }
    this._calendarHijriMonth = m;
    this._calendarHijriYear = y;
    this._loadCalendarMonth(m, y);
    this._render();
  }

  _onCalendarNextMonth() {
    if (this._calendarHijriMonth === undefined) return;
    let m = this._calendarHijriMonth + 1;
    let y = this._calendarHijriYear;
    if (m > 12) { m = 1; y += 1; }
    this._calendarHijriMonth = m;
    this._calendarHijriYear = y;
    this._loadCalendarMonth(m, y);
    this._render();
  }

  _calendarUpcomingEvents() {
    const anchor = this._currentHijri();
    if (!anchor) return [];
    const todayDoy = (anchor.monthNum - 1) * 30 + anchor.day;
    return CALENDAR_SPECIAL_EVENTS.map((ev) => {
      const doy = (ev.month - 1) * 30 + ev.day;
      let dist = doy - todayDoy;
      if (dist < 0) dist += 354; // wraps into next Hijri year
      return { ...ev, daysOff: dist };
    }).sort((a, b) => a.daysOff - b.daysOff);
  }

  _calendarCountdownText(daysOff) {
    if (daysOff === 0) return this.t("calendar_today_label");
    if (daysOff === 1) return this.t("calendar_tomorrow_label");
    return this.t("calendar_days_countdown").replace("{n}", String(daysOff));
  }

  _calendarUpcomingHtml() {
    const events = this._calendarUpcomingEvents();
    if (!events.length) {
      return `<div class="calendar-upcoming-empty">${this.t("calendar_no_events")}</div>`;
    }
    return events.slice(0, 4).map((ev) => {
      const meta = CALENDAR_EVENT_META[ev.key];
      const name = meta ? this.t(meta.nameKey) : ev.key;
      const emoji = meta ? meta.emoji : "🕌";
      return `
        <button class="calendar-upcoming-item" data-action="open-calendar-upcoming"
                data-key="${ev.key}" data-days-off="${ev.daysOff}">
          <span class="calendar-upcoming-emoji" aria-hidden="true">${emoji}</span>
          <span class="calendar-upcoming-name">${this._escape(name)}</span>
          <span class="calendar-upcoming-pill">${this._calendarCountdownText(ev.daysOff)}</span>
        </button>`;
    }).join("");
  }

  _calendarGridHtml(days) {
    const todayIso = this._fmtIsoDate(new Date());
    const firstWeekday = days.length ? (days[0].weekday ?? 0) : 0; // Monday=0..Sunday=6
    const blanks = Array.from({ length: firstWeekday })
      .map(() => `<span class="calendar-day blank"></span>`)
      .join("");
    const cells = days.map((d) => {
      const isToday = d.gregorian === todayIso;
      const events = d.events || [];
      const dots = events.slice(0, 3).map((key) => {
        const meta = CALENDAR_EVENT_META[key];
        const cat = meta ? meta.category : "fasting";
        return `<span class="calendar-dot cat-${cat}"></span>`;
      }).join("");
      const cls = ["calendar-day"];
      if (isToday) cls.push("today");
      if (events.length) cls.push("has-event");
      return `
        <button class="${cls.join(" ")}"
                ${events.length ? `data-action="open-calendar-day" data-hijri-day="${d.hijri_day}"` : "disabled"}>
          <span class="calendar-day-num">${d.hijri_day}</span>
          <span class="calendar-day-dots">${dots}</span>
        </button>`;
    }).join("");
    return `<div class="calendar-grid">${blanks}${cells}</div>`;
  }

  _htmlCalendarCard() {
    this._ensureCalendarMonthReady();
    const month = this._calendarHijriMonth;
    const year = this._calendarHijriYear;
    if (month === undefined) {
      // Sensors not ready yet (HA still loading / coordinator hasn't run
      // its first refresh) — same soft placeholder the old holiday card
      // used, so the layout doesn't shift once real data arrives.
      return `
        <div class="calendar-card todo">
          <div class="holiday-eyebrow">
            ${ICONS.calendar}
            <span>${this.t("section_islamic_calendar")}</span>
          </div>
          <div class="holiday-explainer">${this.t("calendar_loading")}</div>
        </div>
      `;
    }

    const cacheKey = `${month}-${year}`;
    const days = this._calendarCache ? this._calendarCache[cacheKey] : undefined;
    const monthName = this._hijriMonthName(month);

    let gridHtml;
    if (days === undefined) {
      gridHtml = `<div class="calendar-loading">${this.t("calendar_loading")}</div>`;
    } else if (days === null || !days.length) {
      gridHtml = `<div class="calendar-loading">${this.t("calendar_error")}</div>`;
    } else {
      gridHtml = this._calendarGridHtml(days);
    }

    return `
      <div class="calendar-card">
        <div class="calendar-head">
          <button class="calendar-nav-btn" data-action="calendar-prev-month"
                  aria-label="${this.t("calendar_prev_month")}">${ICONS.chevronLeft}</button>
          <div class="calendar-month-title">${this._escape(monthName)} ${year}</div>
          <button class="calendar-nav-btn" data-action="calendar-next-month"
                  aria-label="${this.t("calendar_next_month")}">${ICONS.chevronRight}</button>
        </div>
        <div class="calendar-weekdays">
          ${this.t("calendar_weekdays_short").split(",").map((w) => `<span>${this._escape(w)}</span>`).join("")}
        </div>
        ${gridHtml}
        <div class="calendar-upcoming">
          <div class="calendar-upcoming-title">${this.t("calendar_upcoming_title")}</div>
          ${this._calendarUpcomingHtml()}
        </div>
      </div>
    `;
  }

  _openCalendarDayDetail(hijriDay) {
    const cacheKey = `${this._calendarHijriMonth}-${this._calendarHijriYear}`;
    const days = this._calendarCache ? this._calendarCache[cacheKey] : null;
    const day = (days || []).find((d) => d.hijri_day === hijriDay);
    if (!day || !day.events || !day.events.length) return;
    this._calendarDetail = {
      events: day.events,
      hijriDay: day.hijri_day,
      hijriMonth: this._calendarHijriMonth,
      hijriYear: this._calendarHijriYear,
      gregorian: day.gregorian,
    };
    this._openOverlay("calendar-detail");
  }

  _openCalendarUpcomingDetail(key, daysOff) {
    const anchor = this._currentHijri();
    const ev = CALENDAR_SPECIAL_EVENTS.find((e) => e.key === key);
    if (!ev) return;
    // Approximate Gregorian date, consistent with the same day-count
    // approximation used to rank/display the countdown itself.
    const gregorianApprox = new Date(Date.now() + daysOff * 86400000);
    const yearForDisplay = anchor
      ? (daysOff === 0 || ev.month >= anchor.monthNum ? anchor.year : String(parseInt(anchor.year, 10) + 1))
      : "";
    this._calendarDetail = {
      events: [key],
      hijriDay: ev.day,
      hijriMonth: ev.month,
      hijriYear: yearForDisplay,
      gregorian: this._fmtIsoDate(gregorianApprox),
    };
    this._openOverlay("calendar-detail");
  }

  _htmlOverlayCalendarDetail() {
    const d = this._calendarDetail;
    if (!d) return "";
    const monthName = this._hijriMonthName(d.hijriMonth);
    const hijriDateText = `${d.hijriDay} ${monthName} ${d.hijriYear}`;
    const gregDateText = this._fmtCalendarGregorianDate(d.gregorian);
    const blocks = d.events.map((key) => {
      const meta = CALENDAR_EVENT_META[key];
      if (!meta) return "";
      const name = this.t(meta.nameKey);
      const nameAr = meta.arKey ? this.t(meta.arKey) : "";
      const desc = this.t(meta.descKey);
      const catKey = meta.category === "holiday" ? "cal_category_holiday" : "cal_category_fasting";
      return `
        <div class="calendar-detail-block">
          <div class="calendar-detail-emoji" aria-hidden="true">${meta.emoji}</div>
          <div class="calendar-detail-name">${this._escape(name)}</div>
          ${nameAr ? `<div class="calendar-detail-ar" dir="rtl">${this._escape(nameAr)}</div>` : ""}
          <div class="calendar-detail-dates">${this._escape(hijriDateText)} · ${this._escape(gregDateText)}</div>
          <span class="calendar-detail-category">${this._escape(this.t(catKey))}</span>
          <div class="calendar-detail-desc">${this._escape(desc)}</div>
        </div>`;
    }).join(`<div class="calendar-detail-divider"></div>`);

    return `
      <div class="overlay" data-action="close-overlay">
        <div class="overlay-panel calendar-detail-panel" data-stop>
          <div class="overlay-header">
            <div class="overlay-title">${this.t("calendar_detail_title")}</div>
            <button class="overlay-close" data-action="close-overlay"
                    aria-label="${this.t("close")}">×</button>
          </div>
          <div class="calendar-detail-body">${blocks}</div>
        </div>
      </div>
    `;
  }

  _currentHijri() {
    // Returns {monthNum, day, year} or null if any piece is missing/
    // unparseable. monthNum lookup is tolerant — sensor may emit
    // diacritics or alternative transliterations across Aladhan
    // versions; _hijriMonthNumber normalises before comparing.
    const monthName = this._sensorState("hijri_month");
    const dayRaw = this._sensorState("hijri_day");
    const yearRaw = this._sensorState("hijri_year");
    if (!monthName || !dayRaw || !yearRaw) return null;
    const monthNum = this._hijriMonthNumber(monthName);
    const day = parseInt(dayRaw, 10);
    if (!monthNum || !Number.isFinite(day)) return null;
    return { monthNum, day, year: yearRaw };
  }

  _normaliseHijri(s) {
    // Lowercase + strip combining marks. NFD splits "ā" into "a" + ◌̄,
    // then the regex removes anything in the combining-marks block. Also
    // strips ʾ/ʿ/' so "Sha'ban" matches "Shaʿbān". Hyphens kept (they
    // structure the names like "al-thānī").
    return (s || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[ʾʿ'ʼʻ`]/g, "")
      .toLowerCase()
      .trim();
  }

  _hijriMonthNumber(name) {
    const target = this._normaliseHijri(name);
    if (!target) return null;
    for (const m of HIJRI_MONTHS) {
      if (this._normaliseHijri(m.primary) === target) return m.number;
      for (const alt of m.alts) {
        if (this._normaliseHijri(alt) === target) return m.number;
      }
    }
    return null;
  }

  _hijriMonthName(number) {
    const entry = HIJRI_MONTHS.find((m) => m.number === number);
    return entry ? entry.primary : `M${number}`;
  }

  _htmlOverlay() {
    if (this._activeOverlay === "method") {
      return this._htmlOverlayList(
        this.t("method_pick_title"),
        CALCULATION_METHODS.map((m) => ({
          key: m.id,
          label: m.name,
          active: m.id === this._methodId(),
        })),
        "pick-method"
      );
    }
    if (this._activeOverlay === "language") {
      return this._htmlOverlayList(
        this.t("language_pick_title"),
        LANGUAGES.map((l) => ({
          key: l.code,
          label: l.label,
          active: l.code === (this._settings?.language || "auto"),
        })),
        "pick-language"
      );
    }
    if (this._activeOverlay === "country") {
      const lang = this._effectiveLanguage();
      const current = this._settings?.country || "";
      const query = this._overlaySearchQuery.toLowerCase().trim();
      let countries = listCountries(lang);
      if (query) {
        countries = countries.filter(
          (c) =>
            c.name.toLowerCase().includes(query) ||
            c.code.toLowerCase().includes(query)
        );
      }
      const items = countries.map((c) => ({
        key: c.code,
        label: c.name,
        active: c.code === current,
      }));
      if (current) {
        items.unshift({ key: "", label: this.t("country_clear"), active: false });
      }
      return this._htmlOverlayList(
        this.t("country_pick_title"),
        items,
        "pick-country",
        { searchable: true }
      );
    }
    if (this._activeOverlay === "speakers") {
      const selected = new Set(this._selectedSpeakerIds());
      return this._htmlOverlayList(
        this.t("speakers_pick_title"),
        this._mediaPlayers.map((m) => ({
          key: m.entity_id,
          label: m.name,
          active: selected.has(m.entity_id),
        })),
        "toggle-speaker"
      );
    }
    if (this._activeOverlay === "notify-targets") {
      const selected = new Set(this._notifyTargetIds());
      const ttsWorkaround = new Set(this._notifyTtsWorkaroundIds());
      return this._htmlOverlayList(
        this.t("targets_pick_title"),
        // 2.0.99 — manufacturer (from ws_list_notify_services, sourced
        // from the mobile_app registration data) appended to the label
        // when known, so a Samsung target is identifiable at a glance
        // instead of users having to independently discover they need
        // the workaround below.
        this._notifyServices.map((n) => ({
          key: n.full,
          label: n.manufacturer ? `${n.service} · ${n.manufacturer}` : n.service,
          active: selected.has(n.full),
        })),
        "toggle-notify-target",
        {
          // 2.0.95 — only shown for targets already selected as a
          // notify target (no point flagging the workaround on a
          // device that isn't even a notification destination).
          secondary: {
            action: "toggle-notify-tts-workaround",
            showFor: (it) => selected.has(it.key),
            isOn: (it) => ttsWorkaround.has(it.key),
            icon: ICONS.alertTriangle,
            title: this.t("notify_tts_workaround_label"),
          },
        }
      );
    }
    if (this._activeOverlay === "jumuah-targets") {
      const selected = new Set(this._jumuahTargetIds());
      return this._htmlOverlayList(
        this.t("jumuah_targets_pick_title"),
        this._notifyServices.map((n) => ({
          key: n.full,
          label: n.service,
          active: selected.has(n.full),
        })),
        "toggle-jumuah-target"
      );
    }
    if (this._activeOverlay === "calendar-targets") {
      const selected = new Set(this._calendarTargetIds());
      return this._htmlOverlayList(
        this.t("calendar_targets_pick_title"),
        this._notifyServices.map((n) => ({
          key: n.full,
          label: n.service,
          active: selected.has(n.full),
        })),
        "toggle-calendar-target"
      );
    }
    if (this._activeOverlay === "open-contact-sensors") {
      const selected = new Set(this._openContactSensors());
      const sensors = this._listContactSensors();
      if (sensors.length === 0) {
        return this._htmlOverlayList(
          this.t("open_contact_pick_title"),
          [],
          "toggle-open-contact-sensor"
        );
      }
      return this._htmlOverlayList(
        this.t("open_contact_pick_title"),
        sensors.map((s) => ({
          key: s.entity_id,
          label: s.name,
          active: selected.has(s.entity_id),
        })),
        "toggle-open-contact-sensor"
      );
    }
    if (this._activeOverlay === "welcome") {
      return this._htmlOverlayWelcome();
    }
    if (this._activeOverlay === "setup-confirm") {
      return this._htmlOverlaySetupConfirm();
    }
    if (this._activeOverlay === "setup-restore") {
      return this._htmlOverlaySetupRestore();
    }
    if (this._activeOverlay === "sound-library") {
      return this._htmlOverlaySoundLibrary();
    }
    if (this._activeOverlay === "tts-settings") {
      return this._htmlOverlayTtsSettings();
    }
    if (this._activeOverlay === "pre-adhan-prayers") {
      return this._htmlOverlayPreAdhanPrayers();
    }
    if (this._activeOverlay === "silent-mode") {
      return this._htmlOverlaySilentMode();
    }
    if (this._activeOverlay === "calendar-detail") {
      return this._htmlOverlayCalendarDetail();
    }
    return "";
  }

  // ───── Sound Library (2.0.28) ─────────────────────────────────────────
  // Catalog-driven sound picker, modelled after the Nida Android app:
  // one overlay with categorised sections, each item has play/download
  // (or delete) buttons and the row itself selects-as-active for that
  // category. Catalog comes from a user-hosted JSON at options.catalog_url.

  _ensureSoundLibraryState() {
    if (this._catalog === undefined) this._catalog = null;
    if (!this._catalogPending) this._catalogPending = new Set();
  }

  async _openSoundLibrary(category) {
    this._ensureSoundLibraryState();
    // When opened from a sound-row's chevron, scope the library to
    // that one category. Tapping items there only writes to that
    // category's setting (no accidental cross-category leakage). null
    // = unscoped (every category visible).
    this._libraryCategory = category || null;
    this._openOverlay("sound-library");
    if (!this._catalog && !this._catalogLoading) {
      await this._loadCatalog(false);
    }
  }

  async _loadCatalog(forceRefresh) {
    this._catalogLoading = true;
    this._renderPortal();
    try {
      const res = await this._hass.callWS({
        type: "nida/get_catalog",
        force_refresh: !!forceRefresh,
      });
      this._catalog = res || { sounds: [], error: "network_error" };
    } catch (e) {
      this._catalog = { sounds: [], error: "ws_failed" };
    }
    this._catalogLoading = false;
    this._renderPortal();
  }

  _htmlOverlaySoundLibrary() {
    const cat = this._catalog;
    const loading = !!this._catalogLoading;
    let body;
    if (loading && !cat) {
      body = `<div class="sl-empty">${this.t("loading")}</div>`;
    } else if (!cat) {
      body = `<div class="sl-empty">${this.t("loading")}</div>`;
    } else if (cat.error === "catalog_url_not_configured") {
      body = this._htmlSoundLibraryUrlPrompt();
    } else if (cat.error) {
      body = `
        <div class="sl-empty sl-error">
          <div class="sl-error-icon">⚠</div>
          <div class="sl-error-title">${this.t("sl_error_conn_title")}</div>
          <div class="sl-error-body">${this.t("sl_error_conn_body")}</div>
          <div class="sl-error-actions">
            <button class="test-btn" data-action="sl-retry">${this.t("sl_retry")}</button>
            <a class="sl-report-link" href="${NIDA_ISSUES_URL}"
               target="_blank" rel="noopener noreferrer">${this.t("sl_report_link")}</a>
          </div>
          <div class="sl-error-detail">${this.t("sl_error_detail_label")}: ${this._escape(String(cat.error))}</div>
        </div>
      `;
    } else if (!cat.sounds || cat.sounds.length === 0) {
      body = `<div class="sl-empty">${this.t("sl_empty")}</div>`;
    } else {
      body = this._htmlSoundLibraryList(cat.sounds);
    }
    const scopedCat = this._libraryCategory
      ? SOUND_CATEGORIES.find((c) => c.key === this._libraryCategory)
      : null;
    const title = scopedCat ? this.t(scopedCat.label_key) : this.t("sl_title");
    return `
      <div class="overlay">
        <div class="overlay-panel sound-library-panel" data-stop>
          <div class="overlay-header">
            <div class="overlay-title">
              <span style="font-size:18px">🎵</span>
              ${title}
            </div>
            <div class="overlay-header-actions">
              <button class="sl-refresh-btn" data-action="sl-refresh"
                      title="${this.t("sl_refresh")}"
                      ${loading ? "disabled" : ""}>
                ${ICONS.refresh || "↻"}
              </button>
              <button class="overlay-close" data-action="close-overlay"
                      aria-label="${this.t("close")}">×</button>
            </div>
          </div>
          <div class="sound-library-body">
            ${body}
          </div>
        </div>
      </div>
    `;
  }

  _htmlSoundLibraryUrlPrompt() {
    const current = this._settings?.catalog_url || "";
    return `
      <div class="sl-url-prompt">
        <div class="sl-url-explain">${this.t("sl_url_prompt")}</div>
        <input type="text" class="sl-url-input" data-input="sl-catalog-url"
               value="${this._escape(current)}"
               placeholder="https://example.com/catalog.json"
               autocomplete="off">
        <button class="test-btn" data-action="sl-save-url">${this.t("sl_save_url")}</button>
      </div>
    `;
  }

  _htmlSoundLibraryList(sounds) {
    // Group by category, render in the canonical SOUND_CATEGORIES order
    // so Fajr-adhan is always at top regardless of catalog ordering.
    // When opened scoped to one category, only that group is shown
    // and we skip the category header (it'd be redundant with the
    // overlay title).
    const scoped = this._libraryCategory;
    const byCat = {};
    for (const s of sounds) {
      (byCat[s.category] = byCat[s.category] || []).push(s);
    }
    const cats = scoped
      ? LIBRARY_CATEGORIES.filter((c) => c.key === scoped)
      : LIBRARY_CATEGORIES;
    const blocks = cats.map((cat) => {
      const items = byCat[cat.key] || [];
      if (!items.length) return "";
      // For the dua category the "active" marker means: the sound of
      // the dua currently being edited (no sound_dua option exists).
      const activeRel = cat.key === "dua"
        ? this._duaPickActiveRel()
        : this._settings?.[`sound_${cat.key}`];
      // 2.0.69 — "Random" pseudo-entry at the top of fajr_adhan and
      // adhan lists. Selecting it sets random_adhan_enabled; selecting
      // any real adhan clears it. The row looks like a normal library
      // item but has a special data-action so sl-select doesn't try to
      // download a non-existent sound.
      const isAdhanCat = cat.key === "fajr_adhan" || cat.key === "adhan";
      const randomActive = isAdhanCat && !!this._settings?.random_adhan_enabled;
      const randomRow = isAdhanCat ? `
        <div class="sl-row ${randomActive ? "active" : ""}"
             data-action="sl-select-random">
          <div class="sl-name">
            ${randomActive ? `<span class="sl-active-dot">${ICONS.check}</span>` : ""}
            🎲 ${this.t("random_adhan_label")}
          </div>
        </div>
      ` : "";
      const rows = items.map((s) => {
        const isActive = activeRel === s.rel_path;
        const isPending = this._catalogPending.has(s.id);
        const isPreviewing = this._previewingId === s.id;
        // 2.0.40 — bundled defaults are protected: shipped with the
        // integration, always present, cannot be deleted. Flag comes from
        // the catalog (s.default / s.bundled). Absent flag = normal row.
        const isDefault = !!(s.default || s.bundled);
        return `
          <div class="sl-row ${isActive ? "active" : ""}${isDefault ? " is-default" : ""}"
               data-action="sl-select" data-sound-id="${this._escape(s.id)}">
            <div class="sl-name">
              ${isActive ? `<span class="sl-active-dot">${ICONS.check}</span>` : ""}
              ${this._escape(s.name)}
              ${isDefault ? `<span class="sl-default-chip">${this.t("sound_default")}</span>` : ""}
            </div>
            ${s.category === "dua" && s.downloaded && !isActive ? `
              <button class="sl-btn sl-use"
                      data-action="sl-select"
                      data-sound-id="${this._escape(s.id)}">
                ${this.t("dua_use")}
              </button>
            ` : ""}
            <button class="sl-btn play"
                    data-action="${isPreviewing ? "sl-stop-preview" : "sl-preview"}"
                    data-sound-id="${this._escape(s.id)}"
                    aria-label="${this.t("sl_preview")}">
              ${isPreviewing ? ICONS.stop : ICONS.play}
            </button>
            ${isDefault ? `
              <span class="sl-btn locked" aria-hidden="true"
                    title="${this.t("sound_default")}">🔒</span>
            ` : s.downloaded ? `
              <button class="sl-btn delete"
                      data-action="sl-delete"
                      data-sound-id="${this._escape(s.id)}"
                      ${isPending ? "disabled" : ""}
                      aria-label="${this.t("sl_delete")}">×</button>
            ` : `
              <button class="sl-btn download"
                      data-action="sl-download"
                      data-sound-id="${this._escape(s.id)}"
                      ${isPending ? "disabled" : ""}
                      aria-label="${this.t("sl_download")}">↓</button>
            `}
          </div>
        `;
      }).join("");
      return `
        ${scoped ? "" : `<div class="sl-cat-head">${this.t(cat.label_key)}</div>`}
        <div class="sl-list">${randomRow}${rows}</div>
      `;
    }).join("");
    return blocks || `<div class="sl-empty">${this.t("sl_empty")}</div>`;
  }

  _findSoundById(id) {
    if (!this._catalog?.sounds) return null;
    return this._catalog.sounds.find((s) => s.id === id) || null;
  }

  _onSoundLibraryAction(action, target) {
    const id = target?.dataset?.soundId;
    const sound = id ? this._findSoundById(id) : null;
    if (action === "sl-refresh") {
      this._loadCatalog(true);
    } else if (action === "sl-retry") {
      this._loadCatalog(false);
    } else if (action === "sl-save-url") {
      const root = this._overlayPortal || this.shadowRoot;
      const input = root?.querySelector('[data-input="sl-catalog-url"]');
      const url = (input?.value || "").trim();
      this._saveSettings({ catalog_url: url });
      // Drop the cached "not configured" state and re-fetch.
      this._catalog = null;
      this._loadCatalog(false);
    } else if (action === "sl-preview") {
      if (sound) this._previewSound(sound);
    } else if (action === "sl-stop-preview") {
      this._stopPreview();
    } else if (action === "sl-download") {
      if (sound) this._downloadSound(sound);
    } else if (action === "sl-delete") {
      if (sound) this._deleteSound(sound);
    } else if (action === "sl-select-random") {
      // 2.0.69 — pick the random pseudo-entry: enable random mode,
      // close the library, re-render the sound rows.
      this._saveSettings({ random_adhan_enabled: true });
      this._closeOverlay();
    } else if (action === "sl-select") {
      if (sound) {
        // 2.0.69 — picking a specific adhan while random was on: the
        // user is making a deliberate fixed choice, so turn random off.
        if (this._settings?.random_adhan_enabled &&
            (sound.category === "fajr_adhan" || sound.category === "adhan")) {
          this._saveSettings({ random_adhan_enabled: false });
        }
        this._selectSound(sound);
      }
    }
  }

  _previewSound(sound) {
    // Stop any existing preview first so only one plays at a time.
    this._stopPreview();
    try {
      const audio = new Audio(sound.url);
      audio.volume = 0.8;
      audio.addEventListener("ended", () => {
        if (this._previewingId === sound.id) {
          this._previewingId = null;
          this._renderPortal();
        }
      });
      audio.addEventListener("error", () => {
        this._previewingId = null;
        this._renderPortal();
      });
      audio.play().catch(() => {
        // Autoplay blocked or CORS — silently revert button state.
        this._previewingId = null;
        this._renderPortal();
      });
      this._previewAudio = audio;
      this._previewingId = sound.id;
      this._renderPortal();
    } catch (e) {
      console.warn("Nida preview failed:", e);
    }
  }

  _stopPreview() {
    if (this._previewAudio) {
      try { this._previewAudio.pause(); } catch (_) {}
      this._previewAudio = null;
    }
    if (this._previewingId !== null) {
      this._previewingId = null;
      this._renderPortal();
    }
  }

  async _downloadSound(sound) {
    this._catalogPending.add(sound.id);
    this._renderPortal();
    try {
      const res = await this._hass.callWS({
        type: "nida/download_sound",
        url: sound.url,
        rel_path: sound.rel_path,
      });
      if (res?.ok) {
        // Flip the local sound's downloaded flag without a re-fetch.
        sound.downloaded = true;
      } else {
        console.warn("Nida download failed:", res?.error);
      }
    } catch (e) {
      console.warn("Nida download error:", e);
    } finally {
      this._catalogPending.delete(sound.id);
      this._renderPortal();
    }
  }

  async _deleteSound(sound) {
    // Bundled defaults ship with the integration and cannot be removed —
    // the picker renders no delete button for them, but guard here too so
    // a stale/cached action can never trigger a delete on the backend.
    if (sound && (sound.default || sound.bundled)) return;
    // If the user deletes the currently-active sound, fall back to the
    // category default by clearing the option. Otherwise the integration
    // would try to play a missing file at the next adhan.
    const wasActive = this._settings?.[`sound_${sound.category}`] === sound.rel_path;
    this._catalogPending.add(sound.id);
    this._renderPortal();
    try {
      const res = await this._hass.callWS({
        type: "nida/delete_sound",
        rel_path: sound.rel_path,
      });
      if (res?.ok) {
        sound.downloaded = false;
        const patch = {};
        if (wasActive) patch[`sound_${sound.category}`] = null;
        // 2.0.51 — a dua pointing at the deleted file would 404 at
        // play time; clear its sound so the row shows "no sound".
        const duas = this._duas();
        if (duas.some((d) => d.sound === sound.rel_path)) {
          patch.duas = duas.map((d) =>
            d.sound === sound.rel_path ? { ...d, sound: null } : d
          );
        }
        if (Object.keys(patch).length) this._saveSettings(patch);
      } else {
        console.warn("Nida delete failed:", res?.error);
      }
    } catch (e) {
      console.warn("Nida delete error:", e);
    } finally {
      this._catalogPending.delete(sound.id);
      this._renderPortal();
    }
  }

  _selectSound(sound) {
    // Tapping a not-yet-downloaded row is ambiguous: select-and-download,
    // or just select? We pick "download first, then auto-select on
    // success" — the Android app does the same, and it avoids a 404
    // at adhan time. If already downloaded, just select.
    // 2.0.51 — dua picks don't write a sound_<category> option; they
    // land in the duas list (either the dua being edited, or a new one).
    if (!sound.downloaded) {
      // Kick off the download chain; selection happens on success.
      (async () => {
        await this._downloadSound(sound);
        if (sound.downloaded) {
          if (sound.category === "dua") {
            this._assignDuaSound(sound);
          } else {
            this._saveSettings({ [`sound_${sound.category}`]: sound.rel_path });
          }
        }
      })();
      return;
    }
    if (sound.category === "dua") {
      this._assignDuaSound(sound);
      return;
    }
    this._saveSettings({ [`sound_${sound.category}`]: sound.rel_path });
    this._renderPortal();
  }

  // ───── Duas (2.0.51) ────────────────────────────────────────────────────

  _duas() {
    const raw = this._settings?.duas;
    return Array.isArray(raw) ? raw : [];
  }

  _duaPickActiveRel() {
    // The rel_path that should show the active dot in the dua library
    // scope: the sound of the dua being edited. "new" (or no target)
    // has no active sound yet.
    if (!this._duaPickId || this._duaPickId === "new") return null;
    const dua = this._duas().find((d) => d.id === this._duaPickId);
    return dua?.sound || null;
  }

  _assignDuaSound(sound) {
    const duas = this._duas().map((d) => ({ ...d }));
    if (this._duaPickId && this._duaPickId !== "new") {
      const dua = duas.find((d) => d.id === this._duaPickId);
      if (dua) {
        dua.sound = sound.rel_path;
        dua.name = sound.name;
      }
    } else {
      // New dua: id from the sound id + time suffix so re-adding the
      // same sound twice still yields unique button entities.
      duas.push({
        id: `${sound.id}_${Date.now().toString(36)}`,
        name: sound.name,
        sound: sound.rel_path,
        media_player: "",
        volume: 40,
        trigger_entity: "",
      });
    }
    this._duaPickId = null;
    // Await the save so a backend rejection surfaces before the overlay
    // closes, and log the payload — makes "nothing happened" debuggable
    // from the browser console.
    (async () => {
      console.info("Nida: saving dua config", duas);
      await this._saveSettings({ duas });
      console.info("Nida: dua config saved, duas in settings:", this._settings?.duas);
      this._closeOverlay();
    })();
  }

  _onDuaPatch(duaId, patch) {
    const duas = this._duas().map((d) => (d.id === duaId ? { ...d, ...patch } : d));
    this._saveSettings({ duas });
  }

  _onDuaRemove(duaId) {
    const duas = this._duas().filter((d) => d.id !== duaId);
    this._saveSettings({ duas });
  }

  _onDuaPlay(duaId) {
    const dua = this._duas().find((d) => d.id === duaId);
    if (!dua?.media_player) {
      console.warn("Nida: play_dua skipped — dua has no media player:", duaId);
      return;
    }
    console.info("Nida: play_dua", duaId, "on", dua.media_player);
    // 2.0.71 — track which dua is playing so the single button can
    // toggle between play and stop icons.
    this._duaPlaying = duaId;
    this._render();
    try {
      this._hass.callService("nida", "play_dua", { dua_id: duaId });
    } catch (e) {
      console.warn("Nida play_dua failed:", e);
    }
  }

  _onDuaStop(duaId) {
    const dua = this._duas().find((d) => d.id === duaId);
    if (!dua?.media_player) return;
    console.info("Nida: stop dua playback on", dua.media_player);
    this._duaPlaying = null;
    this._render();
    try {
      this._hass.callService("media_player", "media_stop", {
        entity_id: dua.media_player,
      });
    } catch (e) {
      console.warn("Nida dua stop failed:", e);
    }
  }

  // ───── TTS pre-adhan (2.0.32) ─────────────────────────────────────────

  async _openTtsSettings() {
    this._openOverlay("tts-settings");
    if (!this._ttsServicesList && !this._ttsServicesLoading) {
      await this._loadTtsServices();
    }
  }

  async _loadTtsServices() {
    this._ttsServicesLoading = true;
    this._renderPortal();
    try {
      const res = await this._hass.callWS({ type: "nida/list_tts_services" });
      this._ttsServicesList = res?.services || [];
    } catch (e) {
      this._ttsServicesList = [];
      console.warn("Nida: list_tts_services failed:", e);
    }
    this._ttsServicesLoading = false;
    this._renderPortal();
  }

  // 2.0.36 — Default announcement messages per language. Used to:
  // (1) populate the message field when the user picks a TTS language
  //     and they've never set a custom message, and
  // (2) decide whether to AUTO-REPLACE the current message when the
  //     user switches language: if the current text matches ANY of
  //     these strings (any language), we replace it with the new lang's
  //     default; if it's user-customised, we leave it alone.
  //
  // 2.0.37 — Picker is now driven by the panel's LANGUAGES const
  // instead of a separate TTS_LANGUAGES list, so adding a panel
  // language automatically surfaces it in TTS. Languages here without
  // a default message just fall back to English at picker-change time.
  static get TTS_DEFAULT_MESSAGES() {
    return {
      en: "It's almost time for [prayer] prayer",
      nl: "Het is bijna tijd voor [prayer]",
      ar: "حان وقت صلاة [prayer] تقريباً",
      tr: "[prayer] namazı için neredeyse vakit geldi",
      de: "Es ist fast Zeit für das [prayer]-Gebet",
      fr: "C'est presque l'heure de la prière [prayer]",
      ms: "Hampir tiba waktu solat [prayer]",
      id: "Sudah hampir waktu salat [prayer]",
      ur: "[prayer] کی نماز کا وقت تقریباً ہو گیا ہے",
      fa: "تقریباً وقت نماز [prayer] است",
    };
  }

  _ttsCurrentLanguage() {
    return this._settings?.tts_pre_adhan_language || "auto";
  }

  _ttsEffectiveDefault(codeOverride) {
    // 2.0.56 — the default sentence for the language the announcement
    // will actually use: TTS override, else panel language. Shown as
    // the input placeholder and written by the reset button.
    // 2.0.57 — optional codeOverride so the reset button can pass the
    // LIVE dropdown value instead of relying on stored settings.
    const defs = NidaPanel.TTS_DEFAULT_MESSAGES;
    const code = codeOverride || this._ttsCurrentLanguage();
    const base = code === "auto" ? this._panelLanguageCode() : code.split("-")[0];
    return defs[base] || defs.en;
  }

  _onTtsResetMessage() {
    // Write the default verbatim (not ""): the exact-match detection on
    // both sides then keeps auto-switching on future language changes,
    // and the user sees the actual sentence instead of an empty field.
    // 2.0.57 — the language is read from the dropdown as currently
    // visible, not from stored settings: what you see is what you get,
    // immune to any save race on a just-changed language.
    const liveCode =
      this._overlayPortal?.querySelector('[data-input="tts-language"]')?.value
      || null;
    const sentence = this._ttsEffectiveDefault(liveCode);
    console.info(
      "Nida: TTS reset — live dropdown:", liveCode,
      "| stored language:", this._ttsCurrentLanguage(),
      "| writing:", sentence
    );
    this._saveSettings({ tts_pre_adhan_message: sentence });
  }

  _ttsIsKnownDefault(message) {
    if (!message) return true;
    const defs = NidaPanel.TTS_DEFAULT_MESSAGES;
    return Object.values(defs).includes(message);
  }

  _onTtsLanguageChange(newCode) {
    const defs = NidaPanel.TTS_DEFAULT_MESSAGES;
    const current = this._settings?.tts_pre_adhan_message || "";
    const patch = { tts_pre_adhan_language: newCode };
    const isDefault = this._ttsIsKnownDefault(current);
    if (isDefault) {
      const effective = newCode === "auto"
        ? (defs[this._panelLanguageCode()] || defs.en)
        : (defs[newCode] || defs.en);
      patch.tts_pre_adhan_message = effective;
    }
    // 2.0.57 — trace for the "language does not switch" report: shows
    // whether the current message counted as a default and what got
    // written. Read it in the browser console.
    console.info(
      "Nida: TTS language change →", newCode,
      "| message was default:", isDefault,
      "| patch:", patch
    );
    this._saveSettings(patch);
  }

  _panelLanguageCode() {
    const raw = (this._settings?.language || "auto").toLowerCase();
    if (raw === "auto") {
      const sys = (this._hass?.language || "en").toLowerCase();
      return sys.split("-")[0];
    }
    return raw.split("-")[0];
  }

  _ttsLanguageOptions() {
    // Surface LANGUAGES (the panel-wide picker source) as TTS options.
    // The "auto" label maps to our own translation key so it explains
    // what 'auto' means in the TTS context ("follow panel"), not just
    // the generic "Automatic" used in the panel language picker.
    return LANGUAGES.map((l) => ({
      code: l.code,
      label: l.code === "auto" ? this.t("tts_lang_auto") : l.label,
    }));
  }

  _htmlOverlayTtsSettings() {
    const list = this._ttsServicesList || [];
    const loading = !!this._ttsServicesLoading;
    const selected = new Set(this._settings?.tts_pre_adhan_services || []);
    const message = this._settings?.tts_pre_adhan_message || "";
    let body;
    if (loading && !list.length) {
      body = `<div class="sl-empty">${this.t("loading")}</div>`;
    } else if (!list.length) {
      body = `<div class="sl-empty">${this.t("tts_no_services")}</div>`;
    } else {
      body = `
        <div class="tts-section-head">${this.t("tts_pick_agents")}</div>
        <div class="sl-list">
          ${list.map((s) => `
            <div class="sl-row tts-pick-row ${selected.has(s.entity_id) ? "active" : ""}"
                 data-action="tts-toggle-service"
                 data-tts-entity="${this._escape(s.entity_id)}">
              <div class="sl-name">
                ${selected.has(s.entity_id) ? `<span class="sl-active-dot">${ICONS.check}</span>` : ""}
                ${this._escape(s.name)}
              </div>
              <div class="tts-entity-id">${this._escape(s.entity_id)}</div>
            </div>
          `).join("")}
        </div>
        <div class="tts-section-head">${this.t("tts_message_label")}</div>
        <div class="tts-message-wrap">
          <div class="tts-lang-row">
            <label class="tts-lang-label">${this.t("tts_lang_label")}</label>
            <select class="tts-lang-select" data-input="tts-language">
              ${this._ttsLanguageOptions().map((l) => `
                <option value="${l.code}" ${this._ttsCurrentLanguage() === l.code ? "selected" : ""}>
                  ${this._escape(l.label)}
                </option>
              `).join("")}
            </select>
          </div>
          <input type="text" class="sl-url-input" data-input="tts-message"
                 value="${this._escape(message)}"
                 placeholder="${this._escape(this._ttsEffectiveDefault())}"
                 autocomplete="off">
          <div class="tts-msg-hint-row">
            <div class="tts-msg-hint">${this.t("tts_msg_hint_full")}</div>
            <button class="test-btn tts-reset-btn" data-action="tts-reset-message"
                    ${this._ttsIsKnownDefault(message) ? "disabled" : ""}>
              ${this.t("tts_reset_default")}
            </button>
          </div>
        </div>
        <div class="tts-test-row">
          <button class="test-btn" data-action="tts-test"
                  ${selected.size === 0 ? "disabled" : ""}>
            ${this.t("tts_test")}
          </button>
        </div>
      `;
    }
    return `
      <div class="overlay">
        <div class="overlay-panel sound-library-panel" data-stop>
          <div class="overlay-header">
            <div class="overlay-title">
              <span style="font-size:18px">🗣️</span>
              ${this.t("tts_title")}
            </div>
            <button class="overlay-close" data-action="close-overlay"
                    aria-label="${this.t("close")}">×</button>
          </div>
          <div class="sound-library-body">${body}</div>
        </div>
      </div>
    `;
  }

  _onTtsAction(action, target) {
    if (action === "toggle-tts-master") {
      const cur = !!this._settings?.tts_pre_adhan_enabled;
      this._saveSettings({ tts_pre_adhan_enabled: !cur });
    } else if (action === "open-tts-settings") {
      this._openTtsSettings();
    } else if (action === "tts-toggle-service") {
      // 2.0.43 — single-select. Multi-select fanned the same message out
      // to every engine on the same speakers, which played the
      // announcement N times in a row. One engine is what the setup
      // actually needs; tapping the active one deselects it, tapping
      // another replaces the choice (radio behaviour). The option stays
      // a list for backward compat with services.py's fan-out loop —
      // it just never holds more than one entry from the panel now.
      const id = target?.dataset?.ttsEntity;
      if (!id) return;
      const current = this._settings?.tts_pre_adhan_services || [];
      const next = current.includes(id) ? [] : [id];
      this._saveSettings({ tts_pre_adhan_services: next });
    } else if (action === "tts-test") {
      this._hass.callService("nida", "speak_pre_adhan", { prayer: "test" })
        .catch((e) => console.warn("Nida tts test failed:", e));
    } else if (action === "tts-reset-message") {
      this._onTtsResetMessage();
    }
  }

  _htmlOverlayPreAdhanPrayers() {
    return `
      <div class="overlay">
        <div class="overlay-panel sound-library-panel" data-stop>
          <div class="overlay-header">
            <div class="overlay-title">
              <span style="font-size:18px">🕌</span>
              ${this.t("pre_adhan_prayers_title")}
            </div>
            <button class="overlay-close" data-action="close-overlay"
                    aria-label="${this.t("close")}">×</button>
          </div>
          <div class="sound-library-body">
            <div class="sl-list">
              ${PRAYERS.map((p) => {
                const on = this._isPreAdhanEnabledFor(p);
                return `
                  <div class="sl-row pap-row" data-action="toggle-pre-adhan-prayer"
                       data-prayer="${p}">
                    <div class="sl-name">${this.t("prayer_" + p)}</div>
                    <div class="toggle ${on ? "on" : ""}">
                      <div class="toggle-knob"></div>
                    </div>
                  </div>
                `;
              }).join("")}
            </div>
          </div>
        </div>
      </div>
    `;
  }

  // ───── Silent mode popup (2.0.80) ──────────────────────────────────────
  // Replaces the old guest-mode tile + banner. Opened from the mute
  // button on the now-card. Just a duration dropdown, a note that prayer
  // notifications keep coming (only the adhan sound is muted), and a
  // confirm/turn-off button — no live slider, no separate companion
  // card. Reuses the guest_mode_* settings keys under the hood.
  _htmlOverlaySilentMode() {
    const active = this._guestModeActive();
    const hours = this._guestModeHours();
    const until = this._guestModeUntil();
    const statusText = active
      ? (until
          ? `${this.t("silent_mode_active_until")} ${this._fmtHHMM(until)}`
          : this.t("guest_mode_until_manual"))
      : "";
    const durationOptions = [1, 2, 3, 4, 6, 8, 12, 24];
    return `
      <div class="overlay">
        <div class="overlay-panel silent-mode-panel" data-stop>
          <div class="overlay-header">
            <div class="overlay-title">
              <span style="font-size:18px">🔇</span>
              ${this.t("silent_mode_popup_title")}
            </div>
            <button class="overlay-close" data-action="close-overlay"
                    aria-label="${this.t("close")}">×</button>
          </div>
          <div class="silent-mode-body">
            ${active ? `<div class="silent-mode-status">${statusText}</div>` : ""}
            <label class="silent-mode-label" for="silent-mode-hours-select">
              ${this.t("silent_mode_popup_duration_label")}
            </label>
            <select id="silent-mode-hours-select" class="silent-mode-select"
                    data-input="silent-mode-hours">
              ${durationOptions.map((h) => `
                <option value="${h}" ${h === hours ? "selected" : ""}>
                  ${this._fmtGuestHours(h)}
                </option>
              `).join("")}
            </select>
            <div class="silent-mode-note">${this.t("silent_mode_popup_note")}</div>
            <div class="silent-mode-actions">
              ${active ? `
                <button class="test-btn silent-mode-off" data-action="turn-off-silent-mode">
                  ${this.t("silent_mode_popup_turn_off")}
                </button>
              ` : ""}
              <button class="test-btn silent-mode-confirm" data-action="confirm-silent-mode">
                ${this.t(active ? "silent_mode_popup_update" : "silent_mode_popup_confirm")}
              </button>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  _htmlOverlayWelcome() {
    const w = WELCOME_CONTENT;
    return `
      <div class="overlay welcome">
        <div class="overlay-panel welcome-panel" data-stop>
          <div class="welcome-bismillah">${w.bismillah}</div>
          <div class="welcome-salam">${w.salam}</div>
          <div class="welcome-text">${w.intro}</div>
          <div class="welcome-text">${w.blessing}</div>
          <div class="welcome-divider"></div>
          <ul class="welcome-features">
            ${w.features.map((f) => `<li>${f}</li>`).join("")}
          </ul>
          <div class="welcome-divider"></div>
          <div class="welcome-thanks">${w.thanks}</div>
          <div class="welcome-author">${w.author}</div>
          <button class="welcome-cta" data-action="dismiss-welcome">${w.cta}</button>
        </div>
      </div>
    `;
  }

  _htmlOverlayList(title, items, action, options = {}) {
    const { searchable = false, secondary = null } = options;
    // 2.0.95 — optional secondary per-item toggle (used by the notify-
    // targets overlay for the Samsung TTS/alarm-stream workaround flag).
    // Only rendered when `secondary` is passed, so every other caller of
    // this shared list (speakers, jumuah-targets, country, etc.) is
    // completely unaffected. The secondary control carries its own
    // data-action, so a click on it resolves to that action first
    // (composedPath search starts at the click target and bubbles
    // outward) without also triggering the row's own toggle.
    const searchHtml = searchable
      ? `
        <div class="overlay-search">
          <input
            type="text"
            placeholder="${this.t("search_placeholder")}"
            data-input="overlay-search"
            value="${this._escape(this._overlaySearchQuery)}"
            autocomplete="off"
            spellcheck="false"
          >
        </div>
      `
      : "";
    return `
      <div class="overlay" data-action="close-overlay">
        <div class="overlay-panel" data-stop>
          <div class="overlay-header">
            <span>${title}</span>
            <button class="overlay-close" data-action="close-overlay" aria-label="${this.t("close")}">✕</button>
          </div>
          ${searchHtml}
          <div class="overlay-list">
            ${items.map((it) => `
              <div class="overlay-item ${it.active ? "active" : ""}" data-action="${action}" data-key="${it.key}">
                <span>${this._escape(it.label)}</span>
                <span class="overlay-item-controls">
                  ${secondary && secondary.showFor(it) ? `
                    <div class="toggle-mini critical ${secondary.isOn(it) ? "on" : ""}"
                         data-action="${secondary.action}" data-key="${it.key}"
                         title="${this._escape(secondary.title)}">
                      ${secondary.icon}
                    </div>
                  ` : ""}
                  ${it.active ? `<span class="overlay-check">${ICONS.check}</span>` : ""}
                </span>
              </div>
            `).join("")}
            ${items.length === 0 ? `<div class="overlay-empty">${this.t("search_no_results")}</div>` : ""}
          </div>
        </div>
      </div>
    `;
  }

  _escape(s) {
    return String(s ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;");
  }

  // ───── Event wiring ───────────────────────────────────────────────────────

  _handleClick(e) {
    const target = e.composedPath().find((el) => el.dataset && el.dataset.action);
    if (!target) return;
    const action = target.dataset.action;

    if (action === "toggle-prayer") {
      this._onTogglePrayer(target.dataset.prayer);
    } else if (action === "toggle-pre-adhan-two") {
      this._onTogglePreAdhanTwo();
    } else if (action === "toggle-pre-adhan-audio") {
      this._onTogglePreAdhanAudio();
    } else if (action === "test-pre-adhan") {
      // Legacy action name from <2.0.23 — keep working in case any
      // cached panel HTML still emits it. Forwards to the new play
      // handler so the user experience matches the new UI.
      this._onPlayPreAdhanTest(target);
    } else if (action === "play-pre-adhan-test") {
      if (target.dataset.disabled === "true") return;
      this._onPlayPreAdhanTest(target);
    } else if (action === "stop-pre-adhan-test") {
      this._onStopPreAdhanTest(target);
    } else if (action === "toggle-night-mode") {
      this._onToggleNightMode();
    } else if (action === "toggle-open-contact") {
      this._onToggleOpenContact();
    } else if (action === "open-silent-mode") {
      this._onOpenSilentMode();
    } else if (action === "confirm-silent-mode") {
      this._onConfirmSilentMode();
    } else if (action === "turn-off-silent-mode") {
      this._onTurnOffSilentMode();
    } else if (action === "open-open-contact-sensors") {
      this._openOverlay("open-contact-sensors");
    } else if (action === "toggle-open-contact-sensor") {
      // Multi-select — leave overlay open so several sensors can be picked.
      this._toggleOpenContactSensor(target.dataset.key);
    } else if (action === "toggle-notify-master") {
      this._onToggleNotifyMaster();
    } else if (action === "toggle-notify-critical-prayer") {
      this._onToggleNotifyCriticalPrayer(target.dataset.prayer);
    } else if (action === "toggle-notify-prayer") {
      this._onToggleNotifyPrayer(target.dataset.prayer);
    } else if (action === "open-notify-targets") {
      this._openOverlay("notify-targets");
    } else if (action === "toggle-notify-target") {
      this._toggleNotifyTarget(target.dataset.key);
    } else if (action === "toggle-notify-tts-workaround") {
      this._toggleNotifyTtsWorkaround(target.dataset.key);
    } else if (action === "open-jumuah-targets") {
      this._openOverlay("jumuah-targets");
    } else if (action === "toggle-jumuah-target") {
      this._toggleJumuahTarget(target.dataset.key);
    } else if (action === "toggle-jumuah") {
      this._onToggleJumuah();
    } else if (action === "toggle-calendar-holidays") {
      this._onToggleCalendarHolidays();
    } else if (action === "toggle-calendar-holidays-second") {
      this._onToggleCalendarHolidaysSecond();
    } else if (action === "toggle-calendar-ashura") {
      this._onToggleCalendarAshura();
    } else if (action === "toggle-calendar-white-days") {
      this._onToggleCalendarWhiteDays();
    } else if (action === "toggle-calendar-sunnah") {
      this._onToggleCalendarSunnah();
    } else if (action === "open-calendar-targets") {
      this._openOverlay("calendar-targets");
    } else if (action === "toggle-calendar-target") {
      this._toggleCalendarTarget(target.dataset.key);
    } else if (action === "calendar-prev-month") {
      this._onCalendarPrevMonth();
    } else if (action === "calendar-next-month") {
      this._onCalendarNextMonth();
    } else if (action === "open-calendar-day") {
      this._openCalendarDayDetail(parseInt(target.dataset.hijriDay, 10));
    } else if (action === "open-calendar-upcoming") {
      this._openCalendarUpcomingDetail(target.dataset.key, parseInt(target.dataset.daysOff, 10));
    } else if (action === "test-notify") {
      this._onTestNotify(target);
    } else if (action === "test-notify-prayer") {
      this._onTestNotifyPrayer(target);
    } else if (action === "test-jumuah") {
      this._onTestJumuah(target);
    } else if (action === "test-speakers") {
      this._onTestSpeakers(target);
    } else if (action === "play-speaker-test") {
      if (target.dataset.disabled === "true") return;
      this._onPlaySpeakerTest(target);
    } else if (action === "stop-speaker-test") {
      this._onStopSpeakerTest(target);
    } else if (action === "loc-device") {
      this._onLocationMode("device");
    } else if (action === "loc-manual") {
      this._onLocationMode("manual");
    } else if (action === "open-method") {
      this._openOverlay("method");
    } else if (action === "open-language") {
      this._openOverlay("language");
    } else if (action === "cycle-theme") {
      this._onCycleTheme();
    } else if (action === "open-country") {
      this._openOverlay("country");
    } else if (action === "open-speakers") {
      this._openOverlay("speakers");
    } else if (action === "toggle-speaker") {
      // Multi-select toggle — does NOT close the overlay so the user
      // can pick several speakers in one sitting. Backdrop click or the
      // close button still closes via the close-overlay path.
      this._toggleSpeaker(target.dataset.key);
    } else if (action === "pick-method") {
      this._onPickMethod(Number(target.dataset.key));
    } else if (action === "pick-language") {
      this._onPickLanguage(target.dataset.key);
    } else if (action === "pick-country") {
      this._onPickCountry(target.dataset.key);
    } else if (action === "pick-city") {
      this._onPickCity(
        target.dataset.name,
        parseFloat(target.dataset.lat),
        parseFloat(target.dataset.lon)
      );
    } else if (action === "play-sound") {
      this._playSoundPreview(target.dataset.category);
    } else if (action === "stop-sound") {
      this._stopSoundPreview();
      this._render();
    } else if (action === "open-sound-library") {
      this._openSoundLibrary(target?.dataset?.category || null);
    } else if (action === "dua-add") {
      this._duaPickId = "new";
      this._openSoundLibrary("dua");
    } else if (action === "dua-pick-sound") {
      this._duaPickId = target?.dataset?.duaId || "new";
      this._openSoundLibrary("dua");
    } else if (action === "dua-play") {
      this._onDuaPlay(target?.dataset?.duaId);
    } else if (action === "dua-stop") {
      this._onDuaStop(target?.dataset?.duaId);
    } else if (action === "dua-remove") {
      this._onDuaRemove(target?.dataset?.duaId);
    } else if (action && action.startsWith("sl-")) {
      this._onSoundLibraryAction(action, target);
    } else if (action === "toggle-tts-master" || action === "open-tts-settings"
               || action === "tts-toggle-service" || action === "tts-test"
               || action === "tts-reset-message") {
      this._onTtsAction(action, target);
    } else if (action === "open-pre-adhan-prayers") {
      this._openOverlay("pre-adhan-prayers");
    } else if (action === "toggle-pre-adhan-prayer") {
      const p = target?.dataset?.prayer;
      if (p) this._onTogglePreAdhanForPrayer(p);
    } else if (action === "setup-start") {
      const mode = target?.dataset?.mode;
      if (!mode) return;
      this._pendingSetupMode = mode;
      if (this._hasExistingSetup()) {
        this._openOverlay("setup-confirm");
      } else {
        this._startSetupWizard(mode);
      }
    } else if (action === "setup-export-backup") {
      this._onExportBackup();
    } else if (action === "setup-restore-apply") {
      if (!this._restoreParsed) return;
      this._saveSettings(this._restoreParsed.settings);
      this._restoreParsed = null;
      this._restoreErrorCode = null;
      this._restoreFileName = "";
      this._activeOverlay = null;
      this._render();
    } else if (action === "setup-confirm-proceed") {
      this._startSetupWizard(this._pendingSetupMode);
    } else if (action === "setup-confirm-cancel") {
      this._pendingSetupMode = null;
      this._activeOverlay = null;
      this._render();
    } else if (action === "setup-wizard-prev") {
      const steps = this._setupWizardSteps();
      this._setupStepIndex = Math.max(0, Math.min(this._setupStepIndex - 1, steps.length - 1));
      this._render();
    } else if (action === "setup-wizard-next") {
      const steps = this._setupWizardSteps();
      this._setupStepIndex = Math.max(0, Math.min(this._setupStepIndex + 1, steps.length - 1));
      this._render();
    } else if (action === "setup-wizard-finish") {
      // Every field already auto-saved as the user stepped through (same
      // handlers as the normal accordion) — finishing just closes the
      // wizard, nothing extra to persist here.
      this._setupStepIndex = 0;
      this._setupWizardActive = false;
      this._render();
    } else if (action === "setup-wizard-exit") {
      // Exit without finishing — same as finish in terms of state (fields
      // already auto-saved as edited), just a different affordance.
      this._setupStepIndex = 0;
      this._setupWizardActive = false;
      this._render();
    } else if (action === "setup-auto-toggle-pre-adhan") {
      // Single yes/no in automatic mode. "Yes" applies fixed defaults
      // (20 min first reminder, 5 min second, jingle + TTS both on)
      // rather than exposing the sliders — those stay available in the
      // real Sounds section afterwards if the user wants to tune them.
      const on = !!this._settings?.pre_adhan_audio_enabled || !!this._settings?.tts_pre_adhan_enabled;
      if (on) {
        this._saveSettings({ pre_adhan_audio_enabled: false, tts_pre_adhan_enabled: false });
      } else {
        this._saveSettings({
          pre_adhan_audio_enabled: true,
          tts_pre_adhan_enabled: true,
          pre_adhan_minutes: 20,
          pre_adhan_two_enabled: true,
          pre_adhan_minutes_2: 5,
        });
      }
      this._render();
    } else if (action === "setup-auto-toggle-critical") {
      // Bulk version of the per-prayer "critical" (DND-bypass) toggle
      // that the real Notifications section exposes individually.
      const allCritical = PRAYERS.every((p) => this._isNotifyCriticalFor(p));
      const patch = {};
      for (const p of PRAYERS) patch[`notify_critical_enabled_${p}`] = !allCritical;
      this._saveSettings(patch);
      this._render();
    } else if (action === "dismiss-welcome") {
      // Hide overlay immediately, persist the seen-flag asynchronously.
      this._activeOverlay = null;
      // 2.1.0 — on a genuinely fresh install (no location configured
      // yet), dismissing welcome opens the Setup section so the three
      // entry buttons are immediately visible — the setup wizard follows
      // the welcome screen, as designed, without picking a mode on the
      // user's behalf. Skipped on an already-configured install (e.g.
      // welcome reshown after a version bump — see last_seen_version)
      // since nobody asked to reconfigure there.
      const openSetup = !this._hasExistingSetup();
      if (openSetup) this._setOpenSection("setup");
      this._render();
      this._saveSettings({ panel_welcome_seen: true });
      if (openSetup) {
        // Scroll it into view — it's the last section, below the fold.
        requestAnimationFrame(() => {
          const el = this.shadowRoot?.querySelector('[data-section-id="setup"]');
          if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
        });
      }
    } else if (action === "close-overlay") {
      // Close only on a real backdrop click or an explicit close-button
      // click. Clicks on inert panel whitespace still bubble up to the
      // backdrop element (which carries the close-overlay action), so we
      // distinguish by checking whether the actual click path hits the
      // close button or stays inside the panel.
      const path = e.composedPath();
      const insidePanel = path.find((el) => el.dataset && el.dataset.stop);
      const isCloseBtn = path.find(
        (el) => el.classList && el.classList.contains("overlay-close")
      );
      if (isCloseBtn || !insidePanel) {
        this._stopPreview();
        this._closeOverlay();
      }
    }
  }

  _attachInputListeners(root) {
    if (!root) return;
    // Text inputs save on blur, not on each keystroke, so a re-render doesn't
    // strip focus while the user is typing. These DOM nodes are fresh after
    // every innerHTML reset, so re-attaching is the right thing here (unlike
    // the delegated click handler, which lives on shadow root).
    // Country is no longer a text input — it's a dropdown — so only the
    // city field gets a blur listener.
    root.querySelectorAll("input[data-input]").forEach((input) => {
      const which = input.dataset.input;
      if (which === "city") {
        // Delay blur work so a click on a suggestion (which fires AFTER
        // the input loses focus) can hit _onPickCity first. 200ms is
        // plenty for the click event to land.
        input.addEventListener("blur", (e) => {
          setTimeout(() => this._onCityBlur(e.target.value), 200);
        });
        input.addEventListener("input", (e) => this._onCityInput(e.target.value));
      } else if (which === "overlay-search") {
        input.addEventListener("input", (e) => {
          this._overlaySearchQuery = e.target.value;
          this._renderPortal();
        });
        // Refocus the input after re-render so typing isn't interrupted.
        setTimeout(() => {
          input.focus();
          const v = input.value;
          input.setSelectionRange(v.length, v.length);
        }, 0);
      } else if (which.startsWith("volume-")) {
        const category = which.substring("volume-".length);
        // 'input' updates the live "85%" label without persisting; 'change'
        // (fires on slider release) is the one that actually saves. This
        // keeps option-writes to one per slide gesture, not one per pixel.
        input.addEventListener("input", (e) => {
          const display = root.querySelector(
            `[data-volume-display="${category}"]`
          );
          if (display) display.textContent = `${e.target.value}%`;
        });
        input.addEventListener("change", (e) => this._onVolumeChange(category, e.target.value));
      } else if (which === "pre-adhan-minutes-1" || which === "pre-adhan-minutes-2") {
        const slot = which.endsWith("-2") ? 2 : 1;
        // Live label update during drag (uses data-minutes-display attribute);
        // save on release (change event), same pattern as the volume sliders.
        input.addEventListener("input", (e) => {
          const display = root.querySelector(
            `[data-minutes-display="${slot}"]`
          );
          if (display) display.textContent = `${e.target.value} ${this.t("minutes_short")}`;
        });
        input.addEventListener("change", (e) => this._onPreAdhanMinutesChange(slot, e.target.value));
      } else if (which === "notify-title") {
        input.addEventListener("blur", (e) => this._onNotifyTitleBlur(e.target.value));
      } else if (which === "notify-message") {
        input.addEventListener("blur", (e) => this._onNotifyMessageBlur(e.target.value));
      } else if (which === "jumuah-minutes") {
        input.addEventListener("input", (e) => {
          const display = root.querySelector("[data-jumuah-minutes-display]");
          if (display) display.textContent = `${e.target.value} ${this.t("minutes_short")}`;
        });
        input.addEventListener("change", (e) => this._onJumuahMinutesChange(e.target.value));
      } else if (which === "imsak-offset") {
        // 2.0.88 — live display while dragging, save on release. The
        // save triggers a re-render, which also refreshes the shifted
        // Imsak time on the today-card.
        input.addEventListener("input", (e) => {
          const display = root.querySelector("[data-imsak-offset-display]");
          if (display) display.textContent = `${e.target.value} ${this.t("minutes_short")}`;
        });
        input.addEventListener("change", (e) => this._onImsakOffsetChange(e.target.value));
      } else if (which === "jumuah-message") {
        input.addEventListener("blur", (e) => this._onJumuahMessageBlur(e.target.value));
      } else if (which === "volume-test") {
        input.addEventListener("input", (e) => {
          const display = root.querySelector("[data-test-volume-display]");
          if (display) display.textContent = `${e.target.value}%`;
        });
        input.addEventListener("change", (e) => this._onVolumeTestChange(e.target.value));
      } else if (which === "volume-pre-adhan-test") {
        input.addEventListener("input", (e) => {
          const display = root.querySelector("[data-pre-adhan-test-volume-display]");
          if (display) display.textContent = `${e.target.value}%`;
        });
        input.addEventListener("change", (e) => this._onVolumePreAdhanTestChange(e.target.value));
      } else if (which === "night-start") {
        input.addEventListener("change", (e) => this._onNightStartChange(e.target.value));
      } else if (which === "night-end") {
        input.addEventListener("change", (e) => this._onNightEndChange(e.target.value));
      } else if (which === "calendar-holidays-lead-1" || which === "calendar-holidays-lead-2") {
        const slot = which.endsWith("-2") ? 2 : 1;
        input.addEventListener("input", (e) => {
          const display = root.querySelector(`[data-calendar-lead-display="${slot}"]`);
          if (display) display.textContent = `${e.target.value} ${this.t("days_short")}`;
        });
        input.addEventListener("change", (e) => this._onCalendarLeadChange(slot, e.target.value));
      } else if (which === "calendar-fire-time") {
        input.addEventListener("change", (e) => this._onCalendarFireTimeChange(e.target.value));
      } else if (which === "night-volume-factor") {
        input.addEventListener("input", (e) => {
          const display = root.querySelector("[data-night-factor-display]");
          if (display) display.textContent = `${e.target.value}%`;
        });
        input.addEventListener("change", (e) => this._onNightFactorChange(e.target.value));
      } else if (which === "open-contact-factor") {
        input.addEventListener("input", (e) => {
          const display = root.querySelector("[data-open-contact-factor-display]");
          if (display) display.textContent = `${e.target.value}%`;
        });
        input.addEventListener("change", (e) => this._onOpenContactFactorChange(e.target.value));
      } else if (which === "dua-player") {
        // 2.0.59 — handled by the delegated change listener on the
        // shadow root (see connectedCallback); nothing to attach here.
      } else if (which === "dua-volume") {
        input.addEventListener("input", (e) => {
          const display = root.querySelector(
            `[data-dua-volume-display="${e.target.dataset.duaId}"]`
          );
          if (display) display.textContent = `${e.target.value}%`;
        });
        input.addEventListener("change", (e) => {
          this._onDuaPatch(e.target.dataset.duaId, {
            volume: parseInt(e.target.value, 10),
          });
        });
      } else if (which === "tts-message") {
        input.addEventListener("change", (e) => {
          this._saveSettings({ tts_pre_adhan_message: e.target.value });
        });
      } else if (which === "tts-language") {
        // 2.0.58 — handled by the delegated change listener on the
        // portal (see _ensurePortal); nothing to attach here anymore.
      } else if (which === "restore-file") {
        input.addEventListener("change", (e) => this._onRestoreFileChange(e.target.files?.[0] || null));
      }
    });
  }

  // ───── CSS ────────────────────────────────────────────────────────────────

  _cssBase() {
    return `
      :host {
        display: block;
        min-height: 100%;
        background: var(--nida-bg, #081326);
        color: var(--nida-text, #F8F8FA);
        font-family: 'Inter', sans-serif;
      }
      * { box-sizing: border-box; margin: 0; padding: 0; }
      .app {
        max-width: 1180px;
        margin: 0 auto;
        min-height: 100vh;
        background: var(--nida-bg, #081326);
        position: relative;
        overflow: hidden;
      }
      .loading-state {
        padding: 60px 24px;
        text-align: center;
        font-size: 14px;
        color: var(--nida-text-dim, #B9BED4);
      }
      .loading-state.error { color: #ff7676; }
    `;
  }

  _css() {
    return `
      :host {
        --nida-bg: #081326;
        --nida-surface: #111D39;
        --nida-surface-raised: #18254A;
        --nida-gold: #7C5CFF;
        --nida-gold-soft: #34386A;
        --nida-gold-bright: #F6C24A;
        --nida-text: #F8F8FA;
        --nida-text-dim: #B9BED4;
        --nida-border: #232A45;
        --nida-radius: 20px;
        /* 2.0.89 — semantic red for "critical" state (critical
           notifications toggle). Deliberately NOT themed per light/dark/
           ramadan like --nida-gold-bright: it should read as "urgent"
           consistently, not shift with the palette. Defined once here so
           every :host(.theme-*) block inherits it unless a theme has a
           specific reason to override. */
        --nida-critical: #E5484D;
        --nida-critical-soft: rgba(229, 72, 77, 0.16);
        /* 2.0.76 — the single decorative asset is --img-appbg (defined in
           the light-theme blocks): the full landscape illustration used as
           the .app page background. Dark keeps its flat gold treatment. The
           toggle vars below drive the hero card, header pattern and shadows
           per theme. */
        --nida-now-bg: var(--img-herodark) center / cover no-repeat, linear-gradient(160deg, #141d3f, #1b2148);
        --nida-now-icon-display: none;
        --nida-next-border: 1px solid var(--nida-gold-bright);
        --nida-next-bar: none;
        --nida-next-radius: 12px;
        --nida-next-glow: 0 0 18px rgba(246, 194, 74, 0.22);
        --nida-now-lattice-opacity: 0;
        --nida-countdown: var(--nida-text);
        --nida-eyebrow: var(--nida-text-dim);
        /* 2.0.85 — now-card mute button, themed via vars. Dark: no ring,
           translucent purple fill + glyph (dark accent #7C5CFF). Light
           blocks override with green. Both right-aligned to the countdown
           edge (28px = card padding). */
        --nida-mute-bg: rgba(124, 92, 255, 0.18);
        --nida-mute-border: none;
        --nida-mute-icon: rgba(124, 92, 255, 0.8);
        --nida-mute-right: 28px;
        --nida-motif-opacity: 0.5;
        --nida-card-shadow: 0 10px 30px rgba(0,0,0,0.35);
        --nida-hero-shadow: 0 14px 44px rgba(0,0,0,0.45), 0 0 0 1px rgba(124,92,255,0.18);
        --img-appbg: url("data:image/webp;base64,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");
        --nida-app-illust: none;
        --img-herodark: url("data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCA3MjAgMjIwIiBwcmVzZXJ2ZUFzcGVjdFJhdGlvPSJ4TWlkWU1heCBzbGljZSI+CjxkZWZzPgo8bGluZWFyR3JhZGllbnQgaWQ9InNreSIgeDE9IjAiIHkxPSIwIiB4Mj0iMCIgeTI9IjEiPgo8c3RvcCBvZmZzZXQ9IjAiIHN0b3AtY29sb3I9IiMxNDFkM2YiLz48c3RvcCBvZmZzZXQ9IjAuNTUiIHN0b3AtY29sb3I9IiMxYjIxNDgiLz48c3RvcCBvZmZzZXQ9IjEiIHN0b3AtY29sb3I9IiMyYTIzNTAiLz4KPC9saW5lYXJHcmFkaWVudD4KPHJhZGlhbEdyYWRpZW50IGlkPSJnbG93IiBjeD0iMC41IiBjeT0iMSIgcj0iMC43Ij4KPHN0b3Agb2Zmc2V0PSIwIiBzdG9wLWNvbG9yPSIjZjZjMjRhIiBzdG9wLW9wYWNpdHk9IjAuMzUiLz4KPHN0b3Agb2Zmc2V0PSIwLjQiIHN0b3AtY29sb3I9IiNiOThhNmEiIHN0b3Atb3BhY2l0eT0iMC4xNiIvPgo8c3RvcCBvZmZzZXQ9IjEiIHN0b3AtY29sb3I9IiNiOThhNmEiIHN0b3Atb3BhY2l0eT0iMCIvPgo8L3JhZGlhbEdyYWRpZW50Pgo8bGluZWFyR3JhZGllbnQgaWQ9InNpbCIgeDE9IjAiIHkxPSIwIiB4Mj0iMCIgeTI9IjEiPgo8c3RvcCBvZmZzZXQ9IjAiIHN0b3AtY29sb3I9IiMwZTE0MzAiLz48c3RvcCBvZmZzZXQ9IjEiIHN0b3AtY29sb3I9IiMwYTEwMjkiLz4KPC9saW5lYXJHcmFkaWVudD4KPC9kZWZzPgo8cmVjdCB3aWR0aD0iNzIwIiBoZWlnaHQ9IjIyMCIgZmlsbD0idXJsKCNza3kpIi8+CjxyZWN0IHg9IjEyMCIgeT0iMTIwIiB3aWR0aD0iNjAwIiBoZWlnaHQ9IjEwMCIgZmlsbD0idXJsKCNnbG93KSIvPgo8IS0tIHN0YXJzIC0tPgo8ZyBmaWxsPSIjZWVmMGZmIj48Y2lyY2xlIGN4PSIzODAiIGN5PSIzMCIgcj0iMS4xIiBvcGFjaXR5PSIwLjgiLz48Y2lyY2xlIGN4PSI0NzAiIGN5PSI2MCIgcj0iMC45IiBvcGFjaXR5PSIwLjYiLz48Y2lyY2xlIGN4PSI1NjAiIGN5PSIyNiIgcj0iMS4yIiBvcGFjaXR5PSIwLjciLz48Y2lyY2xlIGN4PSIzMDAiIGN5PSI1MiIgcj0iMC44IiBvcGFjaXR5PSIwLjUiLz48Y2lyY2xlIGN4PSI2NDAiIGN5PSI3MCIgcj0iMSIgb3BhY2l0eT0iMC42Ii8+PGNpcmNsZSBjeD0iMjIwIiBjeT0iMzQiIHI9IjAuOSIgb3BhY2l0eT0iMC42Ii8+PC9nPgo8IS0tIGNyZXNjZW50IG1vb24gdG9wLWxlZnQgLS0+CjxnIHRyYW5zZm9ybT0idHJhbnNsYXRlKDcwLDUyKSI+PHBhdGggZD0iTTE0IDBBMTUgMTUgMCAxIDAgMTQgMzAgMTIgMTIgMCAwIDEgMTQgMFoiIGZpbGw9IiNlOWRkYjAiIG9wYWNpdHk9IjAuOTIiLz48L2c+CjwhLS0gZmFyIGhpbGxzIC0tPgo8cGF0aCBkPSJNMCAxNjggQzEyMCAxNTAgMjIwIDE3MiAzNDAgMTYwIEM0NjAgMTQ4IDU2MCAxNzQgNzIwIDE1OCBMNzIwIDIyMCBMMCAyMjBaIiBmaWxsPSIjMWEyMDQ0IiBvcGFjaXR5PSIwLjciLz4KPCEtLSBza3lsaW5lIHNpbGhvdWV0dGUgKG1vc3F1ZSBsZWZ0ICsgY2l0eSkgLS0+CjxnIGZpbGw9InVybCgjc2lsKSI+CjxwYXRoIGQ9Ik0wIDIyMCBWMTgyIEM0MCAxNzggNzAgMTgwIDk2IDE3NiBMOTYgMTUwIEM5NiAxMzggMTA0IDEzMiAxMTIgMTMyIEMxMjAgMTMyIDEyOCAxMzggMTI4IDE1MCBMMTI4IDE3NiBDMTUwIDE3OCAxNjggMTgwIDE4MCAxODIgTDE4MCAxMzAgQzE4MCAxMDggMTk2IDk2IDIxNCA5NiBDMjMyIDk2IDI0OCAxMDggMjQ4IDEzMCBMMjQ4IDE4MiBDMzAwIDE4MCAzNDAgMTg0IDM4MCAxODIgTDM4MCAyMDUgTDcyMCAyMDUgTDcyMCAyMjBaIi8+CjwhLS0gbWluYXJldCAtLT4KPHJlY3QgeD0iMTUwIiB5PSI5NiIgd2lkdGg9IjciIGhlaWdodD0iOTAiLz4KPHBhdGggZD0iTTE0OSA5NmMwLTYgNC41LTkgNC41LTlzNC41IDMgNC41IDl6Ii8+CjxyZWN0IHg9IjE1Mi41IiB5PSI4MCIgd2lkdGg9IjIiIGhlaWdodD0iOCIvPgo8IS0tIGRvbWUgZmluaWFsIC0tPgo8cmVjdCB4PSIyMzAiIHk9IjgwIiB3aWR0aD0iMyIgaGVpZ2h0PSIxOCIvPjxwYXRoIGQ9Ik0yMzEuNSA4MGEzLjUgMy41IDAgMTAwLTYgNCA0IDAgMDEwIDZ6Ii8+CjwhLS0gcmlnaHQgc21hbGwgZG9tZXMgLyBjaXR5IC0tPgo8cGF0aCBkPSJNNTYwIDIwNSBWMTc2IEM1NjAgMTY0IDU2OCAxNTggNTc2IDE1OCBDNTg0IDE1OCA1OTIgMTY0IDU5MiAxNzYgTDU5MiAyMDVaIi8+CjxyZWN0IHg9IjYyMCIgeT0iMTY4IiB3aWR0aD0iNSIgaGVpZ2h0PSIzNyIvPgo8cGF0aCBkPSJNNDcwIDIwNSB2LTI0IGExMCAxMCAwIDAxMjAgMCB2MjRaIi8+CjwvZz4KPC9zdmc+");
        --nida-pattern-img: url("data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyMjAiIGhlaWdodD0iMjIwIiB2aWV3Qm94PSIwIDAgMjIwIDIyMCI+PGcgZmlsbD0iI2M5ZDJmZiI+PGNpcmNsZSBjeD0iMzAiIGN5PSI0MCIgcj0iMSIgb3BhY2l0eT0iMC41Ii8+PGNpcmNsZSBjeD0iMTIwIiBjeT0iMjAiIHI9IjAuOCIgb3BhY2l0eT0iMC4zNSIvPjxjaXJjbGUgY3g9IjE4MCIgY3k9IjcwIiByPSIxLjEiIG9wYWNpdHk9IjAuNSIvPjxjaXJjbGUgY3g9IjcwIiBjeT0iMTEwIiByPSIwLjciIG9wYWNpdHk9IjAuMyIvPjxjaXJjbGUgY3g9IjE1MCIgY3k9IjE1MCIgcj0iMSIgb3BhY2l0eT0iMC40NSIvPjxjaXJjbGUgY3g9IjIwMCIgY3k9IjEyMCIgcj0iMC44IiBvcGFjaXR5PSIwLjM1Ii8+PGNpcmNsZSBjeD0iNDAiIGN5PSIxODAiIHI9IjAuOSIgb3BhY2l0eT0iMC40Ii8+PGNpcmNsZSBjeD0iMTAwIiBjeT0iMjAwIiByPSIwLjciIG9wYWNpdHk9IjAuMyIvPjwvZz48L3N2Zz4=");
        --nida-pattern-opacity: 0.7;
        display: block;
        min-height: 100%;
        background: var(--nida-bg);
        color: var(--nida-text);
        font-family: 'Inter', sans-serif;
      }

      /* Light theme — explicit selection in the panel header.
         2.0.72 — reskinned to the warm-cream + sage-green mockup. The
         accent tokens keep their --nida-gold* names for cascade
         compatibility but hold green values here; --nida-gold-bright is
         the deep pop green (countdown, next-prayer), --nida-gold the
         medium sage accent (icons), --nida-gold-soft a hairline sage.
         text-dim tuned to #6D7568 for WCAG AA (>=4.5:1 on cream/white). */
      :host(.theme-light) {
        --nida-bg: #FAFAF2;
        --nida-surface: #ffffff;
        --nida-surface-raised: #DDE8CF;
        --nida-gold: #5B7F46;
        --nida-gold-soft: #E7EBD9;
        --nida-gold-bright: #4E6E3B;
        --nida-text: #243024;
        --nida-text-dim: #6D7568;
        --nida-border: #E7EBD9;
        /* 2.0.73 — Scandinavian light theme: rounded, airy, soft shadow,
           ambient green glow behind the hero, flat-vector landscape. */
        --nida-radius: 24px;
        --nida-display-font: 'Manrope', 'Inter', sans-serif;
        --nida-card-shadow: 0 4px 18px rgba(0, 0, 0, 0.06);
        --nida-hero-shadow: 0 6px 22px rgba(0, 0, 0, 0.06);
        --nida-now-bg: linear-gradient(160deg, #ffffff, #f5f8ef);
        --nida-now-icon-display: none;
        --nida-now-lattice-opacity: 0;
        --nida-countdown: var(--nida-gold-bright);
        --nida-eyebrow: var(--nida-text-dim);
        /* 2.0.85 — no ring; lighter translucent fill + glyph. */
        --nida-mute-bg: rgba(221, 232, 207, 0.45);
        --nida-mute-border: none;
        --nida-mute-icon: rgba(78, 110, 59, 0.55);
        --nida-mute-right: 28px;
        --nida-motif-opacity: 0;
        --nida-sky-opacity: 0;
        --nida-pattern-img: url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="56" height="56" viewBox="0 0 56 56"><g fill="none" stroke="%235B7F46" stroke-width="1"><path d="M28 2 L34 14 L48 8 L42 22 L54 28 L42 34 L48 48 L34 42 L28 54 L22 42 L8 48 L14 34 L2 28 L14 22 L8 8 L22 14 Z"/></g></svg>');
        --nida-pattern-opacity: 0.02;
        --nida-app-illust: var(--img-appbg);
      }

      /* Ramadan edition — auto-activated during Hijri month 9 (see
         _currentTheme). Deep-emerald night + gold from the approved mockup
         legend. Green is the countdown colour (--nida-gold-bright), gold the
         accent/active colour (--nida-gold). Uses a bespoke emerald night hero
         (--img-heroramadan: crescent, hanging lantern, mosque over a warm
         horizon glow, palms, stars); the starfield pattern is inherited from
         :host. Dark and light themes are untouched. */
      :host(.theme-ramadan-dark) {
        --nida-bg: #08140F;
        --nida-surface: #11241B;
        --nida-surface-raised: #163327;
        --nida-gold: #C9A227;
        --nida-gold-soft: #2A3E30;
        --nida-gold-bright: #36D98A;
        --nida-text: #F5F7F5;
        --nida-text-dim: #A7B3A7;
        --nida-border: rgba(246, 194, 74, 0.15);
        --nida-radius: 18px;
        --img-heroramadan: url("data:image/webp;base64,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");
        --nida-now-bg: linear-gradient(90deg, rgba(4, 12, 8, 0.78) 0%, rgba(4, 12, 8, 0.38) 46%, rgba(4, 12, 8, 0.06) 100%), var(--img-heroramadan) center / cover no-repeat, linear-gradient(160deg, #0c1d15, #0a3f2a);
        --nida-now-icon-display: none;
        --nida-next-border: 1px solid var(--nida-gold);
        --nida-next-bar: none;
        --nida-next-radius: 12px;
        --nida-next-glow: 0 0 18px rgba(201, 162, 39, 0.22);
        --nida-now-lattice-opacity: 0;
        --nida-countdown: var(--nida-gold-bright);
        --nida-eyebrow: var(--nida-gold);
        --nida-mute-bg: rgba(54, 217, 138, 0.16);
        --nida-mute-border: none;
        --nida-mute-icon: rgba(54, 217, 138, 0.85);
        --nida-mute-right: 28px;
        --nida-motif-opacity: 0.5;
        --nida-sky-opacity: 1;
        --nida-card-shadow: 0 10px 30px rgba(0, 0, 0, 0.4);
        --nida-hero-shadow: 0 14px 44px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(201, 162, 39, 0.18);
        --nida-app-illust: none;
      }

      /* 2.0.88 — Ramadan, light variant. Cream/sage base (matching the
         regular light theme so the month feels like *your* panel, only
         dressed up), gold Ramadan accents, and its own watercolor
         daylight hero (embedded WebP) with a white left scrim so the
         now-card text stays readable over the illustration. */
      :host(.theme-ramadan-light) {
        --nida-bg: #FAFAF2;
        --nida-surface: #ffffff;
        --nida-surface-raised: #DDE8CF;
        --nida-gold: #A67C1A;
        --nida-gold-soft: #E7EBD9;
        --nida-gold-bright: #4E6E3B;
        --nida-text: #243024;
        --nida-text-dim: #6D7568;
        --nida-border: #E7EBD9;
        --nida-radius: 24px;
        --nida-display-font: 'Manrope', 'Inter', sans-serif;
        --img-heroramadanlight: url("data:image/webp;base64,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");
        --nida-now-bg: linear-gradient(90deg, rgba(255, 255, 255, 0.82) 0%, rgba(255, 255, 255, 0.42) 46%, rgba(255, 255, 255, 0.04) 100%), var(--img-heroramadanlight) center / cover no-repeat, linear-gradient(160deg, #ffffff, #f5f8ef);
        --nida-now-icon-display: none;
        --nida-next-border: 1px solid #C9B36A;
        --nida-next-bar: none;
        --nida-next-radius: 12px;
        --nida-next-glow: none;
        --nida-now-lattice-opacity: 0;
        --nida-countdown: var(--nida-gold-bright);
        --nida-eyebrow: var(--nida-text-dim);
        --nida-mute-bg: rgba(221, 232, 207, 0.45);
        --nida-mute-border: none;
        --nida-mute-icon: rgba(78, 110, 59, 0.55);
        --nida-mute-right: 28px;
        --nida-motif-opacity: 0.35;
        --nida-sky-opacity: 0;
        --nida-card-shadow: 0 4px 18px rgba(0, 0, 0, 0.06);
        --nida-hero-shadow: 0 6px 22px rgba(0, 0, 0, 0.08), 0 0 0 1px rgba(166, 124, 26, 0.14);
        --nida-app-illust: none;
      }

      /* 2.0.88 — the photorealistic heroes need more breathing room than
         the flat gradients; give the now-card a minimum height in both
         Ramadan variants so the scene reads as a scene. */
      :host(.theme-ramadan-dark) .now-card,
      :host(.theme-ramadan-light) .now-card {
        min-height: 200px;
        display: flex;
        flex-direction: column;
        justify-content: space-between;
      }

      /* Auto follows the OS preference. 2.0.72 — cream + sage-green to
         match the explicit light theme above. */
      @media (prefers-color-scheme: light) {
        :host(.theme-auto) {
          --nida-bg: #FAFAF2;
          --nida-surface: #ffffff;
          --nida-surface-raised: #DDE8CF;
          --nida-gold: #5B7F46;
          --nida-gold-soft: #E7EBD9;
          --nida-gold-bright: #4E6E3B;
          --nida-text: #243024;
          --nida-text-dim: #6D7568;
          --nida-border: #E7EBD9;
          --nida-radius: 24px;
          --nida-display-font: 'Manrope', 'Inter', sans-serif;
          --nida-card-shadow: 0 4px 18px rgba(0, 0, 0, 0.06);
          --nida-hero-shadow: 0 6px 22px rgba(0, 0, 0, 0.06);
          --nida-now-bg: linear-gradient(160deg, #ffffff, #f5f8ef);
          --nida-now-icon-display: none;
          --nida-now-lattice-opacity: 0;
          --nida-countdown: var(--nida-gold-bright);
          --nida-eyebrow: var(--nida-text-dim);
          /* 2.0.85 — no ring; lighter translucent fill + glyph. */
          --nida-mute-bg: rgba(221, 232, 207, 0.45);
          --nida-mute-border: none;
          --nida-mute-icon: rgba(78, 110, 59, 0.55);
          --nida-mute-right: 28px;
          --nida-motif-opacity: 0;
          --nida-sky-opacity: 0;
          --nida-pattern-img: url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="56" height="56" viewBox="0 0 56 56"><g fill="none" stroke="%235B7F46" stroke-width="1"><path d="M28 2 L34 14 L48 8 L42 22 L54 28 L42 34 L48 48 L34 42 L28 54 L22 42 L8 48 L14 34 L2 28 L14 22 L8 8 L22 14 Z"/></g></svg>');
          --nida-pattern-opacity: 0.02;
          --nida-app-illust: var(--img-appbg);
        }
      }
      * { box-sizing: border-box; margin: 0; padding: 0; }
      button { font-family: inherit; cursor: pointer; }

      /* 2.0.72 — honour the OS reduced-motion preference (WCAG 2.3.3). */
      @media (prefers-reduced-motion: reduce) {
        *, *::before, *::after {
          animation-duration: 0.01ms !important;
          animation-iteration-count: 1 !important;
          transition-duration: 0.01ms !important;
          scroll-behavior: auto !important;
        }
      }

      .app {
        /* 2.0.76 — full-bleed: .app spans the full panel width. Content is
           re-centred via max-width on the children below.
           2.0.82 — the illustration moved off this element (see .app-bg): a
           background on .app rescaled/shifted whenever the box grew on
           section expand. .app now carries only the flat theme colour, which
           fills the full (growing) height with no visible motion. */
        width: 100%;
        min-height: 100vh;
        background: var(--nida-bg);
        position: relative;
        overflow: hidden;
      }
      /* 2.0.82 — the landscape illustration on its own fixed-height layer,
         pinned to the top of the panel and sized to the viewport (100vh)
         rather than the growing .app. Because its height is constant, the
         cover-scaled image renders identically no matter how many sections
         are open. Sits behind the content (z-index 0 + content at z-index 1);
         light theme only via --nida-app-illust, dark leaves it 'none'. */
      .app-bg {
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        height: 100vh;
        background: var(--nida-app-illust, none) left bottom / cover no-repeat;
        /* 2.0.92 — fade the bottom of the illustration to transparent instead of
           letting it stop dead at the 100vh edge, so the flat --nida-bg colour
           eases in rather than cutting off in a hard line. */
        mask-image: linear-gradient(to bottom, #000 0%, #000 55%, transparent 92%);
        -webkit-mask-image: linear-gradient(to bottom, #000 0%, #000 55%, transparent 92%);
        pointer-events: none;
        z-index: 0;
      }
      /* 2.0.76 — content stays centred at the old 1180 max-width while the
         illustration behind it runs edge to edge. 2.0.82 — content also gets
         its own stacking level so it paints above .app-bg (illustration) and
         below pattern-overlay / sky-decor (the faint top layers). */
      .app > .header,
      .app > .layout,
      .app > .footer-support,
      .app > .footer-note {
        max-width: 1180px;
        margin-left: auto;
        margin-right: auto;
        position: relative;
        z-index: 1;
      }

      /* 8-pointed-star lattice watermark. 2.0.73 — colour + opacity come
         from theme vars (gold in dark, subtle green in light). */
      .pattern-overlay {
        /* 2.0.82 — fixed 100vh top-anchored (was inset:0) so the tiled
           watermark stops extending/shifting as the page grows. z-index 2
           keeps it as a faint layer above the content, as before. */
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        height: 100vh;
        opacity: var(--nida-pattern-opacity, 0.06);
        background-image: var(--nida-pattern-img);
        background-size: 56px 56px;
        pointer-events: none;
        z-index: 2;
      }

      /* 2.0.79 — sky decoration: twinkling stars + a few very faint,
         slowly drifting clouds. Dark (night) theme only; toggled off in
         light via --nida-sky-opacity: 0. Purely decorative, so it's
         aria-hidden and also silenced by the reduced-motion rule above. */
      .sky-decor {
        /* 2.0.82 — fixed 100vh top-anchored (was inset:0) so the percent-
           placed stars stop redistributing as the page grows. z-index 2
           keeps the twinkle above the content, as before. */
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        height: 100vh;
        overflow: hidden;
        pointer-events: none;
        z-index: 2;
        opacity: var(--nida-sky-opacity, 1);
      }
      .star {
        position: absolute;
        left: var(--x);
        top: var(--y);
        width: var(--size);
        height: var(--size);
        border-radius: 50%;
        background: #F8F8FA;
        box-shadow: 0 0 4px rgba(248, 248, 250, 0.6);
        opacity: 0.2;
        animation: nida-twinkle var(--dur) ease-in-out infinite;
        animation-delay: var(--delay);
      }
      @keyframes nida-twinkle {
        0%, 100% { opacity: 0.15; transform: scale(0.85); }
        50% { opacity: 0.95; transform: scale(1.2); }
      }
      .cloud {
        position: absolute;
        border-radius: 50%;
        background: rgba(248, 248, 250, 0.05);
        filter: blur(22px);
        animation: nida-drift linear infinite;
      }
      .cloud-a { width: 260px; height: 70px; top: 6%;  left: -25%; animation-duration: 110s; }
      .cloud-b { width: 200px; height: 56px; top: 16%; left: -45%; animation-duration: 150s; animation-delay: -40s; }
      .cloud-c { width: 320px; height: 90px; top: 3%;  left: -35%; animation-duration: 190s; animation-delay: -90s; }
      @keyframes nida-drift {
        from { transform: translateX(0); }
        to   { transform: translateX(140vw); }
      }

      .header {
        position: relative;
        z-index: 1;
        padding: 28px 20px 20px;
        border-bottom: 1px solid var(--nida-border);
      }
      .header-row {
        display: flex;
        align-items: center;
        justify-content: space-between;
      }
      .brand { display: flex; align-items: center; gap: 10px; }
      .brand-mark {
        width: 36px;
        height: 36px;
        border-radius: 9px;
        background: linear-gradient(135deg, var(--nida-surface-raised), var(--nida-surface));
        /* 2.0.72 — accent-coloured rim + soft lift so the mark reads as a
           distinct tile (gold in dark, sage-green in the light theme). */
        border: 1px solid var(--nida-gold);
        box-shadow: 0 1px 6px rgba(0, 0, 0, 0.06);
        display: flex;
        align-items: center;
        justify-content: center;
      }
      .brand-mark svg { width: 20px; height: 20px; stroke: var(--nida-gold-bright); }
      .brand-title {
        font-family: var(--nida-display-font, 'Cairo', sans-serif);
        font-weight: 700;
        font-size: 21px;
        letter-spacing: 0.3px;
        color: var(--nida-text);
      }
      .brand-title sup {
        font-size: 12px;
        position: relative;
        top: -0.4em;
        left: 0px;
      }
      .lang-pill {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        background: var(--nida-surface);
        /* 2.0.72 — sage/gold rim gives the header buttons more presence. */
        border: 1px solid var(--nida-gold-soft);
        border-radius: 20px;
        padding: 7px 12px;
        font-size: 13px;
        color: var(--nida-text-dim);
        cursor: pointer;
      }
      .lang-pill svg { width: 14px; height: 14px; stroke: var(--nida-gold); }
      .lang-pill:hover { border-color: var(--nida-gold-soft); color: var(--nida-text); }
      /* 2.0.86 — Ramadan badge: a static (non-clickable) variant of the
         header pill, tinted with the gold accent to read as a marker. */
      .lang-pill.theme-badge { cursor: default; border-color: var(--nida-gold-soft); }
      .lang-pill.theme-badge:hover { color: var(--nida-text-dim); }
      .header-pills { display: inline-flex; gap: 8px; align-items: center; }
      .theme-glyph {
        font-size: 14px;
        color: var(--nida-gold);
        line-height: 1;
      }

      .border-motif {
        height: 8px;
        margin-top: 18px;
        background-image: url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="24" height="8" viewBox="0 0 24 8"><path d="M0 1 Q6 1 6 7 Q6 1 12 1 Q18 1 18 7 Q18 1 24 1" fill="none" stroke="%23c9a227" stroke-width="1"/></svg>');
        background-size: 24px 8px;
        background-repeat: repeat-x;
        opacity: var(--nida-motif-opacity, 0.5);
      }

      .layout {
        position: relative;
        z-index: 1;
        display: grid;
        /* 2.0.25 — columns swapped (companion left 1fr, settings right
           1.3fr). DOM order was also flipped to match; CSS-only swap via
           grid-area would have worked, but flipping the DOM keeps the
           tab-order and screen-reader sequence intuitive (visual layout
           and source order agree). */
        grid-template-columns: 1fr 1.3fr;
        gap: 0;
        align-items: stretch;
      }
      .col-settings {
        padding: 28px 32px 48px;
        border-left: 1px solid var(--nida-border);
      }
      /* 2.0.65 — the companion column aligns with the vertical centre
         of the first section icon (the "balletje"). col-settings has
         28px top padding; the section-head icon is 30px tall, so its
         centre sits at 28 + 15 = 43px. The first companion card should
         start at that same 28px so the top of the card meets the top of
         the section-head line. */
      .col-companion {
        padding: 28px 28px 48px;
        display: flex;
        flex-direction: column;
        gap: 20px;
        min-height: 100%;
      }

      /* 2.0.27 — drag-to-reorder companion cards. .card-slot wraps each
         card and is the actual draggable element; the inner card is
         decorative. .drag-handle is a small grip icon top-right inside
         the slot, only visible on hover (to keep the resting state
         clean). The whole slot is draggable, not just the handle —
         handle is a visual affordance, you can pick the card anywhere.
         Cursor: grab to signal it's movable. */
      .card-slot {
        position: relative;
        cursor: grab;
        transition: opacity 120ms ease, transform 120ms ease;
      }
      .card-slot:active { cursor: grabbing; }
      .card-slot.dragging {
        opacity: 0.4;
        transform: scale(0.98);
      }
      .card-slot.drop-target > *:not(.drag-handle) {
        box-shadow: 0 -3px 0 0 var(--nida-gold) inset, 0 0 0 1px var(--nida-gold);
      }
      .drag-handle {
        position: absolute;
        top: 8px;
        right: 8px;
        width: 22px;
        height: 22px;
        display: flex;
        align-items: center;
        justify-content: center;
        color: var(--nida-text-dim);
        opacity: 0;
        transition: opacity 150ms ease;
        pointer-events: none;
        z-index: 2;
      }
      .drag-handle svg { width: 16px; height: 16px; }
      .card-slot:hover .drag-handle { opacity: 0.6; }
      .card-slot.dragging .drag-handle { opacity: 0; }
      .content {
        display: flex;
        flex-direction: column;
        gap: 22px;
      }

      .section-head {
        display: flex;
        align-items: center;
        gap: 10px;
        margin-bottom: 10px;
      }
      .section-icon {
        width: 30px;
        height: 30px;
        border-radius: 50%;
        background: var(--nida-surface-raised);
        border: 1px solid var(--nida-gold-soft);
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
      }
      .section-icon svg { width: 16px; height: 16px; stroke: var(--nida-gold-bright); }
      .section-title {
        font-family: var(--nida-display-font, 'Cairo', sans-serif);
        font-weight: 600;
        font-size: 15px;
        color: var(--nida-text);
        flex: 1;
      }

      /* Accordion behaviour for <details> sections (2.0.23).
         The native disclosure-marker is suppressed via summary { list-style: none }
         and the ::-webkit-details-marker pseudo. Our own chevron rotates on [open]
         for the open-state affordance. cursor:pointer + a small hover/active
         feedback to make the whole header feel clickable. */
      details.section { display: block; }
      details.section > summary {
        cursor: pointer;
        list-style: none;
        -webkit-tap-highlight-color: transparent;
        user-select: none;
      }
      details.section > summary::-webkit-details-marker { display: none; }
      details.section > summary:hover .section-title { color: var(--nida-gold-bright); }
      .section-chevron {
        margin-left: auto;
        display: flex;
        align-items: center;
        justify-content: center;
        width: 24px;
        height: 24px;
        transition: transform 180ms ease;
        color: var(--nida-text-soft, var(--nida-text));
        opacity: 0.6;
      }
      .section-chevron svg {
        width: 16px;
        height: 16px;
        stroke: currentColor;
      }
      details.section[open] > summary .section-chevron {
        transform: rotate(180deg);
      }
      /* Subtle fade-in on open. No height-tween — that would need a JS
         measurement of content height to look right, which isn't worth
         the complexity here. */
      details.section[open] > .card {
        animation: nida-section-fade-in 180ms ease;
      }
      @keyframes nida-section-fade-in {
        from { opacity: 0; transform: translateY(-2px); }
        to   { opacity: 1; transform: none; }
      }

      /* Subgroup header inside a card — used by Sounds in 2.0.23 to
         separate Adhan / Pre-adhan / Night mode without splitting into
         three cards. Visually lighter than .section-title; sits between
         rows like a divider with a label. */
      .sounds-group-head {
        padding: 12px 16px 8px 16px;
        font-family: var(--nida-display-font, 'Cairo', sans-serif);
        font-size: 11px;
        font-weight: 700;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        color: var(--nida-gold-bright);
        background: var(--nida-surface-raised, rgba(0,0,0,0.05));
        border-bottom: 1px solid var(--nida-border);
      }
      .sounds-group-head:not(:first-child) {
        border-top: 1px solid var(--nida-border);
      }

      .card {
        background: var(--nida-surface);
        border: 1px solid var(--nida-border);
        border-radius: var(--nida-radius);
        overflow: hidden;
        box-shadow: var(--nida-card-shadow, none);
      }

      .row {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 14px 16px;
        border-bottom: 1px solid var(--nida-border);
      }
      .row:last-child { border-bottom: none; }
      .row-label {
        font-size: 14px;
        color: var(--nida-text);
        font-weight: 500;
      }
      .row-sub {
        font-size: 12px;
        color: var(--nida-text-dim);
        margin-top: 2px;
      }
      .row-sub.random-active {
        /* 2.0.55 — random adhan overrides the fixed pick; render the
           note in the accent gold + italic so the changed behaviour is
           visible at a glance. */
        color: var(--nida-gold-bright);
        font-style: italic;
      }
      .card-note {
        /* 2.0.48 — quiet informational line at the top of a card (used
           for the fard reminder in the Prayers section). */
        padding: 12px 16px 6px;
        font-size: 12px;
        line-height: 1.5;
        color: var(--nida-text-dim);
        border-bottom: 1px solid var(--nida-border);
      }
      .row-info {
        display: flex;
        flex-direction: column;
        flex: 1;
        min-width: 0;
      }
      .subsection-head {
        padding: 10px 16px 6px;
        font-size: 11px;
        color: var(--nida-gold-soft);
        text-transform: uppercase;
        letter-spacing: 0.5px;
        border-top: 1px solid var(--nida-border);
        margin-top: 4px;
      }

      .test-row {
        padding: 14px 16px;
        border-top: 1px solid var(--nida-border);
        display: flex;
        justify-content: flex-end;
      }
      .test-btn {
        background: transparent;
        border: 1px solid var(--nida-gold-soft);
        color: var(--nida-gold-bright);
        font-family: inherit;
        font-size: 13px;
        font-weight: 500;
        padding: 8px 16px;
        border-radius: 8px;
        cursor: pointer;
        transition: background 0.12s, border-color 0.12s;
      }
      .test-btn:hover:not(:disabled) {
        background: var(--nida-surface-raised);
        border-color: var(--nida-gold);
      }
      .test-btn:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }
      .test-btn.test-success {
        border-color: var(--nida-gold);
        background: var(--nida-surface-raised);
      }
      .test-btn.test-error {
        border-color: #b8543b;
        color: #f5b6a3;
      }
      .time-input {
        background: var(--nida-surface-raised);
        border: 1px solid var(--nida-border);
        border-radius: 8px;
        color: var(--nida-text);
        font-family: inherit;
        font-size: 14px;
        padding: 6px 10px;
        color-scheme: dark;
      }
      :host(.theme-light) .time-input { color-scheme: light; }
      @media (prefers-color-scheme: light) {
        :host(.theme-auto) .time-input { color-scheme: light; }
      }

      .seg-control {
        display: flex;
        background: var(--nida-bg);
        border-radius: 9px;
        padding: 3px;
        gap: 3px;
        margin: 14px 16px;
      }
      .seg-btn {
        flex: 1;
        text-align: center;
        padding: 8px 0;
        font-size: 12.5px;
        font-weight: 500;
        color: var(--nida-text-dim);
        border-radius: 7px;
        cursor: pointer;
        user-select: none;
      }
      .seg-btn.active {
        background: var(--nida-surface-raised);
        color: var(--nida-gold-bright);
      }
      .text-field {
        margin: 0 16px 14px;
        display: flex;
        flex-direction: column;
        gap: 6px;
      }
      .text-field label {
        font-size: 12px;
        color: var(--nida-text-dim);
        text-transform: uppercase;
        letter-spacing: 0.5px;
      }
      .text-field input {
        background: var(--nida-bg);
        border: 1px solid var(--nida-border);
        border-radius: 9px;
        padding: 10px 12px;
        font-size: 14px;
        color: var(--nida-text);
        font-family: inherit;
        outline: none;
      }
      .text-field input:focus { border-color: var(--nida-gold-soft); }
      .notify-title-fixed {
        /* 2.0.70 — non-editable notification title display. */
        font-size: 14px;
        color: var(--nida-text);
        padding: 8px 0 4px;
      }

      .city-field { position: relative; }
      .city-suggestions {
        position: absolute;
        left: 0;
        right: 0;
        top: 100%;
        margin-top: 4px;
        background: var(--nida-surface);
        border: 1px solid var(--nida-gold-soft);
        border-radius: 9px;
        z-index: 50;
        max-height: 260px;
        overflow-y: auto;
        box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4);
      }
      .city-suggestion {
        padding: 10px 14px;
        cursor: pointer;
        border-bottom: 1px solid var(--nida-border);
      }
      .city-suggestion:last-child { border-bottom: none; }
      .city-suggestion:hover { background: var(--nida-surface-raised); }
      .city-suggestion-name {
        color: var(--nida-gold-bright);
        font-weight: 500;
        font-size: 14px;
      }
      .city-suggestion-sub {
        color: var(--nida-text-dim);
        font-size: 12px;
        margin-top: 2px;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      .select-field {
        margin: 0 16px 16px;
        display: flex;
        align-items: center;
        justify-content: space-between;
        background: var(--nida-bg);
        border: 1px solid var(--nida-border);
        border-radius: 9px;
        padding: 11px 14px;
        font-size: 14px;
        color: var(--nida-text);
        cursor: pointer;
      }
      .select-field:hover { border-color: var(--nida-gold-soft); }

      /* 2.1.0 — Setup section: three entry-mode buttons (manual / auto /
         restore backup). Same box-in-a-box look as .select-field, but a
         real <button> so it needs its own reset (text-align, width,
         font inheritance) plus room for a two-line label. */
      .setup-intro {
        margin: 0 16px 12px;
      }
      .setup-options {
        display: flex;
        flex-direction: column;
        gap: 10px;
        margin: 0 16px 16px;
      }
      .setup-option-btn {
        display: block;
        width: 100%;
        text-align: left;
        font: inherit;
        background: var(--nida-bg);
        border: 1px solid var(--nida-border);
        border-radius: 9px;
        padding: 12px 14px;
        color: var(--nida-text);
        cursor: pointer;
      }
      .setup-option-btn:hover { border-color: var(--nida-gold-soft); }
      .setup-option-title {
        font-weight: 600;
        font-size: 14px;
        margin-bottom: 2px;
      }
      .setup-option-sub {
        font-size: 12px;
        color: var(--nida-text-dim);
        line-height: 1.4;
      }
      .setup-export-row {
        margin: 0 16px 16px;
        text-align: center;
      }
      .setup-export-link {
        background: transparent;
        border: none;
        font: inherit;
        font-size: 12px;
        color: var(--nida-text-dim);
        cursor: pointer;
        display: inline-flex;
        align-items: center;
        gap: 6px;
      }
      .setup-export-link:hover { color: var(--nida-gold-bright); }

      /* 2.1.0 — inline setup wizard. Replaces the whole section list in
         col-settings while active (see _html()); reuses .card/.toggle/
         .select-field etc. from the single section it renders via
         .setup-wizard-body — no separate styling needed for those. */
      .setup-wizard-inline {
        display: flex;
        flex-direction: column;
        gap: 4px;
      }
      .setup-wizard-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 0 2px;
      }
      .setup-wizard-title {
        font-family: var(--nida-display-font, 'Cairo', sans-serif);
        font-weight: 600;
        font-size: 15px;
        color: var(--nida-text);
      }
      .setup-wizard-progress {
        font-size: 12px;
        color: var(--nida-text-dim);
        padding: 0 2px 8px;
      }
      .setup-wizard-nav {
        display: flex;
        justify-content: space-between;
        gap: 10px;
        padding-top: 8px;
      }

      /* Flat variant — used when a select-field is the only/primary row
         in a card, where the standard "box-in-a-box" look would feel
         too heavy (e.g. Speakers, Notify targets, Jumu'ah targets).
         Renders inline as a card row instead of as its own bordered
         sub-element. */
      .select-field.flat {
        margin: 0;
        background: transparent;
        border: 0;
        border-radius: 0;
        padding: 14px 16px;
      }
      .select-field.flat:hover {
        background: var(--nida-surface-raised);
        border: 0;
      }
      .select-value {
        color: var(--nida-gold-bright);
        font-weight: 500;
        display: inline-flex;
        align-items: center;
        gap: 6px;
      }
      .select-value svg { width: 14px; height: 14px; stroke: var(--nida-gold); }

      .resolved-location {
        margin: 0 16px 16px;
        display: flex;
        align-items: center;
        gap: 12px;
        background: var(--nida-bg);
        border: 1px solid var(--nida-gold-soft);
        border-radius: 9px;
        padding: 11px 14px;
      }
      .resolved-location-icon {
        width: 24px;
        height: 24px;
        border-radius: 50%;
        border: 1px solid var(--nida-gold-soft);
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
      }
      .resolved-location-icon svg {
        width: 12px;
        height: 12px;
        stroke: var(--nida-gold-bright);
      }
      .resolved-location-body { flex: 1; min-width: 0; }
      .resolved-location-primary {
        color: var(--nida-gold-bright);
        font-weight: 500;
        font-size: 14px;
      }
      .resolved-location-sub {
        color: var(--nida-text-dim);
        font-size: 12px;
        margin-top: 2px;
      }
      .toggle {
        width: 42px;
        height: 24px;
        border-radius: 12px;
        background: var(--nida-bg);
        border: 1px solid var(--nida-border);
        position: relative;
        flex-shrink: 0;
        cursor: pointer;
      }
      .toggle.on { background: var(--nida-gold-soft); border-color: var(--nida-gold); }
      .toggle-knob {
        width: 18px;
        height: 18px;
        border-radius: 50%;
        background: var(--nida-text-dim);
        position: absolute;
        top: 2px;
        left: 2px;
        transition: left 0.15s, background 0.15s;
      }
      .toggle.on .toggle-knob { left: 21px; background: var(--nida-gold-bright); }

      /* 2.0.89 — per-prayer critical toggle. Each Notifications row now
         holds the existing normal on/off toggle PLUS, only while that
         prayer's notification is on, a small square icon-toggle for
         "critical". Kept as a separate compact control rather than a
         second full-size toggle so five rows don't turn into ten. */
      .notify-critical-hint {
        font-size: 12px;
        color: var(--nida-text-dim);
        padding: 0 16px 10px;
        line-height: 1.5;
      }
      .notify-prayer-row { gap: 12px; }
      .notify-prayer-toggles {
        display: flex;
        align-items: center;
        gap: 10px;
        flex-shrink: 0;
      }
      .toggle-mini {
        width: 26px;
        height: 26px;
        border-radius: 8px;
        background: var(--nida-bg);
        border: 1px solid var(--nida-border);
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
        cursor: pointer;
      }
      .toggle-mini svg {
        width: 14px;
        height: 14px;
        stroke: var(--nida-text-dim);
      }
      .toggle-mini.critical.on {
        background: var(--nida-critical-soft);
        border-color: var(--nida-critical);
      }
      .toggle-mini.critical.on svg { stroke: var(--nida-critical); }
      .toggle-mini.test-mini svg { stroke: var(--nida-text-dim); }
      .toggle-mini.test-mini:hover svg { stroke: var(--nida-gold-bright); }
      .toggle-mini.test-mini.test-busy { opacity: 0.5; cursor: default; }
      .toggle-mini.test-mini.test-success {
        background: var(--nida-gold-soft);
        border-color: var(--nida-gold);
      }
      .toggle-mini.test-mini.test-success svg { stroke: var(--nida-gold-bright); }
      .toggle-mini.test-mini.test-error {
        background: var(--nida-critical-soft);
        border-color: var(--nida-critical);
      }
      .toggle-mini.test-mini.test-error svg { stroke: var(--nida-critical); }
      .toggle-mini.disabled { opacity: 0.35; cursor: default; pointer-events: none; }

      .sound-row {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 14px 16px;
        border-bottom: 1px solid var(--nida-border);
      }
      .sound-row:last-child { border-bottom: none; }
      .sound-info { flex: 1; min-width: 0; }

      .volume-row {
        display: flex;
        align-items: center;
        gap: 10px;
        margin-top: 8px;
      }
      .volume-slider {
        flex: 1;
        -webkit-appearance: none;
        appearance: none;
        height: 4px;
        background: var(--nida-border);
        border-radius: 2px;
        outline: none;
        cursor: pointer;
      }
      .volume-slider::-webkit-slider-thumb {
        -webkit-appearance: none;
        appearance: none;
        width: 16px;
        height: 16px;
        border-radius: 50%;
        background: var(--nida-gold-bright);
        border: 1px solid var(--nida-gold);
        cursor: pointer;
      }
      .volume-slider::-moz-range-thumb {
        width: 16px;
        height: 16px;
        border-radius: 50%;
        background: var(--nida-gold-bright);
        border: 1px solid var(--nida-gold);
        cursor: pointer;
      }
      .volume-value {
        font-size: 12px;
        color: var(--nida-gold-bright);
        font-weight: 500;
        font-variant-numeric: tabular-nums;
        min-width: 38px;
        text-align: right;
      }

      .minutes-row {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 14px 16px;
        border-top: 1px solid var(--nida-border);
      }
      .minutes-row.sub-indent {
        padding-left: 36px;
        position: relative;
      }
      .minutes-row.sub-indent::before {
        content: "↳";
        position: absolute;
        left: 18px;
        top: 18px;
        color: var(--nida-text-dim);
        font-size: 14px;
      }
      .pre-adhan-subhead {
        font-family: var(--nida-display-font, 'Cairo', sans-serif);
        font-size: 10px;
        font-weight: 700;
        letter-spacing: 0.1em;
        text-transform: uppercase;
        color: var(--nida-text-dim);
        padding: 14px 16px 4px;
        border-top: 1px solid var(--nida-border);
      }
      .row.clickable { cursor: pointer; }
      .row.clickable:hover { background: var(--nida-surface-raised); }
      .minutes-input-wrap {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        background: var(--nida-bg);
        border: 1px solid var(--nida-border);
        border-radius: 8px;
        padding: 6px 10px;
      }
      .minutes-input-wrap:focus-within { border-color: var(--nida-gold-soft); }
      .minutes-input {
        background: transparent;
        border: 0;
        outline: 0;
        color: var(--nida-gold-bright);
        font-weight: 500;
        font-size: 14px;
        font-family: inherit;
        width: 44px;
        text-align: right;
        font-variant-numeric: tabular-nums;
      }
      /* Hide spinner buttons in WebKit — they clash with the gold theme */
      .minutes-input::-webkit-outer-spin-button,
      .minutes-input::-webkit-inner-spin-button {
        -webkit-appearance: none;
        margin: 0;
      }
      .minutes-input[type=number] { -moz-appearance: textfield; }
      .minutes-unit {
        font-size: 12px;
        color: var(--nida-text-dim);
      }

      .sound-name {
        font-size: 14px;
        color: var(--nida-text);
        font-weight: 500;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .play-btn {
        width: 34px;
        height: 34px;
        border-radius: 50%;
        background: var(--nida-surface-raised);
        border: 1px solid var(--nida-gold-soft);
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
        cursor: pointer;
      }
      .play-btn svg { width: 14px; height: 14px; fill: var(--nida-gold-bright); stroke: none; }
      .play-btn.disabled {
        /* 2.0.59 — dua play without a media player: visibly inert
           instead of silently failing in the backend. */
        opacity: 0.4;
        pointer-events: none;
        cursor: default;
      }
      .play-btn.playing {
        background: var(--nida-gold);
        border-color: var(--nida-gold-bright);
      }
      .play-btn.playing svg { fill: var(--nida-bg); }
      .play-btn.disabled,
      .chevron-btn.disabled { opacity: 0.4; cursor: not-allowed; }
      /* Invisible placeholder so test rows (which have no chevron because
         they're not navigable) still align their play button under the
         play buttons of sound-rows above. visibility:hidden keeps the
         layout box; display:none would defeat the purpose. */
      .chevron-btn.spacer { visibility: hidden; pointer-events: none; }
      .chevron-btn {
        width: 34px;
        height: 34px;
        border-radius: 50%;
        background: transparent;
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
        cursor: pointer;
      }
      .chevron-btn svg { width: 16px; height: 16px; stroke: var(--nida-text-dim); }

      /* Save toast (2.0.24). Sits inside shadowRoot so it picks up
         our theme tokens. position:fixed is honoured because the host
         element creates a containing block — but to be safe we also
         set top:auto + bottom right. Opacity-only transition for a
         soft fade; no slide-in to keep it unobtrusive. */
      .save-toast {
        position: fixed;
        right: 18px;
        bottom: 18px;
        z-index: 50;
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 8px 14px;
        border-radius: 999px;
        background: var(--nida-surface-raised, rgba(0,0,0,0.85));
        border: 1px solid var(--nida-gold-soft);
        color: var(--nida-text);
        font-family: 'Inter', sans-serif;
        font-size: 13px;
        font-weight: 500;
        box-shadow: 0 6px 20px rgba(0,0,0,0.25);
        opacity: 0;
        pointer-events: none;
        transition: opacity 220ms ease;
      }
      .save-toast.visible { opacity: 1; }
      .save-toast svg {
        width: 16px;
        height: 16px;
        color: var(--nida-gold-bright);
      }

      /* Manual-mode no-coords warning (2.0.24). Amber accent inside
         the Location card. Lives as a card-row equivalent (same horiz
         padding) so it doesn't visually escape the card outline. */
      .manual-warning {
        display: flex;
        gap: 12px;
        padding: 12px 16px;
        background: var(--nida-warning-bg, rgba(218, 165, 32, 0.12));
        border-bottom: 1px solid var(--nida-warning-border, rgba(218, 165, 32, 0.4));
      }
      .manual-warning-icon {
        font-size: 18px;
        line-height: 1.2;
        color: var(--nida-warning-fg, #d4a017);
        flex-shrink: 0;
      }
      .manual-warning-body { flex: 1; min-width: 0; }
      .manual-warning-title {
        font-family: var(--nida-display-font, 'Cairo', sans-serif);
        font-weight: 600;
        font-size: 13px;
        color: var(--nida-text);
        margin-bottom: 2px;
      }
      .manual-warning-text {
        font-size: 12px;
        color: var(--nida-text-dim, var(--nida-text));
        line-height: 1.4;
      }

      /* Companion cards */

      /* 2.1.2 — calendar card: Hijri month grid + upcoming-events list,
         replaces the old bare .hijri-card and approximate .holiday-card.
         Shares its envelope (background/border/radius/padding) and its
         .todo placeholder state with .quote-card via the shared selector
         below — only the grid/upcoming internals are calendar-specific. */
      .calendar-head {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-bottom: 10px;
      }
      .calendar-nav-btn {
        width: 26px;
        height: 26px;
        border-radius: 7px;
        border: 1px solid var(--nida-border);
        background: var(--nida-surface-raised);
        color: var(--nida-text-dim);
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
      }
      .calendar-nav-btn:hover { color: var(--nida-text); border-color: var(--nida-gold-soft); }
      .calendar-nav-btn svg { width: 15px; height: 15px; }
      .calendar-month-title {
        font-family: var(--nida-display-font, 'Cairo', sans-serif);
        font-weight: 700;
        font-size: 14px;
        color: var(--nida-text);
      }
      .calendar-weekdays {
        display: grid;
        grid-template-columns: repeat(7, 1fr);
        margin-bottom: 4px;
      }
      .calendar-weekdays span {
        text-align: center;
        font-size: 10px;
        text-transform: uppercase;
        letter-spacing: 0.4px;
        color: var(--nida-text-dim);
      }
      .calendar-grid {
        display: grid;
        grid-template-columns: repeat(7, 1fr);
        gap: 2px;
      }
      .calendar-day {
        aspect-ratio: 1;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 2px;
        background: none;
        border: none;
        border-radius: 7px;
        color: var(--nida-text);
        font-size: 11.5px;
        cursor: default;
        padding: 0;
      }
      .calendar-day.blank { visibility: hidden; }
      .calendar-day.has-event {
        cursor: pointer;
        background: var(--nida-surface-raised);
      }
      .calendar-day.has-event:hover { background: var(--nida-gold-soft); }
      /* 2.1.3 — the old gold-tint treatment blended into the card
         background too easily ("ik zie niet wat de huidige dag is").
         Today now gets a solid, theme-independent dark-green fill (not
         one of the --nida-gold-* theme variables, which range from gold
         to green to bright-green depending on theme/dark-light/Ramadan
         and wouldn't guarantee contrast) plus a matching ring so it
         reads clearly in every theme. */
      .calendar-day.today {
        background: #1B7A43;
        color: #FFFFFF;
        font-weight: 700;
        box-shadow: 0 0 0 2px #1B7A43;
      }
      .calendar-day.today .calendar-day-num { color: #FFFFFF; }
      .calendar-day-dots {
        display: flex;
        gap: 2px;
        min-height: 4px;
      }
      .calendar-dot {
        width: 4px;
        height: 4px;
        border-radius: 50%;
        background: var(--nida-text-dim);
      }
      .calendar-dot.cat-holiday { background: var(--nida-gold-bright); }
      .calendar-dot.cat-fasting { background: var(--nida-text-dim); }
      .calendar-loading {
        padding: 18px 0;
        text-align: center;
        font-size: 12px;
        color: var(--nida-text-dim);
      }
      .calendar-upcoming {
        margin-top: 14px;
        padding-top: 12px;
        border-top: 1px solid var(--nida-border);
      }
      .calendar-upcoming-title {
        font-size: 11px;
        color: var(--nida-gold);
        text-transform: uppercase;
        letter-spacing: 0.8px;
        font-weight: 600;
        margin-bottom: 8px;
      }
      .calendar-upcoming-item {
        display: flex;
        align-items: center;
        gap: 8px;
        width: 100%;
        background: none;
        border: none;
        padding: 6px 0;
        cursor: pointer;
        color: var(--nida-text);
        text-align: left;
      }
      .calendar-upcoming-item:hover .calendar-upcoming-name { color: var(--nida-gold-bright); }
      .calendar-upcoming-emoji { font-size: 15px; }
      .calendar-upcoming-name {
        flex: 1;
        font-size: 12.5px;
        min-width: 0;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .calendar-upcoming-pill {
        font-size: 11px;
        color: var(--nida-text-dim);
        flex-shrink: 0;
      }
      .calendar-upcoming-empty {
        font-size: 12px;
        color: var(--nida-text-dim);
        font-style: italic;
      }

      .today-card {
        /* 2.0.62 — today's five prayers at a glance. Same envelope as
           the other companion cards. */
        background: var(--nida-surface);
        border: 1px solid var(--nida-gold-soft);
        border-radius: var(--nida-radius);
        padding: 20px 22px 16px;
        box-shadow: var(--nida-card-shadow, none);
      }
      .today-head {
        display: flex;
        justify-content: space-between;
        align-items: baseline;
        margin-bottom: 8px;
      }
      .today-title {
        font-family: var(--nida-display-font, 'Cairo', sans-serif);
        font-weight: 600;
        font-size: 14px;
        color: var(--nida-text);
      }
      .today-hijri {
        font-size: 12px;
        color: var(--nida-text-dim);
      }
      .today-row {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 7px 8px;
        border-bottom: 1px solid var(--nida-border);
        font-size: 13.5px;
        color: var(--nida-text);
      }
      .today-row:last-child { border-bottom: none; }
      .today-row.past { color: var(--nida-text-dim); }
      .today-row.next {
        background: var(--nida-surface-raised);
        border: var(--nida-next-border, none);
        border-left: var(--nida-next-bar, 3px solid var(--nida-gold-bright));
        border-radius: var(--nida-next-radius, 0);
        box-shadow: var(--nida-next-glow, none);
        padding-left: 6px;
        font-weight: 600;
        color: var(--nida-gold-bright);
      }
      .today-name { display: flex; align-items: center; gap: 0; }
      /* 2.0.73 — per-prayer glyph before the name. Upcoming uses the
         accent, the next prayer the deeper accent, completed prayers a
         green check-ring. */
      .today-icon {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 30px;
        flex-shrink: 0;
      }
      .today-icon svg {
        width: 18px; height: 18px;
        stroke: var(--nida-gold);
      }
      .today-row.next .today-icon svg { stroke: var(--nida-gold-bright); }
      .today-row.past .today-icon svg { stroke: var(--nida-gold); }
      .today-check {
        display: inline-flex;
        width: 20px;
      }
      .today-check svg {
        width: 13px; height: 13px;
        stroke: var(--nida-gold-bright);
      }
      .today-check.spacer { width: 20px; }
      .today-remaining {
        font-size: 11.5px;
        font-weight: 400;
        color: var(--nida-text-dim);
      }
      .today-time { font-variant-numeric: tabular-nums; }
      .today-foot {
        display: flex;
        align-items: center;
        margin-top: 8px;
        font-size: 11.5px;
        color: var(--nida-text-dim);
      }
      .today-foot svg {
        width: 12px; height: 12px;
        stroke: var(--nida-text-dim);
        margin-right: 5px;
        vertical-align: -1px;
      }
      .now-card {
        /* Hero card. The background comes from --nida-now-bg (a soft light
           card in light, the flat gradient in dark); the page illustration
           lives on .app behind it. */
        background: var(--nida-now-bg, linear-gradient(160deg, var(--nida-surface-raised), var(--nida-surface)));
        border: 1px solid var(--nida-gold-soft);
        border-radius: var(--nida-radius);
        padding: 26px 28px;
        position: relative;
        overflow: hidden;
        box-shadow: var(--nida-hero-shadow, none);
      }
      .now-card::before {
        content: "";
        position: absolute;
        inset: 0;
        opacity: var(--nida-now-lattice-opacity, 0.08);
        background-image: url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="56" height="56" viewBox="0 0 56 56"><g fill="none" stroke="%23e0bc4a" stroke-width="1"><path d="M28 2 L34 14 L48 8 L42 22 L54 28 L42 34 L48 48 L34 42 L28 54 L22 42 L8 48 L14 34 L2 28 L14 22 L8 8 L22 14 Z"/></g></svg>');
        background-size: 56px 56px;
        pointer-events: none;
      }
      /* 2.0.26 — horizontal compact layout mirroring nida-card's
         .next-block / .next-inner pattern. Icon on the far left, big
         prayer name in the middle-left, countdown right-aligned on
         the same row. The previous tall centered layout (eyebrow
         above big name above "Starts at" above two count boxes) is
         gone — felt overweight for a sidebar card. */
      .now-row {
        position: relative;
        display: flex;
        align-items: center;
        gap: 12px;
      }
      .now-icon {
        width: 48px;
        height: 48px;
        border-radius: 12px;
        background: linear-gradient(135deg, #c9a84c, #a07830);
        /* 2.0.72 — hidden in the light theme, which shows the watercolor
           mosque as a card background instead of this gold emoji tile. */
        display: var(--nida-now-icon-display, flex);
        align-items: center;
        justify-content: center;
        font-size: 24px;
        flex-shrink: 0;
      }
      .now-text {
        flex: 1;
        min-width: 0;
        display: flex;
        flex-direction: column;
      }
      .now-right {
        display: flex;
        flex-direction: column;
        align-items: flex-end;
        text-align: right;
        flex-shrink: 0;
      }
      .now-eyebrow {
        font-size: 10px;
        letter-spacing: 1.5px;
        text-transform: uppercase;
        font-weight: 700;
        color: var(--nida-eyebrow, var(--nida-gold));
        line-height: 1;
        margin-bottom: 4px;
      }
      .now-name {
        font-family: var(--nida-display-font, 'Cairo', sans-serif);
        font-weight: 700;
        font-size: 28px;
        line-height: 1.15;
        color: var(--nida-text);
      }
      /* 2.0.39 — countdown is now HH:MM:SS (8 chars) instead of HH:MM.
         Slightly smaller than .now-name so the extra seconds field fits
         next to the prayer name in the narrow companion column without
         crowding. tabular-nums keeps the digits from jittering as they
         tick. */
      .now-countdown-big {
        font-family: var(--nida-display-font, 'Cairo', sans-serif);
        font-weight: 700;
        font-size: 24px;
        line-height: 1.15;
        color: var(--nida-countdown, var(--nida-text));
        font-variant-numeric: tabular-nums;
        letter-spacing: 0.5px;
      }
      /* 2.0.88 — Ramadan-only now-card elements. All of these only
         appear in the markup when a ramadan-* theme is active, so no
         theme guards are needed here. */
      .now-until {
        font-size: 12px;
        font-weight: 600;
        color: var(--nida-gold);
        margin-top: 3px;
      }
      .now-iftar {
        position: relative;
        display: flex;
        align-items: center;
        gap: 10px;
        margin-top: 14px;
      }
      .now-iftar-ico {
        width: 30px;
        height: 30px;
        border-radius: 50%;
        flex-shrink: 0;
        display: flex;
        align-items: center;
        justify-content: center;
        border: 1px solid var(--nida-gold-soft);
        background: rgba(0, 0, 0, 0.14);
      }
      .now-iftar-ico svg {
        width: 16px;
        height: 16px;
        stroke: var(--nida-gold);
      }
      .now-iftar-lbl {
        display: flex;
        flex-direction: column;
      }
      .now-iftar-lbl b {
        font-size: 10px;
        letter-spacing: 1.5px;
        text-transform: uppercase;
        font-weight: 700;
        color: var(--nida-gold);
        line-height: 1.3;
      }
      .now-iftar-lbl span {
        font-size: 12.5px;
        color: var(--nida-text);
      }
      .now-divider {
        position: relative;
        height: 1px;
        background: var(--nida-border);
        margin: 14px 0 10px;
        max-width: 240px;
      }
      .now-last {
        position: relative;
        display: flex;
        flex-direction: column;
      }
      .now-last-name {
        font-family: var(--nida-display-font, 'Cairo', sans-serif);
        font-weight: 700;
        font-size: 19px;
        line-height: 1.2;
        color: var(--nida-text);
      }
      .now-last-time {
        font-size: 12.5px;
        font-weight: 600;
        color: var(--nida-gold-bright);
        font-variant-numeric: tabular-nums;
      }
      /* 2.0.88 — "Iftar in X m" tag on the today-card Maghrib row. */
      .today-iftar-tag {
        font-size: 11.5px;
        font-weight: 600;
        color: var(--nida-gold);
      }
      .today-row.next .today-iftar-tag {
        color: var(--nida-gold);
      }
      /* Imsak row: upcoming shows a gold crescent instead of a weather
         glyph; past gets the same dim + check treatment as prayers. */
      .today-row.imsak .today-icon svg {
        stroke: var(--nida-gold);
      }
      /* 2.0.80 — mute button, bottom-right of the now-card. Replaces the
         old guest-mode tile/banner: tapping it opens the silent-mode
         popup (duration dropdown + note that prayer notifications still
         come through). Lights up gold while silent mode is active.
         2.0.81 — smaller (26px) and nudged lower/tighter into the corner
         so it clears the countdown; the icon stroke is now set here
         (stroke: currentColor). Before this the mute glyph had fill:none
         and no stroke on either the SVG or this rule, so it rendered
         invisible. Every other icon gets its stroke from CSS and this
         one was missed. */
      .now-mute-btn {
        position: absolute;
        right: var(--nida-mute-right, 12px);
        bottom: 10px;
        z-index: 1;
        width: 26px;
        height: 26px;
        border-radius: 50%;
        border: var(--nida-mute-border, 1px solid var(--nida-gold-soft));
        background: var(--nida-mute-bg, rgba(0, 0, 0, 0.18));
        color: var(--nida-mute-icon, var(--nida-text-dim));
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 0;
        transition: background 0.12s, border-color 0.12s, color 0.12s;
      }
      .now-mute-btn svg { width: 14px; height: 14px; stroke: currentColor; fill: none; }
      .now-mute-btn:hover {
        border-color: var(--nida-gold);
        color: var(--nida-text);
      }
      .now-mute-btn.active {
        background: var(--nida-gold-bright);
        border-color: var(--nida-gold-bright);
        color: var(--nida-bg);
      }
      /* 2.0.73 — sub-line now sits directly under the name (was a
         bottom-of-card divider). Collapses when empty; keeps the
         data-live hook alive for the next state update. */
      .now-current {
        margin-top: 5px;
        font-size: 11px;
        letter-spacing: 0.5px;
        text-transform: uppercase;
        font-weight: 600;
        color: var(--nida-text-dim);
        min-height: 1em;
      }
      .now-current:empty {
        margin-top: 0;
        min-height: 0;
      }

      /* 2.1.2 — .calendar-card's shared envelope+placeholder rule
         (formerly shared with .quote-card too, before the Quote feature
         was retired in 2.1.3 — see .holiday-eyebrow/.holiday-explainer
         below, still used by the calendar card's "todo" loading state). */
      .calendar-card {
        background: var(--nida-surface);
        border: 1px solid var(--nida-border);
        border-radius: var(--nida-radius);
        padding: 18px 20px;
      }
      .calendar-card.todo {
        border-style: dashed;
        opacity: 0.85;
      }
      .holiday-eyebrow {
        display: flex;
        align-items: center;
        gap: 6px;
        font-size: 11px;
        color: var(--nida-gold);
        text-transform: uppercase;
        letter-spacing: 0.8px;
        font-weight: 600;
        margin-bottom: 8px;
      }
      .holiday-eyebrow svg {
        width: 13px;
        height: 13px;
        stroke: var(--nida-gold);
      }
      .holiday-explainer {
        font-size: 13px;
        line-height: 1.6;
        color: var(--nida-text-dim);
        font-style: normal;
      }

      .dua-player-select {
        /* 2.0.51 — native select styled to match the time-input fields;
           colors come from theme vars so light and dark both work. */
        max-width: 55%;
        padding: 6px 10px;
        border-radius: 8px;
        border: 1px solid var(--nida-border);
        background: var(--nida-surface-raised, rgba(0,0,0,0.05));
        color: var(--nida-text);
        font: inherit;
        font-size: 13px;
      }
      .row.dua-actions {
        justify-content: flex-start;
        gap: 10px;
      }
      .test-btn.dua-remove {
        border-color: rgba(217, 64, 47, 0.6);
        color: #a8271b;
      }
      .footer-support {
        display: flex;
        justify-content: center;
        margin-top: 12px;
      }
      .support-link {
        /* 2.0.53 — plain outbound link, deliberately quiet: no popups,
           no reminders, just a themed pill in the footer. */
        display: inline-flex;
        align-items: center;
        gap: 6px;
        padding: 6px 14px;
        border: 1px solid var(--nida-border);
        border-radius: 999px;
        color: var(--nida-text-dim);
        text-decoration: none;
        font-size: 12.5px;
      }
      .support-link:hover {
        color: var(--nida-gold-bright);
        border-color: var(--nida-gold-bright);
      }
      .support-link svg {
        width: 14px;
        height: 14px;
        /* 2.0.54 — the shared icon set relies on the container to set
           stroke; without this the heart is invisible (fill none,
           stroke none). */
        stroke: currentColor;
      }
      .footer-note {
        position: relative;
        z-index: 1;
        text-align: center;
        font-size: 12px;
        color: var(--nida-text-dim);
        padding: 0 32px 32px;
      }

      /* Overlay (method picker, language picker) */
      .overlay {
        position: fixed;
        inset: 0;
        background: rgba(0, 0, 0, 0.55);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 100;
        padding: 20px;
      }
      .overlay-panel {
        background: var(--nida-surface);
        border: 1px solid var(--nida-border);
        border-radius: var(--nida-radius);
        width: 100%;
        max-width: 460px;
        max-height: 80vh;
        display: flex;
        flex-direction: column;
        overflow: hidden;
      }
      .overlay-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 16px 18px;
        border-bottom: 1px solid var(--nida-border);
        font-family: var(--nida-display-font, 'Cairo', sans-serif);
        font-weight: 600;
        font-size: 15px;
        color: var(--nida-text);
      }
      .overlay-close {
        background: transparent;
        border: none;
        color: var(--nida-text-dim);
        font-size: 16px;
        line-height: 1;
        padding: 4px 8px;
      }
      .overlay-close:hover { color: var(--nida-text); }
      .overlay-list {
        overflow-y: auto;
        flex: 1;
      }
      .overlay-item {
        padding: 12px 18px;
        font-size: 14px;
        color: var(--nida-text);
        border-bottom: 1px solid var(--nida-border);
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
      }
      .overlay-item:last-child { border-bottom: none; }
      .overlay-item:hover { background: var(--nida-surface-raised); }
      .overlay-item.active { color: var(--nida-gold-bright); }
      /* 2.0.95 — wraps the checkmark (+ the optional secondary toggle,
         e.g. the TTS-workaround flag in the notify-targets overlay) so
         both sit flush right without disturbing the existing
         space-between layout. */
      .overlay-item-controls {
        display: flex;
        align-items: center;
        gap: 10px;
        flex-shrink: 0;
      }
      .overlay-check svg {
        width: 16px;
        height: 16px;
        stroke: var(--nida-gold-bright);
      }
      .overlay-search {
        padding: 12px 18px;
        border-bottom: 1px solid var(--nida-border);
      }
      .overlay-search input {
        width: 100%;
        background: var(--nida-bg);
        border: 1px solid var(--nida-border);
        border-radius: 8px;
        padding: 9px 12px;
        font-size: 14px;
        color: var(--nida-text);
        font-family: inherit;
        outline: none;
      }
      .overlay-search input:focus {
        border-color: var(--nida-gold-soft);
      }
      .overlay-empty {
        padding: 24px 18px;
        text-align: center;
        font-size: 13px;
        color: var(--nida-text-dim);
      }

      /* Welcome overlay — one-shot on first /nida visit */
      .welcome-panel {
        max-width: 560px;
        padding: 36px 40px 32px;
        text-align: center;
      }
      .welcome-bismillah {
        font-family: var(--nida-display-font, 'Cairo', sans-serif);
        font-size: 22px;
        line-height: 1.6;
        color: var(--nida-gold-bright);
        margin-bottom: 18px;
        direction: rtl;
      }
      .welcome-salam {
        font-family: var(--nida-display-font, 'Cairo', sans-serif);
        font-weight: 700;
        font-size: 18px;
        color: var(--nida-text);
        margin-bottom: 22px;
      }
      .welcome-text {
        font-size: 14px;
        line-height: 1.6;
        color: var(--nida-text);
        margin-bottom: 14px;
        text-align: left;
      }
      .welcome-divider {
        height: 1px;
        background: var(--nida-border);
        margin: 20px 0;
      }
      .welcome-features {
        list-style: none;
        padding: 0;
        margin: 0;
        text-align: left;
      }
      .welcome-features li {
        font-size: 13px;
        color: var(--nida-text-dim);
        padding: 6px 0;
      }
      .welcome-thanks {
        font-size: 13px;
        color: var(--nida-text);
        font-style: italic;
        margin-bottom: 6px;
      }
      .welcome-author {
        font-size: 12px;
        color: var(--nida-text-dim);
        margin-bottom: 26px;
      }
      .welcome-cta {
        background: var(--nida-gold);
        color: var(--nida-bg);
        border: none;
        border-radius: 8px;
        padding: 11px 28px;
        font-size: 14px;
        font-weight: 600;
        cursor: pointer;
        font-family: inherit;
        transition: background 0.15s;
      }
      .welcome-cta:hover {
        background: var(--nida-gold-bright);
      }

      /* Mobile / narrow — single column.
         Open per design.md: where the companion column lands in narrow
         viewports was not yet decided. Default for now: stack companion
         below settings, full width. Revisit when mobile design is locked. */
      @media (max-width: 900px) {
        .layout {
          grid-template-columns: 1fr;
        }
        .col-settings {
          border-right: none;
          border-bottom: 1px solid var(--nida-border);
          padding: 24px 20px 32px;
        }
        .col-companion {
          padding: 28px 20px 32px;
        }
      }
      /* 2.0.75 — phones: stack the hero so the name and countdown each get
         a full line instead of being squeezed side by side. */
      @media (max-width: 520px) {
        .now-row { flex-direction: column; align-items: flex-start; gap: 12px; }
        .now-right { align-items: flex-start; text-align: left; }
        .now-name { font-size: 26px; }
      }
    `;
  }
}

customElements.define("nida-panel", NidaPanel);