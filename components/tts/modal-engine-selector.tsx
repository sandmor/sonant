"use client";

import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  getSourceLabel,
  MODAL_ENGINE_SOURCES,
  type ModalEngineSource,
} from "@/lib/voices";

type ModalEngineSelectorProps = {
  value: ModalEngineSource;
  onChange: (engine: ModalEngineSource) => void;
};

export function ModalEngineSelector({
  value,
  onChange,
}: ModalEngineSelectorProps) {
  return (
    <Tabs
      value={value}
      onValueChange={(next) => onChange(next as ModalEngineSource)}
      className="w-full gap-0"
    >
      <TabsList className="grid w-full grid-cols-2">
        {MODAL_ENGINE_SOURCES.map((source) => (
          <TabsTrigger key={source} value={source}>
            {getSourceLabel(source)}
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  );
}
