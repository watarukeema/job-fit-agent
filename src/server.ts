import express from "express";
import dotenv from "dotenv";
import OpenAI from "openai";

dotenv.config();

const app = express();
app.use(express.json());

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.post("/analyze-job", async (req, res) => {
  try {
    const { title, company, description, platform } = req.body;

    if (!title || !company || !description || !platform) {
      return res.status(400).json({
        error: "title, company, description, and platform are required",
      });
    }

    const response = await openai.responses.create({
      model: "gpt-4.1-mini",
      input: `
        You are a job application screening assistant for a junior software engineer in Australia.

        Analyze this job and return JSON only.

        Candidate background:
        - Recent Computer Science graduate
        - Strongest skills: TypeScript, Express, PostgreSQL, Supabase, React basics, Flutter
        - Looking for junior software engineer, backend, full-stack, QA, or technical support roles
        - Has Australian working rights but may require sponsorship in the future
        - Has projects: full-stack networking platform, parking app, HTTP proxy, music genre classifier

        Job:
        Title: ${title}
        Company: ${company}
        Description: ${description}

        Return JSON with:
        {
        "verdict": "APPLY" | "MAYBE" | "SKIP",
        "fitScore": number,
        "matchedSkills": string[],
        "riskFlags": string[],
        "reasoning": string,
        "applicationAngle": string,
        "nextAction": "Apply via ${platform} with tailored resume"
        }
      `,
    });

    const cleaned = response.output_text
        .replace(/```json/g, "")
        .replace(/```/g, "")
        .trim();

    const parsed = JSON.parse(cleaned);

    res.json(parsed);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to analyze job" });
  }
});

app.post("/generate-cover-letter", async (req, res) => {
  try {
    const { title, company, description, platform } = req.body;

    if (!title || !company || !description || !platform) {
      return res.status(400).json({
        error: "title, company, description, and platform are required",
      });
    }

    const response = await openai.responses.create({
      model: "gpt-4.1-mini",
      input: `
        You are a job application screening assistant for a junior software engineer in Australia.

        Analyze this job, make a cover letter for the candidate and return JSON only.
        The coverLetter should be concise, natural, and no more than 180 words. Do not use placeholder names.

        Candidate background:
        - Recent Computer Science graduate
        - Strongest skills: TypeScript, Express, PostgreSQL, Supabase, React basics, Flutter
        - Looking for junior software engineer, backend, full-stack, QA, or technical support roles
        - Has Australian working rights but may require sponsorship in the future
        - Has projects: full-stack networking platform, parking app, HTTP proxy, music genre classifier

        Job:
        Title: ${title}
        Company: ${company}
        Description: ${description}

        Return JSON with:
        {
        "verdict": "APPLY" | "MAYBE" | "SKIP",
        "fitScore": number,
        "matchedSkills": string[],
        "riskFlags": string[],
        "reasoning": string,
        "coverLetter": string,
        "nextAction": "Apply via ${platform} with resume and cover letter"
        }
      `,
    });

    const cleaned = response.output_text
        .replace(/```json/g, "")
        .replace(/```/g, "")
        .trim();

    const parsed = JSON.parse(cleaned);

    res.json(parsed);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to generate a cover letter" });
  }
});

const port = process.env.PORT || 5000;

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});