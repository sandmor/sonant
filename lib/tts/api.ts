import type { AuthFormState, AuthUser } from "@/lib/tts/client";
import {
  normalizeGeneration,
  normalizeVoice,
  readErrorMessage,
  type Generation,
  type VoiceOption,
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

export async function fetchVoices() {
  const response = await fetch("/api/tts/voices?source=aws-polly&limit=500", {
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
      if (a.languageCode !== b.languageCode) {
        return a.languageCode.localeCompare(b.languageCode);
      }

      return a.name.localeCompare(b.name);
    });
}

export async function fetchHistory() {
  const response = await fetch("/api/tts/history?limit=50", {
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

  const payload = (await response.json()) as { docs?: unknown[] };
  const docs = Array.isArray(payload.docs) ? payload.docs : [];

  return docs
    .map(normalizeGeneration)
    .filter((entry): entry is Generation => entry !== null);
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
    weekStart?: string;
    percentage?: number;
    remaining?: number;
  };

  return {
    usedCharacters:
      typeof payload.usedCharacters === "number" ? payload.usedCharacters : 0,
    characterLimit:
      typeof payload.characterLimit === "number" ? payload.characterLimit : 0,
    weekStart: typeof payload.weekStart === "string" ? payload.weekStart : "",
    percentage: typeof payload.percentage === "number" ? payload.percentage : 0,
    remaining: typeof payload.remaining === "number" ? payload.remaining : 0,
  };
}
