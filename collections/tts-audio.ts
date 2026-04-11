import type { Access, CollectionConfig } from "payload";

import { isAdminUser } from "./access";

const isAudioOwnerOrAdmin: Access = ({ req: { user } }) => {
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

export const TTSAudio: CollectionConfig = {
  slug: "tts-audio",
  admin: {
    useAsTitle: "filename",
    defaultColumns: ["filename", "mimeType", "filesize", "createdAt"],
  },
  access: {
    read: isAudioOwnerOrAdmin,
    create: () => false,
    update: isAudioOwnerOrAdmin,
    delete: isAudioOwnerOrAdmin,
  },
  upload: {
    mimeTypes: [
      "audio/mpeg",
      "audio/mp3",
      "audio/wav",
      "audio/ogg",
      "audio/webm",
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
  ],
};
