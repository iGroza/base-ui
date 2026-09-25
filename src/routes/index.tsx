import { createFileRoute, stripSearchParams, useNavigate } from "@tanstack/react-router";
import { App } from "@/components/app";
import { defaultDash, parseDashSearch } from "@/lib/query";

export const Route = createFileRoute("/")({
  validateSearch: (search: Record<string, unknown>) => parseDashSearch(search),
  search: {
    middlewares: [stripSearchParams(defaultDash)],
  },
  component: Home,
});

function Home() {
  const dash = Route.useSearch();
  const navigate = useNavigate();
  return (
    <App
      dash={dash}
      setDash={(patch) => {
        void navigate({
          to: "/",
          replace: true,
          search: (prev) => ({ ...parseDashSearch(prev), ...patch }),
        });
      }}
    />
  );
}
