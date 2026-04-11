import type { CollectionConfig } from "payload";

import { isAdmin } from "./access";

export const TTSWeeklyUsage: CollectionConfig = {
  slug: "tts-weekly-usage",
  admin: {
    useAsTitle: "weekKey",
    defaultColumns: ["weekKey", "usedCharacters", "updatedAt"],
  },
  access: {
    read: isAdmin,
    create: isAdmin,
    update: isAdmin,
    delete: isAdmin,
  },
  hooks: {
    beforeValidate: [
      ({ data, originalDoc }) => {
        const userId =
          typeof data?.user === "number"
            ? data.user
            : typeof originalDoc?.user === "number"
              ? originalDoc.user
              : null;

        const weekStartValue =
          typeof data?.weekStart === "string"
            ? data.weekStart
            : typeof originalDoc?.weekStart === "string"
              ? originalDoc.weekStart
              : null;

        if (!userId || !weekStartValue) {
          return data;
        }

        return {
          ...data,
          weekKey: `${userId}:${weekStartValue}`,
        };
      },
    ],
  },
  fields: [
    {
      name: "user",
      type: "relationship",
      relationTo: "users",
      required: true,
      index: true,
    },
    {
      name: "weekStart",
      type: "date",
      required: true,
      index: true,
    },
    {
      name: "weekKey",
      type: "text",
      required: true,
      unique: true,
      index: true,
      admin: {
        readOnly: true,
      },
    },
    {
      name: "usedCharacters",
      type: "number",
      required: true,
      min: 0,
      defaultValue: 0,
    },
  ],
};
