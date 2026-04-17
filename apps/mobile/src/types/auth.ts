export type AuthUser = {
  id: string;
  name: string;
  email: string;
  username?: string | null;
  avatarUrl?: string | null;
  bio?: string | null;
  socialOptIn?: boolean;
};
