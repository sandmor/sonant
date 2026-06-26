"use client";

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
import type { LanguageOption } from "@/lib/tts/languages";

type LanguagePickerProps = {
  languages: LanguageOption[];
  language: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onLanguageChange: (language: string) => void;
};

export function LanguagePicker({
  languages,
  language,
  open,
  onOpenChange,
  onLanguageChange,
}: LanguagePickerProps) {
  const selectedLanguage =
    languages.find((entry) => entry.id === language)?.label ?? language;

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between rounded-xl border-border/40 bg-card/60 py-6 text-[15px] font-normal backdrop-blur-sm hover:bg-card/80 hover:text-foreground"
        >
          {selectedLanguage || "Select language..."}
          <ChevronsUpDown className="ml-2 size-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="rounded-xl border-border/50 bg-card/95 p-0 backdrop-blur-xl"
        style={{ width: "var(--radix-popover-trigger-width)" }}
      >
        <Command>
          <CommandInput
            placeholder="Search language..."
            className="w-full border-none focus:ring-0"
          />
          <CommandList className="max-h-75">
            <CommandEmpty>No language found.</CommandEmpty>
            <CommandGroup>
              {languages.map((entry) => (
                <CommandItem
                  key={entry.id}
                  value={entry.id}
                  keywords={[entry.label, entry.id]}
                  onSelect={() => {
                    onLanguageChange(entry.id);
                    onOpenChange(false);
                  }}
                >
                  <Check
                    className={cn(
                      "mr-2 size-4",
                      language === entry.id ? "opacity-100" : "opacity-0",
                    )}
                  />
                  {entry.label}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
