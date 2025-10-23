import { createRemoteJWKSet, jwtVerify } from "jose";

const ISSUER = process.env.AUTH0_ISSUER;   
const AUDIENCE = process.env.AUTH0_AUDIENCE;

if (!ISSUER || !AUDIENCE) {
  throw new Error("Missing AUTH0_ISSUER or AUTH0_AUDIENCE environment variables");
}

const JWKS = createRemoteJWKSet(new URL(`${ISSUER}.well-known/jwks.json`));

export type AuthContext = {
  sub: string;          
  scope?: string;
  [k: string]: unknown; 
};

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
      issuer: ISSUER,     
      audience: AUDIENCE, 
    });
    return payload as AuthContext;
  } catch (e: any) {
    const err = new Error(e?.message || "Invalid token");
    (err as any).status = e?.code === "ERR_JWS_SIGNATURE_VERIFICATION_FAILED" ? 401 : 403;
    throw err;
  }
}

export async function getAuthOrNull(req: Request): Promise<AuthContext | null> {
  try {
    return await requireAuth(req);
  } catch {
    return null;
  }
}
