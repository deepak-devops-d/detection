# AWS data resources for the AI interview module

This phase uses:

- S3 for interview media and Transcribe output.
- DynamoDB for durable interview sessions/results.
- Amazon Transcribe for answer transcription.
- Amazon Bedrock for adaptive questions and evaluation.
- EKS Pod Identity for workload credentials.

## 1. Create the S3 bucket and DynamoDB table

Set the environment variables and run:

```bash
export AWS_REGION=us-east-1
export AWS_ACCOUNT_ID=123456789012
export INTERVIEW_MEDIA_BUCKET=my-career-ai-interview-media-prod
export INTERVIEW_TABLE_NAME=career-ai-interviews-prod
./setup-data-resources.sh
```

The script enables S3 public-access blocking, versioning, server-side encryption and a 30-day lifecycle for interview media. DynamoDB uses on-demand billing and point-in-time recovery.

## 2. Create the backend IAM role

Replace the placeholders in `iam-policy.json` with the actual Bedrock model/inference-profile ARN, DynamoDB table ARN and S3 bucket name. Attach the resulting policy to the backend IAM role.

Do not put AWS access keys into Kubernetes Secrets or the container image.

## 3. EKS Pod Identity

Associate the IAM role with the `career-ai-backend` service account in namespace `career-ai-prod`. The EKS Pod Identity Agent must be installed on the cluster unless EKS Auto Mode provides it.

The Flask code uses the normal boto3 credential chain, so no application-specific AWS credential code is required.
