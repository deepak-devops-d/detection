# Career AI — Production Upgrade

This directory is the production upgrade of the existing project. The existing React application and the existing `app.py` resume analyzer are preserved; the new AI Video Interview is added as a separate dashboard route.

## Local

Frontend:
```bash
npm install
npm start
```

Backend:
```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
export MODEL_PATH="$PWD"
export CORS_ORIGINS="http://localhost:3000"
export AWS_REGION="us-east-1"
export BEDROCK_MODEL_ID="REPLACE_WITH_ENABLED_MODEL_ID"
python app.py
```

For local Bedrock calls, configure AWS credentials through the normal AWS CLI/SDK credential chain. Do not put access keys in React, Dockerfiles, Kubernetes manifests, or source code.

## Production images

Build:
```bash
docker build -f Dockerfile.backend -t career-ai-backend:1.0.0 .
docker build -f Dockerfile.frontend -t career-ai-frontend:1.0.0 .
```

Tag and push to ECR using your AWS account/region and immutable version tags.

## Kubernetes

Before applying:
1. Replace ECR image placeholders.
2. Replace the ACM certificate ARN.
3. Replace `app.example.com` and `api.example.com` with your real DNS names.
4. Set a real secret in `secret.example.yaml` or, preferably, source secrets from AWS Secrets Manager.
5. Create the IAM role for the backend and configure EKS Pod Identity or IRSA so the pod can call Bedrock without static AWS keys.
6. Install AWS Load Balancer Controller in the EKS cluster.
7. Ensure the EKS node/pod networking allows HTTPS egress to AWS APIs.

Apply:
```bash
kubectl apply -f k8s/namespace.yaml
kubectl apply -f k8s/configmap.yaml
kubectl apply -f k8s/frontend-configmap.yaml
kubectl apply -f k8s/secret.example.yaml
kubectl apply -f k8s/serviceaccount.yaml
kubectl apply -f k8s/backend.yaml
kubectl apply -f k8s/frontend.yaml
kubectl apply -f k8s/ingress.yaml
kubectl apply -f k8s/hpa.yaml
kubectl apply -f k8s/pdb.yaml
kubectl apply -f k8s/networkpolicy.yaml
```

## Important

`secret.example.yaml` is a template only. Do not commit real production secrets to Git.
