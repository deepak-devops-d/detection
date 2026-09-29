#!/usr/bin/env bash
set -euo pipefail

AWS_REGION="${AWS_REGION:-us-east-1}"
AWS_ACCOUNT_ID="${AWS_ACCOUNT_ID:?Set AWS_ACCOUNT_ID}"
BUCKET="${INTERVIEW_MEDIA_BUCKET:?Set INTERVIEW_MEDIA_BUCKET to a globally unique S3 bucket name}"
TABLE="${INTERVIEW_TABLE_NAME:-career-ai-interviews-prod}"

aws s3api create-bucket \
  --bucket "$BUCKET" \
  --region "$AWS_REGION" \
  $(if [[ "$AWS_REGION" != "us-east-1" ]]; then echo "--create-bucket-configuration LocationConstraint=$AWS_REGION"; fi)

aws s3api put-public-access-block \
  --bucket "$BUCKET" \
  --public-access-block-configuration \
  BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true

aws s3api put-bucket-versioning \
  --bucket "$BUCKET" \
  --versioning-configuration Status=Enabled

aws s3api put-bucket-encryption \
  --bucket "$BUCKET" \
  --server-side-encryption-configuration '{"Rules":[{"ApplyServerSideEncryptionByDefault":{"SSEAlgorithm":"AES256"}}]}'

aws s3api put-bucket-lifecycle-configuration \
  --bucket "$BUCKET" \
  --lifecycle-configuration '{"Rules":[{"ID":"ExpireInterviewMedia","Status":"Enabled","Filter":{"Prefix":"interviews/"},"Expiration":{"Days":30},"NoncurrentVersionExpiration":{"NoncurrentDays":7}}]}'

aws dynamodb create-table \
  --table-name "$TABLE" \
  --attribute-definitions AttributeName=session_id,AttributeType=S \
  --key-schema AttributeName=session_id,KeyType=HASH \
  --billing-mode PAY_PER_REQUEST \
  --region "$AWS_REGION" || true

aws dynamodb update-continuous-backups \
  --table-name "$TABLE" \
  --point-in-time-recovery-specification PointInTimeRecoveryEnabled=true \
  --region "$AWS_REGION" || true

echo "Created/verified S3 bucket: $BUCKET"
echo "Created/verified DynamoDB table: $TABLE"
echo "Next: create the IAM role, attach infra/iam-policy.json after replacing placeholders, and associate it with the career-ai-backend service account using EKS Pod Identity."
