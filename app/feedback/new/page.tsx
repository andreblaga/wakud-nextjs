import { redirect } from "next/navigation";
import { Lightbulb } from "lucide-react";
import { BackLink, PageHeader } from "@/components/ui";
import { getSessionUser } from "@/lib/auth";
import { canSubmitFeedback } from "@/lib/feedback";
import FeedbackForm from "../FeedbackForm";
import { createFeedback } from "../actions";

/**
 * Raise a feedback item.
 *
 * Gated on being signed in and nothing else — no canWrite() check, so every
 * role including executive_viewer can reach it. Middleware already turns away
 * anyone without a session; this is the belt to that pair of braces.
 */
export default async function NewFeedbackPage() {
  const user = await getSessionUser();
  if (!canSubmitFeedback(user)) redirect("/feedback");

  return (
    <div className="mx-auto max-w-2xl">
      <BackLink href="/feedback" label="Feedback" />
      <PageHeader
        title="New feedback"
        description="An idea, a problem, a question — anything about how WakudOS works"
        icon={Lightbulb}
      />
      <FeedbackForm action={createFeedback} submitLabel="Submit feedback" />
    </div>
  );
}
