# Career AI - AI Interview Emergency Fix

## Problems addressed
1. `Request failed (403)` after Stop Answer & Analyze: the browser sends a large multipart media upload through the ALB. AWS WAF on an Application Load Balancer can inspect only the first 8 KB of a request body. A WAF allow rule is supplied for the exact AI interview media endpoint so the media request is not blocked by managed body-inspection rules.
2. Camera/microphone `device not found` / browser compatibility: AIVideoInterview now starts with the least restrictive `{video:true,audio:true}` request, applies quality constraints only on a best-effort basis, handles browser permission/device errors clearly, and supports WebM plus MP4 recording types where available.
3. Audio/video filenames now follow the actual MediaRecorder MIME type so Amazon Transcribe receives the correct media format.

## Files
- `AIVideoInterview.js` -> replace `src/pages/AIVideoInterview.js`
- `api.js` -> replace `src/services/api.js` if needed; it uses only `/api/v1/ai-interview/...`
- `app.py` -> backend version with only the AI-interview namespace for interview functionality
- `fix-waf-ai-interview-media.py` -> run on a machine with AWS credentials and permission to update `career-ai-prod-waf`

## Important
The WAF script is an emergency production fix. It allows only `/api/v1/ai-interview/media` before the other WAF rules. Keep all other WAF rules unchanged. After the deadline, move media upload to presigned S3 URLs for stronger WAF isolation.
