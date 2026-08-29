import { describe, it, expect } from "vitest";
import { ApiError } from "@google/genai";
import { classifyGeminiError } from "./providerErrors";

describe("classifyGeminiError", () => {
  it("classifies a timed-out request as 'timeout', not unavailable", () => {
    const result = classifyGeminiError(new Error("whatever"), /* timedOut */ true);
    expect(result.code).toBe("timeout");
    expect(result.status).toBe(504);
    expect(result.unavailable).toBe(false);
  });

  it("classifies an AbortError as 'timeout' even if the timedOut flag wasn't set", () => {
    const err = new Error("aborted");
    err.name = "AbortError";
    const result = classifyGeminiError(err, false);
    expect(result.code).toBe("timeout");
  });

  it("classifies a 401 ApiError as config_error and unavailable (triggers fallback)", () => {
    const err = new ApiError({ message: "bad key", status: 401 });
    const result = classifyGeminiError(err, false);
    expect(result.code).toBe("config_error");
    expect(result.status).toBe(500);
    expect(result.unavailable).toBe(true);
  });

  it("classifies a 403 ApiError the same as a 401", () => {
    const err = new ApiError({ message: "forbidden", status: 403 });
    const result = classifyGeminiError(err, false);
    expect(result.code).toBe("config_error");
    expect(result.unavailable).toBe(true);
  });

  it("classifies a 429 ApiError as rate_limited and unavailable (triggers fallback)", () => {
    const err = new ApiError({ message: "quota exceeded", status: 429 });
    const result = classifyGeminiError(err, false);
    expect(result.code).toBe("rate_limited");
    expect(result.status).toBe(429);
    expect(result.unavailable).toBe(true);
  });

  it("classifies a 503 ApiError as unavailable (triggers fallback)", () => {
    const err = new ApiError({ message: "model overloaded", status: 503 });
    const result = classifyGeminiError(err, false);
    expect(result.code).toBe("upstream_error");
    expect(result.status).toBe(503);
    expect(result.unavailable).toBe(true);
  });

  it("classifies any other ApiError status as upstream_error, NOT unavailable", () => {
    const err = new ApiError({ message: "server exploded", status: 500 });
    const result = classifyGeminiError(err, false);
    expect(result.code).toBe("upstream_error");
    expect(result.unavailable).toBe(false);
  });

  it("classifies the SDK's exhausted-retry wrapper as unavailable (triggers fallback)", () => {
    const err = new Error("Retryable HTTP Error: ");
    err.attemptNumber = 2;
    const result = classifyGeminiError(err, false);
    expect(result.code).toBe("upstream_error");
    expect(result.status).toBe(503);
    expect(result.unavailable).toBe(true);
  });

  it("classifies a missing-API-key Error (not an ApiError) as config_error/unavailable", () => {
    const err = new Error("GEMINI_API_KEY is not set on the server.");
    const result = classifyGeminiError(err, false);
    expect(result.code).toBe("config_error");
    expect(result.unavailable).toBe(true);
  });

  it("classifies an unrecognized generic error as upstream_error, NOT unavailable", () => {
    const result = classifyGeminiError(new Error("some network blip"), false);
    expect(result.code).toBe("upstream_error");
    expect(result.unavailable).toBe(false);
  });
});
