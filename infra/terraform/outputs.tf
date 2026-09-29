
output "cluster_name" {
  description = "EKS cluster name"
  value       = aws_eks_cluster.this.name
}

output "cluster_endpoint" {
  description = "EKS cluster API endpoint"
  value       = aws_eks_cluster.this.endpoint
}

output "vpc_id" {
  description = "VPC ID"
  value       = aws_vpc.this.id
}

output "frontend_ecr_repository" {
  description = "Frontend ECR repository URL"
  value       = aws_ecr_repository.frontend.repository_url
}

output "backend_ecr_repository" {
  description = "Backend ECR repository URL"
  value       = aws_ecr_repository.backend.repository_url
}

output "interview_media_bucket" {
  description = "Private interview media S3 bucket"
  value       = aws_s3_bucket.interview_media.bucket
}

output "interview_table_name" {
  description = "DynamoDB interview table"
  value       = aws_dynamodb_table.interviews.name
}

output "backend_pod_role_arn" {
  description = "IAM role ARN used by backend pods"
  value       = aws_iam_role.backend.arn
}

output "load_balancer_controller_role_arn" {
  description = "IAM role ARN used by AWS Load Balancer Controller"
  value       = aws_iam_role.load_balancer_controller.arn
}

output "external_dns_role_arn" {
  description = "ExternalDNS IAM role ARN when public DNS is enabled"
  value       = var.enable_public_dns ? aws_iam_role.external_dns[0].arn : null
}

output "app_certificate_arn" {
  description = "ACM certificate ARN when public DNS is enabled"
  value       = var.enable_public_dns ? aws_acm_certificate.app[0].arn : null
}

output "app_secret_arn" {
  description = "Secrets Manager application secret ARN"
  value       = aws_secretsmanager_secret.app.arn
}

output "waf_web_acl_arn" {
  description = "AWS WAF Web ACL ARN"
  value       = aws_wafv2_web_acl.app.arn
}

output "aws_region" {
  description = "AWS region"
  value       = var.aws_region
}

output "public_dns_enabled" {
  description = "Whether public DNS resources are enabled"
  value       = var.enable_public_dns
}

