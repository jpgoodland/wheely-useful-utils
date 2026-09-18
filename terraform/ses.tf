# ── SES domain identity ───────────────────────────────────────────────────────
# Verifies the domain so SES can send email on behalf of @<domain>.
# After `terraform apply`, add the outputted DKIM CNAME records to your DNS
# provider to complete verification.

resource "aws_ses_domain_identity" "app" {
  domain = var.domain
}

# ── DKIM signing ──────────────────────────────────────────────────────────────
# SES generates three DKIM tokens; each becomes a CNAME record that proves
# domain ownership and enables DKIM-signed outbound mail.

resource "aws_ses_domain_dkim" "app" {
  domain = aws_ses_domain_identity.app.domain
}

# ── Mail-from domain ──────────────────────────────────────────────────────────
# Using a custom MAIL FROM domain (mail.<domain>) improves deliverability
# and SPF alignment.

resource "aws_ses_domain_mail_from" "app" {
  domain           = aws_ses_domain_identity.app.domain
  mail_from_domain = "mail.${var.domain}"
}

# ── SES configuration set ────────────────────────────────────────────────────
# Groups sending config (bounce/complaint tracking). Attaches to every email
# sent by the app.

resource "aws_ses_configuration_set" "app" {
  name = "${var.app_name}-emails"

  delivery_options {
    tls_policy = "Require"
  }
}
