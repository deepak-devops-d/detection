import { API_BASE_URL } from "../config/config";

async function request(path, options = {}) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: {
      Accept: "application/json",
      ...(options.body instanceof FormData ? {} : { "Content-Type": "application/json" }),
      ...(options.headers || {}),
    },
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.error || data.message || `Request failed with status ${response.status}`);
  }

  return data;
}

export function startAIInterview(payload) {
  return request("/api/v1/ai-interview/start", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function getAIInterviewSession(sessionId) {
  return request(`/api/v1/ai-interview/session/${encodeURIComponent(sessionId)}`);
}

export function uploadAIInterviewMedia({ sessionId, questionNumber, blob }) {
  const formData = new FormData();
  formData.append("session_id", sessionId);
  formData.append("question_number", String(questionNumber));
  formData.append("media", blob, `answer-${questionNumber}.webm`);

  return request("/api/v1/ai-interview/media", {
    method: "POST",
    body: formData,
  });
}

export function getAIInterviewTranscription(jobName) {
  return request(`/api/v1/ai-interview/transcription/${encodeURIComponent(jobName)}`);
}

export function submitAIInterviewAnswer(payload) {
  return request("/api/v1/ai-interview/answer", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function completeAIInterview(payload) {
  return request("/api/v1/ai-interview/complete", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function getBackendHealth() {
  return request("/health");
}
