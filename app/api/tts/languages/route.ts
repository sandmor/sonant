import { z } from "zod";

import {
  getLanguagesForEngine,
  isModalEngine,
} from "@/lib/tts/languages";

const querySchema = z.object({
  engine: z.enum(["qwen", "chatterbox"]),
});

export async function GET(req: Request) {
  const url = new URL(req.url);
  const parsedQuery = querySchema.safeParse({
    engine: url.searchParams.get("engine") ?? undefined,
  });

  if (!parsedQuery.success) {
    return Response.json(
      {
        message: "Invalid query params",
        errors: parsedQuery.error.flatten().fieldErrors,
      },
      { status: 400 },
    );
  }

  const { engine } = parsedQuery.data;

  if (!isModalEngine(engine)) {
    return Response.json({ message: "Unsupported engine" }, { status: 400 });
  }

  return Response.json(
    {
      engine,
      docs: getLanguagesForEngine(engine),
    },
    { status: 200 },
  );
}
