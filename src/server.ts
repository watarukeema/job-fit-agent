import express from "express";
import type { Express } from "express";
import dotenv from "dotenv";
import mammoth from "mammoth";
import multer from "multer";
import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import { PDFParse } from "pdf-parse";
import { z } from "zod";
import { dirname, extname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

dotenv.config({ quiet: true });

const verdictSchema = z.enum(["APPLY", "MAYBE", "SKIP"]);

const baseJobRequestSchema = z.object({
  title: z.string().trim().min(1, "title is required"),
  company: z.string().trim().min(1, "company is required"),
  description: z.string().trim().min(1, "description is required"),
  platform: z.string().trim().min(1, "platform is required"),
  resume: z.string().trim().min(1, "resume is required"),
});

const analysisSchema = z.object({
  verdict: verdictSchema,
  fitScore: z.number().int().min(0).max(100),
  matchedSkills: z.array(z.string()),
  riskFlags: z.array(z.string()),
  reasoning: z.string(),
  applicationAngle: z.string(),
  nextAction: z.string(),
});

const coverLetterSchema = z.object({
  verdict: verdictSchema,
  fitScore: z.number().int().min(0).max(100),
  matchedSkills: z.array(z.string()),
  riskFlags: z.array(z.string()),
  reasoning: z.string(),
  coverLetter: z.string(),
  nextAction: z.string(),
});

const jobRequestSchema = baseJobRequestSchema;
const coverLetterRequestSchema = baseJobRequestSchema.extend({
  analysis: analysisSchema.optional(),
});

type JobRequest = z.infer<typeof jobRequestSchema>;
type Analysis = z.infer<typeof analysisSchema>;
type CoverLetterRequest = z.infer<typeof coverLetterRequestSchema>;

type UploadedResumeFile = Express.Multer.File;

export type OpenAIParseClient = {
  responses: {
    parse: <T>(body: {
      model: string;
      input: string;
      temperature?: number;
      text: { format: unknown };
    }) => Promise<{ output_parsed: T | null }>;
  };
};

const resumeUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024,
  },
});

function cleanExtractedText(text: string) {
  return text.replace(/\r\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
}

async function extractResumeText(file: UploadedResumeFile) {
  const extension = extname(file.originalname).toLowerCase();
  const mimeType = file.mimetype.toLowerCase();

  if (extension === ".pdf" || mimeType === "application/pdf") {
    const parser = new PDFParse({ data: new Uint8Array(file.buffer) });

    try {
      const result = await parser.getText();
      return cleanExtractedText(result.text);
    } finally {
      await parser.destroy();
    }
  }

  if (
    extension === ".docx" ||
    mimeType ===
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  ) {
    const result = await mammoth.extractRawText({ buffer: file.buffer });
    return cleanExtractedText(result.value);
  }

  if (
    [".txt", ".md", ".markdown", ".rtf"].includes(extension) ||
    mimeType.startsWith("text/")
  ) {
    return cleanExtractedText(file.buffer.toString("utf8"));
  }

  return null;
}

function parseRequest<T extends z.ZodType>(schema: T, body: unknown) {
  const result = schema.safeParse(body);

  if (result.success) {
    return { data: result.data };
  }

  return {
    error: result.error.issues.map((issue) => ({
      field: issue.path.join("."),
      message: issue.message,
    })),
  };
}

function formatAnalysisForPrompt(analysis: Analysis) {
  return `
Precomputed fit analysis:
- Verdict: ${analysis.verdict}
- Fit score: ${analysis.fitScore}/100
- Matched skills: ${analysis.matchedSkills.join(", ") || "None"}
- Risk flags: ${analysis.riskFlags.join(", ") || "None"}
- Reasoning: ${analysis.reasoning}
- Application angle: ${analysis.applicationAngle}
- Next action: ${analysis.nextAction}
`;
}

function buildJobPrompt(
  { title, company, description, platform, resume }: JobRequest,
  options: { includeCoverLetter: boolean; existingAnalysis?: Analysis | undefined },
) {
  const outputInstructions = options.includeCoverLetter
    ? options.existingAnalysis
      ? `
Use the precomputed fit analysis exactly. Do not re-score the job.
Return the same verdict, fitScore, matchedSkills, riskFlags, and reasoning from the precomputed fit analysis.
Then write a concise, natural cover letter of no more than 180 words.
Do not use placeholder names. Set nextAction to "Apply via ${platform} with resume and cover letter".
`
      : `
Analyze this job using the strict scoring rubric first.
Then write a concise, natural cover letter of no more than 180 words.
Do not let the cover letter task make the fit score more optimistic.
Do not use placeholder names. Set nextAction to "Apply via ${platform} with resume and cover letter".
`
    : `
Analyze this job using the strict scoring rubric. Set nextAction to "Apply via ${platform} with tailored resume".
`;

  return `
You are a job application screening assistant for a junior software engineer in Australia.

Use the candidate resume/CV as the source of truth for the candidate's background.
Do not invent skills, experience, work rights, education, or achievements that are not supported by the resume/CV.

Candidate resume/CV:
${resume}

Scoring rules:
- APPLY must have fitScore from 70 to 100.
- MAYBE must have fitScore from 40 to 69.
- SKIP must have fitScore from 0 to 39.
- Do not return a verdict that conflicts with the fitScore.
- Score strictly from resume evidence against job requirements, not from how well a cover letter could position the candidate.
- 90-100: exceptional match with direct evidence for nearly all core requirements and no major risks.
- 80-89: strong match with most core requirements directly supported and only minor gaps.
- 70-79: viable match with core requirements supported, but some gaps or limited depth.
- 60-69: partial match; relevant background exists, but at least one important requirement is missing, adjacent, or weakly evidenced.
- 50-59: weak partial match; some transferable evidence, but multiple important gaps.
- 40-49: low match; only a few relevant overlaps.
- 0-39: poor match, seniority mismatch, work-rights blocker, or missing most core requirements.
- For graduate/junior roles where the resume has relevant projects but limited professional experience, default to 55-69 unless the job is clearly entry-level and most required skills are directly evidenced.
- Do not boost fitScore because the candidate could tailor the application or because a cover letter is being generated.
- Include missing important requirements in riskFlags.

Job:
Title: ${title}
Company: ${company}
Description: ${description}

${options.existingAnalysis ? formatAnalysisForPrompt(options.existingAnalysis) : ""}

${outputInstructions}
`;
}

function applyExistingAnalysisToCoverLetter(
  coverLetter: z.infer<typeof coverLetterSchema>,
  analysis: Analysis | undefined,
) {
  if (!analysis) {
    return coverLetter;
  }

  return {
    ...coverLetter,
    verdict: analysis.verdict,
    fitScore: analysis.fitScore,
    matchedSkills: analysis.matchedSkills,
    riskFlags: analysis.riskFlags,
    reasoning: analysis.reasoning,
  };
}

export function createApp(openaiClient?: OpenAIParseClient): Express {
  const app = express();
  app.use(express.json({ limit: "1mb" }));

  const openai =
    openaiClient ??
    (new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    }) as unknown as OpenAIParseClient);

  app.get("/health", (_req, res) => {
    res.json({ status: "ok" });
  });

  app.post("/extract-resume", resumeUpload.single("resume"), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "Resume file is required" });
      }

      const text = await extractResumeText(req.file);

      if (!text) {
        return res.status(415).json({
          error: "Unsupported resume file type",
          details: "Upload a PDF, DOCX, TXT, MD, or RTF file.",
        });
      }

      if (!text.trim()) {
        return res.status(422).json({
          error: "Could not extract resume text",
          details: "The file may be scanned, image-only, encrypted, or empty.",
        });
      }

      res.json({
        fileName: req.file.originalname,
        text,
      });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Failed to extract resume text" });
    }
  });

  app.post("/analyze-job", async (req, res) => {
    try {
      const request = parseRequest(jobRequestSchema, req.body);

      if (request.error) {
        return res.status(400).json({
          error: "Invalid request body",
          details: request.error,
        });
      }

      const response = await openai.responses.parse<
        z.infer<typeof analysisSchema>
      >({
        model: "gpt-4.1-mini",
        input: buildJobPrompt(request.data, { includeCoverLetter: false }),
        temperature: 0,
        text: {
          format: zodTextFormat(analysisSchema, "job_fit_analysis"),
        },
      });

      if (!response.output_parsed) {
        throw new Error("OpenAI response did not include parsed analysis");
      }

      res.json(response.output_parsed);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Failed to analyze job" });
    }
  });

  app.post("/generate-cover-letter", async (req, res) => {
    try {
      const request = parseRequest(coverLetterRequestSchema, req.body);

      if (request.error) {
        return res.status(400).json({
          error: "Invalid request body",
          details: request.error,
        });
      }

      const response = await openai.responses.parse<
        z.infer<typeof coverLetterSchema>
      >({
        model: "gpt-4.1-mini",
        input: buildJobPrompt(request.data, {
          includeCoverLetter: true,
          existingAnalysis: request.data.analysis,
        }),
        temperature: 0,
        text: {
          format: zodTextFormat(coverLetterSchema, "job_fit_cover_letter"),
        },
      });

      if (!response.output_parsed) {
        throw new Error("OpenAI response did not include parsed cover letter");
      }

      res.json(
        applyExistingAnalysisToCoverLetter(
          response.output_parsed,
          request.data.analysis,
        ),
      );
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Failed to generate a cover letter" });
    }
  });

  const frontendDistPath = resolve(
    dirname(fileURLToPath(import.meta.url)),
    "../frontend/dist",
  );

  app.use(express.static(frontendDistPath));

  app.use((req, res, next) => {
    if (req.method !== "GET" || !req.accepts("html")) {
      next();
      return;
    }

    res.sendFile(resolve(frontendDistPath, "index.html"), (error) => {
      if (error) {
        next(error);
      }
    });
  });

  return app;
}

export function startServer() {
  const port = process.env.PORT || 5000;

  return createApp().listen(port, () => {
    console.log(`Server running on port ${port}`);
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  startServer();
}
