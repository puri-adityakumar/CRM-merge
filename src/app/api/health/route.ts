import { NextResponse } from "next/server";

/**
 * Liveness / readiness probe.
 * Does not expose secret env values — only a boolean for LLM configuration.
 */
export async function GET() {
  const llmConfigured = Boolean(
    process.env.OPENROUTER_API_KEY &&
      process.env.OPENROUTER_API_KEY.trim() !== "",
  );

  return NextResponse.json(
    {
      ok: true,
      status: "healthy",
      llmConfigured,
    },
    { status: 200 },
  );
}
