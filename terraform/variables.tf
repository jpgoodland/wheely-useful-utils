variable "aws_region" {
  description = "AWS region to deploy into"
  type        = string
  default     = "us-west-2"
}

variable "app_name" {
  description = "Short name used to prefix all resources"
  type        = string
  default     = "wheel-app"
}

variable "domain" {
  description = "Fully-qualified domain name for the app (e.g. wheel.example.com)"
  type        = string
}

variable "hosted_zone_id" {
  description = "Route 53 hosted zone ID for the parent domain (e.g. example.com)"
  type        = string
}

variable "image_tag" {
  description = "ECR image tag to deploy"
  type        = string
  default     = "latest"
}

variable "task_cpu" {
  description = "Fargate task CPU units"
  type        = number
  default     = 512
}

variable "task_memory" {
  description = "Fargate task memory (MiB)"
  type        = number
  default     = 1024
}

variable "desired_count" {
  description = "Number of ECS tasks to run"
  type        = number
  default     = 1
}

variable "dynamodb_read_capacity" {
  type    = number
  default = 5
}

variable "dynamodb_write_capacity" {
  type    = number
  default = 5
}

variable "oauth_google_client_id" {
  description = "Google OAuth client ID"
  type        = string
  default     = ""
}

variable "oauth_microsoft_client_id" {
  description = "Microsoft (Entra ID) OAuth client ID"
  type        = string
  default     = ""
}

variable "oauth_github_client_id" {
  description = "GitHub OAuth client ID"
  type        = string
  default     = ""
}

variable "admin_emails" {
  description = "Comma-separated list of email addresses that should be granted admin privileges (M2)"
  type        = string
  default     = ""
}
