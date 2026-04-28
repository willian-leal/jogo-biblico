#!/usr/bin/env python3
"""Generate missing alternatives for Bible questions using jw.org only.

This script reads a JSON array of question objects, fetches the referenced
chapter text from jw.org, and builds distractors from the same source text.
It preserves existing alternatives and writes a new JSON file.
"""

from __future__ import annotations

import argparse
import html
import json
import random
import re
import sys
import time
import unicodedata
import urllib.error
import urllib.request
from collections import Counter
from pathlib import Path


BOOK_SLUGS = {
    "genesis": "genesis",
    "exodo": "exodo",
    "levitico": "levitico",
    "numeros": "numeros",
    "deuteronomio": "deuteronomio",
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
    "salmos": "salmos",
    "proverbios": "proverbios",
    "eclesiastes": "eclesiastes",
    "cantico de salomao": "cantico-de-salomao",
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
}

STOPWORDS = {
    "a", "ao", "aos", "as", "com", "como", "da", "das", "de", "do", "dos",
    "e", "ele", "ela", "em", "entre", "era", "esse", "esta", "este", "eu",
    "foi", "há", "isso", "isto", "lhe", "mais", "mas", "me", "mesmo", "meu",
    "minha", "na", "não", "nas", "nem", "no", "nos", "nós", "o", "os", "ou",
    "para", "pela", "pelas", "pelo", "pelos", "por", "que", "quem", "se",
    "sem", "ser", "seu", "seus", "sua", "suas", "também", "te", "tem", "ter",
    "um", "uma", "uns", "umas", "vocês",
}

SITE_NOISE = (
    "opções de download",
    "leia a bíblia on-line",
    "leia a bíblia online",
    "tradução do novo mundo",
    "conteúdo do livro",
    "notas de rodapé",
    "notas de estudo",
    "português (brasil)",
    "reproduzir",
)


def strip_accents(value: str) -> str:
    normalized = unicodedata.normalize("NFD", value)
    return "".join(char for char in normalized if unicodedata.category(char) != "Mn")


def normalize_spaces(value: str) -> str:
    return re.sub(r"\s+", " ", value.replace("\u00a0", " ")).strip()


def normalize_key(value: str) -> str:
    value = normalize_spaces(value).lower()
    value = value.replace(".", "")
    value = strip_accents(value)
    return value


def clean_visible_text(raw_html: str) -> str:
    text = re.sub(r"(?is)<script.*?>.*?</script>", " ", raw_html)
    text = re.sub(r"(?is)<style.*?>.*?</style>", " ", text)
    text = re.sub(r"(?i)<br\s*/?>", "\n", text)
    text = re.sub(r"(?i)</p>", "\n", text)
    text = re.sub(r"(?i)</div>", "\n", text)
    text = re.sub(r"<[^>]+>", " ", text)
    text = html.unescape(text)
    text = text.replace("\u200b", " ")
    text = re.sub(r"\^\{\d+[^\}]*\}", " ", text)
    text = re.sub(r"\[\d+\]", " ", text)
    text = re.sub(r"\s+", " ", text)
    return text.strip()


def chapter_url(book_slug: str, chapter: int) -> str:
    return f"https://www.jw.org/pt/biblioteca/biblia/nwt/livros/{book_slug}/{chapter}/"


def fetch_url(url: str) -> str:
    request = urllib.request.Request(
        url,
        headers={
            "User-Agent": "Mozilla/5.0 (compatible; jw-alternatives-bot/1.0)",
            "Accept-Language": "pt-BR,pt;q=0.9",
        },
    )
    with urllib.request.urlopen(request, timeout=45) as response:
        charset = response.headers.get_content_charset() or "utf-8"
        return response.read().decode(charset, errors="replace")


def parse_references(reference_text: str) -> list[tuple[str, int]]:
    normalized = normalize_spaces(reference_text)
    normalized = normalized.replace(";", " ; ")
    matches = list(
        re.finditer(
            r"(?:(?P<book>(?:[1-3]\s*)?[A-Za-zÀ-ÿ ]+?)\s+)?(?P<chapter>\d+):(?P<verses>[\d,\- ]+)",
            normalized,
        )
    )
    results: list[tuple[str, int]] = []
    current_book = ""
    for match in matches:
        book = normalize_key(match.group("book") or current_book)
        if book:
            current_book = book
        if current_book:
            results.append((current_book, int(match.group("chapter"))))
    unique: list[tuple[str, int]] = []
    seen = set()
    for item in results:
        if item not in seen:
            seen.add(item)
            unique.append(item)
    return unique


def extract_phrase_candidates(source_text: str) -> list[str]:
    phrase_candidates: list[str] = []

    title_case = re.findall(
        r"\b(?:[A-ZÁÀÂÃÉÊÍÓÔÕÚÇ][a-záàâãéêíóôõúç]+(?:\s+(?:de|da|do|dos|das|e))?){1,4}",
        source_text,
    )
    phrase_candidates.extend(normalize_spaces(item) for item in title_case)

    article_phrases = re.findall(
        r"\b(?:o|a|os|as|um|uma)\s+[A-Za-zÁÀÂÃÉÊÍÓÔÕÚÇáàâãéêíóôõúç-]+(?:\s+de\s+[A-Za-zÁÀÂÃÉÊÍÓÔÕÚÇáàâãéêíóôõúç-]+){0,2}",
        source_text,
        flags=re.IGNORECASE,
    )
    phrase_candidates.extend(normalize_spaces(item) for item in article_phrases)

    tokens = re.findall(r"[A-Za-zÁÀÂÃÉÊÍÓÔÕÚÇáàâãéêíóôõúç-]{4,}", source_text)
    token_counts = Counter(
        token for token in tokens if normalize_key(token) not in STOPWORDS and not token.isupper()
    )
    phrase_candidates.extend(token for token, count in token_counts.most_common(80) if count >= 1)

    cleaned: list[str] = []
    seen = set()
    for candidate in phrase_candidates:
        candidate = normalize_spaces(candidate.strip(" ,.;:!?-"))
        if len(candidate) < 3:
            continue
        if any(noise in candidate.lower() for noise in SITE_NOISE):
            continue
        key = normalize_key(candidate)
        if len(key) < 3 or key in seen:
            continue
        seen.add(key)
        cleaned.append(candidate)
    return cleaned


def score_candidate(candidate: str, answer: str) -> tuple[int, int, int]:
    candidate_words = candidate.split()
    answer_words = answer.split()
    same_word_count = abs(len(candidate_words) - len(answer_words))
    same_length = abs(len(candidate) - len(answer))
    capitalized_bonus = 0 if candidate[:1].isupper() == answer[:1].isupper() else 1
    return (same_word_count, same_length, capitalized_bonus)


def choose_distractors(answer: str, pool: list[str], seed_value: str) -> list[str]:
    answer_key = normalize_key(answer)
    filtered: list[str] = []
    for candidate in pool:
        candidate_key = normalize_key(candidate)
        if candidate_key == answer_key:
            continue
        if answer_key in candidate_key or candidate_key in answer_key:
            continue
        if len(candidate_key) < 3:
            continue
        filtered.append(candidate)

    filtered.sort(key=lambda item: score_candidate(item, answer))
    top = filtered[:24] if len(filtered) > 24 else filtered[:]
    rnd = random.Random(seed_value)
    rnd.shuffle(top)

    chosen: list[str] = []
    seen = {answer_key}
    for candidate in top:
        candidate_key = normalize_key(candidate)
        if candidate_key in seen:
            continue
        chosen.append(candidate)
        seen.add(candidate_key)
        if len(chosen) == 3:
            break

    if len(chosen) < 3:
        for candidate in filtered[24:]:
            candidate_key = normalize_key(candidate)
            if candidate_key in seen:
                continue
            chosen.append(candidate)
            seen.add(candidate_key)
            if len(chosen) == 3:
                break

    return chosen


def build_alternatives(answer: str, source_texts: list[str], question_id: str) -> list[str]:
    pool: list[str] = []
    for text in source_texts:
        pool.extend(extract_phrase_candidates(text))

    distractors = choose_distractors(answer, pool, seed_value=question_id)
    if len(distractors) < 3:
        raise ValueError("Not enough jw.org-derived distractors found")

    alternatives = [answer, *distractors]
    rnd = random.Random(f"shuffle:{question_id}")
    rnd.shuffle(alternatives)
    return alternatives


def generate(
    input_path: Path,
    output_path: Path,
    limit: int | None,
    sleep_seconds: float,
) -> tuple[int, int, list[str]]:
    data = json.loads(input_path.read_text(encoding="utf-8"))
    cache: dict[tuple[str, int], str] = {}
    processed = 0
    failures: list[str] = []

    for item in data:
        if item.get("alternativas"):
            continue
        if limit is not None and processed >= limit:
            break

        refs = parse_references(item.get("referencia", ""))
        if not refs:
            failures.append(f"{item.get('id')}: referencia invalida")
            continue

        source_texts: list[str] = []
        try:
            for book_key, chapter in refs:
                book_slug = BOOK_SLUGS.get(book_key)
                if not book_slug:
                    raise ValueError(f"livro sem slug mapeado: {book_key}")

                cache_key = (book_slug, chapter)
                if cache_key not in cache:
                    url = chapter_url(book_slug, chapter)
                    cache[cache_key] = clean_visible_text(fetch_url(url))
                    if sleep_seconds:
                        time.sleep(sleep_seconds)
                source_texts.append(cache[cache_key])

            item["alternativas"] = build_alternatives(
                answer=normalize_spaces(item["resposta"]),
                source_texts=source_texts,
                question_id=item.get("id", ""),
            )
            processed += 1
        except (urllib.error.URLError, TimeoutError, ValueError) as exc:
            failures.append(f"{item.get('id')}: {exc}")

    output_path.write_text(
        json.dumps(data, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    return processed, len(cache), failures


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Preenche alternativas faltantes usando apenas páginas da Bíblia do jw.org."
    )
    parser.add_argument("input", type=Path, help="Caminho do JSON original")
    parser.add_argument("output", type=Path, help="Caminho do JSON de saída")
    parser.add_argument(
        "--limit",
        type=int,
        default=None,
        help="Processa somente as primeiras N questões sem alternativas",
    )
    parser.add_argument(
        "--sleep",
        type=float,
        default=0.35,
        help="Pausa entre downloads para reduzir carga no site",
    )
    args = parser.parse_args()

    processed, chapter_count, failures = generate(
        input_path=args.input,
        output_path=args.output,
        limit=args.limit,
        sleep_seconds=args.sleep,
    )

    print(f"questoes_processadas={processed}")
    print(f"capitulos_baixados={chapter_count}")
    print(f"falhas={len(failures)}")
    if failures:
        print("detalhes_falhas:")
        for failure in failures[:50]:
            print(f" - {failure}")
        if len(failures) > 50:
            print(f" - ... e mais {len(failures) - 50} falhas")
    return 0 if not failures else 2


if __name__ == "__main__":
    sys.exit(main())
