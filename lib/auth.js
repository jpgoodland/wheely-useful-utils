import { SignJWT, jwtVerify } from "jose";

const getJwtSecret = () => {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    // Only allow the insecure fallback in local development.
    // Any other environment (staging, production, CI with real data) must
    // supply a strong secret via the JWT_SECRET env var.
    if (process.env.NODE_ENV !== "development") {
      throw new Error("Missing JWT_SECRET environment variable");
    }
    return "super_secret_local_key_for_jwt"; // dev-only fallback
  }
  return secret;
};

export async function signToken(payload) {
  const secret = new TextEncoder().encode(getJwtSecret());
  return await new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("30m")
    .sign(secret);
}

export async function verifyToken(token) {
  try {
    const secret = new TextEncoder().encode(getJwtSecret());
    const { payload } = await jwtVerify(token, secret);
    return payload;
  } catch (error) {
    return null;
  }
}
