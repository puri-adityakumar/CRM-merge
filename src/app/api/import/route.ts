import { NextResponse } from "next/server";
import { extractLeads } from "@/lib/ai/extract";
import { getMaxUploadBytes } from "@/config/constants";
import { runImport } from "@/lib/import/run-import";
import { readFileField } from "@/lib/import/multipart";

/**
 * POST /api/import
 * Multipart form field `file` (CSV) → parse → extractLeads → JSON.
 */
export async function POST(request: Request) {
  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json(
      {
        error: "Invalid request: expected multipart form data",
        code: "INVALID_CSV",
      },
      { status: 400 },
    );
  }

  const fileBytes = await readFileField(formData);
  const result = await runImport({
    fileBytes,
    maxBytes: getMaxUploadBytes(),
    extractFn: extractLeads,
  });

  if (!result.ok) {
    return NextResponse.json(
      { error: result.error, code: result.code },
      { status: result.status },
    );
  }

  return NextResponse.json(
    {
      imported: result.data.imported,
      skipped: result.data.skipped,
      stats: result.data.stats,
    },
    { status: 200 },
  );
}
