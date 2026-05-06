import assert from "node:assert/strict";
import {} from "node:net";
import test from "node:test";
import { createApp } from "../src/server.js";
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
function createMockOpenAI(output) {
    const calls = [];
    const client = {
        responses: {
            parse: async (body) => {
                calls.push(body);
                return { output_parsed: output };
            },
        },
    };
    return { calls, client };
}
async function withTestServer(app, callback) {
    const server = app.listen(0);
    await new Promise((resolve) => {
        server.once("listening", resolve);
    });
    const address = server.address();
    const baseUrl = `http://127.0.0.1:${address.port}`;
    try {
        return await callback(baseUrl);
    }
    finally {
        await new Promise((resolve, reject) => {
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
async function postJson(baseUrl, path, body) {
    return fetch(`${baseUrl}${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
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
test("POST /analyze-job returns parsed OpenAI analysis", async () => {
    const { calls, client } = createMockOpenAI(analysisResponse);
    const app = createApp(client);
    await withTestServer(app, async (baseUrl) => {
        const response = await postJson(baseUrl, "/analyze-job", {
            title: "Junior Software Engineer",
            company: "Example Co",
            description: "TypeScript, Express, and SQL role.",
            platform: "LinkedIn",
        });
        assert.equal(response.status, 200);
        assert.deepEqual(await response.json(), analysisResponse);
        assert.equal(calls.length, 1);
        assert.match(calls[0].input, /Recent Computer Science graduate/);
        assert.match(calls[0].input, /Apply via LinkedIn with tailored resume/);
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
        });
        assert.equal(response.status, 200);
        assert.deepEqual(await response.json(), coverLetterResponse);
        assert.equal(calls.length, 1);
        assert.match(calls[0].input, /Apply via Seek with resume and cover letter/);
    });
});
test("POST /analyze-job uses optional candidate profile when provided", async () => {
    const { calls, client } = createMockOpenAI(analysisResponse);
    const app = createApp(client);
    await withTestServer(app, async (baseUrl) => {
        const response = await postJson(baseUrl, "/analyze-job", {
            title: "Junior Developer",
            company: "Example Co",
            description: "Backend role using APIs and databases.",
            platform: "LinkedIn",
            candidate: {
                background: "Career changer with a software engineering diploma",
                skills: ["Python", "Django", "PostgreSQL"],
                targetRoles: ["junior backend developer"],
                workRights: "Australian citizen",
                projects: ["portfolio tracker", "support ticket API"],
            },
        });
        assert.equal(response.status, 200);
        assert.equal(calls.length, 1);
        assert.match(calls[0].input, /Career changer/);
        assert.match(calls[0].input, /Python, Django, PostgreSQL/);
        assert.match(calls[0].input, /portfolio tracker, support ticket API/);
        assert.doesNotMatch(calls[0].input, /Recent Computer Science graduate/);
    });
});
//# sourceMappingURL=server.test.js.map