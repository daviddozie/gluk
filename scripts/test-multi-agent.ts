import { glukAgent } from "../src/mastra/agents/gluk-agent";
import { codeReviewerAgent } from "../src/mastra/agents/code-reviewer-agent";
import { factCheckerAgent } from "../src/mastra/agents/fact-checker-agent";

async function main() {
    console.log("=== 1. Direct Test: Code Reviewer Agent ===");
    const vulnerableSnippet = `
    app.post("/api/user", async (req, res) => {
        const { username } = req.body;
        const query = "SELECT * FROM users WHERE name = '" + username + "'";
        const result = await db.raw(query);
        res.json(result);
    });
    `;

    const codeReviewResult = await codeReviewerAgent.generate(
        `Audit this Node.js endpoint snippet for security vulnerabilities and recommend hardened code:\n\`\`\`javascript\n${vulnerableSnippet}\n\`\`\``
    );
    console.log("Code Reviewer Output Preview:");
    console.log(codeReviewResult.text.slice(0, 400) + "...\n");

    console.log("=== 2. Direct Test: Fact-Checker Agent ===");
    const claim = "The Great Wall of China is visible from space with the naked eye.";
    const factCheckResult = await factCheckerAgent.generate(
        `Investigate and fact-check this claim:\n"${claim}"`,
        { maxSteps: 3 }
    );
    console.log("Fact Checker Output Preview:");
    console.log(factCheckResult.text.slice(0, 400) + "...\n");

    console.log("=== 3. Supervisor Delegation Test: Gluk Agent ===");
    console.log("Prompting Gluk supervisor to review code (should trigger consult_code_reviewer tool)...");
    const supervisorResult = await glukAgent.generate(
        `Can you review this code for security issues and fix it?\n\`\`\`typescript\nfunction runCmd(input: string) {\n  require('child_process').exec(input);\n}\n\`\`\``,
        {
            maxSteps: 3,
            onStepFinish: (step: any) => {
                if (step.toolCalls && step.toolCalls.length > 0) {
                    for (const tc of step.toolCalls) {
                        const name = tc.payload?.toolName || tc.toolName;
                        console.log(`[Supervisor Step] Delegated to Tool: ${name}`);
                    }
                }
            },
        }
    );

    console.log("\nSupervisor Final Response Preview:");
    console.log(supervisorResult.text.slice(0, 400) + "...\n");
    console.log("=== Multi-Agent Collaboration Test Completed Successfully ===");
}

main().catch((err) => {
    console.error("Test failed:", err);
    process.exit(1);
});
