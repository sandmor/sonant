import { LoaderCircle } from "lucide-react";

type AppSuspenseScreenProps = {
  message?: string;
};

export function AppSuspenseScreen({
  message = "Loading studio...",
}: AppSuspenseScreenProps) {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="flex flex-col items-center gap-4 animate-fade-up">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10">
          <LoaderCircle className="size-6 animate-spin text-primary" />
        </div>
        <p className="text-sm text-muted-foreground">{message}</p>
      </div>
    </div>
  );
}
