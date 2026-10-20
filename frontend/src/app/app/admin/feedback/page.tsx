import type { Metadata } from "next";
import { FeedbackAdmin } from "@/components/app/feedback-admin";

export const metadata: Metadata = { title: "Feedback" };

export default function AdminFeedback() {
  return <FeedbackAdmin />;
}
