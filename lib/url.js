/**
 * Return a trusted base URL for the application from an incoming Request.
 *
 * Never trust user-supplied `Origin` or `Referer` headers for constructing
 * sensitive links (e.g. password resets, verification emails, invites), as doing
 * so enables Host/Origin header injection attacks.
 *
 * Uses APP_DOMAIN if defined, or validated Host / X-Forwarded-Host headers.
 *
 * @param {Request} [req]
 * @returns {string} e.g. "https://wheel-app.example.com" or "http://localhost:3000"
 */
export function getTrustedBaseUrl(req) {
  // If explicitly configured, APP_DOMAIN takes precedence
  if (process.env.APP_DOMAIN) {
    const proto =
      process.env.FORCE_HTTPS === "true" || process.env.NODE_ENV === "production"
        ? "https"
        : "http";
    const domain = process.env.APP_DOMAIN.replace(/^https?:\/\//, "");
    return `${proto}://${domain}`;
  }

  const forwardedProto = req?.headers?.get?.("x-forwarded-proto");
  const forwardedHost = req?.headers?.get?.("x-forwarded-host");
  const rawHost =
    forwardedHost ||
    req?.headers?.get?.("host") ||
    "localhost:3000";

  // Sanitize host: take the first host in comma-separated list, strip unexpected characters
  const host = rawHost.split(",")[0].trim().replace(/[^\w.:-]/g, "");

  let protocol = forwardedProto;
  if (!protocol || (protocol !== "http" && protocol !== "https")) {
    if (process.env.FORCE_HTTPS === "true" || process.env.NODE_ENV === "production") {
      protocol = "https";
    } else {
      protocol = "http";
    }
  }

  return `${protocol}://${host || "localhost:3000"}`;
}
