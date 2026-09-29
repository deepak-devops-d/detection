# Career AI - AWS Production Infrastructure

This Terraform stack creates the AWS foundation for the Phase 2 application:

- VPC across three AZs with public/private/database subnets
- Internet Gateway and NAT Gateways
- EKS control plane and managed worker nodes
- EKS Pod Identity Agent
- ECR repositories for frontend/backend
- encrypted S3 interview-media bucket with 30-day lifecycle
- DynamoDB interview session table with point-in-time recovery
- KMS encryption for EKS Kubernetes secrets
- CloudWatch EKS control-plane logs
- IAM role for the Flask backend using EKS Pod Identity
- IAM role for AWS Load Balancer Controller using EKS Pod Identity
- AWS Load Balancer Controller via Helm
- ACM certificates with DNS validation through Route 53
- Secrets Manager application secret shell

## Before terraform apply

1. Configure AWS credentials using an AWS-supported authentication method. Do not put access keys in Terraform files.
2. Verify the requested EKS Kubernetes version is supported in your AWS region.
3. Verify the three availability zones exist in the selected region.
4. Create an existing public Route 53 hosted zone and put its zone ID in `terraform.tfvars`.
5. Copy `terraform.tfvars.example` to `terraform.tfvars` and set your real domains.
6. Create an S3 Terraform state bucket and copy `backend.tf.example` to `backend.tf`.
7. Review IAM policies, subnet CIDRs, node sizes, NAT Gateway cost, and Bedrock model availability.

## Commands

```bash
terraform init
terraform fmt -recursive
terraform validate
terraform plan -out tfplan
terraform apply tfplan
```

Then inspect:

```bash
aws eks update-kubeconfig --region <region> --name <cluster>
kubectl get nodes
kubectl get pods -n kube-system
```

## Important DNS limitation

The application Ingress is created by Kubernetes/AWS Load Balancer Controller, so the ALB DNS name does not exist until the Ingress is reconciled. The Route 53 `A` alias records in this first Terraform layer therefore contain placeholders. After the ALB is created, set those two aliases to the ALB DNS name and hosted-zone ID, or manage the records from a separate post-Ingress Terraform layer.

## Secrets

Terraform creates the Secrets Manager secret metadata only. It intentionally does not put application secret values into Terraform configuration. Populate the secret separately and grant only the backend Pod Identity role access to it.

## Pod Identity

The backend service account is `career-ai-backend` in namespace `career-ai-prod`. Terraform creates the Pod Identity association. The backend code must keep using the normal boto3 credential chain; do not add `aws_access_key_id` or `aws_secret_access_key` to `app.py`.
