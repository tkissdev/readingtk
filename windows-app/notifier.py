"""Notifications toast Windows."""
import logging
import os
import webbrowser

log = logging.getLogger("rtk.notifier")

# Chemin de l'icône ICO (généré au premier lancement si absent)
_ICON_PATH = os.path.join(os.path.dirname(__file__), "icon.ico")


def _ensure_icon():
    if os.path.exists(_ICON_PATH):
        return _ICON_PATH
    try:
        from PIL import Image, ImageDraw, ImageFont
        img = Image.new("RGBA", (64, 64), (0, 0, 0, 0))
        draw = ImageDraw.Draw(img)
        draw.ellipse([2, 2, 62, 62], fill=(99, 102, 241))  # indigo
        draw.text((16, 16), "R", fill=(255, 255, 255))
        img.save(_ICON_PATH, format="ICO")
    except Exception as e:
        log.warning("Impossible de créer l'icône: %s", e)
    return _ICON_PATH if os.path.exists(_ICON_PATH) else None


def notify(title_name: str, chap_label: str, chap_url: str):
    """Envoie une notification toast Windows."""
    icon = _ensure_icon()
    try:
        from winotify import Notification, audio
        toast = Notification(
            app_id="ReadingTK",
            title=f"Nouveau chapitre — {title_name}",
            msg=chap_label,
            icon=icon or "",
            duration="short",
        )
        toast.set_audio(audio.Default, loop=False)
        toast.add_actions(label="Lire", launch=chap_url)
        toast.show()
    except Exception as e:
        log.error("Notification échouée: %s", e)
