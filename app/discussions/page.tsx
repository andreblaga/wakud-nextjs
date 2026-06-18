import { MessagesSquare } from "lucide-react";
import { PageHeader } from "@/components/ui";
import Discussions from "./Discussions";

export default function DiscussionsPage() {
  return (
    <div className="mx-auto max-w-7xl">
      <PageHeader
        title="Discussions"
        description="Team chat with references to deals, contracts & batches, plus a searchable archive"
        icon={MessagesSquare}
      />
      <Discussions />
    </div>
  );
}
