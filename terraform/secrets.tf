# JWT secret — value must be set out-of-band (see README).
# Terraform creates the secret shell; the actual value is populated by the
# operator with: aws secretsmanager put-secret-value ...
# This avoids the secret ever appearing in Terraform state.

resource "aws_secretsmanager_secret" "jwt_secret" {
  name                    = "${var.app_name}/jwt-secret"
  description             = "JWT signing secret for ${var.app_name}"
  recovery_window_in_days = 7

  tags = { Name = "${var.app_name}-jwt-secret" }
}

# Placeholder so the secret has a value before ECS tries to read it.
# Replace this with your real secret immediately after `terraform apply`:
#   aws secretsmanager put-secret-value \
#     --secret-id <name> --secret-string "$(openssl rand -hex 32)"
resource "aws_secretsmanager_secret_version" "jwt_secret_placeholder" {
  secret_id     = aws_secretsmanager_secret.jwt_secret.id
  secret_string = "REPLACE_ME_BEFORE_DEPLOYING"

  lifecycle {
    # Prevent Terraform from overwriting the secret once a real value is set
    ignore_changes = [secret_string]
  }
}
