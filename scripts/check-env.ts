import { assertRequiredS3Config } from "../lib/server/env";

function main() {
  assertRequiredS3Config();

  if (!process.env.MODAL_TTS_URL) {
    console.warn(
      "MODAL_TTS_URL is not set. Qwen and Chatterbox synthesis will fail until configured.",
    );
  }

  console.log("Required environment variables are present.");
}

main();
