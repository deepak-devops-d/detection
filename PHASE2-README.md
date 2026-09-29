# Career AI — Phase 2 production interview upgrade

This phase upgrades the existing AI interview module without replacing the existing resume analyzer.

## Added

1. Durable interview sessions in DynamoDB.
2. Interview answer media upload to private S3.
3. Amazon Transcribe batch transcription for recorded answer clips.
4. Bedrock adaptive question generation and answer evaluation.
5. Final Bedrock-generated interview report.
6. Interview session retrieval endpoint.
7. Production IAM policy for Bedrock, DynamoDB, S3 and Transcribe.
8. S3 lifecycle/security setup script.
9. Frontend support for recording, transcription and final report.

## API flow

```text
React
  -> POST /api/v1/interview/start
  -> record camera + microphone answer
  -> POST /api/v1/interview/media
  -> S3
  -> Amazon Transcribe
  -> GET /api/v1/interview/transcription/<job>
  -> POST /api/v1/interview/answer
  -> Amazon Bedrock
  -> next adaptive question
  -> POST /api/v1/interview/complete
  -> DynamoDB + final Bedrock report
```

## Important

The current phase uses Transcribe batch jobs per recorded answer. This is intentionally reliable and easier to operate behind the existing Flask/Gunicorn architecture. True low-latency live transcription can be added as a later phase using Amazon Transcribe streaming and a dedicated streaming/WebSocket service.

The backend still uses the default boto3 credential chain. In EKS production, use EKS Pod Identity rather than static AWS access keys.
