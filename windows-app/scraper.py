"""Scraping via scrapling — port des fonctions de parsing du background.js"""
import re
import json
import logging
from datetime import datetime, timedelta
from urllib.parse import urljoin, urlparse

log = logging.getLogger("rtk.scraper")

# ── User-Agent ─────────────────────────────────────────────────────────────────

UA = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
    "AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/124.0.0.0 Safari/537.36"
)
BASE_HEADERS = {
    "User-Agent": UA,
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "fr-FR,fr;q=0.9,en;q=0.8",
}

# Sélecteurs CSS pour la liste de chapitres (identiques à injectedExtract dans l'extension)
CHAPTER_SELECTORS = [
    ".wp-manga-chapter a",
    ".listing-chapters_wrap a",
    ".chapter-list a",
    ".chapters a",
    ".chapter-li a",
    ".row-content-chapter li a",
    "ul.main.version-chap li a",
    ".eph-num a",
    "li.wp-manga-chapter a",
]

CHAPTER_RE = re.compile(
    r"(chapter|chapitre|chap|ch\.?|episode|ep\.?)[-_/\s]?(\d+(?:\.\d+)?)",
    re.IGNORECASE,
)
MAX_CHAPTER = 9999

# ── Parsing HTML (regex) ───────────────────────────────────────────────────────

def parse_type(html: str) -> str | None:
    """Détecte manga / manhwa / manhua / novel depuis le HTML."""
    m = re.search(r"\btype\b[\s\S]{0,60}?\b(manhwa|manhua|manwha|manga|novel|webtoon)\b", html, re.IGNORECASE)
    if m:
        val = m.group(1).lower()
        return "manhwa" if val in ("manwha", "webtoon") else val

    # JSON-LD
    for jm in re.finditer(r"<script[^>]+application/ld\+json[^>]*>([\s\S]*?)</script>", html, re.IGNORECASE):
        try:
            obj = json.loads(jm.group(1))
            genres = obj.get("genre") or obj.get("Genre") or []
            if isinstance(genres, str):
                genres = [genres]
            for g in genres:
                g = g.lower()
                for kw in ("manhwa", "manhua", "novel", "manga"):
                    if kw in g:
                        return kw
        except Exception:
            pass
    return None


def parse_cover_url(html: str) -> str | None:
    m = re.search(r'<meta[^>]+property=["\']og:image["\'][^>]+content=["\']([^"\']+)["\']', html, re.IGNORECASE)
    if not m:
        m = re.search(r'<meta[^>]+content=["\']([^"\']+)["\'][^>]+property=["\']og:image["\']', html, re.IGNORECASE)
    return m.group(1) if m else None


def parse_human_date(text: str) -> str | None:
    if not text:
        return None
    t = text.strip()
    low = t.lower()
    now = datetime.utcnow()

    if re.search(r"\b(just now|à l'instant|maintenant)\b", low):
        return now.isoformat()
    if re.search(r"\b(yesterday|hier)\b", low):
        return (now - timedelta(days=1)).isoformat()
    if re.search(r"\b(today|aujourd'hui)\b", low):
        return now.isoformat()

    # Relatif "2 days ago" / "il y a 3 heures"
    if re.search(r"ago|il y a|plus tôt|plus tot", low):
        rel = re.search(r"(\d+)\s*(seconde|second|minute|min|heure|hour|hr|jour|day|semaine|week|mois|month|an|year)", low)
        if rel:
            n, u = int(rel.group(1)), rel.group(2)
            if re.match(r"^(seconde|second)", u):  d = now - timedelta(seconds=n)
            elif re.match(r"^(minute|min)", u):   d = now - timedelta(minutes=n)
            elif re.match(r"^(heure|hour|hr)", u): d = now - timedelta(hours=n)
            elif re.match(r"^(jour|day)", u):      d = now - timedelta(days=n)
            elif re.match(r"^(semaine|week)", u):  d = now - timedelta(weeks=n)
            elif re.match(r"^(mois|month)", u):    d = now - timedelta(days=n * 30)
            else:                                   d = now - timedelta(days=n * 365)
            return d.isoformat()

    def in_range(dt: datetime) -> bool:
        return 2000 <= dt.year <= now.year + 1

    # ISO direct
    try:
        dt = datetime.fromisoformat(t.replace("Z", "+00:00"))
        if in_range(dt):
            return dt.isoformat()
    except Exception:
        pass

    # DD/MM/YYYY
    dm = re.search(r"\b(\d{1,2})[/.\-](\d{1,2})[/.\-](\d{2,4})\b", t)
    if dm:
        dd, mm, yy = int(dm.group(1)), int(dm.group(2)), int(dm.group(3))
        if yy < 100:
            yy += 2000
        try:
            dt = datetime(yy, mm, dd)
            if in_range(dt):
                return dt.isoformat()
        except Exception:
            pass
    return None


def parse_last_chapter(html: str, base_url: str) -> dict | None:
    """Port Python de parseLastChapter() du background.js."""
    title_slug = None
    try:
        parts = urlparse(base_url).path.rstrip("/").split("/")
        parts = [p for p in parts if p]
        if parts:
            title_slug = parts[-1]
    except Exception:
        pass

    all_candidates = []
    specific_candidates = []

    for am in re.finditer(r'<a[^>]+href=["\']([^"\']+)["\'][^>]*>([\s\S]*?)</a>', html, re.IGNORECASE):
        href = am.group(1)
        text = re.sub(r"<[^>]+>", " ", am.group(2)).strip()
        km = CHAPTER_RE.search(href) or CHAPTER_RE.search(text)
        if km:
            num = float(km.group(2))
            if not (0 < num <= MAX_CHAPTER):
                continue
            try:
                url = urljoin(base_url, href)
            except Exception:
                url = href
            c = {"num": num, "url": url}
            all_candidates.append(c)
            if title_slug and title_slug in href:
                specific_candidates.append(c)

    candidates = specific_candidates if specific_candidates else ([] if title_slug else all_candidates)

    # Fallback slug regex
    if not candidates and title_slug:
        slug_pat = re.compile(
            re.escape(title_slug).replace(r"\-", r"[-_]")
            + r"/(chapter|chap|ch|episode|ep)[-_]?(\d+(?:\.\d+)?)",
            re.IGNORECASE,
        )
        for hm in re.finditer(r'href=["\']([^"\']+)["\']', html, re.IGNORECASE):
            href = hm.group(1)
            sm = slug_pat.search(href)
            if sm:
                num = float(sm.group(2))
                if 0 < num <= MAX_CHAPTER:
                    try:
                        url = urljoin(base_url, href)
                    except Exception:
                        url = href
                    candidates.append({"num": num, "url": url})

    # Dernier recours sans slug
    if not candidates and not title_slug:
        for rm in re.finditer(r'["\'/](chapter|chap|ch|episode|ep)[-_]?(\d+(?:\.\d+)?)["\'/]', html, re.IGNORECASE):
            num = float(rm.group(2))
            if 0 < num <= MAX_CHAPTER:
                candidates.append({"num": num, "url": base_url})

    if not candidates:
        return None

    candidates.sort(key=lambda c: c["num"], reverse=True)
    return candidates[0]


def is_redirected_away(original_url: str, final_url: str) -> bool:
    if not final_url or final_url == original_url:
        return False
    try:
        orig = urlparse(original_url)
        final = urlparse(final_url)
        norm = lambda h: re.sub(r"^www\.", "", h)
        if norm(orig.hostname or "") != norm(final.hostname or ""):
            return True
        orig_parts = [p for p in orig.path.rstrip("/").split("/") if p]
        final_parts = [p for p in final.path.rstrip("/").split("/") if p]
        orig_depth = len(orig_parts)
        final_depth = len(final_parts)
        if orig_depth >= 2 and final_depth <= 1:
            return True
        # Redirection vers une page de niveau supérieur sur le même site :
        # ex. /chapter/slug/ch-2227 → /manga/slug (le premier segment du chemin change)
        if orig_depth >= 3 and final_depth <= 2 and orig_parts and final_parts and orig_parts[0] != final_parts[0]:
            return True
    except Exception:
        pass
    return False


def is_soft_404(html: str, page_title: str = "") -> bool:
    title_l = page_title.lower()
    body_snippet = html[:2000].lower()
    return (
        "404" in title_l or "not found" in title_l or "introuvable" in title_l
        or ("404" in body_snippet and re.search(r"not.?found|error|erreur", body_snippet))
    )


def validate_chapter_content(html: str) -> bool:
    """Détecte early access / paywall. Port de validateChapterContent() JS."""
    body_l = html.lower()
    paywall_kw = [
        "early access", "subscribe to read", "unlock chapter", "premium chapter",
        "members only", "vip chapter", "patreon", "ko-fi", "supporter only",
        "accès anticipé", "chapitre réservé", "abonnés", "débloquer",
        # pages de login / abonnement
        "log in to continue", "sign in to read", "login to read",
        "sign in to continue", "register to read", "sign in to access",
        "you're trying to read",
        # vortexscans et sites avec pièces / timer
        "please login to unlock", "waiting to be unlocked", "free after",
    ]
    if any(kw in body_l for kw in paywall_kw):
        return False

    img_re = re.compile(
        r'(?:src|data-src|data-lazy|data-lazy-src|data-original|data-cfsrc)=["\']([^"\']{10,})["\']',
        re.IGNORECASE,
    )
    images = set()
    for im in img_re.finditer(html):
        val = im.group(1).split()[0]
        if re.search(r"\.(jpg|jpeg|png|webp|gif)", val, re.IGNORECASE):
            images.add(val)
    if len(images) >= 3:
        return True

    return True


# ── Fetching ────────────────────────────────────────────────────────────────────

def _fetch_simple(url: str) -> dict:
    """Fetch HTTP classique (équivalent fetchSilent)."""
    from scrapling.fetchers import Fetcher
    try:
        resp = Fetcher().get(url, headers=BASE_HEADERS, timeout=20)
    except Exception as e:
        raise ConnectionError(f"Fetch échoué: {e}") from e

    status = getattr(resp, "status", 200)
    final_url = getattr(resp, "url", url)
    html = getattr(resp, "html_content", "") or ""

    if status in (404, 410):
        return {"found": None, "is404": True, "html": None}

    if is_redirected_away(url, str(final_url)):
        return {"found": None, "isRedirect": True, "html": None}

    page_title = ""
    tm = re.search(r"<title[^>]*>([^<]+)</title>", html, re.IGNORECASE)
    if tm:
        page_title = tm.group(1)

    if is_soft_404(html, page_title):
        return {"found": None, "is404": True, "html": None}

    found = parse_last_chapter(html, url)
    cover_url = parse_cover_url(html)
    title_type = parse_type(html)
    return {
        "found": found,
        "is404": False,
        "isRedirect": False,
        "coverUrl": cover_url,
        "type": title_type,
        "html": html,
    }


def _extract_from_page(page, base_url: str) -> dict:
    """Extraction CSS depuis une page scrapling rendue par Playwright."""
    title_slug = None
    try:
        parts = [p for p in urlparse(base_url).path.rstrip("/").split("/") if p]
        if parts:
            title_slug = parts[-1]
    except Exception:
        pass

    all_candidates = []
    specific_candidates = []

    # Essayer d'abord les sélecteurs connus des sites manga
    for sel in CHAPTER_SELECTORS:
        try:
            els = page.css(sel) or []
        except Exception:
            els = []
        if els:
            for el in els:
                href = el.attrib.get("href", "") if hasattr(el, "attrib") else ""
                text = (el.text or "") if hasattr(el, "text") else ""
                km = CHAPTER_RE.search(href) or CHAPTER_RE.search(text)
                if km:
                    num = float(km.group(2))
                    if 0 < num <= MAX_CHAPTER:
                        try:
                            full_url = urljoin(base_url, href)
                        except Exception:
                            full_url = href
                        c = {"num": num, "url": full_url}
                        all_candidates.append(c)
                        if title_slug and title_slug in href:
                            specific_candidates.append(c)
            if all_candidates:
                break

    # Fallback : tous les liens
    if not all_candidates:
        try:
            for el in (page.css("a[href]") or []):
                href = el.attrib.get("href", "") if hasattr(el, "attrib") else ""
                text = (el.text or "") if hasattr(el, "text") else ""
                km = CHAPTER_RE.search(href) or CHAPTER_RE.search(text)
                if km:
                    num = float(km.group(2))
                    if 0 < num <= MAX_CHAPTER:
                        try:
                            full_url = urljoin(base_url, href)
                        except Exception:
                            full_url = href
                        c = {"num": num, "url": full_url}
                        all_candidates.append(c)
                        if title_slug and title_slug in href:
                            specific_candidates.append(c)
        except Exception:
            pass

    candidates = specific_candidates if specific_candidates else all_candidates
    if not candidates:
        # Retourner le HTML brut pour le parsing regex en fallback
        html = getattr(page, "html_content", "") or ""
        return {"found": parse_last_chapter(html, base_url), "is404": False, "html": html}

    candidates.sort(key=lambda c: c["num"], reverse=True)
    best = candidates[0]

    # Cover
    cover_url = None
    try:
        og = page.css('meta[property="og:image"]')
        if og:
            cover_url = og[0].attrib.get("content")
    except Exception:
        pass

    # Type
    title_type = None
    try:
        html = getattr(page, "html_content", "") or ""
        title_type = parse_type(html)
    except Exception:
        pass

    # 404 check
    try:
        page_title = ""
        title_els = page.css("title")
        if title_els:
            page_title = title_els[0].text or ""
        html = getattr(page, "html_content", "") or ""
        if is_soft_404(html, page_title):
            return {"found": None, "is404": True, "html": None}
    except Exception:
        pass

    return {"found": best, "is404": False, "coverUrl": cover_url, "type": title_type, "html": None}


def _fetch_stealth(url: str) -> dict:
    """Fetch via Playwright (équivalent fetchViaTab + injectedExtract)."""
    from scrapling.fetchers import StealthyFetcher
    try:
        page = StealthyFetcher.fetch(url, timeout=35000, wait=3000)
    except Exception as e:
        log.warning("StealthyFetcher échoué pour %s : %s — fallback HTTP", url, e)
        result = _fetch_simple(url)
        if not result.get("found"):
            log.warning("Fallback HTTP aussi sans résultat pour %s (site probablement JS-only)", url)
        return result

    final_url = getattr(page, "url", url)
    if is_redirected_away(url, str(final_url)):
        return {"found": None, "isRedirect": True, "html": None}

    return _extract_from_page(page, url)


def fetch_for_site(url: str, needs_tab: bool = False) -> dict:
    """Point d'entrée principal. Retourne un dict avec 'found', 'coverUrl', 'type', 'is404', 'isRedirect'."""
    try:
        if needs_tab:
            return _fetch_stealth(url)
        return _fetch_simple(url)
    except Exception as e:
        log.error("fetch_for_site(%s) erreur: %s", url, e)
        return {"found": None, "is404": False, "isRedirect": False, "html": None}
