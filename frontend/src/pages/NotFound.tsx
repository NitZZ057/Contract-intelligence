import { Compass } from "lucide-react";
import { EmptyState } from "@/components/common/EmptyState";

export function NotFound() {
  return (
    <EmptyState
      icon={Compass}
      title="Page not found"
      description="The requested workspace route does not exist."
      ctaLabel="Return to dashboard"
      ctaHref="/"
    />
  );
}
