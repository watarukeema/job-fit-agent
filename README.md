# Job Fit Agent

AI-powered job application assistant that analyzes job descriptions and generates tailored application guidance for junior software roles.

## Features
- Analyze job descriptions
- Return Apply / Maybe / Skip verdict
- Match resume/CV evidence against job requirements
- Extract resume/CV text from uploaded PDF, DOCX, or plain text files
- Identify risk flags
- Generate tailored cover letters
- Suggest next application action

## Why I built this

While applying for software engineering roles, I noticed that evaluating whether to apply for a job often involves repetitive decision-making:

- Does my skillset match the requirements?
- Is this role junior-friendly?
- Are there hidden risks (e.g. visa requirements, senior expectations)?
- How should I position myself when applying?

To streamline this process, I built Job Fit Agent — an AI-powered tool that analyzes job descriptions and provides structured insights, including a fit score, risk flags, and a suggested application strategy.

This project also allowed me to explore practical applications of AI in real-world workflows, particularly:
- integrating AI into backend systems
- designing structured outputs from LLMs
- building tools that augment decision-making rather than just generating text

Overall, the goal was to build something I would genuinely use during my job search, while strengthening my full-stack and AI integration skills.

## Tech Stack
- TypeScript
- Node.js
- Express
- OpenAI API
- dotenv
- Zod

## Setup

Install dependencies:

```bash
npm install
```

Create a local environment file:

```bash
cp .env.example .env
```

Then set `OPENAI_API_KEY` in `.env`.

Run the development server:

```bash
npm run dev
```

The API runs on `http://localhost:5000` by default.

API documentation is available at `http://localhost:5000/docs`.

Run the frontend dev server in another terminal:

```bash
npm run dev:frontend
```

The frontend runs on `http://localhost:5173` and proxies API requests to the backend.

For a production-style local run, build everything and start the Express server:

```bash
npm run build
npm start
```

Then open `http://localhost:5000`. Express serves the built React app and the API from the same server.

## Scripts

- `npm run dev` starts the TypeScript server with `tsx`.
- `npm run dev:frontend` starts the React/Vite frontend.
- `npm run typecheck` checks TypeScript without emitting files.
- `npm run build` compiles the backend and builds the frontend.
- `npm start` runs the compiled server from `dist/server.js`.
- `npm test` compiles and runs the API test suite with mocked OpenAI responses.

## API Endpoints

Interactive Swagger documentation is available at:

```bash
http://localhost:5000/docs
```

The raw OpenAPI schema is available at:

```bash
http://localhost:5000/openapi.json
```

### GET /health
Returns API health status.

```bash
curl http://localhost:5000/health
```

### POST /extract-resume
Extracts resume/CV text from an uploaded file so the frontend can place it in the editable resume textarea.

Supported file types:

- PDF
- DOCX
- TXT / MD / RTF

Example request:

```bash
curl -X POST http://localhost:5000/extract-resume \
  -F "resume=@/path/to/resume.pdf"
```

Example response:

```json
{
  "fileName": "resume.pdf",
  "text": "Extracted resume text..."
}
```

### POST /analyze-job
Analyzes job fit.

Required JSON body:

```json
{
  "title": "Junior Software Engineer",
  "company": "Example Co",
  "description": "We are looking for a junior developer with TypeScript, Node.js, and SQL experience.",
  "platform": "LinkedIn",
  "resume": "Recent Computer Science graduate. Skills: TypeScript, Express, PostgreSQL..."
}
```

The `resume` field is required. Send extracted plain text from the user's resume/CV; both job analysis and cover letter generation use it as the candidate source of truth. The frontend can populate this field by calling `/extract-resume` after the user uploads a CV file.

Example request:

```bash
curl -X POST http://localhost:5000/analyze-job \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Junior Software Engineer",
    "company": "Example Co",
    "description": "We are looking for a junior developer with TypeScript, Node.js, and SQL experience.",
    "platform": "LinkedIn",
    "resume": "Recent Computer Science graduate. Skills: TypeScript, Express, PostgreSQL. Projects: parking app, HTTP proxy, music genre classifier."
  }'
```

### POST /generate-cover-letter
Generates job fit analysis and a tailored cover letter.

Uses the same required JSON body as `/analyze-job`.

If the frontend already has an analysis result for the same job and resume, it can include that result as `analysis`. The API will reuse the same verdict, fit score, matched skills, risk flags, and reasoning instead of re-scoring during cover letter generation.

Example request:

```bash
curl -X POST http://localhost:5000/generate-cover-letter \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Junior Backend Developer",
    "company": "Example Co",
    "description": "This role involves building APIs with Node.js, working with PostgreSQL, and supporting production systems.",
    "platform": "Seek",
    "resume": "Recent Computer Science graduate. Skills: TypeScript, Express, PostgreSQL. Projects: parking app, HTTP proxy, music genre classifier."
  }'
```

## Validation

Request bodies are validated with Zod. Model outputs are also constrained with Zod-backed structured outputs, so the API returns predictable JSON instead of parsing free-form model text.

## Browser Storage

The frontend stores the extracted or pasted resume/CV text and recent generated results in `localStorage`. This keeps the app lightweight because saved jobs and resume edits persist in the same browser without requiring a database.
