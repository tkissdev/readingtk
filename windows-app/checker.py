"""Logique de vérification des chapitres — port de runCheck() du background.js"""
import logging
import re
import unicodedata
from datetime import datetime

from supabase_client import supabase
from scraper import fetch_for_site, validate_chapter_content, parse_last_chapter

log = logging.getLogger("rtk.checker")


def title_to_slug(name: str) -> str:
    """Port de titleToSlug() JS."""
    nfd = unicodedata.normalize("NFD", name)
    ascii_only = nfd.encode("ascii", "ignore").decode()
    slug = re.sub(r"[^a-z0-9]+", "-", ascii_only.lower()).strip("-")
    return slug


def _chapter_label(num: float, fmt: str) -> str:
    return str(num) if fmt == "numeric" else f"Chapter {num}"


async def _save_chapter(title_id: str, site_id: str, chap_label: str, chap_url: str,
                        last_read: float, source_url: str) -> dict:
    """Upsert d'un chapitre. Retourne {'is_new': bool, 'chapter_id': str|None}."""
    existing = supabase.get(
        f"/chapters?title_id=eq.{title_id}&chapter_url=eq.{chap_url}&select=id,chapter_label"
    )
    if existing:
        return {"is_new": False, "chapter_id": existing[0]["id"]}

    num = float(chap_label) if chap_label.replace(".", "").isdigit() else -1
    is_new = num < 0 or last_read < 0 or num > last_read

    rows = supabase.post("/chapters", {
        "title_id": title_id,
        "site_id": site_id,
        "chapter_label": chap_label,
        "chapter_url": chap_url,
        "source_url": source_url,
        "detected_at": datetime.utcnow().isoformat(),
    })
    chapter_id = rows[0]["id"] if rows else None
    return {"is_new": is_new, "chapter_id": chapter_id}


def run_check(on_new_chapter=None, on_progress=None) -> dict:
    """
    Vérifie tous les titres de l'utilisateur.
    on_new_chapter(title_name, chap_label, chap_url) — callback appelé pour chaque nouveau chapitre.
    Retourne {'detected': int, 'errors': int}.
    """
    uid = supabase.user_id
    if not uid:
        log.warning("run_check : utilisateur non connecté")
        return {"detected": 0, "errors": 0}

    settings_rows = supabase.get(
        f"/user_settings?user_id=eq.{uid}&select=chapter_format,auto_discover"
    )
    settings = settings_rows[0] if settings_rows else {}
    fmt = "numeric" if settings.get("chapter_format") != "text" else "text"
    auto_discover = bool(settings.get("auto_discover", False))

    titles = supabase.get(
        f"/titles?user_id=eq.{uid}&status=neq.dropped"
        f"&select=id,name,type,type_locked,cover_url,"
        f"title_sources(id,url,site_id,last_seen_chapter,last_error,sites(needs_tab,priority))"
    )

    global_sites = []
    if auto_discover:
        global_sites = supabase.get(
            f"/sites?user_id=eq.{uid}&url_template=not.is.null&enabled=eq.true"
            "&select=id,name,url_template,needs_tab"
        ) or []

    detected = 0
    errors = 0
    total = len(titles or [])

    for i, title in enumerate(titles or []):
        if on_progress:
            on_progress(i + 1, total, title.get("name", "…"))
        sources = sorted(
            [s for s in (title.get("title_sources") or []) if s.get("url")],
            key=lambda s: (s.get("sites") or {}).get("priority") or 0,
            reverse=True,
        )

        progress = supabase.get(
            f"/reading_progress?title_id=eq.{title['id']}&select=last_chapter_read"
        )
        try:
            last_read = float(progress[0]["last_chapter_read"]) if progress and progress[0].get("last_chapter_read") else -1
        except (ValueError, TypeError):
            last_read = -1

        new_chapters = []
        best_type_priority = -1

        # ── 1. Sources existantes ──────────────────────────────────────────────
        for src in sources:
            src_priority = (src.get("sites") or {}).get("priority") or 0
            needs_tab = (src.get("sites") or {}).get("needs_tab") is True
            try:
                result = fetch_for_site(src["url"], needs_tab=needs_tab)

                if result.get("isRedirect"):
                    supabase.patch(f"/title_sources?id=eq.{src['id']}", {"last_error": "redirect", "last_seen_chapter": None})
                    errors += 1
                    continue

                if result.get("is404"):
                    supabase.patch(f"/title_sources?id=eq.{src['id']}", {"last_error": "404"})
                    if src.get("site_id"):
                        supabase.patch(f"/sites?id=eq.{src['site_id']}", {"is_down": True, "enabled": False})
                    errors += 1
                    continue

                found = result.get("found")
                if not found:
                    if result.get("html"):
                        found = parse_last_chapter(result["html"], src["url"])
                if not found:
                    continue

                chap_label = _chapter_label(found["num"], fmt)

                # Paywall check avant d'écrire en BDD
                would_be_new = found["num"] > last_read if last_read >= 0 else True
                if would_be_new:
                    try:
                        chap_html_resp = fetch_for_site(found["url"], needs_tab=needs_tab)
                        chap_html = chap_html_resp.get("html") or ""
                        if not validate_chapter_content(chap_html):
                            log.info("Early access ignoré: %s", found["url"])
                            continue
                    except Exception:
                        pass  # En cas d'erreur, ne pas bloquer

                supabase.patch(f"/title_sources?id=eq.{src['id']}", {"last_seen_chapter": chap_label, "last_error": None})

                # Couverture (seulement si le titre n'en a pas)
                cover_url = result.get("coverUrl")
                if cover_url and not title.get("cover_url"):
                    try:
                        stored = supabase.invoke_edge("cache-cover", {"imageUrl": cover_url, "titleId": title["id"]})
                        title["cover_url"] = stored.get("url") or cover_url
                    except Exception:
                        pass

                # Type
                title_type = result.get("type")
                if title_type and not title.get("type_locked") and (not title.get("type") or src_priority > best_type_priority):
                    supabase.patch(f"/titles?id=eq.{title['id']}", {"type": title_type})
                    title["type"] = title_type
                    best_type_priority = src_priority

                # Sauvegarde
                save_result = _save_chapter(
                    title_id=title["id"], site_id=src["site_id"],
                    chap_label=chap_label, chap_url=found["url"],
                    last_read=last_read, source_url=src["url"],
                )
                if save_result["is_new"] and found["num"] > last_read:
                    new_chapters.append({"num": found["num"], "label": chap_label, "url": found["url"]})

            except Exception as e:
                log.error("Erreur source %s : %s", src.get("url"), e)
                errors += 1

        # ── 2. Auto-découverte ─────────────────────────────────────────────────
        if auto_discover and global_sites:
            slug = title_to_slug(title["name"])
            for site in global_sites:
                already_linked = any(s.get("site_id") == site["id"] for s in sources)
                if already_linked:
                    continue
                template_url = (site.get("url_template") or "").replace("{slug}", slug)
                if not template_url:
                    continue
                try:
                    result = fetch_for_site(template_url, needs_tab=site.get("needs_tab") is True)
                    if result.get("isRedirect") or result.get("is404"):
                        continue
                    found = result.get("found")
                    if not result.get("found") and result.get("html"):
                        found = parse_last_chapter(result["html"], template_url)
                    if not found:
                        continue

                    chap_label = _chapter_label(found["num"], fmt)
                    log.info("Auto-découverte: %s sur %s", title["name"], site["name"])

                    # Paywall check
                    would_be_new = found["num"] > last_read if last_read >= 0 else True
                    if would_be_new:
                        try:
                            chap_html_resp = fetch_for_site(found["url"], needs_tab=site.get("needs_tab") is True)
                            if not validate_chapter_content(chap_html_resp.get("html") or ""):
                                log.info("Early access ignoré (auto-découverte): %s", found["url"])
                                continue
                        except Exception:
                            pass

                    new_src_rows = supabase.post("/title_sources", {
                        "title_id": title["id"],
                        "site_id": site["id"],
                        "url": template_url,
                        "is_primary": False,
                    })
                    if new_src_rows and new_src_rows[0].get("id"):
                        supabase.patch(f"/title_sources?id=eq.{new_src_rows[0]['id']}", {"last_seen_chapter": chap_label})
                        sources.append({"id": new_src_rows[0]["id"], "url": template_url, "site_id": site["id"]})

                    save_result = _save_chapter(
                        title_id=title["id"], site_id=site["id"],
                        chap_label=chap_label, chap_url=found["url"],
                        last_read=last_read, source_url=template_url,
                    )
                    if save_result["is_new"] and found["num"] > last_read:
                        new_chapters.append({"num": found["num"], "label": chap_label, "url": found["url"]})

                except Exception as e:
                    log.error("Auto-découverte erreur %s / %s : %s", title["name"], site.get("name"), e)

        # ── 3. Notification pour ce titre ─────────────────────────────────────
        if new_chapters:
            detected += 1
            best = max(new_chapters, key=lambda c: c["num"])
            if on_new_chapter:
                try:
                    on_new_chapter(title["name"], best["label"], best["url"])
                except Exception as e:
                    log.warning("Callback notification erreur: %s", e)

    log.info("Check terminé : %d nouveau(x), %d erreur(s)", detected, errors)
    return {"detected": detected, "errors": errors}
