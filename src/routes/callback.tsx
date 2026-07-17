import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/i18n";

const DESKTOP_PORT_KEY = "desktopAuthPort";

export const Route = createFileRoute("/callback")({
  ssr: false,
  component: AuthCallback,
});

function AuthCallback() {
  const navigate = useNavigate();
  const { t } = useI18n();
  const [desktopStatus, setDesktopStatus] = useState<"idle" | "sending" | "done">("idle");

  useEffect(() => {
    const desktopPort = sessionStorage.getItem(DESKTOP_PORT_KEY);

    const handleSession = async (session: object) => {
      if (desktopPort) {
        sessionStorage.removeItem(DESKTOP_PORT_KEY);
        setDesktopStatus("sending");
        try {
          await fetch(`http://localhost:${desktopPort}/session`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(session),
            signal: AbortSignal.timeout(3000),
          });
          setDesktopStatus("done");
        } catch {
          // L'app Windows n'est pas lancée — on redirige vers le dashboard quand même
          navigate({ to: "/dashboard", replace: true });
        }
      } else {
        navigate({ to: "/dashboard", replace: true });
      }
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_IN" && session) {
        subscription.unsubscribe();
        handleSession(session);
      } else if (event === "SIGNED_OUT") {
        subscription.unsubscribe();
        navigate({ to: "/auth", replace: true });
      }
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        subscription.unsubscribe();
        handleSession(session);
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  if (desktopStatus === "done") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background" style={{ backgroundImage: "var(--gradient-hero)" }}>
        <div className="w-full max-w-md rounded-2xl border border-border/60 bg-card/80 p-8 backdrop-blur text-center" style={{ boxShadow: "var(--shadow-card)" }}>
          <div className="mb-4 flex justify-center">
            <img src="/Logo RTK.png" alt="ReadingTK" style={{ width: 140, height: "auto", mixBlendMode: "lighten" }} />
          </div>
          <div className="text-4xl mb-3">✓</div>
          <h1 className="text-xl font-semibold mb-2">Connecté !</h1>
          <p className="text-sm text-muted-foreground">Vous pouvez fermer cet onglet et revenir à l'application Windows.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-3">
        <span className="h-8 w-8 animate-spin rounded-full border-2 border-accent border-t-transparent" />
        <p className="text-sm text-muted-foreground">{t("callback.connecting")}</p>
      </div>
    </div>
  );
}
