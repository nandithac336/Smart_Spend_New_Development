import { env } from "../config/env.js";

const VISION_ENDPOINT = "https://vision.googleapis.com/v1/images:annotate";

export function createGoogleVisionProvider({ apiKey = env.OCR_API_KEY, timeoutMs = env.OCR_TIMEOUT_MS } = {}) {
  return {
    async recognize(buffer) {
      if (!apiKey) {
        const error = new Error("OCR provider is not configured");
        error.code = "OCR_NOT_CONFIGURED";
        throw error;
      }
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), timeoutMs);
      try {
        const response = await fetch(`${VISION_ENDPOINT}?key=${encodeURIComponent(apiKey)}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          signal: controller.signal,
          body: JSON.stringify({
            requests: [{
              image: { content: buffer.toString("base64") },
              features: [{ type: "DOCUMENT_TEXT_DETECTION" }],
            }],
          }),
        });
        if (!response.ok) {
          const error = new Error("OCR provider request failed");
          error.code = "OCR_PROVIDER_ERROR";
          throw error;
        }
        const payload = await response.json();
        const result = payload.responses?.[0];
        if (result?.error) {
          const error = new Error("OCR provider could not process the image");
          error.code = "OCR_PROVIDER_ERROR";
          throw error;
        }
        return {
          text: result?.fullTextAnnotation?.text || "",
          confidence: averageBlockConfidence(result?.fullTextAnnotation?.pages || []),
        };
      } catch (error) {
        if (error.name === "AbortError") {
          const timeoutError = new Error("OCR provider timed out");
          timeoutError.code = "OCR_TIMEOUT";
          throw timeoutError;
        }
        throw error;
      } finally {
        clearTimeout(timeout);
      }
    },
  };
}

function averageBlockConfidence(pages) {
  const confidences = pages.flatMap((page) => page.blocks || [])
    .map((block) => block.confidence)
    .filter((value) => Number.isFinite(value));
  return confidences.length
    ? confidences.reduce((sum, value) => sum + value, 0) / confidences.length
    : null;
}
