# ── OAuth client secrets ──────────────────────────────────────────────────────
# One Secrets Manager entry per provider.  Client IDs are not secret and live
# as plain environment variables; client secrets are injected into ECS via the
# `secrets` block (see ecs.tf).
#
# After `terraform apply`, populate each secret:
#   aws secretsmanager put-secret-value \
#     --secret-id wheel-app/oauth-google --secret-string "<YOUR_GOOGLE_CLIENT_SECRET>"

resource "aws_secretsmanager_secret" "oauth_google" {
  name                    = "${var.app_name}/oauth-google"
  description             = "Google OAuth client secret for ${var.app_name}"
  recovery_window_in_days = 7
  tags                    = { Name = "${var.app_name}-oauth-google" }
}

resource "aws_secretsmanager_secret_version" "oauth_google_placeholder" {
  secret_id     = aws_secretsmanager_secret.oauth_google.id
  secret_string = "REPLACE_ME"
  lifecycle { ignore_changes = [secret_string] }
}

resource "aws_secretsmanager_secret" "oauth_microsoft" {
  name                    = "${var.app_name}/oauth-microsoft"
  description             = "Microsoft OAuth client secret for ${var.app_name}"
  recovery_window_in_days = 7
  tags                    = { Name = "${var.app_name}-oauth-microsoft" }
}

resource "aws_secretsmanager_secret_version" "oauth_microsoft_placeholder" {
  secret_id     = aws_secretsmanager_secret.oauth_microsoft.id
  secret_string = "REPLACE_ME"
  lifecycle { ignore_changes = [secret_string] }
}

resource "aws_secretsmanager_secret" "oauth_github" {
  name                    = "${var.app_name}/oauth-github"
  description             = "GitHub OAuth client secret for ${var.app_name}"
  recovery_window_in_days = 7
  tags                    = { Name = "${var.app_name}-oauth-github" }
}

resource "aws_secretsmanager_secret_version" "oauth_github_placeholder" {
  secret_id     = aws_secretsmanager_secret.oauth_github.id
  secret_string = "REPLACE_ME"
  lifecycle { ignore_changes = [secret_string] }
}
