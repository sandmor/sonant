import { buildConfig } from "payload";
import { postgresAdapter } from "@payloadcms/db-postgres";
import { lexicalEditor } from "@payloadcms/richtext-lexical";
import path from "path";
import { fileURLToPath } from "url";

const filename = fileURLToPath(import.meta.url);
const dirname = path.dirname(filename);

export default buildConfig({
  secret: process.env.PAYLOAD_SECRET || "",
  admin: {
    user: "users",
  },
  editor: lexicalEditor({}),
  graphQL: {
    disable: true,
  },
  db: postgresAdapter({
    pool: {
      connectionString: process.env.DATABASE_URL || "",
    },
  }),
  collections: [
    {
      slug: "users",
      auth: true,
      fields: [],
    },
  ],
  typescript: {
    outputFile: path.resolve(dirname, "payload-types.ts"),
  },
});
