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

## API Endpoints

### GET /health
Returns API health status.

### POST /analyze-job
Analyzes job fit.

### POST /generate-cover-letter
Generates job fit analysis and a tailored cover letter.