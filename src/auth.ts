import NextAuth from 'next-auth';
import { authConfig } from './auth.config';
import { supabase } from '@/lib/supabase';

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  callbacks: {
    ...authConfig.callbacks,
    async signIn({ user }) {
      // Auto-create user in Supabase on first sign-in
      if (user.email && supabase) {
        try {
          const { data: existing } = await supabase
            .from('users')
            .select('id')
            .eq('email', user.email)
            .single();

          if (!existing) {
            await supabase.from('users').insert({
              email: user.email,
              name: user.name || '',
              avatar_url: user.image || '',
            });
          }
        } catch (e) {
          console.error('Failed to upsert user:', e);
        }
      }
      return true;
    },
    async jwt({ token }) {
      // Always look up the Supabase user ID from email
      // This runs on every token refresh, not just first sign-in
      if (token.email && supabase && !token.dbUserId) {
        try {
          const { data } = await supabase
            .from('users')
            .select('id')
            .eq('email', token.email)
            .single();
          if (data) {
            token.dbUserId = data.id;
          }
        } catch {}
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as any).dbId = token.dbUserId;
        session.user.email = token.email as string;
        session.user.name = token.name as string;
        session.user.image = token.picture as string;
      }
      return session;
    },
  },
});
