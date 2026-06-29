import type {
  AuthFormState,
  AuthUser,
  Generation,
  SrtCue,
  SrtFitSettings,
  VoiceOption,
} from "@/lib/tts/client";
import {
  normalizeGeneration,
  normalizeSrtJob,
  normalizeVoice,
  readErrorMessage,
} from "@/lib/tts/client";

export type RegisterResult = {
  ok: true;
};

function makeHTTPError(message: string, status: number) {
  const error = new Error(message) as Error & { status?: number };
  error.status = status;
  return error;
}

export async function getSessionUser() {
  const response = await fetch("/api/users/me", {
    method: "GET",
    credentials: "include",
  });

  if (!response.ok) {
    return null;
  }

  const payload = (await response.json()) as {
    user?: { id?: number; email?: string; name?: string };
  };

  const user = payload.user;
  if (!user || typeof user.id !== "number" || typeof user.email !== "string") {
    return null;
  }

  return {
    id: user.id,
    email: user.email,
    name: typeof user.name === "string" ? user.name : undefined,
  } satisfies AuthUser;
}

export async function login(form: AuthFormState) {
  const response = await fetch("/api/users/login", {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(form),
  });

  if (!response.ok) {
    throw makeHTTPError(
      await readErrorMessage(response, "Unable to log in"),
      response.status,
    );
  }

  const payload = (await response.json()) as {
    user?: {
      id?: number;
      email?: string;
      name?: string;
    };
  };

  const user = payload.user;

  if (!user || typeof user.id !== "number" || typeof user.email !== "string") {
    throw new Error("Login succeeded but user data is missing");
  }

  return {
    id: user.id,
    email: user.email,
    name: typeof user.name === "string" ? user.name : undefined,
  } satisfies AuthUser;
}

export async function register(form: AuthFormState): Promise<RegisterResult> {
  const response = await fetch("/api/users", {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(form),
  });

  if (!response.ok) {
    throw new Error(
      await readErrorMessage(response, "Unable to create account"),
    );
  }

  return { ok: true };
}

export async function verifyEmailToken(token: string) {
  const response = await fetch(
    `/api/users/verify/${encodeURIComponent(token)}`,
    {
      method: "POST",
      credentials: "include",
    },
  );

  if (!response.ok) {
    throw new Error(
      await readErrorMessage(response, "Unable to verify email token"),
    );
  }
}

export async function requestPasswordReset(email: string) {
  const response = await fetch("/api/users/forgot-password", {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ email }),
  });

  if (!response.ok) {
    throw new Error(
      await readErrorMessage(response, "Unable to request password reset"),
    );
  }
}

export async function resetPassword(args: { token: string; password: string }) {
  const response = await fetch("/api/users/reset-password", {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(args),
  });

  if (!response.ok) {
    throw new Error(
      await readErrorMessage(response, "Unable to reset password"),
    );
  }
}

export async function logout() {
  await fetch("/api/users/logout", {
    method: "POST",
    credentials: "include",
  });
}

export async function fetchVoices(source?: string) {
  const params = new URLSearchParams({ limit: "500" });
  if (source) {
    params.set("source", source);
  }

  const response = await fetch(`/api/tts/voices?${params.toString()}`, {
    method: "GET",
    credentials: "include",
  });

  if (!response.ok) {
    if (response.status === 401) {
      throw makeHTTPError("Unauthorized", 401);
    }

    throw new Error(await readErrorMessage(response, "Unable to load voices"));
  }

  const payload = (await response.json()) as { docs?: unknown[] };
  const docs = Array.isArray(payload.docs) ? payload.docs : [];

  return docs
    .map(normalizeVoice)
    .filter((entry): entry is VoiceOption => entry !== null)
    .sort((a, b) => {
      const aLang = a.languageCode || "";
      const bLang = b.languageCode || "";
      if (aLang !== bLang) {
        return aLang.localeCompare(bLang);
      }

      return a.name.localeCompare(b.name);
    });
}

export async function fetchLanguages(engine: "qwen" | "chatterbox") {
  const response = await fetch(`/api/tts/languages?engine=${engine}`, {
    method: "GET",
    credentials: "include",
  });

  if (!response.ok) {
    throw new Error(await readErrorMessage(response, "Unable to load languages"));
  }

  const payload = (await response.json()) as {
    docs?: Array<{ id?: string; label?: string }>;
  };

  const docs = Array.isArray(payload.docs) ? payload.docs : [];

  return docs
    .filter(
      (entry): entry is { id: string; label: string } =>
        typeof entry.id === "string" && typeof entry.label === "string",
    )
    .map((entry) => ({ id: entry.id, label: entry.label }));
}

export async function fetchHistory(page = 1, limit = 50) {
  const response = await fetch(`/api/tts/history?limit=${limit}&page=${page}`, {
    method: "GET",
    credentials: "include",
  });

  if (!response.ok) {
    if (response.status === 401) {
      throw makeHTTPError("Unauthorized", 401);
    }

    throw new Error(
      await readErrorMessage(response, "Unable to load timeline"),
    );
  }

  const payload = (await response.json()) as {
    docs?: unknown[];
    totalPages?: number;
    totalDocs?: number;
    page?: number;
  };
  const docs = Array.isArray(payload.docs) ? payload.docs : [];

  return {
    docs: docs
      .map(normalizeGeneration)
      .filter((entry): entry is Generation => entry !== null),
    totalPages: payload.totalPages ?? 1,
    totalDocs: payload.totalDocs ?? docs.length,
    page: payload.page ?? 1,
  };
}

export async function fetchGenerationByID(id: number) {
  const response = await fetch(`/api/tts/history/${id}`, {
    method: "GET",
    credentials: "include",
  });

  if (!response.ok) {
    if (response.status === 401) {
      throw makeHTTPError("Unauthorized", 401);
    }

    throw new Error(
      await readErrorMessage(response, "Unable to load selected audio"),
    );
  }

  const payload = (await response.json()) as { generation?: unknown };
  const generation = normalizeGeneration(payload.generation);

  if (!generation) {
    throw new Error("Selected generation response was malformed");
  }

  return generation;
}

export async function generateAudio(args: {
  text: string;
  voiceSource: string;
  voiceId: string;
  language?: string;
}) {
  const response = await fetch("/api/tts", {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(args),
  });

  if (!response.ok) {
    if (response.status === 401) {
      throw makeHTTPError("Unauthorized", 401);
    }

    throw new Error(
      await readErrorMessage(response, "Unable to generate audio"),
    );
  }

  const payload = (await response.json()) as { generation?: unknown };
  const generation = normalizeGeneration(payload.generation);

  if (!generation) {
    throw new Error("Generation created but response format is invalid");
  }

  return generation;
}

export async function deleteGenerationByID(id: number) {
  const response = await fetch(`/api/tts/history/${id}`, {
    method: "DELETE",
    credentials: "include",
  });

  if (!response.ok) {
    if (response.status === 401) {
      throw makeHTTPError("Unauthorized", 401);
    }

    throw new Error(
      await readErrorMessage(response, "Unable to delete generation"),
    );
  }
}

export async function fetchUsage() {
  const response = await fetch("/api/tts/usage", {
    method: "GET",
    credentials: "include",
  });

  if (!response.ok) {
    if (response.status === 401) {
      throw makeHTTPError("Unauthorized", 401);
    }

    throw new Error(
      await readErrorMessage(response, "Unable to load usage data"),
    );
  }

  const payload = (await response.json()) as {
    usedCharacters?: number;
    characterLimit?: number;
    maxCharactersPerRequest?: number;
    weekStart?: string;
    percentage?: number;
    remaining?: number;
  };

  return {
    usedCharacters:
      typeof payload.usedCharacters === "number" ? payload.usedCharacters : 0,
    characterLimit:
      typeof payload.characterLimit === "number" ? payload.characterLimit : 0,
    maxCharactersPerRequest:
      typeof payload.maxCharactersPerRequest === "number"
        ? payload.maxCharactersPerRequest
        : 0,
    weekStart: typeof payload.weekStart === "string" ? payload.weekStart : "",
    percentage: typeof payload.percentage === "number" ? payload.percentage : 0,
    remaining: typeof payload.remaining === "number" ? payload.remaining : 0,
  };
}

export async function createSrtJob(args: {
  srtText: string;
  srtFilename: string;
  engine: "qwen" | "chatterbox";
  voiceId: string;
  language?: string;
  fit?: SrtFitSettings;
}) {
  const response = await fetch("/api/tts/srt/jobs", {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(args),
  });

  if (!response.ok) {
    if (response.status === 401) {
      throw makeHTTPError("Unauthorized", 401);
    }

    throw new Error(await readErrorMessage(response, "Unable to create SRT job"));
  }

  const payload = (await response.json()) as { job?: unknown };
  const job = normalizeSrtJob(payload.job);

  if (!job) {
    throw new Error("SRT job created but response format is invalid");
  }

  return job;
}

export async function getSrtJob(id: number) {
  const response = await fetch(`/api/tts/srt/jobs/${id}`, {
    method: "GET",
    credentials: "include",
  });

  if (!response.ok) {
    if (response.status === 401) {
      throw makeHTTPError("Unauthorized", 401);
    }

    throw new Error(await readErrorMessage(response, "Unable to load SRT job"));
  }

  const payload = (await response.json()) as { job?: unknown };
  const job = normalizeSrtJob(payload.job);

  if (!job) {
    throw new Error("SRT job response was malformed");
  }

  return job;
}

export async function cancelSrtJob(id: number) {
  const response = await fetch(`/api/tts/srt/jobs/${id}`, {
    method: "DELETE",
    credentials: "include",
  });

  if (!response.ok) {
    if (response.status === 401) {
      throw makeHTTPError("Unauthorized", 401);
    }

    throw new Error(await readErrorMessage(response, "Unable to cancel SRT job"));
  }
}

export async function previewSrtCue(args: {
  engine: "qwen" | "chatterbox";
  voiceId: string;
  language?: string;
  cue: SrtCue;
  fit?: SrtFitSettings;
}) {
  const response = await fetch("/api/tts/srt/preview", {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(args),
  });

  if (!response.ok) {
    if (response.status === 401) {
      throw makeHTTPError("Unauthorized", 401);
    }

    throw new Error(await readErrorMessage(response, "Unable to preview cue"));
  }

  return new Blob([await response.arrayBuffer()], { type: "audio/wav" });
}
