import type { Access, CollectionConfig } from "payload";

import { isAdmin, isAdminUser } from "./access";

const isOwnerOrAdmin: Access = ({ req: { user } }) => {
  if (!user) {
    return false;
  }

  if (isAdminUser(user)) {
    return true;
  }

  return {
    user: {
      equals: user.id,
    },
  };
};

export const TTSSrtJobs: CollectionConfig = {
  slug: "tts-srt-jobs",
  admin: {
    useAsTitle: "srtFilename",
    defaultColumns: [
      "srtFilename",
      "status",
      "cuesDone",
      "cuesTotal",
      "createdAt",
    ],
  },
  access: {
    create: () => false,
    read: isOwnerOrAdmin,
    update: isAdmin,
    delete: isOwnerOrAdmin,
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
      name: "status",
      type: "select",
      required: true,
      defaultValue: "pending",
      options: [
        { label: "Pending", value: "pending" },
        { label: "Running", value: "running" },
        { label: "Completed", value: "completed" },
        { label: "Failed", value: "failed" },
        { label: "Cancelled", value: "cancelled" },
      ],
    },
    {
      name: "voiceSource",
      type: "select",
      required: true,
      options: [
        { label: "Qwen", value: "qwen" },
        { label: "Chatterbox", value: "chatterbox" },
      ],
    },
    {
      name: "sourceVoiceId",
      label: "Provider Voice ID",
      type: "text",
      required: true,
      maxLength: 160,
    },
    {
      name: "voiceName",
      type: "text",
      required: true,
    },
    {
      name: "voice",
      type: "relationship",
      relationTo: "voices",
      required: true,
    },
    {
      name: "language",
      type: "text",
      required: true,
    },
    {
      name: "srtFilename",
      type: "text",
      required: true,
      maxLength: 255,
    },
    {
      name: "audioFilename",
      type: "text",
      required: true,
      maxLength: 255,
    },
    {
      name: "cuesTotal",
      type: "number",
      required: true,
      min: 1,
    },
    {
      name: "cuesDone",
      type: "number",
      required: true,
      defaultValue: 0,
      min: 0,
    },
    {
      name: "fitSettings",
      type: "json",
      required: true,
    },
    {
      name: "warnings",
      type: "json",
    },
    {
      name: "modalCallId",
      type: "text",
      index: true,
    },
    {
      name: "error",
      type: "textarea",
    },
    {
      name: "generation",
      type: "relationship",
      relationTo: "tts-generations",
    },
    {
      name: "charCount",
      type: "number",
      required: true,
      min: 1,
    },
    {
      name: "timelineDurationMs",
      type: "number",
      min: 0,
    },
  ],
};
