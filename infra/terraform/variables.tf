variable "aws_region" {
  type        = string
  description = "AWS region for the platform."
  default     = "ap-south-1"
}

variable "project_name" {
  type        = string
  description = "Short project identifier used in resource names."
  default     = "career-ai"
}

variable "environment" {
  type        = string
  description = "Environment name."
  default     = "prod"
}

variable "cluster_name" {
  type        = string
  description = "EKS cluster name."
  default     = "career-ai-prod"
}

variable "kubernetes_version" {
  type        = string
  description = "EKS Kubernetes version. Set to a version currently supported by EKS in your region."
  default     = "1.33"
}

variable "vpc_cidr" {
  type    = string
  default = "10.30.0.0/16"
}

variable "availability_zones" {
  type        = list(string)
  description = "Three AZs in the selected region."
  default     = ["ap-south-1a", "ap-south-1b", "ap-south-1c"]
}

variable "public_subnets" {
  type    = list(string)
  default = ["10.30.0.0/20", "10.30.16.0/20", "10.30.32.0/20"]
}

variable "private_subnets" {
  type    = list(string)
  default = ["10.30.48.0/20", "10.30.64.0/20", "10.30.80.0/20"]
}

variable "database_subnets" {
  type    = list(string)
  default = ["10.30.96.0/20", "10.30.112.0/20", "10.30.128.0/20"]
}

variable "node_instance_types" {
  type    = list(string)
  default = ["m6i.large"]
}

variable "node_min_size" {
  type    = number
  default = 2
}

variable "node_desired_size" {
  type    = number
  default = 2
}

variable "node_max_size" {
  type    = number
  default = 6
}

variable "enable_public_dns" {
  type        = bool
  description = "Create Route 53, ACM, and ExternalDNS resources. Set true after a public hosted zone and domain are available."
  default     = false
}

variable "frontend_domain" {
  type        = string
  description = "Public frontend DNS name, for example app.example.com."
}

variable "api_domain" {
  type        = string
  description = "Public API DNS name, for example api.example.com."
}

variable "route53_zone_id" {
  type        = string
  description = "Existing public Route 53 hosted zone ID."
}

variable "bedrock_model_id" {
  type        = string
  description = "Bedrock model ID supported in the selected region."
  default     = "amazon.nova-lite-v1:0"
}

variable "transcribe_language_code" {
  type    = string
  default = "en-US"
}

variable "create_nat_gateway_per_az" {
  type        = bool
  description = "Use one NAT Gateway per AZ. Recommended for production resilience."
  default     = true
}

variable "tags" {
  type    = map(string)
  default = {}
}
