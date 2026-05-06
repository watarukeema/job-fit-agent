# Job Fit Agent

AI-powered job application assistant that analyzes job descriptions and generates tailored application guidance for junior software roles.

## Features
- Analyze job descriptions
- Return Apply / Maybe / Skip verdict
- Match candidate skills against job requirements
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

### GET /health
Returns API health status.

```bash
curl http://localhost:5000/health
```

### POST /analyze-job
Analyzes job fit.

Required JSON body:

```json
{
  "title": "Junior Software Engineer",
  "company": "Example Co",
  "description": "We are looking for a junior developer with TypeScript, Node.js, and SQL experience.",
  "platform": "LinkedIn"
}
```

Optional candidate profile:

```json
{
  "candidate": {
    "background": "Recent computer science graduate",
    "skills": ["TypeScript", "Express", "PostgreSQL", "React"],
    "targetRoles": ["junior software engineer", "backend developer"],
    "workRights": "Has Australian working rights",
    "projects": ["parking app", "HTTP proxy", "music genre classifier"]
  }
}
```

If `candidate` is not provided, the API uses the default candidate profile in `src/server.ts`.

Example request:

```bash
curl -X POST http://localhost:5000/analyze-job \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Junior Software Engineer",
    "company": "Example Co",
    "description": "We are looking for a junior developer with TypeScript, Node.js, and SQL experience.",
    "platform": "LinkedIn"
  }'
```

Example request with custom candidate profile:

```bash
curl -X POST http://localhost:5000/analyze-job \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Junior Backend Developer",
    "company": "Example Co",
    "description": "We are looking for a junior developer with Python, Django, PostgreSQL, and API experience.",
    "platform": "LinkedIn",
    "candidate": {
      "background": "Career changer with a software engineering diploma",
      "skills": ["Python", "Django", "PostgreSQL"],
      "targetRoles": ["junior backend developer"],
      "workRights": "Australian citizen",
      "projects": ["portfolio tracker", "support ticket API"]
    }
  }'
```

### POST /generate-cover-letter
Generates job fit analysis and a tailored cover letter.

Uses the same required JSON body as `/analyze-job`.

Example request:

```bash
curl -X POST http://localhost:5000/generate-cover-letter \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Junior Backend Developer",
    "company": "Example Co",
    "description": "This role involves building APIs with Node.js, working with PostgreSQL, and supporting production systems.",
    "platform": "Seek"
  }'
```

## Validation

Request bodies are validated with Zod. Model outputs are also constrained with Zod-backed structured outputs, so the API returns predictable JSON instead of parsing free-form model text.
