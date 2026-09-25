import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/question-bank")({
  beforeLoad: () => {
    throw redirect({
      to: "/courses/$courseId",
      params: { courseId: "question-bank" },
    });
  },
});
