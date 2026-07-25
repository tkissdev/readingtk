import { Link } from "@tanstack/react-router";
import { useI18n } from "@/i18n";

const VERSION = "1.12";

export function Footer() {
  const { t } = useI18n();
  return (
    <footer className="flex shrink-0 items-center justify-center gap-2 border-t border-border py-4 text-xs text-muted-foreground">
      <span>ReadingTK v{VERSION}</span>
      <span>·</span>
      <Link to="/privacy" className="hover:text-foreground hover:underline">
        {t("landing.footerPrivacy")}
      </Link>
      <span>·</span>
      <Link to="/contribute" className="hover:text-foreground hover:underline">
        {t("landing.footerContribute")}
      </Link>
    </footer>
  );
}
