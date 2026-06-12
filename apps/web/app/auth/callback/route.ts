import { NextResponse, type NextRequest } from "next/server";

import { createSupabaseServerClient } from "@/lib/supabase/server";

/** PKCE-Callback: tauscht den Code aus dem Magic Link gegen eine Session. */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");

  if (code) {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}/verifizierungen`);
    }
  }

  return NextResponse.redirect(`${origin}/login?fehler=link-ungueltig`);
}
