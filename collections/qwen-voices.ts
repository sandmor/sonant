import type { CollectionConfig } from "payload";

import { isAdmin, isAuthenticated } from "./access";

export const QwenVoices: CollectionConfig = {
  slug: "qwen-voices",
  admin: {
    useAsTitle: "name",
    defaultColumns: ["name", "voiceId", "gender", "isActive"],
  },
  access: {
    read: isAuthenticated,
    create: isAdmin,
    update: isAdmin,
    delete: isAdmin,
  },
  fields: [
    {
      name: "name",
      type: "text",
      required: true,
      maxLength: 120,
    },
    {
      name: "voiceId",
      type: "text",
      required: true,
      unique: true,
      maxLength: 160,
    },
    {
      name: "gender",
      type: "select",
      options: [
        { label: "Female", value: "female" },
        { label: "Male", value: "male" },
        { label: "Neutral", value: "neutral" },
        { label: "Unknown", value: "unknown" },
      ],
      defaultValue: "unknown",
      required: true,
    },
    {
      name: "isActive",
      type: "checkbox",
      defaultValue: true,
      required: true,
    },
  ],
};
