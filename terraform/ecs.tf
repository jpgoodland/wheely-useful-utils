resource "aws_ecs_cluster" "main" {
  name = var.app_name

  setting {
    name  = "containerInsights"
    value = "enabled"
  }

  tags = { Name = var.app_name }
}

resource "aws_cloudwatch_log_group" "app" {
  name              = "/ecs/${var.app_name}"
  retention_in_days = 30
}

resource "aws_ecs_task_definition" "app" {
  family                   = var.app_name
  network_mode             = "awsvpc"
  requires_compatibilities = ["FARGATE"]
  cpu                      = var.task_cpu
  memory                   = var.task_memory
  execution_role_arn       = aws_iam_role.task_exec.arn
  task_role_arn            = aws_iam_role.task.arn

  container_definitions = jsonencode([{
    name      = var.app_name
    image     = "${aws_ecr_repository.app.repository_url}:${var.image_tag}"
    essential = true

    portMappings = [{
      containerPort = 3000
      protocol      = "tcp"
    }]

    environment = [
      { name = "NODE_ENV", value = "production" },
      { name = "AWS_REGION", value = var.aws_region },
      { name = "FORCE_HTTPS", value = "true" },
      { name = "APP_DOMAIN", value = var.domain },
      { name = "SES_CONFIG_SET", value = aws_ses_configuration_set.app.name },
      { name = "OAUTH_GOOGLE_CLIENT_ID", value = var.oauth_google_client_id },
      { name = "OAUTH_MICROSOFT_CLIENT_ID", value = var.oauth_microsoft_client_id },
      { name = "OAUTH_GITHUB_CLIENT_ID", value = var.oauth_github_client_id },
      { name = "ADMIN_EMAILS", value = var.admin_emails },
    ]

    # Secrets are injected from Secrets Manager — never appear in plaintext
    secrets = [
      {
        name      = "JWT_SECRET"
        valueFrom = aws_secretsmanager_secret.jwt_secret.arn
      },
      {
        name      = "OAUTH_GOOGLE_CLIENT_SECRET"
        valueFrom = aws_secretsmanager_secret.oauth_google.arn
      },
      {
        name      = "OAUTH_MICROSOFT_CLIENT_SECRET"
        valueFrom = aws_secretsmanager_secret.oauth_microsoft.arn
      },
      {
        name      = "OAUTH_GITHUB_CLIENT_SECRET"
        valueFrom = aws_secretsmanager_secret.oauth_github.arn
      },
    ]

    logConfiguration = {
      logDriver = "awslogs"
      options = {
        "awslogs-group"         = aws_cloudwatch_log_group.app.name
        "awslogs-region"        = var.aws_region
        "awslogs-stream-prefix" = "ecs"
      }
    }
  }])
}

resource "aws_ecs_service" "app" {
  name            = var.app_name
  cluster         = aws_ecs_cluster.main.id
  task_definition = aws_ecs_task_definition.app.arn
  desired_count   = var.desired_count
  launch_type     = "FARGATE"

  # Pick up new task definitions automatically on the next deployment
  force_new_deployment = true

  network_configuration {
    subnets          = aws_subnet.public[*].id
    security_groups  = [aws_security_group.app.id]
    assign_public_ip = true
  }

  load_balancer {
    target_group_arn = aws_lb_target_group.app.arn
    container_name   = var.app_name
    container_port   = 3000
  }

  depends_on = [
    aws_lb_listener.https,
    aws_iam_role_policy_attachment.task_exec_managed,
  ]
}
