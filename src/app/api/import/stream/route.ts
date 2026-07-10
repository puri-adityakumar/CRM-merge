import { extractLeads } from "@/lib/ai/extract";
import { getMaxUploadBytes } from "@/config/constants";
import { runImport } from "@/lib/import/run-import";
import { readFileField } from "@/lib/import/multipart";
import { formatSseEvent } from "@/lib/import/sse";

export const runtime = "nodejs";
/** Allow longer AI batch runs on serverless (best-effort). */
export const maxDuration = 300;

/**
 * POST /api/import/stream
 * Multipart `file` → SSE stream of progress / complete / error events.
 */
export async function POST(request: Request) {
  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return new Response(
      formatSseEvent("error", {
        error: "Invalid request: expected multipart form data",
        code: "INVALID_CSV",
        status: 400,
      }),
      {
        status: 200,
        headers: sseHeaders(),
      },
    );
  }

  const fileBytes = await readFileField(formData);
  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: "progress" | "complete" | "error", data: unknown) => {
        controller.enqueue(encoder.encode(formatSseEvent(event, data)));
      };

      try {
        const result = await runImport({
          fileBytes,
          maxBytes: getMaxUploadBytes(),
          extractFn: extractLeads,
          onProgress: (p) => {
            send("progress", p);
          },
        });

        if (!result.ok) {
          send("error", {
            error: result.error,
            code: result.code,
            status: result.status,
          });
        } else {
          send("complete", {
            imported: result.data.imported,
            skipped: result.data.skipped,
            stats: result.data.stats,
          });
        }
      } catch (err) {
        send("error", {
          error:
            err instanceof Error ? err.message : "Unexpected stream failure",
          code: "EXTRACT_FAILED",
          status: 502,
        });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    status: 200,
    headers: sseHeaders(),
  });
}

function sseHeaders(): HeadersInit {
  return {
    "Content-Type": "text/event-stream; charset=utf-8",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
    // Disable buffering on some proxies
    "X-Accel-Buffering": "no",
  };
}
