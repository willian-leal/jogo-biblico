#!/usr/bin/env python3
"""Repair invalid multiple-choice alternatives for the Bible question bank.

The script starts from the pre-repair backup, replaces alternatives that do not
contain the correct answer, and writes a consistent JSON file. When possible,
it derives distractors from the referenced jw.org Bible chapter text only.
"""

from __future__ import annotations

import argparse
import html
import json
import random
import re
import time
import unicodedata
import urllib.error
import urllib.request
from collections import Counter, defaultdict
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path


BOOK_SLUGS = {
    "genesis": "genesis",
    "gen": "genesis",
    "exodo": "exodo",
    "levitico": "levitico",
    "numeros": "numeros",
    "deuteronomio": "deuteronomio",
    "deut": "deuteronomio",
    "josue": "josue",
    "juizes": "juizes",
    "rute": "rute",
    "1 samuel": "1-samuel",
    "2 samuel": "2-samuel",
    "1 reis": "1-reis",
    "2 reis": "2-reis",
    "1 cronicas": "1-cronicas",
    "2 cronicas": "2-cronicas",
    "esdras": "esdras",
    "neemias": "neemias",
    "ester": "ester",
    "jo": "jo",
    "salmo": "salmos",
    "salmos": "salmos",
    "proverbios": "proverbios",
    "eclesiastes": "eclesiastes",
    "cantico de salomao": "cantico-de-salomao",
    "o cantico de salomao": "cantico-de-salomao",
    "canticos": "cantico-de-salomao",
    "isaias": "isaias",
    "jeremias": "jeremias",
    "lamentacoes": "lamentacoes",
    "ezequiel": "ezequiel",
    "daniel": "daniel",
    "oseias": "oseias",
    "joel": "joel",
    "amos": "amos",
    "obadias": "obadias",
    "jonas": "jonas",
    "miqueias": "miqueias",
    "naum": "naum",
    "habacuque": "habacuque",
    "sofonias": "sofonias",
    "ageu": "ageu",
    "zacarias": "zacarias",
    "malaquias": "malaquias",
    "mateus": "mateus",
    "marcos": "marcos",
    "lucas": "lucas",
    "joao": "joao",
    "atos": "atos",
    "romanos": "romanos",
    "1 corintios": "1-corintios",
    "2 corintios": "2-corintios",
    "galatas": "galatas",
    "efesios": "efesios",
    "filipenses": "filipenses",
    "colossenses": "colossenses",
    "1 tessalonicenses": "1-tessalonicenses",
    "2 tessalonicenses": "2-tessalonicenses",
    "1 timoteo": "1-timoteo",
    "2 timoteo": "2-timoteo",
    "tito": "tito",
    "filemom": "filemom",
    "hebreus": "hebreus",
    "tiago": "tiago",
    "1 pedro": "1-pedro",
    "2 pedro": "2-pedro",
    "1 joao": "1-joao",
    "2 joao": "2-joao",
    "3 joao": "3-joao",
    "judas": "judas",
    "apocalipse": "apocalipse",
    "revelacao": "apocalipse",
}

ONE_CHAPTER_BOOKS = {
    "obadias",
    "filemom",
    "2 joao",
    "3 joao",
    "judas",
}

STOPWORDS = {
    "a",
    "ao",
    "aos",
    "as",
    "com",
    "como",
    "da",
    "das",
    "de",
    "do",
    "dos",
    "e",
    "em",
    "era",
    "foi",
    "lhe",
    "mais",
    "mas",
    "na",
    "nas",
    "no",
    "nos",
    "o",
    "os",
    "ou",
    "para",
    "pela",
    "pelas",
    "pelo",
    "pelos",
    "por",
    "que",
    "se",
    "sem",
    "seu",
    "seus",
    "sua",
    "suas",
    "um",
    "uma",
}


def strip_accents(value: str) -> str:
    normalized = unicodedata.normalize("NFD", value)
    return "".join(char for char in normalized if unicodedata.category(char) != "Mn")


def normalize_spaces(value: str) -> str:
    return re.sub(r"\s+", " ", str(value).replace("\u00a0", " ")).strip()


def normalize_key(value: str) -> str:
    return strip_accents(normalize_spaces(value).casefold().replace(".", ""))


def chapter_url(book_slug: str, chapter: int) -> str:
    return f"https://www.jw.org/pt/biblioteca/biblia/nwt/livros/{book_slug}/{chapter}/"


def fetch_url(url: str) -> str:
    request = urllib.request.Request(
        url,
        headers={
            "User-Agent": "Mozilla/5.0 (compatible; bible-bank-repair/1.0)",
            "Accept-Language": "pt-BR,pt;q=0.9",
        },
    )
    with urllib.request.urlopen(request, timeout=45) as response:
        charset = response.headers.get_content_charset() or "utf-8"
        return response.read().decode(charset, errors="replace")


def clean_visible_text(raw_html: str) -> str:
    text = re.sub(r"(?is)<script.*?>.*?</script>", " ", raw_html)
    text = re.sub(r"(?is)<style.*?>.*?</style>", " ", text)
    text = re.sub(r"(?is)<sup.*?>.*?</sup>", " ", text)
    text = re.sub(r"(?is)<a[^>]*class=[\"'][^\"']*(?:xrefLink|footnoteLink)[^\"']*[\"'][^>]*>.*?</a>", " ", text)
    text = re.sub(r"<[^>]+>", " ", text)
    text = html.unescape(text)
    text = re.sub(r"\s+", " ", text.replace("\u200b", " "))
    return text.strip()


def bible_text_from_html(raw_html: str) -> str:
    match = re.search(r'(?is)<div id="bibleText"[^>]*>(.*?)</div>', raw_html)
    if not match:
        return clean_visible_text(raw_html)
    return clean_visible_text(match.group(1))


def parse_references(reference_text: str) -> list[tuple[str, int]]:
    text = normalize_spaces(reference_text)
    text = re.sub(r"\[[^\]]+\]", " ", text)
    text = text.replace(";", " ; ")
    pattern = re.compile(
        r"(?:(?P<book>(?:[1-3]\s*)?[A-Za-zÀ-ÿ ]+?)\s+)?(?P<chapter>\d+)(?::(?P<verses>[\d,\- ]+))?"
    )
    results: list[tuple[str, int]] = []
    current_book = ""
    for match in pattern.finditer(text):
        book = normalize_key(match.group("book") or current_book)
        if book:
            current_book = book
        if not current_book:
            continue
        chapter = int(match.group("chapter"))
        if not match.group("verses") and current_book in ONE_CHAPTER_BOOKS:
            chapter = 1
        results.append((current_book, chapter))

    unique: list[tuple[str, int]] = []
    seen = set()
    for item in results:
        if item not in seen:
            seen.add(item)
            unique.append(item)
    return unique


def answer_kind(value: str) -> str:
    text = normalize_spaces(value)
    lower = normalize_key(text)
    words = text.split()
    letters = re.sub(r"[^A-Za-zÀ-ÿ]", "", text)
    if letters and letters.upper() == letters and len(letters) > 1:
        return "upper_name"
    if re.fullmatch(r"\d+|[a-z]+", lower) and lower in {
        "um",
        "uma",
        "dois",
        "duas",
        "tres",
        "quatro",
        "cinco",
        "seis",
        "sete",
        "oito",
        "nove",
        "dez",
        "doze",
        "quarenta",
    }:
        return "number"
    if len(words) == 2 and normalize_key(words[0]) in {"a", "o", "as", "os", "um", "uma"} and words[1][:1].islower():
        return "short"
    title_name = bool(words) and all(
        word[:1].isupper() or normalize_key(word) in {"de", "da", "do", "dos", "das", "e"}
        for word in words
    )
    if len(words) >= 3 and not title_name:
        return "phrase"
    if text[:1].isupper() and len(words) <= 4 and len(text) <= 32:
        return "name"
    if len(words) >= 3 or len(text) > 38:
        return "phrase"
    return "short"


def candidate_kind(value: str) -> str:
    return answer_kind(value)


def question_category(question: str) -> str:
    text = normalize_key(question)
    if text.startswith("quem ") or text.startswith("de quem ") or text.startswith("a quem "):
        return "person"
    if text.startswith("que ") and any(
        word in text
        for word in (
            "procurador",
            "rei",
            "rainha",
            "profeta",
            "apostolo",
            "homem",
            "mulher",
            "pessoa",
            "governante",
            "sacerdote",
            "filho",
            "filha",
            "irmao",
            "irma",
        )
    ):
        return "person"
    if re.search(r"\bpor que\b", text) or text.startswith("por qual motivo"):
        return "reason"
    if text.startswith("como ") or "de que forma" in text:
        return "manner"
    if text.startswith("onde ") or "em que local" in text or "em que lugar" in text:
        return "place"
    if text.startswith("quantos ") or text.startswith("quantas "):
        return "number"
    if "o que aconteceu" in text:
        return "event"
    if "o que" in text and any(word in text for word in ("fez", "fazer", "fizesse", "devia", "deve", "deveria")):
        return "action"
    return "other"


def answer_prefix(answer: str) -> str:
    text = normalize_spaces(answer)
    lowered = normalize_key(text)
    for prefix in (
        "a fim de",
        "por causa",
        "para que",
        "para",
        "porque",
        "que",
        "ele devia",
        "ela devia",
        "ele pediu",
        "ela pediu",
        "ele disse",
        "ela disse",
        "ele se",
        "ela se",
        "no",
        "na",
        "em",
        "com",
        "de",
    ):
        if lowered.startswith(prefix):
            return prefix
    words = lowered.split()
    return " ".join(words[:1]) if words else ""


def template_distractors(answer: str) -> list[str]:
    text = normalize_spaces(answer)
    match = re.match(r"^(Ele|Ela) devia ser .+$", text, flags=re.IGNORECASE)
    if match:
        subject = match.group(1)
        return [
            f"{subject} devia ser advertido",
            f"{subject} devia ser expulso",
            f"{subject} devia ser perdoado",
        ]

    match = re.match(r"^(Ele|Ela) pediu .+$", text, flags=re.IGNORECASE)
    if match:
        subject = match.group(1)
        return [
            f"{subject} pediu comida",
            f"{subject} pediu hospedagem",
            f"{subject} fez uma pergunta",
        ]

    match = re.match(r"^(Ele|Ela) (disse|falou|respondeu) .+$", text, flags=re.IGNORECASE)
    if match:
        subject = match.group(1)
        return [
            f"{subject} ficou em silêncio",
            f"{subject} fez uma pergunta",
            f"{subject} deu outra orientação",
        ]

    if ";" in text and re.search(r"\bescapou\b|\bmorreu\b|\bfoi\b", normalize_key(text)):
        return [
            "Os dois foram mortos",
            "Os dois escaparam com vida",
            "Um deles foi preso e o outro fugiu",
        ]

    return []


def extract_candidates(source_text: str, expected_kind: str) -> list[str]:
    candidates: list[str] = []

    if expected_kind in {"number", "short", "upper_name", "name"}:
        return []

    if expected_kind in {"name", "short"}:
        candidates.extend(
            re.findall(
                r"\b[A-ZÀ-Ý][A-Za-zÀ-ÿ-]+(?:\s+(?:de|da|do|dos|das|e)\s+[A-ZÀ-Ý][A-Za-zÀ-ÿ-]+){0,3}",
                source_text,
            )
        )

    if expected_kind == "phrase":
        sentence_parts = re.split(r"[.;:!?]", source_text)
        for part in sentence_parts:
            part = normalize_spaces(part.strip(" ,"))
            words = part.split()
            if 3 <= len(words) <= 10:
                candidates.append(part)

    if expected_kind != "phrase":
        tokens = re.findall(r"[A-Za-zÀ-ÿ-]{4,}", source_text)
        counts = Counter(
            token for token in tokens if normalize_key(token) not in STOPWORDS and not token.isupper()
        )
        candidates.extend(token for token, _ in counts.most_common(100))

    cleaned: list[str] = []
    seen = set()
    for candidate in candidates:
        candidate = normalize_spaces(candidate.strip(" \"'“”‘’,.;:!?-"))
        candidate_key = normalize_key(candidate)
        if not candidate_key or candidate_key in seen:
            continue
        if len(candidate) < 3 or len(candidate) > 80:
            continue
        if candidate_key in STOPWORDS:
            continue
        if re.search(r"\b(JW\.ORG|MENU|Log in|download|Bíblia on-line)\b", candidate, re.I):
            continue
        cleaned.append(candidate)
        seen.add(candidate_key)
    return cleaned


def choose_distractors(answer: str, candidates: list[str], question_id: str) -> list[str]:
    answer_key = normalize_key(answer)
    expected_kind = answer_kind(answer)
    filtered = []
    seen = {answer_key}
    for candidate in candidates:
        candidate_key = normalize_key(candidate)
        if candidate_key in seen or candidate_key in answer_key or answer_key in candidate_key:
            continue
        kind = candidate_kind(candidate)
        if expected_kind == "phrase" and kind != "phrase":
            continue
        if expected_kind != "phrase" and kind == "phrase":
            continue
        filtered.append(candidate)
        seen.add(candidate_key)

    rnd = random.Random(f"distractors:{question_id}")
    rnd.shuffle(filtered)
    return filtered[:3]


def build_answer_pools(data: list[dict]) -> dict[tuple, list[str]]:
    pools: dict[tuple, list[str]] = defaultdict(list)
    for item in data:
        answer = normalize_spaces(item.get("resposta", ""))
        if answer:
            kind = answer_kind(answer)
            category = question_category(item.get("pergunta", ""))
            prefix = answer_prefix(answer)
            attrs = (
                item.get("fonte") or "",
                item.get("testamento") or "",
                item.get("dificuldade") or "",
            )
            keys = [
                (kind, category, prefix, *attrs),
                (kind, category, prefix, attrs[0], attrs[1]),
                (kind, category, prefix),
                (kind, category, *attrs),
                (kind, category, attrs[0], attrs[1]),
                (kind, category),
                (kind, prefix, attrs[0], attrs[1]),
                (kind, prefix),
                (kind, *attrs),
                (kind, attrs[0], attrs[1]),
                (kind, attrs[1], attrs[2]),
                (kind, attrs[0]),
                (kind, attrs[1]),
                (kind,),
            ]
            for key_item in keys:
                pools[key_item].append(answer)
    return pools


def fallback_distractors(item: dict, question_id: str, pools: dict[tuple, list[str]]) -> list[str]:
    answer = normalize_spaces(item.get("resposta", ""))
    answer_key = normalize_key(answer)
    expected_kind = answer_kind(answer)
    category = question_category(item.get("pergunta", ""))
    prefix = answer_prefix(answer)
    attrs = (
        item.get("fonte") or "",
        item.get("testamento") or "",
        item.get("dificuldade") or "",
    )
    person_name_keys = (
        [
            (expected_kind, "person", attrs[0], attrs[1]),
            (expected_kind, "person"),
        ]
        if expected_kind in {"name", "upper_name"} and category != "person"
        else []
    )
    pool_keys = [
        (expected_kind, category, prefix, *attrs),
        (expected_kind, category, prefix, attrs[0], attrs[1]),
        (expected_kind, category, prefix),
        *person_name_keys,
        (expected_kind, category, *attrs),
        (expected_kind, category, attrs[0], attrs[1]),
        (expected_kind, category),
        (expected_kind, prefix, attrs[0], attrs[1]),
        (expected_kind, prefix),
        (expected_kind, *attrs),
        (expected_kind, attrs[0], attrs[1]),
        (expected_kind, attrs[1], attrs[2]),
        (expected_kind, attrs[0]),
        (expected_kind, attrs[1]),
        (expected_kind,),
    ]
    staged_candidates = []
    for pool_key in pool_keys:
        values = list(dict.fromkeys(pools.get(pool_key, [])))
        if values:
            staged_candidates.append(values)
    rnd = random.Random(f"fallback:{question_id}")
    selected = []
    seen = {answer_key}

    for stage_index, candidates in enumerate(staged_candidates):
        candidates = candidates[:]
        rnd.shuffle(candidates)
        for candidate in candidates:
            candidate_key = normalize_key(candidate)
            if candidate_key in seen or answer_kind(candidate) != expected_kind:
                continue
            if stage_index < 6 and category == "reason" and answer_prefix(candidate) not in {
                prefix,
                "para",
                "para que",
                "porque",
                "a fim de",
                "por causa",
            }:
                continue
            selected.append(candidate)
            seen.add(candidate_key)
            if len(selected) == 3:
                return selected
    return selected


def needs_repair(item: dict) -> bool:
    answer_key = normalize_key(item.get("resposta", ""))
    alternatives = item.get("alternativas") or []
    alt_keys = [normalize_key(alt) for alt in alternatives]
    return len(alternatives) != 4 or len(set(alt_keys)) != len(alt_keys) or answer_key not in alt_keys


def repair(input_path: Path, output_path: Path, sleep_seconds: float, offline: bool) -> dict[str, int]:
    data = json.loads(input_path.read_text(encoding="utf-8"))
    for item in data:
        if "resposta" in item:
            item["resposta"] = normalize_spaces(item["resposta"])
    pools = build_answer_pools(data)
    cache: dict[tuple[str, int], str] = {}
    stats = Counter()

    if not offline:
        needed_chapters = set()
        for item in data:
            if not needs_repair(item):
                continue
            for book_key, chapter in parse_references(item.get("referencia", "")):
                book_slug = BOOK_SLUGS.get(book_key)
                if book_slug:
                    needed_chapters.add((book_slug, chapter))
                else:
                    stats["unmapped_reference"] += 1

        def fetch_chapter(cache_key: tuple[str, int]) -> tuple[tuple[str, int], str]:
            book_slug, chapter = cache_key
            return cache_key, bible_text_from_html(fetch_url(chapter_url(book_slug, chapter)))

        with ThreadPoolExecutor(max_workers=8) as executor:
            future_map = {
                executor.submit(fetch_chapter, cache_key): cache_key for cache_key in needed_chapters
            }
            for future in as_completed(future_map):
                cache_key = future_map[future]
                try:
                    key_item, text = future.result()
                    cache[key_item] = text
                except (TimeoutError, urllib.error.URLError):
                    stats["fetch_failure"] += 1
                if sleep_seconds:
                    time.sleep(sleep_seconds)

    for item in data:
        if not needs_repair(item):
            continue
        answer = normalize_spaces(item.get("resposta", ""))
        if not answer:
            continue

        candidates: list[str] = []
        if not offline and answer_kind(answer) not in {"phrase", "short"}:
            refs = parse_references(item.get("referencia", ""))
            for book_key, chapter in refs:
                book_slug = BOOK_SLUGS.get(book_key)
                if not book_slug:
                    stats["unmapped_reference"] += 1
                    continue
                cache_key = (book_slug, chapter)
                if cache_key in cache:
                    candidates.extend(extract_candidates(cache[cache_key], answer_kind(answer)))

        distractors = []
        for candidate in template_distractors(answer):
            if normalize_key(candidate) != normalize_key(answer):
                distractors.append(candidate)

        for candidate in choose_distractors(answer, candidates, item.get("id", "")):
            if len(distractors) == 3:
                break
            if normalize_key(candidate) not in {normalize_key(answer), *(normalize_key(x) for x in distractors)}:
                distractors.append(candidate)
        if len(distractors) < 3:
            fallback = fallback_distractors(item, item.get("id", ""), pools)
            for candidate in fallback:
                if len(distractors) == 3:
                    break
                if normalize_key(candidate) not in {normalize_key(answer), *(normalize_key(x) for x in distractors)}:
                    distractors.append(candidate)
            stats["used_fallback"] += 1

        alternatives = [answer, *distractors[:3]]
        if len(alternatives) != 4:
            raise RuntimeError(f"Could not repair {item.get('id')}: {alternatives}")
        random.Random(f"shuffle:{item.get('id', '')}").shuffle(alternatives)
        item["alternativas"] = alternatives
        stats["repaired"] += 1

    output_path.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
    stats["chapters_downloaded"] = len(cache)
    return dict(stats)


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("input", type=Path)
    parser.add_argument("output", type=Path)
    parser.add_argument("--sleep", type=float, default=0.05)
    parser.add_argument("--offline", action="store_true")
    args = parser.parse_args()
    print(json.dumps(repair(args.input, args.output, args.sleep, args.offline), ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
