data "aws_iam_policy_document" "ecs_assume_role" {
  statement {
    actions = ["sts:AssumeRole"]
    principals {
      type        = "Service"
      identifiers = ["ecs-tasks.amazonaws.com"]
    }
  }
}

# ── Task execution role ───────────────────────────────────────────────────────
# Used by the ECS agent to pull the image from ECR, write CloudWatch logs,
# and fetch the JWT secret from Secrets Manager at task startup.

resource "aws_iam_role" "task_exec" {
  name               = "${var.app_name}-task-exec-role"
  assume_role_policy = data.aws_iam_policy_document.ecs_assume_role.json
}

resource "aws_iam_role_policy_attachment" "task_exec_managed" {
  role       = aws_iam_role.task_exec.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy"
}

resource "aws_iam_role_policy" "task_exec_secrets" {
  name = "read-jwt-secret"
  role = aws_iam_role.task_exec.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect = "Allow"
      Action = "secretsmanager:GetSecretValue"
      Resource = [
        aws_secretsmanager_secret.jwt_secret.arn,
        aws_secretsmanager_secret.oauth_google.arn,
        aws_secretsmanager_secret.oauth_microsoft.arn,
        aws_secretsmanager_secret.oauth_github.arn,
      ]
    }]
  })
}

# ── Task role ─────────────────────────────────────────────────────────────────
# Assumed by the running container. Grants only the DynamoDB operations the
# app actually uses. No static credentials are ever injected.

resource "aws_iam_role" "task" {
  name               = "${var.app_name}-task-role"
  assume_role_policy = data.aws_iam_policy_document.ecs_assume_role.json
}

resource "aws_iam_role_policy" "task_dynamodb" {
  name = "dynamodb-access"
  role = aws_iam_role.task.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect = "Allow"
      Action = [
        "dynamodb:GetItem",
        "dynamodb:PutItem",
        "dynamodb:UpdateItem",
        "dynamodb:DeleteItem",
        "dynamodb:Query",
        "dynamodb:Scan",
      ]
      Resource = [
        aws_dynamodb_table.users.arn,
        "${aws_dynamodb_table.users.arn}/index/*",
        aws_dynamodb_table.wheels.arn,
        "${aws_dynamodb_table.wheels.arn}/index/*",
      ]
    }]
  })
}

resource "aws_iam_role_policy" "task_ses" {
  name = "ses-send-email"
  role = aws_iam_role.task.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect = "Allow"
      Action = [
        "ses:SendEmail",
        "ses:SendRawEmail",
      ]
      Resource = "*"
      Condition = {
        StringEquals = {
          "ses:FromAddress" = "no-reply@${var.domain}"
        }
      }
    }]
  })
}

