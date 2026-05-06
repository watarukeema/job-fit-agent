import express from "express";
import type { Express } from "express";
import dotenv from "dotenv";
import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import { z } from "zod";
import { pathToFileURL } from "node:url";

dotenv.config({ quiet: true });

const jobRequestSchema = z.object({
  title: z.string().trim().min(1, "title is required"),
  company: z.string().trim().min(1, "company is required"),
  description: z.string().trim().min(1, "description is required"),
  platform: z.string().trim().min(1, "platform is required"),
  candidate: z
    .object({
      background: z.string().trim().min(1).optional(),
      skills: z.array(z.string().trim().min(1)).optional(),
      targetRoles: z.array(z.string().trim().min(1)).optional(),
      workRights: z.string().trim().min(1).optional(),
      projects: z.array(z.string().trim().min(1)).optional(),
    })
    .optional(),
});

const verdictSchema = z.enum(["APPLY", "MAYBE", "SKIP"]);

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

type JobRequest = z.infer<typeof jobRequestSchema>;

export type OpenAIParseClient = {
  responses: {
    parse: <T>(body: {
      model: string;
      input: string;
      text: { format: unknown };
    }) => Promise<{ output_parsed: T | null }>;
  };
};

const defaultCandidateBackground = `
Candidate background:
- Recent Computer Science graduate
- Strongest skills: TypeScript, Express, PostgreSQL, Supabase, React basics, Flutter
- Looking for junior software engineer, backend, full-stack, QA, or technical support roles
- Has Australian working rights but may require sponsorship in the future
- Has projects: full-stack networking platform, parking app, HTTP proxy, music genre classifier
`;

function formatList(items: string[] | undefined, fallback: string) {
  return items && items.length > 0 ? items.join(", ") : fallback;
}

function buildCandidateBackground(candidate: JobRequest["candidate"]) {
  if (!candidate) {
    return defaultCandidateBackground;
  }

  return `
Candidate background:
- Background: ${candidate.background ?? "Not specified"}
- Strongest skills: ${formatList(candidate.skills, "Not specified")}
- Looking for: ${formatList(candidate.targetRoles, "Not specified")}
- Work rights: ${candidate.workRights ?? "Not specified"}
- Projects: ${formatList(candidate.projects, "Not specified")}
`;
}

function parseJobRequest(body: unknown) {
  const result = jobRequestSchema.safeParse(body);

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

function buildJobPrompt(
  { title, company, description, platform, candidate }: JobRequest,
  options: { includeCoverLetter: boolean },
) {
  const outputInstructions = options.includeCoverLetter
    ? `
Analyze this job and write a concise, natural cover letter of no more than 180 words.
Do not use placeholder names. Set nextAction to "Apply via ${platform} with resume and cover letter".
`
    : `
Analyze this job. Set nextAction to "Apply via ${platform} with tailored resume".
`;

  return `
You are a job application screening assistant for a junior software engineer in Australia.

${buildCandidateBackground(candidate)}

Job:
Title: ${title}
Company: ${company}
Description: ${description}

${outputInstructions}
`;
}

export function createApp(openaiClient?: OpenAIParseClient): Express {
  const app = express();
  app.use(express.json());

  const openai =
    openaiClient ??
    (new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    }) as unknown as OpenAIParseClient);

  app.get("/health", (_req, res) => {
    res.json({ status: "ok" });
  });

  app.post("/analyze-job", async (req, res) => {
    try {
      const request = parseJobRequest(req.body);

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
      const request = parseJobRequest(req.body);

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
        input: buildJobPrompt(request.data, { includeCoverLetter: true }),
        text: {
          format: zodTextFormat(coverLetterSchema, "job_fit_cover_letter"),
        },
      });

      if (!response.output_parsed) {
        throw new Error("OpenAI response did not include parsed cover letter");
      }

      res.json(response.output_parsed);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Failed to generate a cover letter" });
    }
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
