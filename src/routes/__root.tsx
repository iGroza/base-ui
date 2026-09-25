import { useState } from "react";
import {
  createRootRoute,
  HeadContent,
  Outlet,
  Scripts,
} from "@tanstack/react-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AuthProvider } from "@/lib/auth/provider";
import { PreviewHostBridge } from "@/components/preview-host-bridge";
import { Toaster } from "sonner";
import appCss from "../styles.css?url";

const APP_NAME = "Base";
const publicBase = import.meta.env.BASE_URL || "/";

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1, viewport-fit=cover" },
      { title: APP_NAME },
      { name: "theme-color", content: "#9eb8d0" },
      {
        name: "description",
        content: "Доска задач, клиенты и команда.",
      },
    ],
    links: [
      { rel: "icon", type: "image/svg+xml", href: `${publicBase}favicon.svg` },
      { rel: "stylesheet", href: appCss },
      { rel: "manifest", href: `${publicBase}__grok/manifest.webmanifest` },
      { rel: "apple-touch-icon", href: `${publicBase}__grok/icon-180.png` },
    ],
  }),
  component: RootDocument,
});

function RootDocument() {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            refetchOnWindowFocus: false,
            retry: 1,
          },
        },
      }),
  );

  return (
    <html lang="ru" className="h-full antialiased" suppressHydrationWarning>
      <head>
        <HeadContent />
      </head>
      <body className="h-full overflow-hidden">
        <PreviewHostBridge />
        <AuthProvider>
          <QueryClientProvider client={queryClient}>
            <Outlet />
            <Toaster
              position="top-center"
              toastOptions={{
                className: "toast-app",
              }}
            />
          </QueryClientProvider>
        </AuthProvider>
        <Scripts />
      </body>
    </html>
  );
}
