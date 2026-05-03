import { config } from "./config";

/** Public CDN/base URL for bucket objects (trailing slash optional). */
export function resolvedAvatarUrl(row: {
  id: string;
  profilePicUpdatedAt: Date | null;
}): string | null {
  const base = config.cdnBaseUrl?.trim();
  if (!row.profilePicUpdatedAt || !base) {
    return null;
  }
  const root = base.replace(/\/$/, "");
  return `${root}/profile-pic/${row.id}.jpg?v=${row.profilePicUpdatedAt.getTime()}`;
}

export function withResolvedAvatar<T extends { id: string; profilePicUpdatedAt: Date | null }>(
  user: T
): Omit<T, "profilePicUpdatedAt"> & { avatarUrl: string | null } {
  const { profilePicUpdatedAt, ...rest } = user;
  return {
    ...rest,
    avatarUrl: resolvedAvatarUrl({ id: user.id, profilePicUpdatedAt }),
  };
}
