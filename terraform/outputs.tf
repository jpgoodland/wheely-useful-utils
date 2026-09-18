output "ecr_repository_url" {
  description = "ECR repository URL — use this to tag and push images"
  value       = aws_ecr_repository.app.repository_url
}

output "app_url" {
  description = "Public URL of the application"
  value       = "https://${var.domain}"
}

output "alb_dns_name" {
  description = "ALB DNS name — the Route 53 alias record points here"
  value       = aws_lb.app.dns_name
}

output "jwt_secret_name" {
  description = "Secrets Manager secret name — set the real value with: aws secretsmanager put-secret-value --secret-id <name> --secret-string \"$(openssl rand -hex 32)\""
  value       = aws_secretsmanager_secret.jwt_secret.name
}

output "ecs_cluster_name" {
  value = aws_ecs_cluster.main.name
}

output "ecs_service_name" {
  value = aws_ecs_service.app.name
}

output "cloudwatch_log_group" {
  value = aws_cloudwatch_log_group.app.name
}
