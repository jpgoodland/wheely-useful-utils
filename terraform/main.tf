terraform {
  required_version = ">= 1.6"

  backend "s3" {
    bucket         = "wheel-app-tfstate-persist"
    key            = "wheel-app/terraform.tfstate"
    region         = "us-west-2"
    dynamodb_table = "wheel-app-tfstate-lock"
    encrypt        = true
  }

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

provider "aws" {
  region = var.aws_region
}

data "aws_caller_identity" "current" {}
data "aws_availability_zones" "available" { state = "available" }
