import { createContext, useContext } from 'react';

export type Account = {
  id: string;
  username: string;
  isOwner: boolean;
  tourPending: boolean;
};

export type Session = {
  account: Account;
  request: (path: string, init?: RequestInit) => Promise<Response>;
  signOut: () => Promise<void>;
  profileChanged: (username: string) => void;
};

export const SessionContext = createContext<Session | null>(null);

export function useSession() {
  const session = useContext(SessionContext);
  if (!session) throw new Error('Session provider is missing.');
  return session;
}
