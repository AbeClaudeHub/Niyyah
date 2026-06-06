"""Islamic tailoring for captions.

Two jobs:
  1. Normalize how Whisper transcribes common Islamic vocabulary (it tends to
     lowercase or mis-spell terms, e.g. "inshallah", "in sha allah") into clean,
     consistently-cased forms, and merge spaced multi-word phrases into one token.
  2. Tell the caption renderer which words are "sacred" so they always get the
     highlight colour, and append the ﷺ honorific after the Prophet's name.

Matching is punctuation/case-insensitive; display punctuation is preserved.
"""

from __future__ import annotations

import re

from .. import config

# Single-token canonical spellings (key is lowercased, punctuation-stripped).
GLOSSARY: dict[str, str] = {
    "allah": "Allah", "allahu": "Allahu",
    "inshallah": "Insha'Allah", "inshaallah": "Insha'Allah", "inchallah": "Insha'Allah",
    "mashallah": "Masha'Allah", "mashaallah": "Masha'Allah",
    "subhanallah": "SubhanAllah",
    "alhamdulillah": "Alhamdulillah", "hamdulillah": "Alhamdulillah",
    "bismillah": "Bismillah",
    "astaghfirullah": "Astaghfirullah",
    "jazakallah": "JazakAllah", "jazakAllah": "JazakAllah",
    "barakallah": "BarakAllah",
    "mubarak": "Mubarak",
    "quran": "Qur'an", "koran": "Qur'an",
    "sunnah": "Sunnah", "hadith": "Hadith", "seerah": "Seerah",
    "deen": "Deen", "iman": "Iman", "ummah": "Ummah", "dunya": "Dunya",
    "akhirah": "Akhirah", "akhira": "Akhirah",
    "jannah": "Jannah", "jahannam": "Jahannam",
    "halal": "Halal", "haram": "Haram",
    "dua": "Du'a", "dhikr": "Dhikr",
    "salah": "Salah", "salat": "Salah", "salawat": "Salawat",
    "zakat": "Zakat", "zakah": "Zakat", "sawm": "Sawm", "hajj": "Hajj", "umrah": "Umrah",
    "ramadan": "Ramadan", "ramadhan": "Ramadan",
    "sabr": "Sabr", "shukr": "Shukr", "tawakkul": "Tawakkul", "tawheed": "Tawheed",
    "rizq": "Rizq", "barakah": "Barakah", "niyyah": "Niyyah", "niyah": "Niyyah",
    "fitrah": "Fitrah", "taqwa": "Taqwa", "nafs": "Nafs",
    "shaytan": "Shaytan", "shaitan": "Shaytan", "iblis": "Iblis",
    "muhammad": "Muhammad", "muhammed": "Muhammad", "mohammed": "Muhammad",
    "prophet": "Prophet", "rasul": "Rasul", "rasool": "Rasul",
    "sahaba": "Sahaba", "imam": "Imam", "ayah": "Ayah", "surah": "Surah",
    "masjid": "Masjid", "kaaba": "Ka'bah", "kabah": "Ka'bah",
    "mecca": "Makkah", "makkah": "Makkah", "medina": "Madinah", "madinah": "Madinah",
    "subhanahu": "Subhanahu", "wataala": "wa Ta'ala",
}

# Spaced multi-word phrases -> single canonical token (keys lowercased, clean).
# Longest sequences are tried first.
PHRASES: list[tuple[tuple[str, ...], str]] = [
    (("la", "ilaha", "illa", "allah"), "La ilaha illa Allah"),
    (("in", "sha", "allah"), "Insha'Allah"),
    (("in", "shaa", "allah"), "Insha'Allah"),
    (("insha", "allah"), "Insha'Allah"),
    (("masha", "allah"), "Masha'Allah"),
    (("mashaa", "allah"), "Masha'Allah"),
    (("subhan", "allah"), "SubhanAllah"),
    (("subhaan", "allah"), "SubhanAllah"),
    (("alhamdu", "lillah"), "Alhamdulillah"),
    (("astaghfiru", "llah"), "Astaghfirullah"),
    (("jazak", "allah"), "JazakAllah"),
    (("barak", "allah"), "BarakAllah"),
    (("allahu", "akbar"), "Allahu Akbar"),
    (("subhanahu", "wa", "taala"), "Subhanahu wa Ta'ala"),
]
_MAX_PHRASE = max(len(p[0]) for p in PHRASES)

# Canonical (lowercased) terms that always get the sacred highlight colour.
SACRED: set[str] = {
    "allah", "allahu", "allahu akbar", "insha'allah", "masha'allah", "subhanallah",
    "alhamdulillah", "bismillah", "astaghfirullah", "jazakallah", "barakallah",
    "qur'an", "sunnah", "hadith", "jannah", "jahannam", "du'a", "dhikr", "salah",
    "salawat", "zakat", "sawm", "hajj", "umrah", "ramadan", "muhammad", "prophet",
    "rasul", "ka'bah", "makkah", "madinah", "deen", "iman", "ummah", "akhirah",
    "taqwa", "barakah", "niyyah", "tawheed", "mubarak", "subhanahu wa ta'ala",
    "la ilaha illa allah",
}

# Canonical (lowercased) words after which the ﷺ honorific is appended.
PBUH_AFTER: set[str] = {"muhammad"}

_PUNCT = re.compile(r"^(\W*)(.*?)(\W*)$", re.UNICODE)


def _split_punct(token: str) -> tuple[str, str, str]:
    """Return (leading_punct, core, trailing_punct)."""
    m = _PUNCT.match(token)
    if not m:
        return "", token, ""
    return m.group(1), m.group(2), m.group(3)


def _clean_key(token: str) -> str:
    return _split_punct(token)[1].lower()


def _merge_phrases(words: list[dict]) -> list[dict]:
    out: list[dict] = []
    i = 0
    n = len(words)
    while i < n:
        matched = False
        for length in range(min(_MAX_PHRASE, n - i), 1, -1):
            seq = tuple(_clean_key(words[i + k]["word"]) for k in range(length))
            for keys, canonical in PHRASES:
                if keys == seq:
                    out.append({
                        "word": canonical,
                        "start": words[i]["start"],
                        "end": words[i + length - 1]["end"],
                    })
                    i += length
                    matched = True
                    break
            if matched:
                break
        if not matched:
            out.append(dict(words[i]))
            i += 1
    return out


def transform(words: list[dict], append_pbuh: bool | None = None) -> list[dict]:
    """Normalize Islamic terms, merge phrases, and append the ﷺ honorific."""
    if append_pbuh is None:
        append_pbuh = config.APPEND_PBUH
    words = _merge_phrases(words)
    out: list[dict] = []
    for w in words:
        lead, core, trail = _split_punct(w["word"])
        key = core.lower()
        if key in GLOSSARY:
            core = GLOSSARY[key]
        text = f"{lead}{core}{trail}"
        if append_pbuh and core.lower() in PBUH_AFTER:
            text = f"{text} {config.PBUH_SYMBOL}"
        out.append({"word": text, "start": w["start"], "end": w["end"]})
    return out


def is_sacred(token: str) -> bool:
    """True if the (already-normalized) token is a sacred term to always highlight."""
    core = _split_punct(token)[1]
    # Drop the honorific symbol if present so "Muhammad ﷺ" still matches.
    core = core.replace(config.PBUH_SYMBOL, "").strip()
    return core.lower() in SACRED
