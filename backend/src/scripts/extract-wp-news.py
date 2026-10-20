"""Extract categories and published posts from the WordPress mega.sql dump."""
from __future__ import annotations

import json
import re
import sys
from pathlib import Path

DUMP = Path(r"c:\Users\posey\Downloads\mega.sql")
OUT = Path(r"c:\Users\posey\Proyectos\votomusicamundial\backend\tmp\wp-news.json")


def unescape(value: str) -> str:
    return (
        value.replace("\\'", "'")
        .replace('\\"', '"')
        .replace("\\n", "\n")
        .replace("\\r", "\r")
        .replace("\\t", "\t")
        .replace("\\\\", "\\")
    )


def parse_values(chunk: str) -> list:
    values = []
    i = 0
    n = len(chunk)
    while i < n:
        while i < n and chunk[i] in " \t\r\n,":
            i += 1
        if i >= n:
            break
        if chunk.startswith("NULL", i) and (i + 4 == n or chunk[i + 4] in ", \t\r\n"):
            values.append(None)
            i += 4
            continue
        if chunk[i] == "'":
            i += 1
            out = []
            while i < n:
                ch = chunk[i]
                if ch == "\\" and i + 1 < n:
                    out.append(chunk[i + 1])
                    i += 2
                    continue
                if ch == "'":
                    i += 1
                    break
                out.append(ch)
                i += 1
            values.append(unescape("".join(out)))
            continue
        j = i
        while j < n and chunk[j] not in ",":
            j += 1
        values.append(chunk[i:j].strip())
        i = j
    return values


def split_tuples(blob: str):
    i = 0
    n = len(blob)
    while i < n:
        while i < n and blob[i] != "(":
            i += 1
        if i >= n:
            return
        i += 1
        start = i
        depth = 1
        in_str = False
        while i < n and depth:
            ch = blob[i]
            if in_str:
                if ch == "\\" and i + 1 < n:
                    i += 2
                    continue
                if ch == "'":
                    in_str = False
                i += 1
                continue
            if ch == "'":
                in_str = True
                i += 1
                continue
            if ch == "(":
                depth += 1
            elif ch == ")":
                depth -= 1
                if depth == 0:
                    yield blob[start:i]
                    i += 1
                    break
            i += 1


def first_image(html: str) -> str | None:
    match = re.search(r'<img[^>]+src=["\']([^"\']+)["\']', html or "", re.I)
    if not match:
        return None
    url = match.group(1).replace("\\/", "/")
    if url.startswith("//"):
        url = "https:" + url
    return url


def excerpt_from(content: str, excerpt: str) -> str:
    text = excerpt or ""
    if text.strip():
        return re.sub(r"\s+", " ", re.sub(r"<[^>]+>", " ", text)).strip()
    plain = re.sub(r"\s+", " ", re.sub(r"<[^>]+>", " ", content or "")).strip()
    return plain[:280]


def iter_insert_blobs(path: Path, table: str):
    header = f"INSERT INTO `{table}`"
    with path.open("r", encoding="utf-8", errors="replace", newline="") as handle:
        in_insert = False
        in_str = False
        buf: list[str] = []
        for line in handle:
            if not in_insert:
                pos = line.find(header)
                if pos < 0:
                    continue
                in_insert = True
                in_str = False
                after = line[pos:].split("VALUES", 1)
                chunk = after[1] if len(after) > 1 else ""
            else:
                chunk = line

            i = 0
            while i < len(chunk):
                ch = chunk[i]
                if in_str:
                    if ch == "\\" and i + 1 < len(chunk):
                        i += 2
                        continue
                    if ch == "'":
                        in_str = False
                    i += 1
                    continue
                if ch == "'":
                    in_str = True
                    i += 1
                    continue
                if ch == ";":
                    buf.append(chunk[:i])
                    yield "".join(buf)
                    buf = []
                    in_insert = False
                    in_str = False
                    break
                i += 1
            else:
                buf.append(chunk)


def stream_table(path: Path, table: str):
    for blob in iter_insert_blobs(path, table):
        yield from split_tuples(blob)


def main() -> int:
    if not DUMP.exists():
        print(f"missing dump: {DUMP}", file=sys.stderr)
        return 1

    print("reading terms...", flush=True)
    terms: dict[int, dict] = {}
    for tuple_sql in stream_table(DUMP, "wpgn_terms"):
        row = parse_values(tuple_sql)
        if len(row) < 3:
            continue
        term_id = int(row[0])
        terms[term_id] = {"id": term_id, "name": row[1], "slug": row[2]}

    print(f"terms={len(terms)}", flush=True)
    print("reading taxonomy...", flush=True)
    tax_by_id: dict[int, dict] = {}
    categories: dict[int, dict] = {}
    for tuple_sql in stream_table(DUMP, "wpgn_term_taxonomy"):
        row = parse_values(tuple_sql)
        if len(row) < 6:
            continue
        tax_id = int(row[0])
        term_id = int(row[1])
        taxonomy = row[2]
        parent = int(row[4] or 0)
        count = int(row[5] or 0)
        tax_by_id[tax_id] = {
            "termId": term_id,
            "taxonomy": taxonomy,
            "parent": parent,
            "count": count,
        }
        if taxonomy == "category" and term_id in terms:
            term = terms[term_id]
            categories[term_id] = {
                "wpId": term_id,
                "name": term["name"].replace("&amp;", "&"),
                "slug": term["slug"],
                "parentWpId": parent or None,
                "count": count,
            }

    print(f"categories={len(categories)} taxonomy={len(tax_by_id)}", flush=True)
    print("reading users...", flush=True)
    users: dict[int, str] = {}
    for tuple_sql in stream_table(DUMP, "wpgn_users"):
        row = parse_values(tuple_sql)
        if len(row) < 2:
            continue
        display = row[9] if len(row) > 9 else row[1]
        users[int(row[0])] = display or row[1] or "Redacción"

    print(f"users={len(users)}", flush=True)
    print("reading relationships...", flush=True)
    post_cats: dict[int, list[int]] = {}
    rels = 0
    for tuple_sql in stream_table(DUMP, "wpgn_term_relationships"):
        row = parse_values(tuple_sql)
        if len(row) < 2:
            continue
        object_id = int(row[0])
        tax_id = int(row[1])
        tax = tax_by_id.get(tax_id)
        if not tax or tax["taxonomy"] != "category":
            continue
        post_cats.setdefault(object_id, []).append(tax["termId"])
        rels += 1
        if rels % 50000 == 0:
            print(f"category rels={rels}", flush=True)

    print(f"category rels={rels}", flush=True)
    print("reading posts...", flush=True)
    posts = []
    for tuple_sql in stream_table(DUMP, "wpgn_posts"):
        row = parse_values(tuple_sql)
        if len(row) < 23:
            continue
        status = row[7]
        post_type = row[20]
        if post_type != "post" or status != "publish":
            continue
        wp_id = int(row[0])
        author_id = int(row[1] or 0)
        content = row[4] or ""
        title = (row[5] or "").strip()
        slug = (row[11] or "").strip()
        if not title or not slug:
            continue
        posts.append(
            {
                "wpId": wp_id,
                "slug": slug,
                "title": title,
                "excerpt": excerpt_from(content, row[6] or ""),
                "content": content,
                "coverUrl": first_image(content),
                "authorName": users.get(author_id) or "Redacción",
                "publishedAt": row[2],
                "commentCount": int(row[22] or 0),
                "categoryWpIds": post_cats.get(wp_id, []),
            }
        )
        if len(posts) % 1000 == 0:
            print(f"posts={len(posts)}", flush=True)

    posts.sort(key=lambda item: item["publishedAt"] or "", reverse=True)
    OUT.parent.mkdir(parents=True, exist_ok=True)
    payload = {
        "categories": sorted(categories.values(), key=lambda item: item["name"].lower()),
        "posts": posts,
    }
    OUT.write_text(json.dumps(payload, ensure_ascii=False), encoding="utf-8")
    print(f"wrote {OUT} categories={len(categories)} posts={len(posts)}")
    print("top categories:")
    for cat in sorted(categories.values(), key=lambda item: item["count"], reverse=True)[:30]:
        print(f"  {cat['count']:6}  {cat['slug']:32}  {cat['name']}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
