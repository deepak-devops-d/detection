import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Divider,
  Paper,
  Stack,
  Typography,
} from "@mui/material";
import {
  MdCheckCircle,
  MdMic,
  MdMicOff,
  MdRecordVoiceOver,
  MdStop,
  MdVideocam,
  MdVideocamOff,
  MdWarning,
} from "react-icons/md";
import { useNavigate } from "react-router-dom";

import {
  completeAIInterview,
  recordInterviewIntegrityEvent,
  startAIInterview,
  submitInterviewAnswer,
  uploadInterviewMedia,
} from "../services/api";

const DEFAULT_QUESTION_COUNT = 5;

function getSupportedRecordingMimeType() {
  const candidates = [
    "video/webm;codecs=vp9,opus",
    "video/webm;codecs=vp8,opus",
    "video/webm",
    "video/mp4",
  ];

  return candidates.find((type) =>
    window.MediaRecorder?.isTypeSupported?.(type),
  ) || "";
}

function speakQuestion(text, onStart, onEnd) {
  if (!window.speechSynthesis) {
    onStart?.();
    onEnd?.();
    return;
  }

  window.speechSynthesis.cancel();

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.rate = 0.95;
  utterance.pitch = 1;
  utterance.volume = 1;

  utterance.onstart = () => onStart?.();
  utterance.onend = () => onEnd?.();
  utterance.onerror = () => onEnd?.();

  window.speechSynthesis.speak(utterance);
}

function getSpeechRecognitionConstructor() {
  return (
    window.SpeechRecognition ||
    window.webkitSpeechRecognition ||
    null
  );
}

export default function AIVideoInterview() {
  const navigate = useNavigate();

  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const recorderRef = useRef(null);
  const recordingChunksRef = useRef([]);
  const recognitionRef = useRef(null);
  const recognitionActiveRef = useRef(false);
  const transcriptRef = useRef("");
  const questionRef = useRef("");

  const [setup, setSetup] = useState(null);
  const [session, setSession] = useState(null);
  const [currentQuestion, setCurrentQuestion] = useState("");
  const [questionNumber, setQuestionNumber] = useState(1);
  const [transcript, setTranscript] = useState("");
  const [cameraReady, setCameraReady] = useState(false);
  const [micReady, setMicReady] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [starting, setStarting] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [error, setError] = useState("");
  const [warning, setWarning] = useState("");
  const [integrityCount, setIntegrityCount] = useState(0);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  const setupInterview = useCallback(() => {
    try {
      const raw = sessionStorage.getItem("interview_setup");
      if (!raw) {
        navigate("/dashboard/interview");
        return null;
      }

      const parsed = JSON.parse(raw);
      setSetup(parsed);
      return parsed;
    } catch {
      navigate("/dashboard/interview");
      return null;
    }
  }, [navigate]);

  const addIntegrityEvent = useCallback(
    async (type, severity = "MEDIUM", details = "") => {
      if (!session?.session_id) return;

      setIntegrityCount((value) => value + 1);
      setWarning(details || type.replaceAll("_", " "));

      try {
        await recordInterviewIntegrityEvent({
          session_id: session.session_id,
          event: {
            type,
            severity,
            details,
            timestamp: new Date().toISOString(),
          },
        });
      } catch (eventError) {
        console.warn("Integrity event could not be saved:", eventError);
      }
    },
    [session],
  );

  const stopRecognition = useCallback(() => {
    recognitionActiveRef.current = false;

    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {
        // Recognition may already be stopped.
      }
    }

    setIsListening(false);
  }, []);

  const startRecognition = useCallback(() => {
    const Recognition = getSpeechRecognitionConstructor();

    if (!Recognition) {
      setWarning(
        "Live browser transcription is not available in this browser. You can still record the answer, but live transcript will not be available.",
      );
      return;
    }

    stopRecognition();

    const recognition = new Recognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-US";

    recognition.onstart = () => {
      recognitionActiveRef.current = true;
      setIsListening(true);
    };

    recognition.onresult = (event) => {
      let finalText = transcriptRef.current;
      let interimText = "";

      for (let index = event.resultIndex; index < event.results.length; index += 1) {
        const result = event.results[index];
        const text = result[0]?.transcript || "";

        if (result.isFinal) {
          finalText = `${finalText} ${text}`.trim();
        } else {
          interimText += ` ${text}`;
        }
      }

      transcriptRef.current = finalText;
      setTranscript(`${finalText} ${interimText}`.trim());
    };

    recognition.onerror = (event) => {
      if (event.error !== "aborted" && event.error !== "no-speech") {
        console.warn("Speech recognition error:", event.error);
      }
      setIsListening(false);
    };

    recognition.onend = () => {
      setIsListening(false);

      if (recognitionActiveRef.current && isRecording) {
        try {
          recognition.start();
        } catch {
          // Browser may reject a rapid restart.
        }
      }
    };

    recognitionRef.current = recognition;

    try {
      recognition.start();
    } catch {
      setWarning("Unable to start live speech recognition.");
    }
  }, [isRecording, stopRecognition]);

  const stopMediaStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;

    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }

    setCameraReady(false);
    setMicReady(false);
  }, []);

  const startCamera = useCallback(async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      throw new Error(
        "Camera and microphone access is not supported by this browser.",
      );
    }

    const stream = await navigator.mediaDevices.getUserMedia({
      video: {
        width: { ideal: 1280 },
        height: { ideal: 720 },
        facingMode: "user",
      },
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
    });

    streamRef.current = stream;

    const videoTrack = stream.getVideoTracks()[0];
    const audioTrack = stream.getAudioTracks()[0];

    setCameraReady(Boolean(videoTrack));
    setMicReady(Boolean(audioTrack));

    if (videoRef.current) {
      videoRef.current.srcObject = stream;
      await videoRef.current.play().catch(() => {});
    }

    videoTrack?.addEventListener("ended", () => {
      setCameraReady(false);
      addIntegrityEvent(
        "CAMERA_DISABLED",
        "HIGH",
        "The candidate camera stream ended.",
      );
    });

    audioTrack?.addEventListener("ended", () => {
      setMicReady(false);
      addIntegrityEvent(
        "MICROPHONE_DISABLED",
        "HIGH",
        "The candidate microphone stream ended.",
      );
    });
  }, [addIntegrityEvent]);

  const createSession = useCallback(
    async (parsedSetup) => {
      const result = await startAIInterview({
        role: parsedSetup.role,
        experience: parsedSetup.experience || "",
        interview_type: parsedSetup.interviewType || "Mixed",
        question_count:
          Number(parsedSetup.questionCount) || DEFAULT_QUESTION_COUNT,
        resume_context: parsedSetup.resume_context || "",
        job_description: parsedSetup.job_description || "",
      });

      setSession(result);
      setCurrentQuestion(result.question);
      questionRef.current = result.question;
      setQuestionNumber(1);
      return result;
    },
    [],
  );

  const initializeInterview = useCallback(async () => {
    setStarting(true);
    setError("");

    try {
      const parsedSetup = setupInterview();
      if (!parsedSetup) return;

      await startCamera();

      const result = await createSession(parsedSetup);

      speakQuestion(
        result.question,
        () => setIsSpeaking(true),
        () => setIsSpeaking(false),
      );
    } catch (initError) {
      console.error(initError);
      setError(initError.message || "Unable to start the video interview.");
      stopMediaStream();
    } finally {
      setStarting(false);
    }
  }, [createSession, setupInterview, startCamera, stopMediaStream]);

  useEffect(() => {
    initializeInterview();

    return () => {
      window.speechSynthesis?.cancel();
      recognitionActiveRef.current = false;

      try {
        recognitionRef.current?.stop();
      } catch {
        // Ignore cleanup errors.
      }

      if (recorderRef.current?.state === "recording") {
        try {
          recorderRef.current.stop();
        } catch {
          // Ignore cleanup errors.
        }
      }

      streamRef.current?.getTracks().forEach((track) => track.stop());
    };
  }, [initializeInterview]);

  useEffect(() => {
    const onVisibilityChange = () => {
      if (document.hidden && session?.session_id) {
        addIntegrityEvent(
          "TAB_HIDDEN",
          "MEDIUM",
          "The interview tab became hidden.",
        );
      }
    };

    const onBlur = () => {
      if (session?.session_id) {
        addIntegrityEvent(
          "WINDOW_BLURRED",
          "LOW",
          "The interview window lost focus.",
        );
      }
    };

    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("blur", onBlur);

    return () => {
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("blur", onBlur);
    };
  }, [addIntegrityEvent, session]);

  useEffect(() => {
    if (!session?.session_id || completed) return undefined;

    const timer = window.setInterval(() => {
      setElapsedSeconds((value) => value + 1);
    }, 1000);

    return () => window.clearInterval(timer);
  }, [completed, session]);

  const beginAnswer = () => {
    if (!streamRef.current) {
      setError("Camera and microphone are not available.");
      return;
    }

    setError("");
    setWarning("");
    transcriptRef.current = "";
    setTranscript("");

    recordingChunksRef.current = [];

    const mimeType = getSupportedRecordingMimeType();
    const recorderOptions = mimeType ? { mimeType } : undefined;

    try {
      const recorder = new MediaRecorder(streamRef.current, recorderOptions);
      recorderRef.current = recorder;

      recorder.ondataavailable = (event) => {
        if (event.data?.size > 0) {
          recordingChunksRef.current.push(event.data);
        }
      };

      recorder.onerror = (event) => {
        console.error("MediaRecorder error:", event);
        setError("Video recording failed. Please try again.");
      };

      recorder.start(1000);
      setIsRecording(true);

      window.setTimeout(() => {
        startRecognition();
      }, 100);
    } catch (recordingError) {
      setError(
        recordingError.message || "Unable to start camera recording.",
      );
    }
  };

  const finishAnswer = async () => {
    if (!recorderRef.current || recorderRef.current.state !== "recording") {
      return;
    }

    setSubmitting(true);
    setError("");
    setWarning("");

    stopRecognition();
    setIsRecording(false);

    const recorder = recorderRef.current;

    const recordingFinished = new Promise((resolve) => {
      recorder.addEventListener(
        "stop",
        () => resolve(),
        { once: true },
      );
    });

    recorder.stop();
    await recordingFinished;

    const mimeType = recorder.mimeType || "video/webm";
    const blob = new Blob(recordingChunksRef.current, {
      type: mimeType,
    });

    const answerText = transcriptRef.current.trim();

    if (!answerText) {
      setSubmitting(false);
      setError(
        "No speech transcript was captured. Please start your answer again and speak clearly.",
      );
      return;
    }

    try {
      const mediaResult = await uploadInterviewMedia({
        sessionId: session.session_id,
        questionNumber,
        blob,
      });

      const answerResult = await submitInterviewAnswer({
        session_id: session.session_id,
        question: questionRef.current,
        question_number: questionNumber,
        transcript: answerText,
        answer: answerText,
      });

      if (mediaResult?.transcription_job) {
        console.info(
          "Amazon Transcribe job:",
          mediaResult.transcription_job,
        );
      }

      setSession((previous) => ({
        ...(previous || {}),
        ...answerResult,
      }));

      if (answerResult.completed) {
        await finishInterview(answerResult);
        return;
      }

      const nextQuestion = answerResult.next_question;

      setQuestionNumber((value) => value + 1);
      setCurrentQuestion(nextQuestion);
      questionRef.current = nextQuestion;
      transcriptRef.current = "";
      setTranscript("");

      speakQuestion(
        nextQuestion,
        () => setIsSpeaking(true),
        () => setIsSpeaking(false),
      );
    } catch (submitError) {
      console.error(submitError);
      setError(
        submitError.message || "Unable to submit the interview answer.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  const finishInterview = async (answerResult = null) => {
    setSubmitting(true);

    try {
      stopRecognition();

      if (recorderRef.current?.state === "recording") {
        recorderRef.current.stop();
      }

      window.speechSynthesis?.cancel();

      const result = await completeAIInterview({
        session_id: session.session_id,
        elapsed_seconds: elapsedSeconds,
      });

      setSession((previous) => ({
        ...(previous || {}),
        ...(answerResult || {}),
        ...result,
      }));

      setCompleted(true);
      stopMediaStream();
    } catch (completeError) {
      console.error(completeError);
      setError(
        completeError.message || "Unable to complete the interview.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  const endInterview = async () => {
    const confirmed = window.confirm(
      "End this interview now? Your completed answers will remain saved.",
    );

    if (!confirmed) return;

    await finishInterview();
  };

  const formattedTime = `${String(Math.floor(elapsedSeconds / 60)).padStart(
    2,
    "0",
  )}:${String(elapsedSeconds % 60).padStart(2, "0")}`;

  if (starting) {
    return (
      <Stack alignItems="center" justifyContent="center" sx={{ minHeight: 560 }}>
        <CircularProgress />
        <Typography mt={2} fontWeight={700}>
          Preparing your secure video interview...
        </Typography>
        <Typography color="text.secondary" mt={1}>
          Please allow camera and microphone access when your browser asks.
        </Typography>
      </Stack>
    );
  }

  if (error && !session) {
    return (
      <Stack spacing={3} sx={{ maxWidth: 720, mx: "auto", py: 5 }}>
        <Alert severity="error">{error}</Alert>
        <Button variant="contained" onClick={() => navigate("/dashboard/interview")}>
          Back to Interview Setup
        </Button>
      </Stack>
    );
  }

  if (completed) {
    const score = session?.score ?? session?.average_score ?? 0;
    const report = session?.report;

    return (
      <Stack spacing={3} sx={{ maxWidth: 1000, mx: "auto", py: 4 }}>
        <Alert severity="success" icon={<MdCheckCircle />}>
          AI interview completed successfully.
        </Alert>

        <Paper sx={{ p: { xs: 3, md: 5 }, borderRadius: 4 }}>
          <Stack spacing={2}>
            <Typography variant="h4" fontWeight={800}>
              Interview Complete
            </Typography>

            <Typography color="text.secondary">
              {setup?.role || "Target role"} • {questionNumber} questions
            </Typography>

            <Divider />

            <Typography variant="h5" fontWeight={800}>
              Overall Score: {score}/100
            </Typography>

            {report?.overall_summary && (
              <Typography color="text.secondary">
                {report.overall_summary}
              </Typography>
            )}

            {report?.recommendation && (
              <Chip
                label={report.recommendation}
                color="primary"
                sx={{ width: "fit-content", fontWeight: 700 }}
              />
            )}

            <Box>
              <Typography fontWeight={800} mb={1}>
                Interview Integrity
              </Typography>
              <Typography color="text.secondary">
                {integrityCount === 0
                  ? "No browser/session integrity events were detected."
                  : `${integrityCount} integrity event(s) were recorded for review.`}
              </Typography>
            </Box>

            <Button
              variant="contained"
              onClick={() => navigate("/dashboard/interview")}
              sx={{ width: "fit-content" }}
            >
              Back to Interview Setup
            </Button>
          </Stack>
        </Paper>
      </Stack>
    );
  }

  return (
    <Stack spacing={3} sx={{ py: 2 }}>
      <Stack
        direction={{ xs: "column", md: "row" }}
        justifyContent="space-between"
        alignItems={{ xs: "flex-start", md: "center" }}
        spacing={2}
      >
        <Box>
          <Typography variant="h4" fontWeight={900}>
            AI Video Interview
          </Typography>
          <Typography color="text.secondary" mt={0.5}>
            {setup?.role || "Target role"} • Question {questionNumber} of{" "}
            {session?.question_count || setup?.questionCount || 5}
          </Typography>
        </Box>

        <Chip
          label={formattedTime}
          color="primary"
          sx={{ fontWeight: 800, fontSize: 15 }}
        />
      </Stack>

      {(error || warning) && (
        <Alert severity={error ? "error" : "warning"} icon={<MdWarning />}>
          {error || warning}
        </Alert>
      )}

      <Paper
        sx={{
          p: { xs: 1.5, md: 2.5 },
          borderRadius: 4,
          overflow: "hidden",
        }}
      >
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: { xs: "1fr", lg: "1.25fr .75fr" },
            gap: 2,
          }}
        >
          <Box
            sx={{
              position: "relative",
              borderRadius: 3,
              overflow: "hidden",
              bgcolor: "#07111f",
              minHeight: { xs: 300, md: 460 },
            }}
          >
            <video
              ref={videoRef}
              autoPlay
              muted
              playsInline
              style={{
                width: "100%",
                height: "100%",
                minHeight: 460,
                objectFit: "cover",
                transform: "scaleX(-1)",
              }}
            />

            <Stack
              direction="row"
              spacing={1}
              sx={{
                position: "absolute",
                top: 16,
                left: 16,
                right: 16,
                flexWrap: "wrap",
              }}
            >
              <Chip
                icon={cameraReady ? <MdVideocam /> : <MdVideocamOff />}
                label={cameraReady ? "Camera ON" : "Camera OFF"}
                color={cameraReady ? "success" : "error"}
                size="small"
              />
              <Chip
                icon={micReady ? <MdMic /> : <MdMicOff />}
                label={micReady ? "Mic ON" : "Mic OFF"}
                color={micReady ? "success" : "error"}
                size="small"
              />
              {isRecording && (
                <Chip
                  icon={<MdStop />}
                  label="Recording"
                  color="error"
                  size="small"
                />
              )}
            </Stack>

            <Box
              sx={{
                position: "absolute",
                bottom: 16,
                left: 16,
                right: 16,
                display: "flex",
                justifyContent: "space-between",
                gap: 2,
                alignItems: "center",
              }}
            >
              <Chip
                icon={<MdWarning />}
                label={`Integrity events: ${integrityCount}`}
                sx={{
                  bgcolor: "rgba(0,0,0,.65)",
                  color: "#fff",
                  fontWeight: 700,
                }}
              />

              <Chip
                label={
                  isListening
                    ? "Listening..."
                    : isRecording
                      ? "Recording"
                      : "Ready"
                }
                sx={{
                  bgcolor: "rgba(0,0,0,.65)",
                  color: "#fff",
                  fontWeight: 700,
                }}
              />
            </Box>
          </Box>

          <Paper
            variant="outlined"
            sx={{
              p: { xs: 2.5, md: 3 },
              borderRadius: 3,
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
            }}
          >
            <Stack spacing={2.5}>
              <Stack direction="row" spacing={1.5} alignItems="center">
                <Box
                  sx={{
                    width: 48,
                    height: 48,
                    borderRadius: "50%",
                    display: "grid",
                    placeItems: "center",
                    color: "#fff",
                    background:
                      "linear-gradient(135deg,#2563eb,#7c3aed)",
                  }}
                >
                  <MdRecordVoiceOver size={25} />
                </Box>

                <Box>
                  <Typography fontWeight={900}>
                    AI Interviewer
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {isSpeaking ? "Speaking..." : "Ready"}
                  </Typography>
                </Box>
              </Stack>

              <Divider />

              <Typography
                variant="h5"
                fontWeight={800}
                sx={{ lineHeight: 1.45 }}
              >
                {currentQuestion}
              </Typography>

              {isSpeaking && (
                <Alert severity="info">
                  Listen to the AI question. Your answer recording starts when
                  you press <b>Start Answer</b>.
                </Alert>
              )}

              <Button
                variant="contained"
                size="large"
                disabled={isRecording || submitting || isSpeaking}
                startIcon={<MdMic />}
                onClick={beginAnswer}
              >
                Start Answer
              </Button>

              <Button
                variant="outlined"
                size="large"
                disabled={!isRecording || submitting}
                startIcon={submitting ? <CircularProgress size={18} /> : <MdStop />}
                onClick={finishAnswer}
              >
                {submitting ? "Processing Answer..." : "Finish Answer"}
              </Button>
            </Stack>
          </Paper>
        </Box>

        <Box
          sx={{
            mt: 2,
            p: { xs: 2, md: 2.5 },
            borderRadius: 3,
            bgcolor: "rgba(37,99,235,.05)",
          }}
        >
          <Typography fontWeight={900} mb={1}>
            Live Transcript
          </Typography>

          <Typography
            color={transcript ? "text.primary" : "text.secondary"}
            sx={{ minHeight: 60, whiteSpace: "pre-wrap" }}
          >
            {transcript ||
              "Your spoken answer will appear here while you are answering."}
          </Typography>
        </Box>
      </Paper>

      <Stack
        direction={{ xs: "column", md: "row" }}
        spacing={1.5}
        justifyContent="space-between"
        alignItems={{ xs: "stretch", md: "center" }}
      >
        <Typography variant="body2" color="text.secondary">
          Camera and microphone are used only during the interview session.
          Recorded answers are uploaded to the interview media storage.
        </Typography>

        <Button
          color="error"
          variant="outlined"
          onClick={endInterview}
          disabled={submitting}
        >
          End Interview
        </Button>
      </Stack>
    </Stack>
  );
}
