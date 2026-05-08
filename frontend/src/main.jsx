import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  AlertTriangle,
  BriefcaseBusiness,
  CheckCircle2,
  Clipboard,
  Copy,
  FileText,
  History,
  Loader2,
  RotateCcw,
  Sparkles,
  Trash2,
  Upload,
} from "lucide-react";
import "./styles.css";

const initialJob = {
  title: "",
  company: "",
  platform: "LinkedIn",
  description: "",
};

const resumeStorageKey = "job-fit-agent:resume";
const historyStorageKey = "job-fit-agent:history";
const maxHistoryItems = 8;

function readJsonStorage(key, fallback) {
  try {
    const value = window.localStorage.getItem(key);
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
}

function createId() {
  return window.crypto?.randomUUID?.() ?? String(Date.now());
}

function loadResume() {
  return readJsonStorage(resumeStorageKey, "");
}

function loadHistory() {
  const history = readJsonStorage(historyStorageKey, []);
  return Array.isArray(history) ? history : [];
}

function buildPayload(job, resume) {
  return {
    title: job.title.trim(),
    company: job.company.trim(),
    platform: job.platform.trim(),
    description: job.description.trim(),
    resume: resume.trim(),
  };
}

function createRequestSignature(job, resume) {
  return JSON.stringify(buildPayload(job, resume));
}

function App() {
  const [job, setJob] = useState(initialJob);
  const [resume, setResume] = useState(loadResume);
  const [history, setHistory] = useState(loadHistory);
  const [activeTab, setActiveTab] = useState("analysis");
  const [analysis, setAnalysis] = useState(null);
  const [analysisSignature, setAnalysisSignature] = useState("");
  const [coverLetter, setCoverLetter] = useState(null);
  const [error, setError] = useState("");
  const [loadingAction, setLoadingAction] = useState("");
  const [isExtractingResume, setIsExtractingResume] = useState(false);
  const [resumeFileName, setResumeFileName] = useState("");
  const [copied, setCopied] = useState(false);

  const isBusy = Boolean(loadingAction);

  useEffect(() => {
    window.localStorage.setItem(resumeStorageKey, JSON.stringify(resume));
  }, [resume]);

  useEffect(() => {
    window.localStorage.setItem(historyStorageKey, JSON.stringify(history));
  }, [history]);

  const canSubmit = useMemo(
    () =>
      job.title.trim() &&
      job.company.trim() &&
      job.platform.trim() &&
      job.description.trim() &&
      resume.trim() &&
      !isExtractingResume &&
      !isBusy,
    [job, resume, isExtractingResume, isBusy],
  );

  function updateJob(field, value) {
    setJob((current) => ({ ...current, [field]: value }));
  }

  async function submit(endpoint, action) {
    setError("");
    setCopied(false);
    setLoadingAction(action);

    try {
      const payload = buildPayload(job, resume);
      const currentSignature = createRequestSignature(job, resume);

      if (action === "cover" && analysis && analysisSignature === currentSignature) {
        payload.analysis = analysis;
      }

      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Request failed");
      }

      if (action === "analysis") {
        setAnalysis(data);
        setAnalysisSignature(currentSignature);
        setActiveTab("analysis");
      } else {
        setCoverLetter(data);
        setAnalysis(data);
        setAnalysisSignature(currentSignature);
        setActiveTab("cover");
      }

      saveHistoryItem(data, action);
    } catch (requestError) {
      setError(requestError.message || "Something went wrong");
    } finally {
      setLoadingAction("");
    }
  }

  function resetForm() {
    setJob(initialJob);
    setAnalysis(null);
    setAnalysisSignature("");
    setCoverLetter(null);
    setError("");
    setCopied(false);
    setActiveTab("analysis");
  }

  function resetResume() {
    setResume("");
    setResumeFileName("");
    setAnalysisSignature("");
  }

  async function extractResumeFromFile(event) {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (!file) {
      return;
    }

    setError("");
    setIsExtractingResume(true);

    try {
      const formData = new FormData();
      formData.append("resume", file);

      const response = await fetch("/extract-resume", {
        method: "POST",
        body: formData,
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.details || data.error || "Could not read resume file");
      }

      setResume(data.text);
      setResumeFileName(data.fileName || file.name);
      setAnalysisSignature("");
    } catch (uploadError) {
      setError(uploadError.message || "Could not read resume file");
    } finally {
      setIsExtractingResume(false);
    }
  }

  function saveHistoryItem(result, action) {
    const item = {
      id: createId(),
      createdAt: new Date().toISOString(),
      action,
      job,
      resume,
      analysis: result,
      coverLetter: action === "cover" ? result : null,
      verdict: result.verdict,
      fitScore: result.fitScore,
    };

    setHistory((current) => [item, ...current].slice(0, maxHistoryItems));
  }

  function loadHistoryItem(item) {
    setJob(item.job);
    setResume(item.resume ?? "");
    setAnalysis(item.analysis);
    setAnalysisSignature(createRequestSignature(item.job, item.resume ?? ""));
    setCoverLetter(item.coverLetter);
    setError("");
    setCopied(false);
    setActiveTab(item.coverLetter ? "cover" : "analysis");
  }

  function clearHistory() {
    setHistory([]);
  }

  async function copyCoverLetter() {
    if (!coverLetter?.coverLetter) {
      return;
    }

    await navigator.clipboard.writeText(coverLetter.coverLetter);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">AI job application workspace</p>
          <h1>Job Fit Agent</h1>
        </div>
        <div className="health-pill">
          <CheckCircle2 size={16} />
          API ready
        </div>
      </header>

      <section className="workspace" aria-label="Job analysis workspace">
        <form className="panel form-panel" onSubmit={(event) => event.preventDefault()}>
          <div className="panel-header">
            <div>
              <h2>Job Details</h2>
              <p>Paste the role once, then choose what output you need.</p>
            </div>
            <button className="icon-button" type="button" onClick={resetForm} title="Clear form">
              <RotateCcw size={18} />
            </button>
          </div>

          <div className="field-grid">
            <label>
              <span>Job title</span>
              <input
                value={job.title}
                onChange={(event) => updateJob("title", event.target.value)}
                placeholder="Junior Software Engineer"
              />
            </label>
            <label>
              <span>Company</span>
              <input
                value={job.company}
                onChange={(event) => updateJob("company", event.target.value)}
                placeholder="Example Co"
              />
            </label>
          </div>

          <label>
            <span>Platform</span>
            <input
              value={job.platform}
              onChange={(event) => updateJob("platform", event.target.value)}
              placeholder="LinkedIn, Seek, Indeed"
            />
          </label>

          <label>
            <span>Job description</span>
            <textarea
              value={job.description}
              onChange={(event) => updateJob("description", event.target.value)}
              placeholder="Paste the job description here..."
              rows={10}
            />
          </label>

          <section className="resume-box">
            <div className="resume-topline">
              <div>
                <h3>
                  <FileText size={18} />
                  Resume / CV
                </h3>
                <p>
                  {resumeFileName
                    ? `Extracted from ${resumeFileName}`
                    : "Upload a CV file or paste text directly"}
                </p>
              </div>
              <div className="resume-actions">
                <label className={`file-button ${isExtractingResume ? "disabled" : ""}`}>
                  {isExtractingResume ? (
                    <Loader2 className="spin" size={17} />
                  ) : (
                    <Upload size={17} />
                  )}
                  {isExtractingResume ? "Reading file" : "Upload CV"}
                  <input
                    type="file"
                    accept=".pdf,.docx,.txt,.md,.markdown,.rtf,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain,text/markdown"
                    disabled={isExtractingResume}
                    onChange={extractResumeFromFile}
                  />
                </label>
                {resume.trim() && (
                  <button className="text-button" type="button" onClick={resetResume}>
                    Clear resume
                  </button>
                )}
              </div>
            </div>

            <label className="resume-field">
              <span>Resume / CV text</span>
              <textarea
                value={resume}
                onChange={(event) => setResume(event.target.value)}
                placeholder="Paste the resume or CV text here..."
                rows={9}
              />
            </label>
          </section>

          {error && (
            <div className="error-banner">
              <AlertTriangle size={18} />
              {error}
            </div>
          )}

          <div className="action-row">
            <button
              className="primary-button"
              type="button"
              disabled={!canSubmit}
              onClick={() => submit("/analyze-job", "analysis")}
            >
              {loadingAction === "analysis" ? <Loader2 className="spin" size={18} /> : <Sparkles size={18} />}
              Analyze Job
            </button>
            <button
              className="secondary-button"
              type="button"
              disabled={!canSubmit}
              onClick={() => submit("/generate-cover-letter", "cover")}
            >
              {loadingAction === "cover" ? <Loader2 className="spin" size={18} /> : <FileText size={18} />}
              Cover Letter
            </button>
          </div>

          <HistoryPanel
            history={history}
            onLoad={loadHistoryItem}
            onClear={clearHistory}
          />
        </form>

        <section className="panel result-panel">
          <div className="panel-header">
            <div>
              <h2>Results</h2>
              <p>Review the fit decision and next application move.</p>
            </div>
            <BriefcaseBusiness size={22} />
          </div>

          <div className="tabs" role="tablist" aria-label="Results">
            <button
              className={activeTab === "analysis" ? "active" : ""}
              type="button"
              onClick={() => setActiveTab("analysis")}
            >
              Analysis
            </button>
            <button
              className={activeTab === "cover" ? "active" : ""}
              type="button"
              onClick={() => setActiveTab("cover")}
            >
              Cover Letter
            </button>
          </div>

          {activeTab === "analysis" ? (
            <AnalysisView analysis={analysis} />
          ) : (
            <CoverLetterView
              coverLetter={coverLetter}
              copied={copied}
              onCopy={copyCoverLetter}
            />
          )}
        </section>
      </section>
    </main>
  );
}

function HistoryPanel({ history, onLoad, onClear }) {
  return (
    <section className="history-box">
      <div className="history-header">
        <div>
          <h3>
            <History size={18} />
            Saved Jobs
          </h3>
          <p>{history.length ? "Stored in this browser" : "No saved results yet"}</p>
        </div>
        {history.length > 0 && (
          <button className="icon-button" type="button" onClick={onClear} title="Clear saved jobs">
            <Trash2 size={17} />
          </button>
        )}
      </div>

      {history.length > 0 && (
        <div className="history-list">
          {history.map((item) => (
            <button
              className="history-item"
              key={item.id}
              type="button"
              onClick={() => onLoad(item)}
            >
              <span className={`verdict mini verdict-${item.verdict.toLowerCase()}`}>
                {item.verdict}
              </span>
              <span className="history-main">
                <strong>{item.job.title || "Untitled role"}</strong>
                <small>
                  {item.job.company || "Unknown company"} · {item.fitScore}/100 ·{" "}
                  {item.action === "cover" ? "Cover letter" : "Analysis"}
                </small>
              </span>
            </button>
          ))}
        </div>
      )}
    </section>
  );
}

function AnalysisView({ analysis }) {
  if (!analysis) {
    return (
      <EmptyState
        icon={<Clipboard size={28} />}
        title="No analysis yet"
        text="Fill in the job details and run an analysis to see the verdict here."
      />
    );
  }

  return (
    <div className="analysis-view">
      <div className="score-strip">
        <span className={`verdict verdict-${analysis.verdict.toLowerCase()}`}>
          {analysis.verdict}
        </span>
        <div>
          <strong>{analysis.fitScore}/100</strong>
          <span>Fit score</span>
        </div>
      </div>

      <ResultSection title="Matched Skills">
        <BadgeList items={analysis.matchedSkills} emptyText="No matched skills returned." />
      </ResultSection>

      <ResultSection title="Risk Flags">
        <BadgeList items={analysis.riskFlags} emptyText="No risk flags returned." tone="risk" />
      </ResultSection>

      <ResultSection title="Reasoning">
        <p>{analysis.reasoning}</p>
      </ResultSection>

      {analysis.applicationAngle && (
        <ResultSection title="Application Angle">
          <p>{analysis.applicationAngle}</p>
        </ResultSection>
      )}

      <ResultSection title="Next Action">
        <p>{analysis.nextAction}</p>
      </ResultSection>
    </div>
  );
}

function CoverLetterView({ coverLetter, copied, onCopy }) {
  if (!coverLetter) {
    return (
      <EmptyState
        icon={<FileText size={28} />}
        title="No cover letter yet"
        text="Generate a cover letter after entering a job description."
      />
    );
  }

  return (
    <div className="cover-view">
      <div className="cover-toolbar">
        <span className={`verdict verdict-${coverLetter.verdict.toLowerCase()}`}>
          {coverLetter.verdict}
        </span>
        <button className="copy-button" type="button" onClick={onCopy}>
          <Copy size={16} />
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <article className="letter-box">{coverLetter.coverLetter}</article>
      <ResultSection title="Next Action">
        <p>{coverLetter.nextAction}</p>
      </ResultSection>
    </div>
  );
}

function ResultSection({ title, children }) {
  return (
    <section className="result-section">
      <h3>{title}</h3>
      {children}
    </section>
  );
}

function BadgeList({ items, emptyText, tone = "skill" }) {
  if (!items?.length) {
    return <p className="muted">{emptyText}</p>;
  }

  return (
    <div className="badge-list">
      {items.map((item) => (
        <span className={`badge ${tone}`} key={item}>
          {item}
        </span>
      ))}
    </div>
  );
}

function EmptyState({ icon, title, text }) {
  return (
    <div className="empty-state">
      <div className="empty-icon">{icon}</div>
      <h3>{title}</h3>
      <p>{text}</p>
    </div>
  );
}

createRoot(document.getElementById("root")).render(<App />);
