import { defineHandler } from "nitro";

export default defineHandler(async (event) => {
  const requestUrl = new URL(event.req.url);
  const pathname = requestUrl.pathname;
  if (pathname.includes("..") || !pathname.startsWith("/media-file/user_files/")) {
    return new Response("Нельзя скачать этот адрес", { status: 400 });
  }
  const upstream = await fetch(`https://base.imshop.io${pathname.replace(/^\/media-file/, "/media")}`, {
    signal: AbortSignal.timeout(20_000),
  });
  const headers = new Headers();
  const type = upstream.headers.get("content-type");
  if (type) headers.set("content-type", type);
  headers.set("cache-control", "private, max-age=300");
  return new Response(upstream.body, { status: upstream.status, headers });
});
