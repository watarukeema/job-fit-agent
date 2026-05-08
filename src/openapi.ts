export const openApiSpec = {
  openapi: "3.0.3",
  info: {
    title: "Job Fit Agent API",
    version: "1.0.0",
    description:
      "API for extracting resume text, analyzing job fit, and generating consistent cover letters.",
  },
  servers: [
    {
      url: "http://localhost:5000",
      description: "Local Express API",
    },
  ],
  tags: [
    {
      name: "System",
      description: "Health and diagnostics",
    },
    {
      name: "Resume",
      description: "Resume/CV text extraction",
    },
    {
      name: "Jobs",
      description: "Job fit analysis and application output generation",
    },
  ],
  paths: {
    "/health": {
      get: {
        tags: ["System"],
        summary: "Check API health",
        responses: {
          "200": {
            description: "API is running",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["status"],
                  properties: {
                    status: {
                      type: "string",
                      example: "ok",
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
    "/extract-resume": {
      post: {
        tags: ["Resume"],
        summary: "Extract text from a resume/CV file",
        description:
          "Uploads a PDF, DOCX, TXT, MD, or RTF file and returns extracted text for review/editing before analysis.",
        requestBody: {
          required: true,
          content: {
            "multipart/form-data": {
              schema: {
                type: "object",
                required: ["resume"],
                properties: {
                  resume: {
                    type: "string",
                    format: "binary",
                    description: "Resume/CV file to extract.",
                  },
                },
              },
            },
          },
        },
        responses: {
          "200": {
            description: "Text extracted from the uploaded file",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/ExtractResumeResponse",
                },
              },
            },
          },
          "400": {
            $ref: "#/components/responses/BadRequest",
          },
          "415": {
            description: "Unsupported file type",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/ErrorResponse",
                },
              },
            },
          },
          "422": {
            description: "File was readable but no resume text could be extracted",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/ErrorResponse",
                },
              },
            },
          },
          "500": {
            $ref: "#/components/responses/ServerError",
          },
        },
      },
    },
    "/analyze-job": {
      post: {
        tags: ["Jobs"],
        summary: "Analyze job fit against a resume/CV",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                $ref: "#/components/schemas/JobRequest",
              },
            },
          },
        },
        responses: {
          "200": {
            description: "Structured job fit analysis",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/AnalysisResponse",
                },
              },
            },
          },
          "400": {
            $ref: "#/components/responses/BadRequest",
          },
          "500": {
            $ref: "#/components/responses/ServerError",
          },
        },
      },
    },
    "/generate-cover-letter": {
      post: {
        tags: ["Jobs"],
        summary: "Generate a cover letter with fit analysis",
        description:
          "Generates a cover letter. If an existing analysis is supplied, the API reuses that verdict, score, matched skills, risk flags, and reasoning.",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                $ref: "#/components/schemas/CoverLetterRequest",
              },
            },
          },
        },
        responses: {
          "200": {
            description: "Structured cover letter response",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/CoverLetterResponse",
                },
              },
            },
          },
          "400": {
            $ref: "#/components/responses/BadRequest",
          },
          "500": {
            $ref: "#/components/responses/ServerError",
          },
        },
      },
    },
  },
  components: {
    responses: {
      BadRequest: {
        description: "Invalid request body",
        content: {
          "application/json": {
            schema: {
              $ref: "#/components/schemas/ErrorResponse",
            },
          },
        },
      },
      ServerError: {
        description: "Unexpected server error",
        content: {
          "application/json": {
            schema: {
              $ref: "#/components/schemas/ErrorResponse",
            },
          },
        },
      },
    },
    schemas: {
      Verdict: {
        type: "string",
        enum: ["APPLY", "MAYBE", "SKIP"],
      },
      JobRequest: {
        type: "object",
        required: ["title", "company", "description", "platform", "resume"],
        properties: {
          title: {
            type: "string",
            example: "Graduate Software Engineer",
          },
          company: {
            type: "string",
            example: "Mako Trading",
          },
          description: {
            type: "string",
            example:
              "We are looking for a graduate software engineer with backend, SQL, and systems programming interest.",
          },
          platform: {
            type: "string",
            example: "LinkedIn",
          },
          resume: {
            type: "string",
            example:
              "Recent Computer Science graduate. Skills: TypeScript, Express, PostgreSQL. Projects: parking app, HTTP proxy.",
          },
        },
      },
      AnalysisResponse: {
        type: "object",
        required: [
          "verdict",
          "fitScore",
          "matchedSkills",
          "riskFlags",
          "reasoning",
          "applicationAngle",
          "nextAction",
        ],
        properties: {
          verdict: {
            $ref: "#/components/schemas/Verdict",
          },
          fitScore: {
            type: "integer",
            minimum: 0,
            maximum: 100,
            example: 65,
          },
          matchedSkills: {
            type: "array",
            items: {
              type: "string",
            },
            example: ["PostgreSQL", "API development"],
          },
          riskFlags: {
            type: "array",
            items: {
              type: "string",
            },
            example: ["No direct trading systems experience shown"],
          },
          reasoning: {
            type: "string",
            example:
              "The resume has relevant backend project evidence, but the job asks for stronger systems experience.",
          },
          applicationAngle: {
            type: "string",
            example: "Lead with backend projects, SQL, and API experience.",
          },
          nextAction: {
            type: "string",
            example: "Apply via LinkedIn with tailored resume",
          },
        },
      },
      CoverLetterRequest: {
        allOf: [
          {
            $ref: "#/components/schemas/JobRequest",
          },
          {
            type: "object",
            properties: {
              analysis: {
                $ref: "#/components/schemas/AnalysisResponse",
              },
            },
          },
        ],
      },
      CoverLetterResponse: {
        allOf: [
          {
            $ref: "#/components/schemas/AnalysisResponse",
          },
          {
            type: "object",
            required: ["coverLetter"],
            properties: {
              coverLetter: {
                type: "string",
                example:
                  "I am excited to apply for the Graduate Software Engineer role...",
              },
            },
          },
        ],
      },
      ExtractResumeResponse: {
        type: "object",
        required: ["fileName", "text"],
        properties: {
          fileName: {
            type: "string",
            example: "resume.pdf",
          },
          text: {
            type: "string",
            example: "Extracted resume text...",
          },
        },
      },
      ErrorResponse: {
        type: "object",
        required: ["error"],
        properties: {
          error: {
            type: "string",
            example: "Invalid request body",
          },
          details: {
            description: "Optional validation or parsing details.",
          },
        },
      },
    },
  },
} as const;
