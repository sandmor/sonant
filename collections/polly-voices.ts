import type { CollectionConfig } from "payload";

import { isAdmin, isAuthenticated } from "./access";

const genderOptions = [
  { label: "Female", value: "female" },
  { label: "Male", value: "male" },
  { label: "Neutral", value: "neutral" },
  { label: "Unknown", value: "unknown" },
];

const engineOptions = [
  { label: "Standard", value: "standard" },
  { label: "Neural", value: "neural" },
  { label: "Long-form", value: "long-form" },
  { label: "Generative", value: "generative" },
  { label: "Other", value: "other" },
];

export const PollyVoices: CollectionConfig = {
  slug: "polly-voices",
  admin: {
    useAsTitle: "name",
    defaultColumns: ["voiceId", "name", "languageCode", "gender"],
  },
  access: {
    read: isAuthenticated,
    create: isAdmin,
    update: isAdmin,
    delete: isAdmin,
  },
  fields: [
    {
      name: "voiceId",
      type: "text",
      required: true,
      unique: true,
      maxLength: 160,
    },
    {
      name: "name",
      type: "text",
      required: true,
      maxLength: 120,
    },
    {
      name: "languageCode",
      type: "text",
      required: true,
      maxLength: 16,
    },
    {
      name: "languageName",
      type: "text",
      required: true,
      maxLength: 120,
    },
    {
      name: "gender",
      type: "select",
      required: true,
      defaultValue: "unknown",
      options: genderOptions,
    },
    {
      name: "engines",
      type: "select",
      hasMany: true,
      required: true,
      options: engineOptions,
      defaultValue: ["standard"],
    },
  ],
};
