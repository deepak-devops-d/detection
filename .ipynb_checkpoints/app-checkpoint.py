from flask import Flask, request, jsonify
from flask_cors import CORS
import json
import uuid
import pickle, re, pytesseract
from pdf2image import convert_from_path
import tempfile, os
from datetime import datetime, timezone

try:
    import boto3
except ImportError:
    boto3 = None

app = Flask(__name__)
CORS(app, origins=os.getenv("CORS_ORIGINS", "http://localhost:3000").split(","))

save_path = os.getenv("MODEL_PATH", os.path.join(os.path.dirname(os.path.abspath(__file__)), "models"))
model = pickle.load(open(f"{save_path}/career_model.pkl", "rb"))
tfidf = pickle.load(open(f"{save_path}/tfidf_vectorizer.pkl", "rb"))
le    = pickle.load(open(f"{save_path}/label_encoder.pkl", "rb"))
print("Model loaded!")

SKILL_BANK = [
    "javascript","react","node.js","python","java","sql","aws","docker",
    "kubernetes","git","html","css","typescript","mongodb","machine learning",
    "algorithms","agile","linux","c++","c#","tensorflow","pytorch","django","flask",
    "nlp","deep learning","mysql","postgresql","azure","gcp","selenium","spring boot",
    "spring","figma","power bi","tableau","hadoop","spark","redux","graphql",
    "express","unity","unreal","swift","kotlin","flutter","react native",
    "solidity","blockchain","terraform","ansible","jenkins","ci/cd","rest api",
    "microservices","opencv","scikit-learn","pandas","numpy","r","excel",
    "jira","confluence","networking","tcp/ip","cisco","penetration testing",
    "wireshark","firewall","active directory","windows server","bash",
    "shell scripting","embedded c","rtos","arduino","raspberry pi","matlab",
    "computer vision","opengl","c","go","rust","php","ruby","laravel",
    "wordpress","seo","ui design","ux research","wireframing","adobe xd",
    "sketch","prototyping","product roadmap","stakeholder management",
    "agile scrum","jql","test automation","manual testing","load testing",
    "cypress","postman","junit","pytest","oracle","dba","backup recovery",
    "sql server","business intelligence","etl","data warehousing","ssis",
    "robotics","ros","plc","automation","hive","kafka","airflow",
]

# Role -> required/expected skills mapping (matches all 35 label_encoder classes)
CAREER_SKILLS = {
    "AI Engineer": ["python","machine learning","tensorflow","pytorch","deep learning","nlp","scikit-learn","pandas","numpy"],
    "AI Research Scientist": ["python","machine learning","deep learning","tensorflow","pytorch","nlp","computer vision","r"],
    "Automation Engineer": ["python","selenium","ci/cd","jenkins","ansible","bash","test automation"],
    "Backend Developer": ["node.js","python","java","sql","rest api","docker","mongodb","microservices"],
    "Blockchain developer": ["solidity","blockchain","javascript","python","rest api"],
    "Business Intelligence(BI)  Developer": ["power bi","tableau","sql","etl","data warehousing","ssis","excel"],
    "Cloud Engineer": ["aws","azure","gcp","docker","kubernetes","terraform","linux","ci/cd"],
    "Computer Vision Engineer": ["python","opencv","tensorflow","pytorch","deep learning","computer vision","numpy"],
    "Cyber security Analyst": ["networking","wireshark","firewall","penetration testing","tcp/ip","active directory","linux"],
    "DL Engineer": ["python","deep learning","tensorflow","pytorch","numpy","pandas","nlp"],
    "Data Analyst": ["sql","excel","python","power bi","tableau","pandas","r"],
    "Data engineer": ["python","sql","spark","hadoop","kafka","airflow","etl","aws"],
    "Data scientist": ["python","machine learning","sql","pandas","numpy","tensorflow","excel"],
    "Database Administrator": ["sql","mysql","postgresql","oracle","dba","backup recovery","sql server"],
    "DevOps Engineer": ["docker","kubernetes","aws","ci/cd","linux","jenkins","terraform","ansible"],
    "Embedded Systems Engineer": ["embedded c","rtos","arduino","raspberry pi","c","c++","matlab"],
    "Frontend Developer": ["javascript","react","html","css","typescript","redux","figma"],
    "Full Stack developer": ["javascript","react","node.js","sql","git","html","css"],
    "Game Developer": ["unity","unreal","c#","c++","opengl","git"],
    "IT Support Specialist": ["windows server","active directory","networking","linux","bash"],
    "Java Developer": ["java","spring boot","spring","sql","git","microservices"],
    "Mobile App Developer": ["flutter","react native","kotlin","swift","java"],
    "NLP Engineer": ["python","nlp","machine learning","deep learning","tensorflow","pytorch"],
    "Network engineer": ["networking","tcp/ip","cisco","firewall","wireshark","linux"],
    "Product Manager": ["jira","confluence","product roadmap","stakeholder management","agile scrum","excel"],
    "Python developer": ["python","django","flask","sql","git","rest api"],
    "Quality Assurance Engineer": ["selenium","test automation","manual testing","jira","cypress","postman"],
    "Robotics Engineer": ["python","ros","robotics","c++","matlab","arduino"],
    "Site Reliability Engineer": ["linux","kubernetes","docker","ci/cd","aws","bash","terraform"],
    "Software Tester": ["manual testing","selenium","test automation","jira","junit","pytest"],
    "Software engineer": ["python","java","git","algorithms","sql","docker"],
    "Solution Architect": ["aws","azure","microservices","docker","kubernetes","rest api"],
    "System Administrator": ["linux","windows server","bash","networking","active directory"],
    "Technical Project Mnger": ["jira","confluence","agile scrum","stakeholder management","product roadmap"],
    "UI-UX Designer": ["figma","adobe xd","sketch","wireframing","prototyping","ux research"],
}

def clean(text):
    text = text.lower()
    text = re.sub(r"\n+", " ", text)
    text = re.sub(r"[^a-z0-9\s\+\#\.]", " ", text)
    return re.sub(r"\s+", " ", text).strip()

def skill_fit_percent(found_skills, role):
    required = CAREER_SKILLS.get(role, [])
    if not required:
        return 0
    matched = [s for s in required if s in found_skills]
    return round((len(matched) / len(required)) * 100)

def analyze_text(text, predicted_career):
    text_lower = text.lower()
    word_count = len(text_lower.split())
    found_skills = [s for s in SKILL_BANK if s in text_lower]

    required_skills = CAREER_SKILLS.get(predicted_career, [])
    missing_skills = [s for s in required_skills if s not in found_skills]
    matching_percentage = skill_fit_percent(found_skills, predicted_career)

    ats_score = 0
    ats_score += min(len(found_skills) * 3, 35)
    ats_score += 15 if re.search(r"(@|\+?\d{10})", text_lower) else 0
    ats_score += 15 if re.search(r"education|degree|university|college", text_lower) else 0
    ats_score += 15 if re.search(r"experience|internship|worked|project", text_lower) else 0
    ats_score += 10 if re.search(r"%|\$|\d+\s?(users|clients|projects)", text_lower) else 0
    ats_score += 10 if word_count > 150 else 5
    ats_score = min(ats_score, 98)

    strengths = []
    if len(found_skills) >= 5: strengths.append("Strong technical skill set detected")
    if re.search(r"%|\d+\s?(users|clients)", text_lower): strengths.append("Quantified achievements found")
    if re.search(r"experience|internship", text_lower): strengths.append("Experience section detected")
    if re.search(r"project", text_lower): strengths.append("Projects section detected")
    if not strengths: strengths.append("Resume successfully parsed")

    weaknesses = []
    if not re.search(r"%|\d+\s?(users|clients)", text_lower): weaknesses.append("No quantified achievements found")
    if not re.search(r"(@|\+?\d{10})", text_lower): weaknesses.append("Contact details not clearly detected")
    if len(found_skills) < 5: weaknesses.append("Limited technical keywords found")
    if word_count < 150: weaknesses.append("Resume content too short")
    if missing_skills: weaknesses.append(f"Missing {len(missing_skills)} key skill(s) for {predicted_career}")
    if not weaknesses: weaknesses.append("Minor formatting issues may affect ATS")

    # Dynamic suggestions based on actual detected weaknesses
    suggestions = []
    if "No quantified achievements found" in weaknesses:
        suggestions.append("Quantify achievements (e.g. improved performance by 30%, served 500 users)")
    if "Contact details not clearly detected" in weaknesses:
        suggestions.append("Add a clear email and phone number at the top of your resume")
    if "Limited technical keywords found" in weaknesses:
        suggestions.append(f"Add more {predicted_career}-relevant keywords throughout your resume")
    if "Resume content too short" in weaknesses:
        suggestions.append("Expand experience/project descriptions with more specific detail")
    if missing_skills:
        suggestions.append(f"Consider adding or highlighting: {', '.join(missing_skills[:5])}")
    if not suggestions:
        suggestions.append("Resume is well-optimized — keep reinforcing role-specific keywords")

    return {
        "ats_score": ats_score,
        "found_skills": found_skills,
        "missing_skills": missing_skills,
        "matching_percentage": matching_percentage,
        "strengths": strengths,
        "weaknesses": weaknesses,
        "suggestions": suggestions,
        "word_count": word_count,
    }

@app.route("/predict", methods=["POST"])
def predict():
    if "file" not in request.files:
        return jsonify({"error": "No file"}), 400
    file = request.files["file"]
    with tempfile.NamedTemporaryFile(delete=False, suffix=".pdf") as tmp:
        file.save(tmp.name)
        tmp_path = tmp.name
    try:
        print(f"Processing: {file.filename}")
        pages = convert_from_path(tmp_path, dpi=100)
        text  = "".join([pytesseract.image_to_string(p) for p in pages])
        cleaned = clean(text)

        if len(cleaned) < 20:
            return jsonify({"error": "Could not extract readable text from this PDF"}), 400

        features = tfidf.transform([cleaned])
        pred     = model.predict(features)
        career   = le.inverse_transform(pred)[0]
        scores   = model.decision_function(features)[0]
        top3_idx = scores.argsort()[-3:][::-1]

        found_skills_for_top3 = [s for s in SKILL_BANK if s in cleaned]
        top3 = [
            {
                "role": le.classes_[i],
                "skill_fit_percent": skill_fit_percent(found_skills_for_top3, le.classes_[i])
            }
            for i in top3_idx
        ]

        analysis = analyze_text(text, career)
        print(f"Predicted: {career}, ATS: {analysis['ats_score']}, Match: {analysis['matching_percentage']}%")

        return jsonify({
            "predicted_career": career,
            "top_3": top3,
            "ats_score": analysis["ats_score"],
            "matching_percentage": analysis["matching_percentage"],
            "found_skills": analysis["found_skills"],
            "missing_skills": analysis["missing_skills"],
            "strengths": analysis["strengths"],
            "weaknesses": analysis["weaknesses"],
            "suggestions": analysis["suggestions"],
            "word_count": analysis["word_count"],
        })
    except Exception as e:
        print(f"Error: {e}")
        return jsonify({"error": str(e)}), 500
    finally:
        os.unlink(tmp_path)


# ============================================================
# PRODUCTION AI INTERVIEW — BEDROCK + DYNAMODB + S3 + TRANSCRIBE
# ============================================================

AWS_REGION = os.getenv("AWS_REGION", os.getenv("AWS_DEFAULT_REGION", "us-east-1"))
BEDROCK_MODEL_ID = os.getenv("BEDROCK_MODEL_ID", "")
INTERVIEW_TABLE_NAME = os.getenv("INTERVIEW_TABLE_NAME", "career-ai-interviews")
INTERVIEW_MEDIA_BUCKET = os.getenv("INTERVIEW_MEDIA_BUCKET", "")
TRANSCRIBE_LANGUAGE_CODE = os.getenv("TRANSCRIBE_LANGUAGE_CODE", "en-US")
TRANSCRIBE_LANGUAGE_OPTIONS = [
    x.strip() for x in os.getenv("TRANSCRIBE_LANGUAGE_OPTIONS", "en-US").split(",") if x.strip()
]
TRANSCRIBE_VOCABULARY_NAME = os.getenv("TRANSCRIBE_VOCABULARY_NAME", "").strip()
MEDIA_PREFIX = os.getenv("INTERVIEW_MEDIA_PREFIX", "interviews")

bedrock_runtime = None
s3_client = None
transcribe_client = None
dynamodb_table = None

if boto3 is not None:
    try:
        session = boto3.session.Session(region_name=AWS_REGION)
        if BEDROCK_MODEL_ID:
            bedrock_runtime = session.client("bedrock-runtime")
        s3_client = session.client("s3")
        transcribe_client = session.client("transcribe")
        if INTERVIEW_TABLE_NAME:
            dynamodb_table = session.resource("dynamodb").Table(INTERVIEW_TABLE_NAME)
    except Exception as exc:
        app.logger.exception("AWS client initialization failed: %s", exc)

LOCAL_SESSIONS = {}


def _now():
    return datetime.now(timezone.utc).isoformat()


def _bedrock_text(prompt, max_tokens=1600, temperature=0.2):
    if bedrock_runtime is None or not BEDROCK_MODEL_ID:
        raise RuntimeError(
            "Amazon Bedrock is not configured. Set BEDROCK_MODEL_ID and provide an AWS IAM identity."
        )

    response = bedrock_runtime.converse(
        modelId=BEDROCK_MODEL_ID,
        messages=[{"role": "user", "content": [{"text": prompt}]}],
        inferenceConfig={
            "maxTokens": max_tokens,
            "temperature": temperature,
            "topP": 0.9,
        },
    )
    content = response.get("output", {}).get("message", {}).get("content", [])
    return "\n".join(item.get("text", "") for item in content if item.get("text"))


def _extract_json(text):
    cleaned = (text or "").strip()
    if cleaned.startswith("```"):
        cleaned = re.sub(r"^```(?:json)?\s*", "", cleaned, flags=re.I)
        cleaned = re.sub(r"\s*```$", "", cleaned)
    try:
        return json.loads(cleaned)
    except json.JSONDecodeError:
        match = re.search(r"\{.*\}", cleaned, flags=re.S)
        if not match:
            raise ValueError("Bedrock returned an invalid JSON response")
        return json.loads(match.group(0))


def _save_session(session):
    if dynamodb_table is not None:
        dynamodb_table.put_item(Item=session)
    else:
        LOCAL_SESSIONS[session["session_id"]] = session


def _get_session(session_id):
    if dynamodb_table is not None:
        response = dynamodb_table.get_item(
            Key={"session_id": session_id},
            ConsistentRead=True,
        )
        return response.get("Item")
    return LOCAL_SESSIONS.get(session_id)


def _update_session(session):
    _save_session(session)


def _build_history_text(history):
    return "\n".join(
        f"Q{item.get('question_number', '')}: {item.get('question', '')}\n"
        f"A: {item.get('answer', '')}\n"
        f"Score: {item.get('score', '')}\n"
        f"Verdict: {item.get('verdict', '')}"
        for item in history[-10:]
        if isinstance(item, dict)
    )


def _safe_media_extension(filename, mimetype):
    extension = os.path.splitext(filename or "")[1].lower()
    allowed = {".webm", ".mp4", ".wav", ".m4a", ".mp3", ".ogg", ".flac", ".amr"}
    if extension in allowed:
        return extension

    mapping = {
        "audio/webm": ".webm",
        "video/webm": ".webm",
        "audio/wav": ".wav",
        "audio/x-wav": ".wav",
        "audio/mpeg": ".mp3",
        "audio/mp4": ".m4a",
        "video/mp4": ".mp4",
        "audio/ogg": ".ogg",
        "audio/flac": ".flac",
    }
    return mapping.get((mimetype or "").lower(), ".webm")


def _start_transcription(audio_uri, session_id, question_number, job_token, audio_extension):
    if transcribe_client is None:
        return None

    job_name = f"career-ai-{session_id[:8]}-{question_number}-{job_token[:12]}"
    request = {
        "TranscriptionJobName": job_name,
        "Media": {"MediaFileUri": audio_uri},
        "MediaFormat": audio_extension.lstrip("."),
        "LanguageCode": TRANSCRIBE_LANGUAGE_CODE,
        "OutputBucketName": INTERVIEW_MEDIA_BUCKET,
        "OutputKey": f"{MEDIA_PREFIX}/{session_id}/transcripts/{job_name}.json",
        "Tags": [
            {"Key": "Application", "Value": "career-ai"},
            {"Key": "SessionId", "Value": session_id},
        ],
    }

    # Optional technical vocabulary can substantially improve recognition of
    # product names, cloud services and other domain-specific terminology.
    if TRANSCRIBE_VOCABULARY_NAME:
        request["Settings"] = {"VocabularyName": TRANSCRIBE_VOCABULARY_NAME}

    transcribe_client.start_transcription_job(**request)
    return job_name


def _read_transcript_from_job(job):
    transcript_uri = job.get("Transcript", {}).get("TranscriptFileUri")
    if not transcript_uri:
        raise RuntimeError("Transcribe completed without a transcript URI")

    bucket = INTERVIEW_MEDIA_BUCKET
    key = ""

    if transcript_uri.startswith("s3://"):
        raw = transcript_uri[5:]
        if "/" in raw:
            bucket, key = raw.split("/", 1)
    elif transcript_uri.startswith("https://"):
        marker = ".amazonaws.com/"
        if marker in transcript_uri:
            raw = transcript_uri.split(marker, 1)[1]
            if "/" in raw:
                bucket, key = raw.split("/", 1)

    if not key:
        return ""

    obj = s3_client.get_object(Bucket=bucket, Key=key)
    payload = json.loads(obj["Body"].read().decode("utf-8"))
    return (
        payload.get("results", {})
        .get("transcripts", [{}])[0]
        .get("transcript", "")
        .strip()
    )


@app.route("/api/v1/ai-interview/start", methods=["POST"])
def start_ai_interview():
    data = request.get_json(silent=True) or {}
    role = str(data.get("role", "")).strip()
    experience = str(data.get("experience", "")).strip()
    interview_type = str(data.get("interview_type", "Mixed")).strip()

    try:
        question_count = int(data.get("question_count", 5))
    except (TypeError, ValueError):
        question_count = 5

    resume_context = str(data.get("resume_context", "")).strip()[:12000]
    job_description = str(data.get("job_description", "")).strip()[:12000]

    if not role:
        return jsonify({"error": "Target role is required."}), 400
    if question_count not in (5, 10, 15):
        return jsonify({"error": "question_count must be 5, 10, or 15."}), 400

    prompt = f"""
You are a professional AI interviewer conducting a structured interview.
Target role: {role}
Experience: {experience}
Interview type: {interview_type}
Resume context: {resume_context or 'Not provided'}
Job description: {job_description or 'Not provided'}

Create the first interview question. It must be practical, job-relevant, concise and
appropriate for the candidate's experience. Avoid protected characteristics and unrelated
personal questions.

Return ONLY JSON:
{{"question":"..."}}
"""

    try:
        result = _extract_json(_bedrock_text(prompt, max_tokens=500, temperature=0.2))
        question = str(result.get("question", "")).strip()
        if not question:
            raise ValueError("No question returned by Bedrock")

        session_id = str(uuid.uuid4())
        session = {
            "session_id": session_id,
            "status": "IN_PROGRESS",
            "created_at": _now(),
            "updated_at": _now(),
            "role": role,
            "experience": experience,
            "interview_type": interview_type,
            "question_count": question_count,
            "resume_context": resume_context,
            "job_description": job_description,
            "current_question": question,
            "current_question_number": 1,
            "answers": [],
            "media": [],
            "elapsed_seconds": 0,
        }
        _save_session(session)

        return jsonify({
            "session_id": session_id,
            "question": question,
            "question_count": question_count,
            "provider": "amazon-bedrock",
            "model_id": BEDROCK_MODEL_ID,
        })
    except Exception as exc:
        app.logger.exception("AI interview start failed")
        return jsonify({"error": str(exc)}), 503


@app.route("/api/v1/ai-interview/session/<session_id>", methods=["GET"])
def get_interview_session(session_id):
    session = _get_session(session_id)
    if not session:
        return jsonify({"error": "Interview session not found."}), 404
    return jsonify(session)


@app.route("/api/v1/ai-interview/media", methods=["POST"])
def upload_interview_media():
    """Upload separate video + audio. Transcribe the AUDIO object only.

    The previous implementation sent the browser's combined video/WebM file to
    Transcribe. This replacement deliberately records and submits an audio-only
    WebM/Opus object for speech-to-text, while preserving the video separately.
    """
    if not INTERVIEW_MEDIA_BUCKET or s3_client is None:
        return jsonify({"error": "Interview media storage is not configured."}), 503

    session_id = str(request.form.get("session_id", "")).strip()
    question_number = str(request.form.get("question_number", "1")).strip()
    audio = request.files.get("audio")
    video = request.files.get("video")

    if not session_id or not audio:
        return jsonify({"error": "session_id and audio are required."}), 400

    session = _get_session(session_id)
    if not session:
        return jsonify({"error": "Interview session not found."}), 404

    audio_extension = _safe_media_extension(audio.filename, audio.mimetype)
    video_extension = _safe_media_extension(video.filename, video.mimetype) if video else ".webm"
    job_token = uuid.uuid4().hex

    audio_key = f"{MEDIA_PREFIX}/{session_id}/audio-{question_number}-{job_token}{audio_extension}"
    video_key = f"{MEDIA_PREFIX}/{session_id}/video-{question_number}-{job_token}{video_extension}"

    try:
        s3_client.upload_fileobj(
            audio.stream,
            INTERVIEW_MEDIA_BUCKET,
            audio_key,
            ExtraArgs={"ContentType": audio.mimetype or "audio/webm"},
        )

        audio_uri = f"s3://{INTERVIEW_MEDIA_BUCKET}/{audio_key}"
        video_uri = None

        if video:
            s3_client.upload_fileobj(
                video.stream,
                INTERVIEW_MEDIA_BUCKET,
                video_key,
                ExtraArgs={"ContentType": video.mimetype or "video/webm"},
            )
            video_uri = f"s3://{INTERVIEW_MEDIA_BUCKET}/{video_key}"

        job_name = _start_transcription(
            audio_uri,
            session_id,
            question_number,
            job_token,
            audio_extension,
        )

        media_record = {
            "question_number": int(question_number),
            "audio_uri": audio_uri,
            "video_uri": video_uri or "",
            "transcription_job": job_name or "",
            "transcription_status": "IN_PROGRESS" if job_name else "NOT_CONFIGURED",
            "created_at": _now(),
        }
        session.setdefault("media", []).append(media_record)
        session["updated_at"] = _now()
        _update_session(session)

        return jsonify({
            "audio_uri": audio_uri,
            "video_uri": video_uri,
            "transcription_job": job_name,
            "transcription_status": "IN_PROGRESS" if job_name else "NOT_CONFIGURED",
        }), 202

    except Exception as exc:
        app.logger.exception("Interview media upload failed")
        return jsonify({"error": str(exc)}), 503


@app.route("/api/v1/ai-interview/transcription/<job_name>", methods=["GET"])
def get_interview_transcription(job_name):
    if transcribe_client is None:
        return jsonify({"error": "Amazon Transcribe is not configured."}), 503

    try:
        response = transcribe_client.get_transcription_job(
            TranscriptionJobName=job_name
        )
        job = response.get("TranscriptionJob", {})
        status = job.get("TranscriptionJobStatus", "UNKNOWN")
        result = {"job_name": job_name, "status": status}

        if status == "COMPLETED":
            result["transcript"] = _read_transcript_from_job(job)
        elif status == "FAILED":
            result["reason"] = job.get("FailureReason", "Transcription failed")

        return jsonify(result)

    except Exception as exc:
        app.logger.exception("Transcription status lookup failed")
        return jsonify({"error": str(exc)}), 503


@app.route("/api/v1/ai-interview/answer", methods=["POST"])
def answer_ai_interview():
    data = request.get_json(silent=True) or {}
    session_id = str(data.get("session_id", "")).strip()

    if not session_id:
        return jsonify({"error": "session_id is required."}), 400

    session = _get_session(session_id)
    if not session:
        return jsonify({"error": "Interview session not found."}), 404
    if session.get("status") == "COMPLETED":
        return jsonify({"error": "Interview session is already completed."}), 409

    answer = str(data.get("answer", "")).strip()[:12000]
    transcript = str(data.get("transcript", "")).strip()[:12000]
    effective_answer = transcript or answer

    question = str(
        data.get("question", session.get("current_question", ""))
    ).strip()[:8000]
    question_number = int(
        data.get("question_number", session.get("current_question_number", 1))
    )
    question_count = int(session.get("question_count", 5))

    if not effective_answer:
        return jsonify({"error": "A transcript or text answer is required."}), 400

    history = session.get("answers", [])
    history_text = _build_history_text(history)

    prompt = f"""
You are an expert technical interviewer evaluating one spoken candidate answer.

Target role: {session['role']}
Experience: {session.get('experience', '')}
Interview type: {session.get('interview_type', 'Mixed')}
Question {question_number} of {question_count}

Resume context:
{session.get('resume_context', '') or 'Not provided'}

Job description:
{session.get('job_description', '') or 'Not provided'}

Previous interview history:
{history_text or 'No previous answers'}

CURRENT QUESTION:
{question}

CANDIDATE TRANSCRIPT:
{effective_answer}

Evaluate ONLY the candidate's answer to the current question.

Evaluation rules:
1. Judge correctness against the actual question, not against wording style.
2. Accept technically equivalent valid approaches.
3. Separate factual correctness from communication quality.
4. Do not reward confident-sounding but incorrect statements.
5. Identify important concepts the answer should contain.
6. Identify concepts actually present.
7. Identify missing concepts that materially affect the answer.
8. Identify concrete factual errors when present.
9. If the answer is partially correct, say exactly what is correct and what is wrong/missing.
10. Do not infer protected characteristics or unrelated personal traits.
11. If the answer is too short or unclear, mark that explicitly rather than inventing content.
12. Generate the next question only when another question remains.

Return ONLY valid JSON in this exact structure:
{{
  "verdict": "CORRECT|PARTIALLY_CORRECT|INCORRECT|INSUFFICIENT",
  "score": 0,
  "correctness_score": 0,
  "relevance_score": 0,
  "completeness_score": 0,
  "technical_accuracy_score": 0,
  "communication_score": 0,
  "confidence": 0,
  "summary": "...",
  "strengths": ["..."],
  "missing_key_points": ["..."],
  "factual_errors": ["..."],
  "feedback": "...",
  "next_question": "...",
  "completed": false
}}
"""

    try:
        result = _extract_json(
            _bedrock_text(prompt, max_tokens=1800, temperature=0.15)
        )

        def score_value(name):
            try:
                return max(0, min(100, int(float(result.get(name, 0)))))
            except (TypeError, ValueError):
                return 0

        score = score_value("score")
        completed = question_number >= question_count or bool(result.get("completed", False))
        next_question = str(result.get("next_question", "")).strip()

        if not completed and not next_question:
            raise ValueError("Bedrock did not return the next interview question")

        answer_record = {
            "question_number": question_number,
            "question": question,
            "answer": effective_answer,
            "score": score,
            "verdict": str(result.get("verdict", "INSUFFICIENT")).strip(),
            "correctness_score": score_value("correctness_score"),
            "relevance_score": score_value("relevance_score"),
            "completeness_score": score_value("completeness_score"),
            "technical_accuracy_score": score_value("technical_accuracy_score"),
            "communication_score": score_value("communication_score"),
            "confidence": score_value("confidence"),
            "summary": str(result.get("summary", "")).strip(),
            "feedback": str(result.get("feedback", "")).strip(),
            "strengths": result.get("strengths", []) or [],
            "missing_key_points": result.get("missing_key_points", []) or [],
            "factual_errors": result.get("factual_errors", []) or [],
            "answered_at": _now(),
        }

        history.append(answer_record)
        session["answers"] = history
        session["updated_at"] = _now()

        if completed:
            session["status"] = "COMPLETED"
            session["completed_at"] = _now()
            session["current_question"] = None
        else:
            session["current_question"] = next_question
            session["current_question_number"] = question_number + 1

        _update_session(session)

        return jsonify({
            "session_id": session_id,
            "verdict": answer_record["verdict"],
            "score": score,
            "correctness_score": answer_record["correctness_score"],
            "relevance_score": answer_record["relevance_score"],
            "completeness_score": answer_record["completeness_score"],
            "technical_accuracy_score": answer_record["technical_accuracy_score"],
            "communication_score": answer_record["communication_score"],
            "confidence": answer_record["confidence"],
            "summary": answer_record["summary"],
            "feedback": answer_record["feedback"],
            "strengths": answer_record["strengths"],
            "missing_key_points": answer_record["missing_key_points"],
            "factual_errors": answer_record["factual_errors"],
            "transcript": effective_answer,
            "next_question": None if completed else next_question,
            "completed": completed,
            "answer_count": len(history),
        })

    except Exception as exc:
        app.logger.exception("AI interview answer evaluation failed")
        return jsonify({"error": str(exc)}), 503


@app.route("/api/v1/ai-interview/integrity", methods=["POST"])
def record_ai_interview_integrity():
    """Record objective browser/session integrity signals for an active AI interview."""
    data = request.get_json(silent=True) or {}
    session_id = str(data.get("session_id", "")).strip()
    event = data.get("event") or {}

    if not session_id:
        return jsonify({"error": "session_id is required."}), 400
    if not isinstance(event, dict):
        return jsonify({"error": "event must be an object."}), 400

    event_type = str(event.get("type", "")).strip().upper()
    severity = str(event.get("severity", "MEDIUM")).strip().upper()
    details = str(event.get("details", "")).strip()[:1000]
    timestamp = str(event.get("timestamp", "")).strip() or _now()

    allowed_types = {
        "TAB_HIDDEN", "WINDOW_BLURRED", "FULLSCREEN_EXIT",
        "CAMERA_DISABLED", "MICROPHONE_DISABLED", "NO_FACE", "MULTIPLE_FACES",
    }
    if event_type not in allowed_types:
        return jsonify({"error": "Unsupported integrity event type."}), 400
    if severity not in {"LOW", "MEDIUM", "HIGH"}:
        severity = "MEDIUM"

    session = _get_session(session_id)
    if not session:
        return jsonify({"error": "AI interview session not found."}), 404
    if session.get("status") in {"COMPLETED", "TERMINATED"}:
        return jsonify({"error": "AI interview session is already closed."}), 409

    integrity_event = {
        "type": event_type,
        "severity": severity,
        "details": details,
        "timestamp": timestamp,
        "recorded_at": _now(),
    }
    events = session.setdefault("integrity_events", [])
    if len(events) >= 200:
        events.pop(0)
    events.append(integrity_event)
    session["integrity_event_count"] = len(events)
    session["updated_at"] = _now()
    _update_session(session)

    return jsonify({
        "session_id": session_id,
        "recorded": True,
        "integrity_event_count": len(events),
        "event": integrity_event,
    })


@app.route("/api/v1/ai-interview/complete", methods=["POST"])
def complete_ai_interview():
    data = request.get_json(silent=True) or {}
    session_id = str(data.get("session_id", "")).strip()
    session = _get_session(session_id) if session_id else None

    if not session:
        return jsonify({"error": "Interview session not found."}), 404

    answers = session.get("answers", [])
    scores = [
        int(item.get("score", 0))
        for item in answers
        if isinstance(item, dict)
    ]
    average_score = round(sum(scores) / len(scores), 1) if scores else 0

    session["status"] = "COMPLETED"
    session["completed_at"] = _now()
    session["updated_at"] = _now()
    session["average_score"] = average_score
    session["elapsed_seconds"] = max(0, int(data.get("elapsed_seconds", 0)))

    try:
        history_text = _build_history_text(answers)
        prompt = f"""
Create a concise final interview assessment for a {session['role']} candidate.
Experience: {session.get('experience', '')}
Interview type: {session.get('interview_type', '')}
Average answer score: {average_score}

Interview history:
{history_text}

Return ONLY JSON:
{{
  "overall_summary":"...",
  "strengths":["..."],
  "improvements":["..."],
  "technical_score":0,
  "communication_score":0,
  "problem_solving_score":0,
  "confidence_score":0,
  "overall_level":"EXCELLENT|GOOD|DEVELOPING|NEEDS_IMPROVEMENT"
}}
"""
        report = _extract_json(
            _bedrock_text(prompt, max_tokens=1400, temperature=0.2)
        )
        session["report"] = report
    except Exception as exc:
        app.logger.warning(
            "Final AI report generation failed; returning deterministic summary: %s",
            exc,
        )
        session["report"] = {
            "overall_summary": "Interview completed. Review the individual answer assessments for details.",
            "strengths": [],
            "improvements": [],
            "technical_score": average_score,
            "communication_score": average_score,
            "problem_solving_score": average_score,
            "confidence_score": average_score,
            "overall_level": "DEVELOPING" if average_score < 70 else "GOOD",
        }

    _update_session(session)
    return jsonify({
        "session_id": session_id,
        "status": session["status"],
        "average_score": average_score,
        "answer_count": len(answers),
        "report": session["report"],
    })

@app.route("/health", methods=["GET"])
def health():
    return jsonify({
        "status": "running",
        "model_loaded": model is not None,
        "bedrock_configured": bool(BEDROCK_MODEL_ID and bedrock_runtime),
        "service": "career-ai-backend",
    })


@app.route("/ready", methods=["GET"])
def ready():
    if model is None:
        return jsonify({"status": "not_ready", "reason": "resume model not loaded"}), 503
    return jsonify({"status": "ready"})


if __name__ == "__main__":
    app.run(debug=False, host="0.0.0.0", port=int(os.getenv("PORT", "5000")), threaded=True)
