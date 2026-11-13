"""Expand charts packs to TOP tracks with covers for Load more."""
from __future__ import annotations

import json
import time
import urllib.parse
import urllib.request
from pathlib import Path

ROOT = Path(r"c:\Users\posey\OneDrive\Escritorio\MusicMundial")
OUT = Path(__file__).resolve().parent
DATA = OUT / "data.json"
SPOT = OUT / "spotify"
UA = "MusicMundialCharts/1.0 (+https://www.musicmundial.com)"
TOP = 40


def main() -> None:
    old = json.loads(DATA.read_text(encoding="utf-8"))
    cover_by_track: dict[str, str] = {}
    cover_by_artist: dict[str, str] = {}
    cover_by_key: dict[tuple[str, str], str] = {}

    def remember(track: dict) -> None:
        if track.get("coverUrl") and track.get("trackId"):
            cover_by_track[str(track["trackId"])] = str(track["coverUrl"])
        if track.get("coverUrl") and track.get("artistId"):
            cover_by_artist[str(track["artistId"])] = str(track["coverUrl"])
        key = (
            str(track.get("artist") or "").lower().strip(),
            str(track.get("title") or "").lower().strip(),
        )
        if track.get("coverUrl") and key[0]:
            cover_by_key[key] = str(track["coverUrl"])

    for pack in old.values():
        for t in pack.get("tracks") or []:
            remember(t)
    for f in SPOT.glob("*-daily.json"):
        for t in json.loads(f.read_text(encoding="utf-8")).get("tracks") or []:
            remember(t)

    def fetch_json(url: str) -> dict | None:
        req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept": "application/json"})
        try:
            with urllib.request.urlopen(req, timeout=15) as res:
                return json.loads(res.read().decode("utf-8"))
        except Exception:
            return None

    def spotify_thumb(kind: str, sid: str) -> str | None:
        url = (
            "https://open.spotify.com/oembed?url="
            + urllib.parse.quote(f"https://open.spotify.com/{kind}/{sid}", safe="")
        )
        payload = fetch_json(url)
        thumb = (payload or {}).get("thumbnail_url")
        return str(thumb) if thumb else None

    def itunes_thumb(artist: str, title: str) -> str | None:
        term = urllib.parse.quote(f"{artist} {title}".strip())
        payload = fetch_json(f"https://itunes.apple.com/search?term={term}&entity=song&limit=1")
        results = (payload or {}).get("results") or []
        if not results:
            return None
        art = results[0].get("artworkUrl100") or ""
        return art.replace("100x100bb", "300x300bb") if art else None

    def cover_for(track: dict) -> str | None:
        if track.get("coverUrl"):
            return str(track["coverUrl"])
        if track.get("videoId"):
            return f"https://i.ytimg.com/vi/{track['videoId']}/hqdefault.jpg"
        tid = track.get("trackId")
        aid = track.get("artistId")
        if tid and tid in cover_by_track:
            return cover_by_track[str(tid)]
        if aid and aid in cover_by_artist:
            return cover_by_artist[str(aid)]
        key = (
            str(track.get("artist") or "").lower().strip(),
            str(track.get("title") or "").lower().strip(),
        )
        if key in cover_by_key:
            return cover_by_key[key]
        if tid:
            c = spotify_thumb("track", str(tid))
            time.sleep(0.05)
            if c:
                cover_by_track[str(tid)] = c
                return c
        if aid:
            c = spotify_thumb("artist", str(aid))
            time.sleep(0.05)
            if c:
                cover_by_artist[str(aid)] = c
                return c
        artist = str(track.get("artist") or "")
        title = str(track.get("title") or "")
        if artist and title:
            c = itunes_thumb(artist, title)
            time.sleep(0.05)
            if c:
                cover_by_key[key] = c
                return c
        return None

    def enrich(tracks: list[dict]) -> int:
        filled = 0
        for t in tracks:
            c = cover_for(t)
            if c:
                t["coverUrl"] = c
                remember(t)
                filled += 1
        return filled

    def take(src_path: str, n: int = TOP) -> dict:
        raw = json.loads((ROOT / src_path).read_text(encoding="utf-8"))
        tracks = (raw.get("tracks") or [])[:n]
        filled = enrich(tracks)
        out = {k: raw.get(k) for k in raw if k != "tracks"}
        out["tracks"] = tracks
        print(src_path, len(tracks), f"covers {filled}/{len(tracks)}")
        return out

    new = {
        "daily": take("kworb/spotify/global-daily.json"),
        "listeners": take("kworb/spotify/listeners.json"),
        "latest": take("kworb/youtube/latest.json"),
        "trending": take("kworb/youtube/trending.json"),
        "insights": take("kworb/youtube/insights.json"),
    }

    aa = json.loads((ROOT / "allaccess.json").read_text(encoding="utf-8"))
    old_radio = {
        (str(t.get("title") or "").lower(), str(t.get("artist") or "").lower()): t
        for t in old["radio"]["tracks"]
    }
    radio_tracks: list[dict] = []
    for t in aa["tracks"]:
        artist = str(t.get("artist") or "").title()
        title = str(t.get("title") or "")
        prev = None
        for (pt, pa), v in old_radio.items():
            if pt == title.lower() or title.lower() in pt or pt in title.lower():
                if pa.split()[0] in artist.lower() or artist.lower().split()[0] in pa:
                    prev = v
                    break
        row = {
            "position": t["position"],
            "change": t.get("change"),
            "artist": prev.get("artist") if prev else artist,
            "title": prev.get("title") if prev else title,
            "spins": t.get("spins"),
            "spinsLastWeek": t.get("spinsLastWeek"),
            "spinsChange": t.get("spinsChange"),
            "panelAudience": t.get("audience"),
            "audience": prev.get("audience")
            if prev and prev.get("audience") is not None
            else t.get("audience"),
            "audienceChange": prev.get("audienceChange") if prev else None,
            "sources": prev.get("sources") if prev else ["allaccess"],
        }
        if prev and prev.get("coverUrl"):
            row["coverUrl"] = prev["coverUrl"]
        if prev:
            for k in ("kworbPosition", "formats", "days", "peak", "shazam", "itunes"):
                if prev.get(k) is not None:
                    row[k] = prev[k]
        radio_tracks.append(row)
    filled = enrich(radio_tracks)
    new["radio"] = {
        "source": old["radio"].get("source") or "hybrid",
        "chart": "Radio Airplay",
        "date": old["radio"].get("date") or str(aa.get("scrapedAt") or "")[:10],
        "week": old["radio"].get("week"),
        "count": aa.get("count") or len(radio_tracks),
        "matched": old["radio"].get("matched"),
        "note": old["radio"].get("note"),
        "tracks": radio_tracks,
    }
    print("radio", len(radio_tracks), f"covers {filled}/{len(radio_tracks)}")

    DATA.write_text(json.dumps(new, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print("wrote data.json", DATA.stat().st_size)

    index = []
    for f in sorted((ROOT / "kworb/spotify").glob("*-daily.json")):
        code = f.stem.replace("-daily", "")
        if code == "global":
            continue
        raw = json.loads(f.read_text(encoding="utf-8"))
        tracks = (raw.get("tracks") or [])[:TOP]
        filled = enrich(tracks)
        out = {
            "source": raw.get("source"),
            "section": raw.get("section"),
            "id": raw.get("id"),
            "country": raw.get("country"),
            "code": raw.get("code") or code,
            "period": raw.get("period"),
            "chart": raw.get("chart"),
            "date": raw.get("date"),
            "scrapedAt": raw.get("scrapedAt"),
            "count": raw.get("count"),
            "tracks": tracks,
        }
        (SPOT / f"{code}-daily.json").write_text(
            json.dumps(out, ensure_ascii=False, separators=(",", ":")), encoding="utf-8"
        )
        index.append(
            {
                "code": out["code"],
                "country": out["country"],
                "date": out["date"],
                "count": out.get("count"),
            }
        )
        print("country", code, len(tracks), f"{filled}/{len(tracks)}")

    (SPOT / "countries.json").write_text(
        json.dumps(
            {"frequent": ["us", "gb", "br", "mx", "co"], "available": index, "packed": index},
            ensure_ascii=False,
            indent=2,
        ),
        encoding="utf-8",
    )
    print("done countries", len(index))


if __name__ == "__main__":
    main()
