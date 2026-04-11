import { assertRequiredS3Config } from "../lib/server/env";

function main() {
  assertRequiredS3Config();
  console.log("Required environment variables are present.");
}

main();
