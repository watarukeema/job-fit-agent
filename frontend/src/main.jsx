import React, { useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  AlertTriangle,
  BriefcaseBusiness,
  CheckCircle2,
  Clipboard,
  Copy,
  FileText,
  Loader2,
  RotateCcw,
  Send,
  Sparkles,
  UserRound,
} from "lucide-react";
import "./styles.css";

const initialJob = {
  title: "",
  company: "",
  platform: "LinkedIn",
  description: "",
};

const initialCandidate = {
  background: "Recent Computer Science graduate",
  skills: "TypeScript, Express, PostgreSQL, Supabase, React basics, Flutter",
  targetRoles:
    "junior software engineer, backend developer, full-stack developer, QA, technical support",
  workRights: "Has Australian working rights but may require sponsorship in the future",
  projects:
    "full-stack networking platform, parking app, HTTP proxy, music genre classifier",
};

function toList(value) {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function buildPayload(job, candidate, useDefaultProfile) {
  const payload = {
    title: job.title.trim(),
    company: job.company.trim(),
    platform: job.platform.trim(),
    description: job.description.trim(),
  };

  if (!useDefaultProfile) {
    payload.candidate = {
      background: candidate.background.trim(),
      skills: toList(candidate.skills),
      targetRoles: toList(candidate.targetRoles),
      workRights: candidate.workRights.trim(),
      projects: toList(candidate.projects),
    };
  }

  return payload;
}

function App() {
  const [job, setJob] = useState(initialJob);
  const [candidate, setCandidate] = useState(initialCandidate);
  const [useDefaultProfile, setUseDefaultProfile] = useState(true);
  const [activeTab, setActiveTab] = useState("analysis");
  const [analysis, setAnalysis] = useState(null);
  const [coverLetter, setCoverLetter] = useState(null);
  const [error, setError] = useState("");
  const [loadingAction, setLoadingAction] = useState("");
  const [copied, setCopied] = useState(false);

  const isBusy = Boolean(loadingAction);
  const canSubmit = useMemo(
    () =>
      job.title.trim() &&
      job.company.trim() &&
      job.platform.trim() &&
      job.description.trim() &&
      !isBusy,
    [job, isBusy],
  );

  function updateJob(field, value) {
    setJob((current) => ({ ...current, [field]: value }));
  }

  function updateCandidate(field, value) {
    setCandidate((current) => ({ ...current, [field]: value }));
  }

  async function submit(endpoint, action) {
    setError("");
    setCopied(false);
    setLoadingAction(action);

    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildPayload(job, candidate, useDefaultProfile)),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Request failed");
      }

      if (action === "analysis") {
        setAnalysis(data);
        setActiveTab("analysis");
      } else {
        setCoverLetter(data);
        setAnalysis(data);
        setActiveTab("cover");
      }
    } catch (requestError) {
      setError(requestError.message || "Something went wrong");
    } finally {
      setLoadingAction("");
    }
  }

  function resetForm() {
    setJob(initialJob);
    setCandidate(initialCandidate);
    setUseDefaultProfile(true);
    setAnalysis(null);
    setCoverLetter(null);
    setError("");
    setCopied(false);
    setActiveTab("analysis");
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

          <section className="profile-box">
            <div className="profile-topline">
              <div>
                <h3>
                  <UserRound size={18} />
                  Candidate Profile
                </h3>
                <p>{useDefaultProfile ? "Using default profile" : "Using custom profile"}</p>
              </div>
              <label className="switch">
                <input
                  type="checkbox"
                  checked={!useDefaultProfile}
                  onChange={(event) => setUseDefaultProfile(!event.target.checked)}
                />
                <span>Edit</span>
              </label>
            </div>

            {!useDefaultProfile && (
              <div className="profile-fields">
                <label>
                  <span>Background</span>
                  <input
                    value={candidate.background}
                    onChange={(event) => updateCandidate("background", event.target.value)}
                  />
                </label>
                <label>
                  <span>Skills</span>
                  <input
                    value={candidate.skills}
                    onChange={(event) => updateCandidate("skills", event.target.value)}
                  />
                </label>
                <label>
                  <span>Target roles</span>
                  <input
                    value={candidate.targetRoles}
                    onChange={(event) => updateCandidate("targetRoles", event.target.value)}
                  />
                </label>
                <label>
                  <span>Work rights</span>
                  <input
                    value={candidate.workRights}
                    onChange={(event) => updateCandidate("workRights", event.target.value)}
                  />
                </label>
                <label>
                  <span>Projects</span>
                  <input
                    value={candidate.projects}
                    onChange={(event) => updateCandidate("projects", event.target.value)}
                  />
                </label>
              </div>
            )}
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
