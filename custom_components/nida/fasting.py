"""
Fasting status logic for the Nida Home Assistant integration.

Pure functions — no Home Assistant dependencies — so this module is
trivially unit-testable. Determines whether a given day is recommended,
forbidden, or neutral for Islamic fasting based on the Hijri date and
the Gregorian weekday.

Recommendation/forbidden rules follow majority Sunni scholarship.
Edge cases that depend on user state we cannot detect (pilgrim status
on Arafah, sacrifice status during Tashreeq) are flagged in the
description text rather than branched on.

@version 1.0.0
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date
from enum import Enum

# ── Hijri month constants ──
MUHARRAM = 1
RAMADAN = 9
SHAWWAL = 10
DHUL_HIJJAH = 12


class FastingType(str, Enum):
    """Type of fasting day; values double as sensor attribute strings."""
    RAMADAN = "ramadan"
    MONDAY = "monday"
    THURSDAY = "thursday"
    WHITE_DAY = "white_day"      # 13, 14, 15 of any Hijri month
    ASHURA = "ashura"            # 10 Muharram
    TASUA = "tasua"              # 9 Muharram (paired with Ashura)
    ARAFAH = "arafah"            # 9 Dhul-Hijjah (non-pilgrims)
    DHUL_HIJJAH = "dhul_hijjah"  # 1–8 Dhul-Hijjah
    SHAWWAL_6 = "shawwal_6"      # any 6 days in Shawwal except the 1st
    NONE = "none"


class FastingObligation(str, Enum):
    """Religious obligation level."""
    FARD = "fard"                          # obligatory (Ramadan)
    SUNNAH_MUAKKADAH = "sunnah_muakkadah"  # strongly recommended
    SUNNAH = "sunnah"                      # recommended
    NONE = "none"


class ForbiddenReason(str, Enum):
    """Reason fasting is forbidden today."""
    EID_FITR = "eid_fitr"   # 1 Shawwal
    EID_ADHA = "eid_adha"   # 10 Dhul-Hijjah
    TASHREEQ = "tashreeq"   # 11, 12, 13 Dhul-Hijjah
    NONE = "none"


@dataclass(frozen=True)
class FastingStatus:
    """Complete fasting evaluation for a given date."""
    recommended: bool
    forbidden: bool
    type: FastingType
    obligation: FastingObligation
    forbidden_reason: ForbiddenReason
    description: str

    def as_attributes(self) -> dict:
        """Render as a flat dict for Home Assistant entity attributes."""
        return {
            "type": self.type.value,
            "obligation": self.obligation.value,
            "forbidden_reason": self.forbidden_reason.value,
            "description": self.description,
        }


def get_fasting_status(
    gregorian: date,
    hijri_day: int,
    hijri_month: int,
    hijri_year: int,  # noqa: ARG001 — kept for future Eid-offset / qada' logic
) -> FastingStatus:
    """Evaluate fasting status for the given date.

    Forbidden days override every other classification. If the input
    Hijri values are clearly invalid (e.g. 0), returns a neutral status.
    """
    if not (1 <= hijri_month <= 12) or not (1 <= hijri_day <= 30):
        return _neutral("Hijri date unavailable")

    # ── 1. Forbidden days override everything ──
    forbidden = _check_forbidden(hijri_day, hijri_month)
    if forbidden is not ForbiddenReason.NONE:
        return FastingStatus(
            recommended=False,
            forbidden=True,
            type=FastingType.NONE,
            obligation=FastingObligation.NONE,
            forbidden_reason=forbidden,
            description=_FORBIDDEN_DESC[forbidden],
        )

    # ── 2. Ramadan (fard) ──
    if hijri_month == RAMADAN:
        return _make(FastingType.RAMADAN, FastingObligation.FARD,
                     "Ramadan — obligatory fast")

    # ── 3. Arafah (sunnah muakkadah) ──
    if hijri_month == DHUL_HIJJAH and hijri_day == 9:
        return _make(FastingType.ARAFAH, FastingObligation.SUNNAH_MUAKKADAH,
                     "Day of Arafah — highly recommended for non-pilgrims")

    # ── 4. Ashura + paired Tasu'a ──
    if hijri_month == MUHARRAM and hijri_day == 10:
        return _make(FastingType.ASHURA, FastingObligation.SUNNAH_MUAKKADAH,
                     "Day of Ashura")
    if hijri_month == MUHARRAM and hijri_day == 9:
        return _make(FastingType.TASUA, FastingObligation.SUNNAH,
                     "Day of Tasu'a (paired with Ashura)")

    # ── 5. First 1–8 of Dhul-Hijjah (day 9 handled above) ──
    if hijri_month == DHUL_HIJJAH and 1 <= hijri_day <= 8:
        return _make(FastingType.DHUL_HIJJAH, FastingObligation.SUNNAH,
                     "First days of Dhul-Hijjah")

    # ── 6. Six days of Shawwal (any 6 days except 1 Shawwal = Eid) ──
    if hijri_month == SHAWWAL and hijri_day >= 2:
        return _make(FastingType.SHAWWAL_6, FastingObligation.SUNNAH,
                     "Six days of Shawwal")

    # ── 7. White days (13, 14, 15 of any Hijri month) ──
    if hijri_day in (13, 14, 15):
        return _make(FastingType.WHITE_DAY, FastingObligation.SUNNAH,
                     "White day (Ayyam al-Bid)")

    # ── 8. Monday & Thursday ──
    weekday = gregorian.weekday()  # 0 = Monday, 3 = Thursday
    if weekday == 0:
        return _make(FastingType.MONDAY, FastingObligation.SUNNAH,
                     "Monday — sunnah fast")
    if weekday == 3:
        return _make(FastingType.THURSDAY, FastingObligation.SUNNAH,
                     "Thursday — sunnah fast")

    return _neutral("No recommended fast today")


# ── Internal helpers ──

_FORBIDDEN_DESC = {
    ForbiddenReason.EID_FITR: "Eid al-Fitr — fasting forbidden",
    ForbiddenReason.EID_ADHA: "Eid al-Adha — fasting forbidden",
    ForbiddenReason.TASHREEQ: "Days of Tashreeq — fasting forbidden",
}


def _check_forbidden(hijri_day: int, hijri_month: int) -> ForbiddenReason:
    if hijri_month == SHAWWAL and hijri_day == 1:
        return ForbiddenReason.EID_FITR
    if hijri_month == DHUL_HIJJAH and hijri_day == 10:
        return ForbiddenReason.EID_ADHA
    if hijri_month == DHUL_HIJJAH and hijri_day in (11, 12, 13):
        return ForbiddenReason.TASHREEQ
    return ForbiddenReason.NONE


def _make(type_: FastingType, obligation: FastingObligation, desc: str) -> FastingStatus:
    return FastingStatus(
        recommended=True,
        forbidden=False,
        type=type_,
        obligation=obligation,
        forbidden_reason=ForbiddenReason.NONE,
        description=desc,
    )


def _neutral(desc: str) -> FastingStatus:
    return FastingStatus(
        recommended=False,
        forbidden=False,
        type=FastingType.NONE,
        obligation=FastingObligation.NONE,
        forbidden_reason=ForbiddenReason.NONE,
        description=desc,
    )
