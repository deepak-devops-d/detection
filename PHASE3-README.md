# Career AI - Phase 3: AWS Infrastructure + EKS Deployment

Phase 3 takes the Phase 2 application and adds the AWS production platform around it.

## Architecture

```text
Internet
   |
Route 53
   |
AWS ALB (AWS Load Balancer Controller)
   |---------------------------|
app.example.com             api.example.com
   |                           |
Frontend Service            Backend Service
   |                           |
React/Nginx Pods             Flask/Gunicorn Pods
                               |
                    EKS Pod Identity
                               |
          +--------------------+----------------------+
          |                    |          |            |
       Bedrock             DynamoDB      S3        Transcribe
```

## What Phase 3 creates

- VPC with public/private/database subnets in three AZs
- production EKS cluster with managed node group
- EKS Pod Identity Agent
- ECR repositories with immutable tags and scan-on-push
- private encrypted interview media S3 bucket
- DynamoDB interview session table with PITR
- KMS encryption for EKS Kubernetes secrets
- CloudWatch control-plane logging
- backend IAM role with least-privilege access to Bedrock, S3, DynamoDB, Transcribe and the application secret
- AWS Load Balancer Controller using Pod Identity
- ExternalDNS using a Route 53-scoped IAM policy
- ACM certificate for frontend + API hostnames
- Route 53 DNS validation for ACM
- ALB certificate discovery from Ingress hostnames
- Kubernetes deployment script that obtains Terraform outputs and deploys the application

AWS documents EKS Pod Identity as a mechanism to associate an IAM role with a Kubernetes service account, and AWS SDKs can use those credentials through the normal default credential chain. citeturn0search0turn0search6

AWS's current Load Balancer Controller installation guidance uses Helm and requires an IAM role with the controller policy. citeturn0search2

The controller supports ACM certificate discovery from Ingress hostnames when an explicit certificate ARN is not supplied. citeturn1search1

## 1. Prepare Terraform state

Create an S3 state bucket with versioning and encryption. Then copy:

```bash
cp infra/terraform/backend.tf.example infra/terraform/backend.tf
cp infra/terraform/terraform.tfvars.example infra/terraform/terraform.tfvars
```

Edit both files with your real values.

## 2. Terraform

```bash
cd infra/terraform
terraform init
terraform fmt -recursive
terraform validate
terraform plan -out tfplan
terraform apply tfplan
```

Do not commit `terraform.tfvars`, `backend.tf`, `.terraform/`, or `*.tfstate`.

## 3. Populate Secrets Manager

Terraform creates the secret metadata but intentionally does not place secret values into Terraform source. Populate it using your organization's approved secret-management process.

AWS recommends limiting access to Secrets Manager values to the workloads that need them. citeturn0search9turn0search12

## 4. Build and push images

Use immutable Git SHA tags rather than `latest`.

```bash
export AWS_REGION=ap-south-1
export TAG=$(git rev-parse --short=12 HEAD)
export FRONTEND_REPO=$(terraform -chdir=infra/terraform output -raw frontend_ecr_repository)
export BACKEND_REPO=$(terraform -chdir=infra/terraform output -raw backend_ecr_repository)

aws ecr get-login-password --region "$AWS_REGION" | docker login --username AWS --password-stdin "$(echo "$FRONTEND_REPO" | cut -d/ -f1)"

docker build -f Dockerfile.frontend -t "$FRONTEND_REPO:$TAG" .
docker build -f Dockerfile.backend -t "$BACKEND_REPO:$TAG" .

docker push "$FRONTEND_REPO:$TAG"
docker push "$BACKEND_REPO:$TAG"
```

The backend build requires the actual model files in the project build context, as documented by Phase 2.

## 5. Deploy

```bash
export AWS_REGION=ap-south-1
export FRONTEND_DOMAIN=app.example.com
export API_DOMAIN=api.example.com
export FRONTEND_IMAGE_TAG=$(git rev-parse --short=12 HEAD)
export BACKEND_IMAGE_TAG=$(git rev-parse --short=12 HEAD)

./scripts/deploy-eks.sh
```

## 6. Verify

```bash
kubectl get nodes
kubectl get pods -n career-ai-prod
kubectl get ingress -n career-ai-prod
kubectl get pods -n kube-system | grep -E 'aws-load-balancer-controller|external-dns|eks-pod-identity-agent'
```

Then test:

```bash
curl -I https://app.example.com
curl https://api.example.com/health
curl https://api.example.com/ready
```

## Important production notes

1. Replace the example domains with your real domains.
2. Verify the Bedrock model is enabled/available in your selected AWS region before deployment.
3. Review the AWS Load Balancer Controller IAM policy against the current controller release before applying it. AWS's official installation documentation should be treated as the authoritative source for policy updates. citeturn0search2
4. Review Kubernetes/EKS version support before changing the version in `terraform.tfvars`.
5. NAT Gateways are intentionally one-per-AZ for production resilience, but they increase cost.
6. The ALB is internet-facing. Restrict application-level access with authentication/authorization and consider AWS WAF for public production traffic.
7. Do not put AWS access keys into `app.py`, Dockerfiles, ConfigMaps, or Kubernetes manifests. Pod Identity is the intended workload credential path. citeturn0search0turn0search6
8. The S3 media bucket is private and automatically expires the `interviews/` prefix after 30 days.
9. The DynamoDB table is on-demand and has point-in-time recovery enabled.
10. The Phase 2 application still uses batch Transcribe per recorded answer. Real-time streaming is a later optimization.

## Files added in Phase 3

- `infra/terraform/versions.tf`
- `infra/terraform/main.tf`
- `infra/terraform/variables.tf`
- `infra/terraform/outputs.tf`
- `infra/terraform/terraform.tfvars.example`
- `infra/terraform/backend.tf.example`
- `infra/terraform/README.md`
- `scripts/deploy-eks.sh`
- updated `k8s/ingress.yaml`
