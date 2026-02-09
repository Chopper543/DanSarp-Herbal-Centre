export function getRateLimitIdentifier(
  request: Request,
  userId?: string | null
): string {
  const forwardedFor = request.headers.get("x-forwarded-for");
  const realIp = request.headers.get("x-real-ip");
  const cfConnectingIp = request.headers.get("cf-connecting-ip");

  const ip = (forwardedFor?.split(",")[0] || realIp || cfConnectingIp || "unknown").trim();

  if (userId && userId.trim().length > 0) {
    return `user:${userId.trim()}:ip:${ip}`;
  }

  return `ip:${ip}`;
}
