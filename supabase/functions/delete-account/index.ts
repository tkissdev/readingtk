import { createClient } from "jsr:@supabase/supabase-js@2";

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405 });
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return new Response(JSON.stringify({ error: "Missing Authorization header" }), { status: 401 });
  }

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
  const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  // Client scopé au JWT de l'appelant, utilisé uniquement pour vérifier son identité.
  const callerClient = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: userData, error: userError } = await callerClient.auth.getUser();
  if (userError || !userData?.user) {
    return new Response(JSON.stringify({ error: "Session invalide" }), { status: 401 });
  }
  const userId = userData.user.id;

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

  // Nettoyage best-effort des images de couverture stockées pour les titres de cet utilisateur.
  try {
    const { data: titles } = await admin.from("titles").select("cover_url").eq("user_id", userId);
    const marker = "/storage/v1/object/public/covers/";
    const paths = (titles ?? [])
      .map((t: { cover_url: string | null }) => t.cover_url)
      .filter((u: string | null): u is string => !!u && u.includes(marker))
      .map((u: string) => u.split(marker)[1]);
    if (paths.length > 0) {
      await admin.storage.from("covers").remove(paths);
    }
  } catch (_e) {
    // Non bloquant : la suppression du compte doit continuer même si le nettoyage des images échoue.
  }

  // Supprime l'utilisateur auth : toutes les tables (profiles, titles, sites, user_settings,
  // title_sources, reading_progress, chapters, notifications, imports, release_schedules)
  // sont en ON DELETE CASCADE sur profiles.id -> auth.users.id, donc tout est nettoyé automatiquement,
  // sans jamais toucher aux données d'un autre utilisateur.
  const { error: deleteError } = await admin.auth.admin.deleteUser(userId);
  if (deleteError) {
    return new Response(JSON.stringify({ error: deleteError.message }), { status: 500 });
  }

  return new Response(JSON.stringify({ success: true }), {
    headers: { "Content-Type": "application/json" },
  });
});
