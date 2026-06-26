"use client";

import { useMemo } from "react";
import { Check, ChevronsUpDown } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import type { VoiceOption } from "@/lib/tts/client";
import { makeVoiceKey } from "@/lib/voices";
import type { VoiceSource } from "@/lib/voices";

type VoicePickerProps = {
  engine: VoiceSource;
  voices: VoiceOption[];
  voiceId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onVoiceChange: (voiceId: string) => void;
};

function groupVoices(engine: VoiceSource, voices: VoiceOption[]) {
  return voices.reduce<Record<string, VoiceOption[]>>((acc, voice) => {
    const groupKey =
      engine === "aws-polly"
        ? `${voice.languageName ?? "Unknown"} (${voice.languageCode ?? "?"})`
        : voice.gender === "unknown"
          ? "Voices"
          : `${voice.gender.charAt(0).toUpperCase()}${voice.gender.slice(1)} voices`;

    if (!acc[groupKey]) {
      acc[groupKey] = [];
    }

    acc[groupKey].push(voice);
    return acc;
  }, {});
}

export function VoicePicker({
  engine,
  voices,
  voiceId,
  open,
  onOpenChange,
  onVoiceChange,
}: VoicePickerProps) {
  const voiceByKey = useMemo(
    () =>
      new Map(
        voices.map((voice) => [
          makeVoiceKey(voice.source, voice.sourceVoiceId),
          voice,
        ]),
      ),
    [voices],
  );

  const groupedVoices = useMemo(
    () => groupVoices(engine, voices),
    [engine, voices],
  );

  const selectedVoice = voiceId ? voiceByKey.get(voiceId) : undefined;

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between rounded-xl border-border/40 bg-card/60 py-6 text-[15px] font-normal backdrop-blur-sm hover:bg-card/80 hover:text-foreground"
        >
          {selectedVoice ? selectedVoice.name : "Select a voice..."}
          <ChevronsUpDown className="ml-2 size-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="rounded-xl border-border/50 bg-card/95 p-0 backdrop-blur-xl"
        style={{ width: "var(--radix-popover-trigger-width)" }}
      >
        <Command defaultValue={voiceId}>
          <CommandInput
            placeholder="Search voices..."
            className="w-full border-none focus:ring-0"
          />
          <CommandList className="max-h-75">
            <CommandEmpty>No voice found.</CommandEmpty>
            {Object.entries(groupedVoices).map(([group, groupVoices]) => (
              <CommandGroup
                key={group}
                heading={group}
                className="text-muted-foreground"
              >
                {groupVoices.map((voice) => {
                  const voiceVal = makeVoiceKey(
                    voice.source,
                    voice.sourceVoiceId,
                  );

                  return (
                    <CommandItem
                      key={voiceVal}
                      value={voiceVal}
                      keywords={[voice.name, group]}
                      onSelect={() => {
                        onVoiceChange(voiceVal);
                        onOpenChange(false);
                      }}
                    >
                      <Check
                        className={cn(
                          "mr-2 size-4",
                          voiceId === voiceVal ? "opacity-100" : "opacity-0",
                        )}
                      />
                      {voice.name}
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            ))}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
