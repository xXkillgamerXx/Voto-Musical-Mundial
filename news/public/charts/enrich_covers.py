"""Fetch cover URLs for charts/data.json via Spotify oEmbed + iTunes fallback."""
from __future__ import annotations

import json
import time
import urllib.parse
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent
DATA = ROOT / "data.json"
UA = "MusicMundialCharts/1.0 (+https://www.musicmundial.com)"


def fetch_json(url: str) -> dict | None:
    req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=20) as res:
            return json.loads(res.read().decode("utf-8"))
    except Exception as exc:  # noqa: BLE001
        print("fail", url, exc)
        return None


def spotify_thumb(kind: str, spotify_id: str) -> str | None:
    url = (
        "https://open.spotify.com/oembed?url="
        + urllib.parse.quote(f"https://open.spotify.com/{kind}/{spotify_id}", safe="")
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
    if not art:
        return None
    return art.replace("100x100bb", "300x300bb")


def cover_for(track: dict) -> str | None:
    if track.get("coverUrl"):
        return track["coverUrl"]
    if track.get("videoId"):
        return f"https://i.ytimg.com/vi/{track['videoId']}/hqdefault.jpg"
    if track.get("trackId"):
        return spotify_thumb("track", track["trackId"])
    if track.get("artistId"):
        return spotify_thumb("artist", track["artistId"])
    artist = str(track.get("artist") or "")
    title = str(track.get("title") or "")
    if artist and title:
        return itunes_thumb(artist, title)
    if artist:
        return itunes_thumb(artist, "")
    return None


def main() -> None:
    data = json.loads(DATA.read_text(encoding="utf-8"))
    total = 0
    filled = 0
    for pack in data.values():
        tracks = pack.get("tracks") or []
        for track in tracks:
            total += 1
            cover = cover_for(track)
            time.sleep(0.12)
            if cover:
                track["coverUrl"] = cover
                filled += 1
                print("ok", track.get("title") or track.get("artist"), "→", cover[:64])
            else:
                print("miss", track.get("title") or track.get("artist") or track.get("country"))
    DATA.write_text(json.dumps(data, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print(f"done {filled}/{total}")


if __name__ == "__main__":
    main()
