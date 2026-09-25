import { createFileRoute, redirect } from "@tanstack/react-router";
import { taskIdFromBaseLink } from "@/lib/base-link";
import { defaultDash } from "@/lib/query";

export const Route = createFileRoute("/database/$")({
  beforeLoad: ({ location }) => {
    const task = taskIdFromBaseLink(location.pathname) ?? "";
    throw redirect({
      to: "/",
      replace: true,
      search: task ? { ...defaultDash, view: "list", task } : defaultDash,
    });
  },
});
