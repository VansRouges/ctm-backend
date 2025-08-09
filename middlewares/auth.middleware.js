import { ClerkExpressRequireAuth, ClerkExpressWithAuth } from '@clerk/clerk-sdk-node'

export const requireAuthNonStrict = ClerkExpressWithAuth();

export const requireAuthStrict = ClerkExpressRequireAuth();
