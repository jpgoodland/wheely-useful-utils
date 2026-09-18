# ── Users table ───────────────────────────────────────────────────────────────

resource "aws_dynamodb_table" "users" {
  name           = "WheelApp_Users"
  billing_mode   = "PROVISIONED"
  read_capacity  = var.dynamodb_read_capacity
  write_capacity = var.dynamodb_write_capacity
  hash_key       = "PK"

  attribute {
    name = "PK"
    type = "S"
  }

  attribute {
    name = "EmailOrUsername"
    type = "S"
  }

  global_secondary_index {
    name            = "EmailOrUsernameIndex"
    hash_key        = "EmailOrUsername"
    projection_type = "ALL"
    read_capacity   = var.dynamodb_read_capacity
    write_capacity  = var.dynamodb_write_capacity
  }

  # Encryption at rest using AWS-managed KMS key
  server_side_encryption {
    enabled = true
  }

  tags = { Name = "WheelApp_Users" }
}

# ── Wheels table ──────────────────────────────────────────────────────────────

resource "aws_dynamodb_table" "wheels" {
  name           = "WheelApp_Wheels"
  billing_mode   = "PROVISIONED"
  read_capacity  = var.dynamodb_read_capacity
  write_capacity = var.dynamodb_write_capacity
  hash_key       = "PK"

  attribute {
    name = "PK"
    type = "S"
  }

  # M4: GSI for efficient owner-based queries (replaces full-table Scan)
  attribute {
    name = "ownerId"
    type = "S"
  }

  global_secondary_index {
    name            = "OwnerIdIndex"
    hash_key        = "ownerId"
    projection_type = "ALL"
    read_capacity   = var.dynamodb_read_capacity
    write_capacity  = var.dynamodb_write_capacity
  }

  # Encryption at rest using AWS-managed KMS key
  server_side_encryption {
    enabled = true
  }

  tags = { Name = "WheelApp_Wheels" }
}
