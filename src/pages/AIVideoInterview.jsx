import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Divider,
  LinearProgress,
  MenuItem,
  Paper,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import {
  MdArrowBack,
  MdAutoAwesome,
  MdCameraAlt,
  MdCheckCircle,
  MdMic,
  MdMicOff,
  MdPlayArrow,
  MdStop,
} from "react-icons/md";
import { motion } from "framer-motion";
import {
  startAIInterview,
  submitInterviewAnswer,
  completeAIInterview,
  uploadInterviewMedia,
  getTranscription,
} from "../services/api";

const QUESTION_COUNTS = [5, 10, 15];
const EXPERIENCE_LEVELS = ["Fresher", "1-3 years", "3-5 years", "5-8 years", "8+ years"];
const INTERVIEW_TYPES = ["Technical", "Behavioral", "Mixed"];

function scoreColor(score) {
  if (score >= 80) return "success";
  if (score >= 60) return "warning";
  return "error";
}

function sleep(ms) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

async function waitForTranscript(jobName, attempts = 20) {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const result = await getTranscription(jobName);
    if (result.status === "COMPLETED") return result.transcript || "";
    if (result.status === "FAILED") throw new Error(result.reason || "Transcription failed.");
    await sleep(1500);
  }
  throw new Error("Transcription is taking longer than expected. You can submit the typed answer instead.");
}

export default function AIVideoInterview() {
  const navigate = useNavigate();
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);

  const [stage, setStage] = useState("setup");
  const [role, setRole] = useState("");
  const [experience, setExperience] = useState("1-3 years");
  const [type, setType] = useState("Mixed");
  const [questionCount, setQuestionCount] = useState(5);
  const [resumeContext, setResumeContext] = useState("");
  const [jobDescription, setJobDescription] = useState("");
  const [question, setQuestion] = useState("");
  const [history, setHistory] = useState([]);
  const [currentAnswer, setCurrentAnswer] = useState("");
  const [sessionId, setSessionId] = useState("");
  const [questionIndex, setQuestionIndex] = useState(0);
  const [score, setScore] = useState(null);
  const [feedback, setFeedback] = useState(null);
  const [finalReport, setFinalReport] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);
  const [recording, setRecording] = useState(false);
  const [recordedBlob, setRecordedBlob] = useState(null);
  const [transcribing, setTranscribing] = useState(false);
  const [elapsed, setElapsed] = useState(0);

  const progress = useMemo(
    () => (questionCount ? ((questionIndex + 1) / questionCount) * 100 : 0),
    [questionCount, questionIndex]
  );

  useEffect(() => {
    return () => {
      if (streamRef.current) streamRef.current.getTracks().forEach((track) => track.stop());
    };
  }, []);

  useEffect(() => {
    if (stage !== "interview") return undefined;
    const timer = window.setInterval(() => setElapsed((value) => value + 1), 1000);
    return () => window.clearInterval(timer);
  }, [stage]);

  const formattedTime = `${String(Math.floor(elapsed / 60)).padStart(2, "0")}:${String(elapsed % 60).padStart(2, "0")}`;

  async function enableCamera() {
    setError("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: "user" },
        audio: true,
      });
      streamRef.current = stream;
      if (videoRef.current) videoRef.current.srcObject = stream;
      setCameraReady(true);
    } catch (err) {
      setError(`Camera/microphone permission failed: ${err.message}`);
    }
  }

  function startRecording() {
    if (!streamRef.current || typeof MediaRecorder === "undefined") {
      setError("Video recording is not supported by this browser.");
      return;
    }
    chunksRef.current = [];
    setRecordedBlob(null);
    const recorder = new MediaRecorder(streamRef.current, { mimeType: "video/webm" });
    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) chunksRef.current.push(event.data);
    };
    recorder.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: "video/webm" });
      setRecordedBlob(blob);
      setRecording(false);
    };
    mediaRecorderRef.current = recorder;
    recorder.start(1000);
    setRecording(true);
  }

  function stopRecording() {
    if (mediaRecorderRef.current?.state === "recording") mediaRecorderRef.current.stop();
  }

  async function beginInterview() {
    if (!role.trim()) {
      setError("Enter a target job role.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const result = await startAIInterview({
        role: role.trim(),
        experience,
        interview_type: type,
        question_count: questionCount,
        resume_context: resumeContext.trim(),
        job_description: jobDescription.trim(),
      });
      setSessionId(result.session_id);
      setQuestion(result.question);
      setQuestionIndex(0);
      setHistory([]);
      setScore(null);
      setFeedback(null);
      setFinalReport(null);
      setCurrentAnswer("");
      setRecordedBlob(null);
      setElapsed(0);
      setStage("interview");
      if (!cameraReady) await enableCamera();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function submitAnswer() {
    if (!currentAnswer.trim() && !recordedBlob) {
      setError("Type an answer or record your answer before continuing.");
      return;
    }

    setLoading(true);
    setError("");
    let transcript = "";
    try {
      if (recordedBlob) {
        setTranscribing(true);
        const mediaResult = await uploadInterviewMedia({
          sessionId,
          questionNumber: questionIndex + 1,
          blob: recordedBlob,
        });
        if (mediaResult.transcription_job) {
          transcript = await waitForTranscript(mediaResult.transcription_job);
        }
      }

      const typedAnswer = currentAnswer.trim();
      if (!transcript && !typedAnswer) {
        throw new Error("No transcript was produced. Please type the answer and try again.");
      }

      const result = await submitInterviewAnswer({
        session_id: sessionId,
        question,
        answer: typedAnswer,
        transcript,
        question_number: questionIndex + 1,
      });

      const effectiveAnswer = transcript || typedAnswer;
      const nextHistory = [
        ...history,
        {
          question,
          answer: effectiveAnswer,
          score: result.score,
          feedback: result.feedback,
        },
      ];
      setHistory(nextHistory);
      setScore(result.score);
      setFeedback(result.feedback);
      setCurrentAnswer("");
      setRecordedBlob(null);

      if (result.completed || questionIndex + 1 >= questionCount) {
        const finalResult = await completeAIInterview({
          session_id: sessionId,
          elapsed_seconds: elapsed,
        });
        setFinalReport(finalResult);
        setStage("complete");
        if (streamRef.current) {
          streamRef.current.getTracks().forEach((track) => track.stop());
          streamRef.current = null;
        }
        return;
      }

      setQuestion(result.next_question);
      setQuestionIndex((value) => value + 1);
    } catch (err) {
      setError(err.message);
    } finally {
      setTranscribing(false);
      setLoading(false);
    }
  }

  if (stage === "setup") {
    return (
      <Stack spacing={4}>
        <Box>
          <Button startIcon={<MdArrowBack />} onClick={() => navigate("/dashboard")} sx={{ mb: 2 }}>Back to Dashboard</Button>
          <Typography variant="h4" fontWeight={800}>AI Video Interview</Typography>
          <Typography color="text.secondary" mt={1}>
            Your existing interview module is now connected to Amazon Bedrock, Amazon Transcribe, and persistent interview sessions.
          </Typography>
        </Box>

        {error && <Alert severity="error">{error}</Alert>}

        <Paper elevation={0} sx={{ p: { xs: 3, md: 5 }, borderRadius: 5, border: "1px solid rgba(15,23,42,.08)" }}>
          <Stack spacing={3}>
            <Stack direction="row" spacing={2} alignItems="center">
              <Box sx={{ width: 64, height: 64, borderRadius: "50%", display: "grid", placeItems: "center", background: "linear-gradient(120deg,#2563EB,#7C3AED)", color: "white" }}>
                <MdAutoAwesome size={32} />
              </Box>
              <Box>
                <Typography variant="h6" fontWeight={800}>Personalized AI Interview</Typography>
                <Typography variant="body2" color="text.secondary">Questions adapt to your role, experience, resume and previous answers.</Typography>
              </Box>
            </Stack>

            <TextField fullWidth label="Target Role" value={role} onChange={(e) => setRole(e.target.value)} placeholder="e.g. DevOps Engineer" />
            <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
              <TextField select fullWidth label="Experience" value={experience} onChange={(e) => setExperience(e.target.value)}>
                {EXPERIENCE_LEVELS.map((item) => <MenuItem key={item} value={item}>{item}</MenuItem>)}
              </TextField>
              <TextField select fullWidth label="Interview Type" value={type} onChange={(e) => setType(e.target.value)}>
                {INTERVIEW_TYPES.map((item) => <MenuItem key={item} value={item}>{item}</MenuItem>)}
              </TextField>
              <TextField select fullWidth label="Questions" value={questionCount} onChange={(e) => setQuestionCount(Number(e.target.value))}>
                {QUESTION_COUNTS.map((item) => <MenuItem key={item} value={item}>{item}</MenuItem>)}
              </TextField>
            </Stack>

            <TextField fullWidth multiline minRows={4} label="Resume Context (optional)" value={resumeContext} onChange={(e) => setResumeContext(e.target.value)} placeholder="Paste the resume analysis summary or relevant resume details here." />
            <TextField fullWidth multiline minRows={4} label="Job Description (optional)" value={jobDescription} onChange={(e) => setJobDescription(e.target.value)} placeholder="Paste the target job description for more relevant questions." />

            <Button variant="contained" size="large" onClick={beginInterview} disabled={loading} startIcon={loading ? <CircularProgress size={20} color="inherit" /> : <MdPlayArrow />}>
              {loading ? "Preparing AI Interview..." : "Start AI Video Interview"}
            </Button>
          </Stack>
        </Paper>
      </Stack>
    );
  }

  if (stage === "complete") {
    const report = finalReport?.report || {};
    return (
      <Stack spacing={3}>
        <Box>
          <Typography variant="h4" fontWeight={800}>Interview Complete</Typography>
          <Typography color="text.secondary" mt={1}>Your interview session has been saved and evaluated.</Typography>
        </Box>
        <Paper elevation={0} sx={{ p: { xs: 3, md: 5 }, borderRadius: 5, border: "1px solid rgba(15,23,42,.08)" }}>
          <Stack spacing={3}>
            <Stack direction="row" spacing={2} alignItems="center">
              <Chip label={`Overall ${finalReport?.average_score ?? 0}/100`} color={scoreColor(finalReport?.average_score ?? 0)} sx={{ fontWeight: 800 }} />
              <Chip label={report.recommendation || "Completed"} variant="outlined" />
            </Stack>
            <Typography variant="h6" fontWeight={800}>AI Summary</Typography>
            <Typography color="text.secondary">{report.overall_summary || "Interview completed successfully."}</Typography>
            <Divider />
            <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
              {[["Technical", report.technical_score], ["Communication", report.communication_score], ["Problem Solving", report.problem_solving_score], ["Confidence", report.confidence_score]].map(([label, value]) => (
                <Paper key={label} variant="outlined" sx={{ p: 2, flex: 1, borderRadius: 3 }}>
                  <Typography variant="body2" color="text.secondary">{label}</Typography>
                  <Typography variant="h5" fontWeight={800}>{value ?? "—"}</Typography>
                </Paper>
              ))}
            </Stack>
            <Button variant="contained" onClick={() => navigate("/dashboard")}>Back to Dashboard</Button>
          </Stack>
        </Paper>
      </Stack>
    );
  }

  return (
    <Stack spacing={3}>
      <Stack direction="row" justifyContent="space-between" alignItems="center">
        <Box>
          <Typography variant="h5" fontWeight={800}>{role} AI Interview</Typography>
          <Stack direction="row" gap={1} sx={{ mt: 0.5 }}>
            <Chip label={experience} size="small" />
            <Chip label={type} size="small" color="secondary" variant="outlined" />
          </Stack>
        </Box>
        <Typography variant="h5" fontWeight={800} className="gradient-text">{formattedTime}</Typography>
      </Stack>

      <LinearProgress variant="determinate" value={progress} sx={{ height: 8, borderRadius: 4 }} />
      <Typography variant="caption" color="text.secondary">Question {questionIndex + 1} of {questionCount}</Typography>

      {error && <Alert severity="error">{error}</Alert>}

      <Stack direction={{ xs: "column", md: "1.3fr 1fr" }} spacing={3}>
        <Paper elevation={0} sx={{ p: 2, borderRadius: 5, overflow: "hidden", border: "1px solid rgba(15,23,42,.08)" }}>
          <Box sx={{ position: "relative", background: "#0f172a", borderRadius: 4, overflow: "hidden", minHeight: 360 }}>
            <video ref={videoRef} autoPlay muted playsInline style={{ width: "100%", height: "100%", minHeight: 360, objectFit: "cover" }} />
            {!cameraReady && (
              <Stack alignItems="center" justifyContent="center" spacing={2} sx={{ position: "absolute", inset: 0, color: "white" }}>
                <MdCameraAlt size={48} />
                <Button variant="contained" onClick={enableCamera}>Enable Camera & Mic</Button>
              </Stack>
            )}
            <Chip
              icon={recording ? <MdMic /> : <MdMicOff />}
              label={recording ? "Recording answer" : "Camera ready"}
              color={recording ? "error" : "success"}
              sx={{ position: "absolute", top: 16, left: 16, fontWeight: 700 }}
            />
          </Box>

          <Stack direction="row" spacing={2} sx={{ mt: 2 }}>
            {!recording ? (
              <Button variant="outlined" startIcon={<MdMic />} onClick={startRecording} disabled={!cameraReady || loading}>Record Answer</Button>
            ) : (
              <Button color="error" variant="contained" startIcon={<MdStop />} onClick={stopRecording}>Stop Recording</Button>
            )}
            {recordedBlob && <Chip icon={<MdCheckCircle />} label="Answer recorded" color="success" />}
          </Stack>
        </Paper>

        <Paper elevation={0} sx={{ p: { xs: 3, md: 4 }, borderRadius: 5, border: "1px solid rgba(15,23,42,.08)" }}>
          <Stack spacing={3}>
            <Stack direction="row" spacing={1} alignItems="center">
              <MdAutoAwesome color="#7C3AED" />
              <Typography variant="subtitle2" fontWeight={800}>AI Interviewer</Typography>
            </Stack>
            <Typography variant="h6" fontWeight={800}>{question}</Typography>
            <TextField fullWidth multiline minRows={8} label="Type your answer (optional if recording)" value={currentAnswer} onChange={(e) => setCurrentAnswer(e.target.value)} disabled={loading} />
            {transcribing && <Alert severity="info">Uploading your answer and waiting for Amazon Transcribe...</Alert>}
            {score !== null && <Chip label={`Last answer score: ${score}/100`} color={scoreColor(score)} sx={{ alignSelf: "flex-start", fontWeight: 800 }} />}
            {feedback && <Typography color="text.secondary">{feedback}</Typography>}
            <Button variant="contained" size="large" onClick={submitAnswer} disabled={loading || recording} startIcon={loading ? <CircularProgress size={20} color="inherit" /> : <MdPlayArrow />}>
              {loading ? "Evaluating..." : questionIndex + 1 >= questionCount ? "Finish Interview" : "Submit & Continue"}
            </Button>
          </Stack>
        </Paper>
      </Stack>
    </Stack>
  );
}
