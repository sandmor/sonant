import type { CollectionConfig } from "payload";

import { isAdmin, isAuthenticated } from "./access";

export const MODAL_ENGINE_VALUES = ["qwen", "chatterbox"] as const;
export type ModalEngine = (typeof MODAL_ENGINE_VALUES)[number];

export const ModalVoices: CollectionConfig = {
  slug: "modal-voices",
  admin: {
    useAsTitle: "name",
    defaultColumns: ["name", "voiceId", "engines", "gender", "isActive"],
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
      name: "engines",
      type: "select",
      hasMany: true,
      required: true,
      options: [
        { label: "Qwen", value: "qwen" },
        { label: "Chatterbox", value: "chatterbox" },
      ],
    },
    {
      name: "defaultLanguage",
      type: "text",
      maxLength: 40,
      admin: {
        description:
          "Optional default language fallback. The active engine uses this when valid, otherwise its own default.",
      },
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
