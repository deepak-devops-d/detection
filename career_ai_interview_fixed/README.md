# Career AI - AI Interview Fix

This revision changes the interview pipeline to:

1. Browser asks for camera + microphone.
2. Browser records video and audio separately.
3. Audio-only WebM/Opus is uploaded to S3.
4. Video is uploaded separately to S3.
5. Amazon Transcribe receives the audio object, not the combined video object.
6. Frontend waits for Transcribe to reach COMPLETED.
7. The final transcript is sent to `/api/v1/interview/answer`.
8. Amazon Bedrock evaluates correctness, relevance, completeness, technical accuracy and communication.
9. The UI shows CORRECT / PARTIALLY_CORRECT / INCORRECT / INSUFFICIENT, scores, factual errors, missing key points and feedback.
10. The next question is generated after evaluation.
11. The final interview report is generated after the configured question count.

## Files

- `AIVideoInterview.js`: replace `src/pages/AIVideoInterview.js`
- `app.py`: replace the backend `app.py`

## Backend environment

Existing values can remain:

- AWS_REGION=ap-south-1
- BEDROCK_MODEL_ID=amazon.nova-2-lite-v1:0
- INTERVIEW_TABLE_NAME=career-ai-interviews
- INTERVIEW_MEDIA_BUCKET=career-ai-interview-media-114354606708-6e8ed9d5
- INTERVIEW_MEDIA_PREFIX=interviews
- TRANSCRIBE_LANGUAGE_CODE=en-US

Optional accuracy improvement:

- TRANSCRIBE_VOCABULARY_NAME=<READY custom vocabulary name>

The IAM role must allow the backend to start/read Transcribe jobs and read/write the interview S3 prefix. The existing role already has `transcribe:StartTranscriptionJob`, `transcribe:GetTranscriptionJob`, `s3:PutObject`, and `s3:GetObject` according to the current project policy.

Amazon Transcribe also needs permission to write the transcript into the configured output bucket when `OutputBucketName` is used. Verify the bucket policy/service permissions before production rollout.

## Frontend API

The component uses the runtime `window.__APP_CONFIG__.API_BASE_URL` first and falls back to `https://mycareerai.click`.
