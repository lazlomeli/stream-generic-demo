// api/_utils/auth0.ts
import { createRemoteJWKSet, jwtVerify } from "jose";

const ISSUER = process.env.AUTH0_ISSUER;   // ej: https://dev-xxxxx.us.auth0.com/
const AUDIENCE = process.env.AUTH0_AUDIENCE;

if (!ISSUER || !AUDIENCE) {
  throw new Error("Missing AUTH0_ISSUER or AUTH0_AUDIENCE environment variables");
}

// Cachea/rota claves públicas de Auth0 automáticamente
const JWKS = createRemoteJWKSet(new URL(`${ISSUER}.well-known/jwks.json`));

export type AuthContext = {
  sub: string;          // user id (p.ej. "auth0|abc123")
  scope?: string;
  [k: string]: unknown; // otros claims si los necesitas
};

/**
 * Extrae y verifica el Bearer token del header Authorization.
 * Lanza un error con {status: 401/403} si algo falla.
 */
export async function requireAuth(req: Request): Promise<AuthContext> {
  const authHeader = req.headers.get("authorization") || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";

  if (!token) {
    const err = new Error("Missing bearer token");
    (err as any).status = 401;
    throw err;
  }

  try {
    const { payload } = await jwtVerify(token, JWKS, {
      issuer: ISSUER,     // debe coincidir exactamente (incluida la / final)
      audience: AUDIENCE, // debe coincidir con tu API Identifier
    });
    return payload as AuthContext;
  } catch (e: any) {
    // Diferencia 401 vs 403 si quieres granularidad
    const err = new Error(e?.message || "Invalid token");
    (err as any).status = e?.code === "ERR_JWS_SIGNATURE_VERIFICATION_FAILED" ? 401 : 403;
    throw err;
  }
}

/**
 * (Opcional) helper por si solo quieres el `sub` o null en vez de lanzar error
 */
export async function getAuthOrNull(req: Request): Promise<AuthContext | null> {
  try {
    return await requireAuth(req);
  } catch {
    return null;
  }
}
