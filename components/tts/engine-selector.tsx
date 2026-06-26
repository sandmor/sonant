"use client";

import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  getSourceLabel,
  VOICE_SOURCE_VALUES,
  type VoiceSource,
} from "@/lib/voices";

type EngineSelectorProps = {
  value: VoiceSource;
  onChange: (engine: VoiceSource) => void;
};

export function EngineSelector({ value, onChange }: EngineSelectorProps) {
  return (
    <Tabs
      value={value}
      onValueChange={(next) => onChange(next as VoiceSource)}
      className="w-full gap-0"
    >
      <TabsList className="grid w-full grid-cols-3">
        {VOICE_SOURCE_VALUES.map((source) => (
          <TabsTrigger key={source} value={source}>
            {getSourceLabel(source)}
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  );
}
