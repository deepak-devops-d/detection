#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TF_DIR="$ROOT_DIR/infra/terraform"
NAMESPACE="career-ai-prod"

: "${AWS_REGION:?Set AWS_REGION}"
: "${FRONTEND_IMAGE_TAG:?Set FRONTEND_IMAGE_TAG, for example git SHA}"
: "${BACKEND_IMAGE_TAG:?Set BACKEND_IMAGE_TAG, for example git SHA}"

cd "$TF_DIR"
terraform output -raw cluster_name > /tmp/career-ai-cluster-name
terraform output -raw frontend_ecr_repository > /tmp/career-ai-frontend-ecr
terraform output -raw backend_ecr_repository > /tmp/career-ai-backend-ecr
terraform output -raw interview_media_bucket > /tmp/career-ai-media-bucket
terraform output -raw interview_table_name > /tmp/career-ai-table
terraform output -raw waf_web_acl_arn > /tmp/career-ai-waf-arn

CLUSTER_NAME="$(cat /tmp/career-ai-cluster-name)"
FRONTEND_REPO="$(cat /tmp/career-ai-frontend-ecr)"
BACKEND_REPO="$(cat /tmp/career-ai-backend-ecr)"
MEDIA_BUCKET="$(cat /tmp/career-ai-media-bucket)"
TABLE_NAME="$(cat /tmp/career-ai-table)"
WAF_ARN="$(cat /tmp/career-ai-waf-arn)"

aws eks update-kubeconfig --region "$AWS_REGION" --name "$CLUSTER_NAME"
kubectl apply -f "$ROOT_DIR/k8s/namespace.yaml"
kubectl apply -f "$ROOT_DIR/k8s/serviceaccount.yaml"

# Render the environment-specific ConfigMap from the committed template.
TMP_CONFIG="$(mktemp)"
sed \
  -e "s|AWS_REGION:.*|AWS_REGION: \"$AWS_REGION\"|" \
  -e "s|BEDROCK_MODEL_ID:.*|BEDROCK_MODEL_ID: \"${BEDROCK_MODEL_ID:-amazon.nova-lite-v1:0}\"|" \
  -e "s|INTERVIEW_TABLE_NAME:.*|INTERVIEW_TABLE_NAME: \"$TABLE_NAME\"|" \
  -e "s|INTERVIEW_MEDIA_BUCKET:.*|INTERVIEW_MEDIA_BUCKET: \"$MEDIA_BUCKET\"|" \
  -e "s|API_BASE_URL:.*|API_BASE_URL: \"https://${API_DOMAIN:?Set API_DOMAIN}\"|" \
  -e "s|CORS_ORIGINS:.*|CORS_ORIGINS: \"https://${FRONTEND_DOMAIN:?Set FRONTEND_DOMAIN}\"|" \
  "$ROOT_DIR/k8s/configmap.yaml" > "$TMP_CONFIG"
kubectl apply -f "$TMP_CONFIG"
rm -f "$TMP_CONFIG"

TMP_FRONTEND_CONFIG="$(mktemp)"
sed \
  -e "s|https://api.example.com|https://${API_DOMAIN:?Set API_DOMAIN}|g" \
  "$ROOT_DIR/k8s/frontend-configmap.yaml" > "$TMP_FRONTEND_CONFIG"
kubectl apply -f "$TMP_FRONTEND_CONFIG"
rm -f "$TMP_FRONTEND_CONFIG"

# The ingress uses the real domains from Terraform variables.
TMP_INGRESS="$(mktemp)"
sed \
  -e "s/app.example.com/${FRONTEND_DOMAIN:?Set FRONTEND_DOMAIN}/g" \
  -e "s/api.example.com/${API_DOMAIN:?Set API_DOMAIN}/g" \
  -e "s|WAF_ARN_PLACEHOLDER|$WAF_ARN|g" \
  "$ROOT_DIR/k8s/ingress.yaml" > "$TMP_INGRESS"
kubectl apply -f "$TMP_INGRESS"
rm -f "$TMP_INGRESS"

sed -e "s|<AWS_ACCOUNT_ID>.dkr.ecr.<AWS_REGION>.amazonaws.com/career-ai/frontend:[^[:space:]]*|${FRONTEND_REPO}:${FRONTEND_IMAGE_TAG}|" \
    -e "s|<AWS_ACCOUNT_ID>.dkr.ecr.<AWS_REGION>.amazonaws.com/career-ai/backend:[^[:space:]]*|${BACKEND_REPO}:${BACKEND_IMAGE_TAG}|" \
    "$ROOT_DIR/k8s/frontend.yaml" > /tmp/career-ai-frontend.yaml
sed -e "s|<AWS_ACCOUNT_ID>.dkr.ecr.<AWS_REGION>.amazonaws.com/career-ai/backend:[^[:space:]]*|${BACKEND_REPO}:${BACKEND_IMAGE_TAG}|" \
    "$ROOT_DIR/k8s/backend.yaml" > /tmp/career-ai-backend.yaml

kubectl apply -f /tmp/career-ai-backend.yaml
kubectl apply -f /tmp/career-ai-frontend.yaml
kubectl apply -f "$ROOT_DIR/k8s/hpa.yaml"
kubectl apply -f "$ROOT_DIR/k8s/pdb.yaml"
kubectl apply -f "$ROOT_DIR/k8s/networkpolicy.yaml"

kubectl -n "$NAMESPACE" rollout status deployment/career-ai-backend --timeout=10m
kubectl -n "$NAMESPACE" rollout status deployment/career-ai-frontend --timeout=10m
kubectl -n "$NAMESPACE" get ingress career-ai-ingress
