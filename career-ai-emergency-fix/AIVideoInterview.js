import React, { useEffect, useRef, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Divider,
  FormControl,
  InputLabel,
  LinearProgress,
  MenuItem,
  Select,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import {
  MdArrowForward,
  MdCheckCircle,
  MdMic,
  MdStop,
  MdVideocam,
  MdVolumeUp,
} from "react-icons/md";

const runtimeConfig = window.__APP_CONFIG__ || {};
const API_BASE_URL =
  runtimeConfig.API_BASE_URL ||
  process.env.REACT_APP_API_BASE_URL ||
  "https://mycareerai.click";

const ROLES = [
  "Software Engineer",
  "DevOps Engineer",
  "Cloud Engineer",
  "Frontend Developer",
  "Backend Developer",
  "Full Stack Developer",
  "AI Engineer",
  "Data Scientist",
  "Python developer",
  "Java Developer",
  "Machine Learning Engineer",
  "Cyber security Analyst",
];

const EXPERIENCE = ["Fresher", "1 Year", "2 Years", "3+ Years"];
const INTERVIEW_TYPES = ["Technical", "HR", "Mixed", "Behavioral"];

function apiUrl(path) {
  return `${API_BASE_URL.replace(/\/$/, "")}${path}`;
}

async function requestJson(path, options = {}) {
  const response = await fetch(apiUrl(path), {
    ...options,
    headers: {
      ...(options.body instanceof FormData ? {} : { "Content-Type": "application/json" }),
      ...(options.headers || {}),
    },
  });

  let data = null;
  try {
    data = await response.json();
  } catch {
    data = {};
  }

  if (!response.ok) {
    throw new Error(
      data?.error || data?.message || `Request failed (${response.status})`,
    );
  }

  return data;
}

function chooseMimeType(kind) {
  if (typeof MediaRecorder === "undefined") return "";

  const candidates =
    kind === "audio"
      ? [
          "audio/webm;codecs=opus",
          "audio/webm",
          "audio/mp4",
          "audio/ogg;codecs=opus",
        ]
      : [
          "video/webm;codecs=vp9,opus",
          "video/webm;codecs=vp8,opus",
          "video/webm",
          "video/mp4;codecs=avc1.42E01E,mp4a.40.2",
          "video/mp4",
        ];

  return candidates.find((type) => {
    try {
      return MediaRecorder.isTypeSupported(type);
    } catch (_) {
      return false;
    }
  }) || "";
}

function extensionForMimeType(mimeType, kind = "audio", fallback = "webm") {
  const type = (mimeType || "").toLowerCase();
  if (type.includes("mp4")) return kind === "video" ? "mp4" : "m4a";
  if (type.includes("ogg")) return "ogg";
  if (type.includes("webm")) return "webm";
  return fallback;
}

function mediaErrorMessage(error) {
  const name = error?.name || "";
  if (name === "NotAllowedError" || name === "SecurityError") {
    return "Camera/microphone permission was blocked. Allow Camera and Microphone for mycareerai.click in your browser site settings, then reload the page.";
  }
  if (name === "NotFoundError") {
    return "Camera or microphone was not found. Connect a working webcam and microphone, close other apps using them (Teams/Zoom/Meet), then reload the page.";
  }
  if (name === "NotReadableError" || name === "AbortError") {
    return "The camera or microphone is already in use or could not be opened. Close Teams, Zoom, Meet, OBS or other recording apps and try again.";
  }
  if (name === "OverconstrainedError") {
    return "The selected camera/microphone does not support the requested settings. The interview will retry using browser-compatible default settings.";
  }
  return error?.message || "The camera and microphone could not be opened.";
}

function waitForRecorder(recorder, chunks) {
  return new Promise((resolve, reject) => {
    const timeout = window.setTimeout(() => {
      reject(new Error("Recording did not stop correctly. Please try again."));
    }, 10000);

    recorder.addEventListener(
      "stop",
      () => {
        window.clearTimeout(timeout);
        resolve(new Blob(chunks, { type: recorder.mimeType || "" }));
      },
      { once: true },
    );

    try {
      recorder.stop();
    } catch (error) {
      window.clearTimeout(timeout);
      reject(error);
    }
  });
}

function scoreColor(verdict) {
  if (verdict === "CORRECT") return "success";
  if (verdict === "PARTIALLY_CORRECT") return "warning";
  if (verdict === "INCORRECT") return "error";
  return "default";
}

export default function AIVideoInterview() {
  const [stage, setStage] = useState("setup");
  const [role, setRole] = useState("DevOps Engineer");
  const [experience, setExperience] = useState("3+ Years");
  const [interviewType, setInterviewType] = useState("Technical");
  const [questionCount, setQuestionCount] = useState(5);

  const [session, setSession] = useState(null);
  const [questionNumber, setQuestionNumber] = useState(1);
  const [question, setQuestion] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [liveTranscript, setLiveTranscript] = useState("");
  const [lastEvaluation, setLastEvaluation] = useState(null);
  const [evaluations, setEvaluations] = useState([]);
  const [finalReport, setFinalReport] = useState(null);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [elapsed, setElapsed] = useState(0);
  const [integrityCount, setIntegrityCount] = useState(0);

  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const audioRecorderRef = useRef(null);
  const videoRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const videoChunksRef = useRef([]);
  const recognitionRef = useRef(null);
  const recognitionFinalRef = useRef("");
  const sessionRef = useRef(null);
  const questionRef = useRef("");

  useEffect(() => {
    sessionRef.current = session;
  }, [session]);

  useEffect(() => {
    questionRef.current = question;
  }, [question]);

  useEffect(() => {
    if (stage !== "interview") return undefined;
    const timer = window.setInterval(() => setElapsed((value) => value + 1), 1000);
    return () => window.clearInterval(timer);
  }, [stage]);

  useEffect(() => {
    return () => {
      stopAllTracks();
      try {
        recognitionRef.current?.stop();
      } catch (_) {}
    };
  }, []);

  useEffect(() => {
    if (stage !== "interview") return undefined;

    const onVisibilityChange = () => {
      if (document.hidden) {
        recordIntegrityEvent("TAB_HIDDEN", "MEDIUM", "The interview tab became hidden.");
      }
    };
    const onBlur = () => {
      recordIntegrityEvent("WINDOW_BLURRED", "LOW", "The interview window lost focus.");
    };
    const onFullscreenChange = () => {
      if (!document.fullscreenElement) {
        recordIntegrityEvent("FULLSCREEN_EXIT", "MEDIUM", "Fullscreen mode was exited.");
      }
    };

    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("blur", onBlur);
    document.addEventListener("fullscreenchange", onFullscreenChange);

    return () => {
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("blur", onBlur);
      document.removeEventListener("fullscreenchange", onFullscreenChange);
    };
  }, [stage]);

  const stopAllTracks = () => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
  };

  const speakQuestion = (text) => {
    if (!text || !window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 0.95;
    utterance.pitch = 1;
    window.speechSynthesis.speak(utterance);
  };

  const startSpeechRecognition = () => {
    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setInfo("Live browser transcript is unavailable. The final answer will use Amazon Transcribe.");
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = "en-US";

      recognition.onresult = (event) => {
        let finalText = recognitionFinalRef.current;
        let interim = "";

        for (let i = event.resultIndex; i < event.results.length; i += 1) {
          const text = event.results[i][0]?.transcript || "";
          if (event.results[i].isFinal) finalText += `${text} `;
          else interim += text;
        }

        recognitionFinalRef.current = finalText;
        setLiveTranscript(`${finalText}${interim}`.trim());
      };

      recognition.onerror = (event) => {
        console.warn("Browser speech recognition:", event.error);
      };

      recognition.onend = () => {
        if (isRecording && recognitionRef.current === recognition) {
          try {
            recognition.start();
          } catch (_) {}
        }
      };

      recognitionFinalRef.current = "";
      recognitionRef.current = recognition;
      recognition.start();
    } catch (recognitionError) {
      console.warn("Browser speech recognition could not start", recognitionError);
    }
  };

  const stopSpeechRecognition = () => {
    try {
      recognitionRef.current?.stop();
    } catch (_) {}
    recognitionRef.current = null;
  };

  const recordIntegrityEvent = async (type, severity = "MEDIUM", details = "") => {
    const activeSession = sessionRef.current;
    if (!activeSession?.session_id) return;

    setIntegrityCount((value) => value + 1);

    try {
      await requestJson("/api/v1/ai-interview/integrity", {
        method: "POST",
        body: JSON.stringify({
          session_id: activeSession.session_id,
          event: {
            type,
            severity,
            details,
            timestamp: new Date().toISOString(),
          },
        }),
      });
    } catch (eventError) {
      console.warn("Unable to record AI interview integrity event", eventError);
    }
  };

  const prepareCamera = async () => {
    if (streamRef.current) return streamRef.current;

    if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
      throw new Error("Camera and microphone require HTTPS. Open https://mycareerai.click and do not use an HTTP URL.");
    }

    // Start with the least restrictive constraints. This is deliberately
    // more compatible than requiring resolution, facingMode or channelCount.
    // Browser/device-specific enhancements are applied only when available.
    let stream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true,
      });
    } catch (firstError) {
      // Some browsers/devices reject combined capture even though one of the
      // devices is available. Probe each side so the user gets a useful error.
      try {
        const videoOnly = await navigator.mediaDevices.getUserMedia({ video: true });
        videoOnly.getTracks().forEach((track) => track.stop());
      } catch (_) {}

      try {
        const audioOnly = await navigator.mediaDevices.getUserMedia({ audio: true });
        audioOnly.getTracks().forEach((track) => track.stop());
      } catch (_) {}

      throw new Error(mediaErrorMessage(firstError));
    }

    // Best-effort quality settings. Never fail the interview if a device
    // cannot satisfy them.
    const videoTrack = stream.getVideoTracks()[0];
    if (videoTrack?.applyConstraints) {
      try {
        await videoTrack.applyConstraints({
          width: { ideal: 1280 },
          height: { ideal: 720 },
        });
      } catch (_) {}
    }

    const audioTrack = stream.getAudioTracks()[0];
    if (audioTrack?.applyConstraints) {
      try {
        await audioTrack.applyConstraints({
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        });
      } catch (_) {}
    }

    streamRef.current = stream;
    if (videoRef.current) {
      videoRef.current.srcObject = stream;
      await videoRef.current.play().catch(() => {});
    }

    return stream;
  };

  const startInterview = async () => {
    setError("");
    setInfo("Creating your AI interview session...");

    try {
      const data = await requestJson("/api/v1/ai-interview/start", {
        method: "POST",
        body: JSON.stringify({
          role,
          experience,
          interview_type: interviewType,
          question_count: questionCount,
        }),
      });

      setSession(data);
      sessionRef.current = data;
      setQuestion(data.question || "");
      setQuestionNumber(1);
      setEvaluations([]);
      setFinalReport(null);
      setElapsed(0);

      await prepareCamera();
      setStage("interview");
      setInfo("Interview ready. Listen to the question, then click Start Answer and speak naturally.");
      speakQuestion(data.question);
    } catch (startError) {
      setError(startError.message || "Could not start the interview.");
      setInfo("");
    }
  };

  const startRecording = async () => {
    setError("");
    setInfo("");

    try {
      const stream = await prepareCamera();
      const audioStream = new MediaStream(stream.getAudioTracks());
      const videoStream = new MediaStream(stream.getVideoTracks());

      const audioMime = chooseMimeType("audio");
      const videoMime = chooseMimeType("video");

      if (!audioMime) {
        throw new Error("This browser cannot create an audio recording. Please use current Chrome or Edge on a laptop/desktop.");
      }

      audioChunksRef.current = [];
      videoChunksRef.current = [];
      recognitionFinalRef.current = "";
      setLiveTranscript("");
      setTranscript("");

      const audioRecorder = new MediaRecorder(audioStream, {
        mimeType: audioMime,
        audioBitsPerSecond: 128000,
      });

      audioRecorder.ondataavailable = (event) => {
        if (event.data?.size) audioChunksRef.current.push(event.data);
      };

      audioRecorderRef.current = audioRecorder;
      audioRecorder.start(1000);

      if (videoStream.getVideoTracks().length && videoMime) {
        const videoRecorder = new MediaRecorder(videoStream, {
          mimeType: videoMime,
          videoBitsPerSecond: 1500000,
        });

        videoRecorder.ondataavailable = (event) => {
          if (event.data?.size) videoChunksRef.current.push(event.data);
        };

        videoRecorderRef.current = videoRecorder;
        videoRecorder.start(1000);
      }

      setIsRecording(true);
      startSpeechRecognition();
      setInfo("Recording... speak your complete answer. Click Stop Answer when you finish.");
    } catch (recordError) {
      setError(recordError.message || "Could not start recording.");
    }
  };

  const pollTranscription = async (jobName) => {
    if (!jobName) return "";

    const maxAttempts = 45;
    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
      const result = await requestJson(
        `/api/v1/ai-interview/transcription/${encodeURIComponent(jobName)}`,
        { method: "GET" },
      );

      if (result.status === "COMPLETED") {
        return (result.transcript || "").trim();
      }

      if (result.status === "FAILED") {
        throw new Error(result.reason || "Amazon Transcribe failed to process the answer.");
      }

      setInfo(`Transcribing your answer with Amazon Transcribe... ${attempt + 1}/45`);
      await new Promise((resolve) => window.setTimeout(resolve, 2000));
    }

    throw new Error("Transcription is taking too long. Please try the answer again.");
  };

  const stopRecording = async () => {
    if (!isRecording || isProcessing) return;

    setIsRecording(false);
    setIsProcessing(true);
    setError("");
    stopSpeechRecognition();

    try {
      const audioRecorder = audioRecorderRef.current;
      const videoRecorder = videoRecorderRef.current;

      if (!audioRecorder) {
        throw new Error("Audio recorder was not initialized.");
      }

      const audioPromise = waitForRecorder(audioRecorder, audioChunksRef.current);
      const videoPromise = videoRecorder
        ? waitForRecorder(videoRecorder, videoChunksRef.current)
        : Promise.resolve(null);

      const [audioBlob, videoBlob] = await Promise.all([audioPromise, videoPromise]);
      audioRecorderRef.current = null;
      videoRecorderRef.current = null;

      if (!audioBlob || audioBlob.size < 1000) {
        throw new Error("No usable audio was captured. Check the microphone permission and try again.");
      }

      const currentSession = sessionRef.current;
      const currentQuestion = questionRef.current;
      const formData = new FormData();
      formData.append("session_id", currentSession.session_id);
      formData.append("question_number", String(questionNumber));
      const audioExtension = extensionForMimeType(audioBlob.type, "audio", "webm");
      const videoExtension = extensionForMimeType(videoBlob?.type, "video", "webm");
      formData.append("audio", audioBlob, `answer-${questionNumber}.${audioExtension}`);
      if (videoBlob?.size) {
        formData.append("video", videoBlob, `answer-${questionNumber}.${videoExtension}`);
      }

      setInfo("Uploading answer media and starting server-side transcription...");
      const media = await requestJson("/api/v1/ai-interview/media", {
        method: "POST",
        body: formData,
      });

      let finalTranscript = "";
      if (media.transcription_job) {
        finalTranscript = await pollTranscription(media.transcription_job);
      }

      // Browser transcript is only a fallback. The primary transcript is Amazon Transcribe.
      if (!finalTranscript) {
        finalTranscript = recognitionFinalRef.current.trim() || liveTranscript.trim();
      }

      if (!finalTranscript) {
        throw new Error("The answer was recorded, but no usable transcript was produced. Please answer again in a clear voice.");
      }

      setTranscript(finalTranscript);
      setInfo("Transcript ready. AI is checking correctness, relevance and technical accuracy...");

      const evaluation = await requestJson("/api/v1/ai-interview/answer", {
        method: "POST",
        body: JSON.stringify({
          session_id: currentSession.session_id,
          question: currentQuestion,
          question_number: questionNumber,
          transcript: finalTranscript,
        }),
      });

      setLastEvaluation(evaluation);
      setEvaluations((items) => [...items, evaluation]);

      if (evaluation.completed) {
        setInfo("Interview answers evaluated. Generating the final report...");
        const report = await requestJson("/api/v1/ai-interview/complete", {
          method: "POST",
          body: JSON.stringify({
            session_id: currentSession.session_id,
            elapsed_seconds: elapsed,
          }),
        });
        setFinalReport(report);
        setStage("result");
        stopAllTracks();
        setInfo("");
      } else {
        const nextQuestion = evaluation.next_question || "";
        setQuestion(nextQuestion);
        setQuestionNumber((value) => value + 1);
        setInfo("Answer evaluated. Your next question is ready.");
        speakQuestion(nextQuestion);
      }
    } catch (processingError) {
      setError(processingError.message || "The answer could not be processed.");
      setInfo("Your recording was not discarded. You can answer this question again.");
    } finally {
      setIsProcessing(false);
    }
  };

  const restartInterview = () => {
    stopAllTracks();
    setStage("setup");
    setSession(null);
    setQuestion("");
    setTranscript("");
    setLiveTranscript("");
    setLastEvaluation(null);
    setFinalReport(null);
    setEvaluations([]);
    setError("");
    setInfo("");
  };

  if (stage === "setup") {
    return (
      <Stack spacing={3} sx={{ py: 2 }}>
        <Box>
          <Typography variant="h4" fontWeight={800}>
            AI Video Interview
          </Typography>
          <Typography color="text.secondary" sx={{ mt: 1 }}>
            Speak naturally. Your answer is recorded, transcribed by Amazon Transcribe, and evaluated by Amazon Bedrock.
          </Typography>
        </Box>

        {error && <Alert severity="error">{error}</Alert>}
        {info && <Alert severity="info">{info}</Alert>}

        <Card sx={{ borderRadius: 4 }}>
          <CardContent>
            <Stack spacing={2.5}>
              <FormControl fullWidth>
                <InputLabel>Target Role</InputLabel>
                <Select value={role} label="Target Role" onChange={(e) => setRole(e.target.value)}>
                  {ROLES.map((item) => <MenuItem key={item} value={item}>{item}</MenuItem>)}
                </Select>
              </FormControl>

              <FormControl fullWidth>
                <InputLabel>Experience</InputLabel>
                <Select value={experience} label="Experience" onChange={(e) => setExperience(e.target.value)}>
                  {EXPERIENCE.map((item) => <MenuItem key={item} value={item}>{item}</MenuItem>)}
                </Select>
              </FormControl>

              <FormControl fullWidth>
                <InputLabel>Interview Type</InputLabel>
                <Select value={interviewType} label="Interview Type" onChange={(e) => setInterviewType(e.target.value)}>
                  {INTERVIEW_TYPES.map((item) => <MenuItem key={item} value={item}>{item}</MenuItem>)}
                </Select>
              </FormControl>

              <FormControl fullWidth>
                <InputLabel>Number of Questions</InputLabel>
                <Select value={questionCount} label="Number of Questions" onChange={(e) => setQuestionCount(Number(e.target.value))}>
                  {[5, 10, 15].map((item) => <MenuItem key={item} value={item}>{item} Questions</MenuItem>)}
                </Select>
              </FormControl>

              <Alert severity="info">
                Desktop/laptop mode: camera + microphone are required. The final transcript comes from server-side Amazon Transcribe; browser speech recognition is only live feedback/fallback.
              </Alert>

              <Button
                variant="contained"
                size="large"
                endIcon={<MdArrowForward />}
                onClick={startInterview}
                disabled={!role || isProcessing}
              >
                Start Interview
              </Button>
            </Stack>
          </CardContent>
        </Card>
      </Stack>
    );
  }

  if (stage === "result") {
    return (
      <Stack spacing={3} sx={{ py: 2 }}>
        <Typography variant="h4" fontWeight={800}>Interview Result</Typography>
        {finalReport && (
          <Card sx={{ borderRadius: 4 }}>
            <CardContent>
              <Stack spacing={2}>
                <Typography variant="h5" fontWeight={800}>
                  Overall Score: {finalReport.average_score}/100
                </Typography>
                <Chip label={finalReport.report?.overall_level || "Assessment complete"} color="primary" sx={{ width: "fit-content" }} />
                <Typography>{finalReport.report?.overall_summary}</Typography>
                <Divider />
                <Typography fontWeight={700}>Strengths</Typography>
                {(finalReport.report?.strengths || []).map((item, i) => <Typography key={i}>• {item}</Typography>)}
                <Typography fontWeight={700}>Improvements</Typography>
                {(finalReport.report?.improvements || []).map((item, i) => <Typography key={i}>• {item}</Typography>)}
              </Stack>
            </CardContent>
          </Card>
        )}

        {evaluations.map((item, index) => (
          <Card key={`${item.session_id}-${index}`} sx={{ borderRadius: 4 }}>
            <CardContent>
              <Stack spacing={1.5}>
                <Typography fontWeight={800}>Question {index + 1}</Typography>
                <Typography color="text.secondary">{item.transcript}</Typography>
                <Stack direction="row" spacing={1} flexWrap="wrap">
                  <Chip label={`${item.verdict} · ${item.score}/100`} color={scoreColor(item.verdict)} />
                  <Chip label={`Correctness ${item.correctness_score}`} />
                  <Chip label={`Technical ${item.technical_accuracy_score}`} />
                  <Chip label={`Completeness ${item.completeness_score}`} />
                </Stack>
                <Typography>{item.feedback}</Typography>
                {(item.factual_errors || []).length > 0 && (
                  <Alert severity="error">Factual issues: {item.factual_errors.join("; ")}</Alert>
                )}
                {(item.missing_key_points || []).length > 0 && (
                  <Alert severity="warning">Missing key points: {item.missing_key_points.join("; ")}</Alert>
                )}
              </Stack>
            </CardContent>
          </Card>
        ))}

        <Button variant="contained" onClick={restartInterview}>Start New Interview</Button>
      </Stack>
    );
  }

  return (
    <Stack spacing={3} sx={{ py: 2 }}>
      <Stack direction={{ xs: "column", md: "row" }} spacing={3}>
        <Box sx={{ flex: 1 }}>
          <Card sx={{ borderRadius: 4, overflow: "hidden", background: "#07111f" }}>
            <Box sx={{ position: "relative", aspectRatio: "16/9" }}>
              <video
                ref={videoRef}
                muted
                autoPlay
                playsInline
                style={{ width: "100%", height: "100%", objectFit: "cover" }}
              />
              <Chip
                icon={<MdVideocam />}
                label={isRecording ? "Recording" : "Camera ready"}
                color={isRecording ? "error" : "success"}
                sx={{ position: "absolute", top: 16, left: 16 }}
              />
            </Box>
          </Card>
        </Box>

        <Box sx={{ flex: 1 }}>
          <Card sx={{ borderRadius: 4, height: "100%" }}>
            <CardContent>
              <Stack spacing={2.5}>
                <Stack direction="row" justifyContent="space-between" alignItems="center">
                  <Chip label={`Question ${questionNumber} / ${session?.question_count || questionCount}`} color="primary" />
                  <Typography color="text.secondary">{Math.floor(elapsed / 60)}:{String(elapsed % 60).padStart(2, "0")}</Typography>
                </Stack>

                <Typography variant="h5" fontWeight={800}>{question}</Typography>

                <Button
                  variant="outlined"
                  startIcon={<MdVolumeUp />}
                  onClick={() => speakQuestion(question)}
                >
                  Repeat Question
                </Button>

                <Divider />

                <Typography variant="subtitle2" color="text.secondary">
                  Live transcript preview
                </Typography>
                <Box sx={{ minHeight: 90, p: 2, borderRadius: 2, bgcolor: "action.hover" }}>
                  <Typography>{liveTranscript || "Your spoken answer will appear here while you speak..."}</Typography>
                </Box>

                {transcript && !isRecording && (
                  <Alert severity="success">
                    Final Amazon Transcribe answer: {transcript}
                  </Alert>
                )}

                {isProcessing && <LinearProgress />}
                {error && <Alert severity="error">{error}</Alert>}
                {info && <Alert severity="info">{info}</Alert>}

                {!isRecording ? (
                  <Button
                    variant="contained"
                    size="large"
                    startIcon={<MdMic />}
                    onClick={startRecording}
                    disabled={isProcessing}
                  >
                    Start Answer
                  </Button>
                ) : (
                  <Button
                    variant="contained"
                    color="error"
                    size="large"
                    startIcon={<MdStop />}
                    onClick={stopRecording}
                    disabled={isProcessing}
                  >
                    Stop Answer & Analyze
                  </Button>
                )}
              </Stack>
            </CardContent>
          </Card>
        </Box>
      </Stack>

      {lastEvaluation && (
        <Card sx={{ borderRadius: 4 }}>
          <CardContent>
            <Stack spacing={1.5}>
              <Typography variant="h6" fontWeight={800}>Latest AI Evaluation</Typography>
              <Chip
                icon={<MdCheckCircle />}
                label={`${lastEvaluation.verdict} · ${lastEvaluation.score}/100`}
                color={scoreColor(lastEvaluation.verdict)}
                sx={{ width: "fit-content" }}
              />
              <Typography>{lastEvaluation.summary}</Typography>
              <Typography color="text.secondary">{lastEvaluation.feedback}</Typography>
            </Stack>
          </CardContent>
        </Card>
      )}
    </Stack>
  );
}
