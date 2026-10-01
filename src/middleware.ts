import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// /auth/activar: la sesión de la invitación llega como fragmento de URL
// (#access_token=...), que el navegador recién fija en cookies DESPUÉS de
// que esta primera petición ya se resolvió — si no fuera pública, el
// middleware rebotaría esa primera carga a /login antes de que el cliente
// alcance a establecer la sesión.
const RUTAS_PUBLICAS = ["/login", "/auth/callback", "/auth/activar"];

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
          for (const { name, value } of cookiesToSet) {
            request.cookies.set(name, value);
          }
          response = NextResponse.next({ request });
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options);
          }
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const esRutaPublica = RUTAS_PUBLICAS.some((ruta) => request.nextUrl.pathname.startsWith(ruta));

  // getUser() puede haber refrescado la sesión y guardado las cookies
  // nuevas en `response` (vía setAll, arriba). Un redirect() crea una
  // respuesta DISTINTA que no hereda esas cookies — sin copiarlas acá, la
  // sesión refrescada se pierde en cualquier petición que además redirija,
  // y el navegador sigue mandando el refresh token viejo. Eso produce un
  // bucle: sesión válida un instante, inválida al siguiente, de ida y
  // vuelta entre /login y la página protegida (ERR_TOO_MANY_REDIRECTS).
  function redirigirConservandoCookies(url: URL) {
    const redireccion = NextResponse.redirect(url);
    for (const cookie of response.cookies.getAll()) {
      redireccion.cookies.set(cookie);
    }
    return redireccion;
  }

  if (!user && !esRutaPublica) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("redirectTo", request.nextUrl.pathname);
    return redirigirConservandoCookies(url);
  }

  if (user && request.nextUrl.pathname === "/login") {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    return redirigirConservandoCookies(url);
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|brand/|fonts/|api/jobs).*)"],
};
