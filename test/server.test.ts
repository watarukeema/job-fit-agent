import assert from "node:assert/strict";
import { type AddressInfo } from "node:net";
import test from "node:test";
import { createApp, type OpenAIParseClient } from "../src/server.js";

type ParseCall = {
  model: string;
  input: string;
  temperature?: number;
  text: { format: unknown };
};

const analysisResponse = {
  verdict: "APPLY",
  fitScore: 82,
  matchedSkills: ["TypeScript", "Express"],
  riskFlags: ["Mentions production support"],
  reasoning: "The role matches the candidate's backend experience.",
  applicationAngle: "Lead with TypeScript and API project experience.",
  nextAction: "Apply via LinkedIn with tailored resume",
};

const coverLetterResponse = {
  verdict: "APPLY",
  fitScore: 84,
  matchedSkills: ["Node.js", "PostgreSQL"],
  riskFlags: [],
  reasoning: "The role is aligned with backend project work.",
  coverLetter: "I am excited to apply for this junior backend role.",
  nextAction: "Apply via Seek with resume and cover letter",
};

const optimisticCoverLetterResponse = {
  verdict: "APPLY",
  fitScore: 88,
  matchedSkills: ["Node.js", "PostgreSQL"],
  riskFlags: [],
  reasoning: "The role is a strong match.",
  coverLetter: "I am excited to apply for this graduate software role.",
  nextAction: "Apply via Seek with resume and cover letter",
};

const strictAnalysis = {
  verdict: "MAYBE",
  fitScore: 62,
  matchedSkills: ["PostgreSQL"],
  riskFlags: ["Trading systems experience is not shown"],
  reasoning:
    "The resume has adjacent backend evidence but lacks direct trading systems experience.",
  applicationAngle: "Lead with backend project work and database experience.",
  nextAction: "Apply via Seek with tailored resume",
};

const sampleResume = `
Recent Computer Science graduate.
Skills: TypeScript, Express, PostgreSQL, Supabase, React basics, Flutter.
Projects: full-stack networking platform, parking app, HTTP proxy, music genre classifier.
Work rights: Australian working rights, may require sponsorship in the future.
`;

function createMockOpenAI(output: unknown) {
  const calls: ParseCall[] = [];
  const client: OpenAIParseClient = {
    responses: {
      parse: async (body) => {
        calls.push(body);
        return { output_parsed: output as never };
      },
    },
  };

  return { calls, client };
}

async function withTestServer<T>(
  app: ReturnType<typeof createApp>,
  callback: (baseUrl: string) => Promise<T>,
) {
  const server = app.listen(0);

  await new Promise<void>((resolve) => {
    server.once("listening", resolve);
  });

  const address = server.address() as AddressInfo;
  const baseUrl = `http://127.0.0.1:${address.port}`;

  try {
    return await callback(baseUrl);
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => {
        if (error) {
          reject(error);
          return;
        }

        resolve();
      });
    });
  }
}

async function postJson(baseUrl: string, path: string, body: unknown) {
  return fetch(`${baseUrl}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

async function postResumeFile(
  baseUrl: string,
  file: Blob,
  fileName = "resume.txt",
) {
  const formData = new FormData();
  formData.append("resume", file, fileName);

  return fetch(`${baseUrl}/extract-resume`, {
    method: "POST",
    body: formData,
  });
}

test("GET /health returns ok", async () => {
  const { client } = createMockOpenAI(analysisResponse);
  const app = createApp(client);

  await withTestServer(app, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/health`);

    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { status: "ok" });
  });
});

test("GET /openapi.json returns API schema", async () => {
  const { client } = createMockOpenAI(analysisResponse);
  const app = createApp(client);

  await withTestServer(app, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/openapi.json`);
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.equal(body.openapi, "3.0.3");
    assert.equal(body.info.title, "Job Fit Agent API");
    assert.ok(body.paths["/analyze-job"]);
    assert.ok(body.paths["/generate-cover-letter"]);
    assert.ok(body.paths["/extract-resume"]);
  });
});

test("GET /docs serves Swagger UI", async () => {
  const { client } = createMockOpenAI(analysisResponse);
  const app = createApp(client);

  await withTestServer(app, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/docs/`);
    const body = await response.text();

    assert.equal(response.status, 200);
    assert.match(body, /swagger-ui/);
  });
});

test("POST /analyze-job rejects invalid request body", async () => {
  const { calls, client } = createMockOpenAI(analysisResponse);
  const app = createApp(client);

  await withTestServer(app, async (baseUrl) => {
    const response = await postJson(baseUrl, "/analyze-job", {});
    const body = await response.json();

    assert.equal(response.status, 400);
    assert.equal(body.error, "Invalid request body");
    assert.equal(calls.length, 0);
  });
});

test("POST /extract-resume returns text from uploaded plain text resume", async () => {
  const { client } = createMockOpenAI(analysisResponse);
  const app = createApp(client);

  await withTestServer(app, async (baseUrl) => {
    const response = await postResumeFile(
      baseUrl,
      new Blob(["Jane Developer\nTypeScript and PostgreSQL"], {
        type: "text/plain",
      }),
    );

    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), {
      fileName: "resume.txt",
      text: "Jane Developer\nTypeScript and PostgreSQL",
    });
  });
});

test("POST /extract-resume rejects missing resume file", async () => {
  const { client } = createMockOpenAI(analysisResponse);
  const app = createApp(client);

  await withTestServer(app, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/extract-resume`, {
      method: "POST",
      body: new FormData(),
    });
    const body = await response.json();

    assert.equal(response.status, 400);
    assert.equal(body.error, "Resume file is required");
  });
});

test("POST /analyze-job returns parsed OpenAI analysis", async () => {
  const { calls, client } = createMockOpenAI(analysisResponse);
  const app = createApp(client);

  await withTestServer(app, async (baseUrl) => {
    const response = await postJson(baseUrl, "/analyze-job", {
      title: "Junior Software Engineer",
      company: "Example Co",
      description: "TypeScript, Express, and SQL role.",
      platform: "LinkedIn",
      resume: sampleResume,
    });

    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), analysisResponse);
    assert.equal(calls.length, 1);
    assert.equal(calls[0]!.temperature, 0);
    assert.match(calls[0]!.input, /Recent Computer Science graduate/);
    assert.match(calls[0]!.input, /Candidate resume\/CV/);
    assert.match(calls[0]!.input, /Apply via LinkedIn with tailored resume/);
    assert.match(calls[0]!.input, /APPLY must have fitScore from 70 to 100/);
    assert.match(calls[0]!.input, /Score strictly from resume evidence/);
  });
});

test("POST /generate-cover-letter returns parsed OpenAI cover letter", async () => {
  const { calls, client } = createMockOpenAI(coverLetterResponse);
  const app = createApp(client);

  await withTestServer(app, async (baseUrl) => {
    const response = await postJson(baseUrl, "/generate-cover-letter", {
      title: "Junior Backend Developer",
      company: "Example Co",
      description: "Node.js, Express, and PostgreSQL role.",
      platform: "Seek",
      resume: sampleResume,
    });

    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), coverLetterResponse);
    assert.equal(calls.length, 1);
    assert.equal(calls[0]!.temperature, 0);
    assert.match(calls[0]!.input, /Do not let the cover letter task make the fit score more optimistic/);
    assert.match(calls[0]!.input, /Apply via Seek with resume and cover letter/);
    assert.match(calls[0]!.input, /Do not return a verdict that conflicts with the fitScore/);
  });
});

test("POST /generate-cover-letter reuses provided analysis scores", async () => {
  const { calls, client } = createMockOpenAI(optimisticCoverLetterResponse);
  const app = createApp(client);

  await withTestServer(app, async (baseUrl) => {
    const response = await postJson(baseUrl, "/generate-cover-letter", {
      title: "Graduate Software Engineer",
      company: "Mako Trading",
      description: "Graduate role involving backend systems and trading technology.",
      platform: "Seek",
      resume: sampleResume,
      analysis: strictAnalysis,
    });

    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), {
      ...optimisticCoverLetterResponse,
      verdict: strictAnalysis.verdict,
      fitScore: strictAnalysis.fitScore,
      matchedSkills: strictAnalysis.matchedSkills,
      riskFlags: strictAnalysis.riskFlags,
      reasoning: strictAnalysis.reasoning,
    });
    assert.equal(calls.length, 1);
    assert.match(calls[0]!.input, /Use the precomputed fit analysis exactly/);
    assert.match(calls[0]!.input, /Fit score: 62\/100/);
  });
});

test("POST /analyze-job uses resume as candidate source", async () => {
  const { calls, client } = createMockOpenAI(analysisResponse);
  const app = createApp(client);

  await withTestServer(app, async (baseUrl) => {
    const response = await postJson(baseUrl, "/analyze-job", {
      title: "Junior Developer",
      company: "Example Co",
      description: "Backend role using APIs and databases.",
      platform: "LinkedIn",
      resume: `
Career changer with a software engineering diploma.
Skills: Python, Django, PostgreSQL.
Work rights: Australian citizen.
Projects: portfolio tracker, support ticket API.
`,
    });

    assert.equal(response.status, 200);
    assert.equal(calls.length, 1);
    assert.match(calls[0]!.input, /Career changer/);
    assert.match(calls[0]!.input, /Skills: Python, Django, PostgreSQL/);
    assert.match(calls[0]!.input, /Projects: portfolio tracker, support ticket API/);
    assert.match(calls[0]!.input, /Do not invent skills/);
  });
});
