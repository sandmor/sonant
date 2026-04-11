"use client";

import * as React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  itemsPerPage?: number;
  totalItems: number;
  className?: string;
}

export function Pagination({
  currentPage,
  totalPages,
  onPageChange,
  itemsPerPage = 20,
  totalItems,
  className,
}: PaginationProps) {
  const startItem = (currentPage - 1) * itemsPerPage + 1;
  const endItem = Math.min(currentPage * itemsPerPage, totalItems);

  const handlePrevious = () => {
    if (currentPage > 1) {
      onPageChange(currentPage - 1);
    }
  };

  const handleNext = () => {
    if (currentPage < totalPages) {
      onPageChange(currentPage + 1);
    }
  };

  // Don't render if there's only one page
  if (totalPages <= 1) {
    return null;
  }

  return (
    <div
      className={cn(
        "flex flex-wrap items-center justify-between gap-2 border-t border-border/40 px-2 py-2",
        className,
      )}
    >
      <div className="text-xs text-muted-foreground">
        <span className="tabular-nums">{startItem}</span>
        <span className="mx-1">-</span>
        <span className="tabular-nums">{endItem}</span>
        <span className="mx-1 text-muted-foreground/50">of</span>
        <span className="tabular-nums">{totalItems}</span>
      </div>

      <div className="ml-auto flex items-center gap-1">
        <Button
          variant="ghost"
          size="icon-xs"
          onClick={handlePrevious}
          disabled={currentPage <= 1}
          className="h-7 w-7"
          aria-label="Previous page"
        >
          <ChevronLeft className="size-4" />
        </Button>

        <span className="min-w-12 text-center text-xs tabular-nums text-muted-foreground">
          {currentPage}
          <span className="mx-0.5 text-muted-foreground/40">/</span>
          {totalPages}
        </span>

        <Button
          variant="ghost"
          size="icon-xs"
          onClick={handleNext}
          disabled={currentPage >= totalPages}
          className="h-7 w-7"
          aria-label="Next page"
        >
          <ChevronRight className="size-4" />
        </Button>
      </div>
    </div>
  );
}
