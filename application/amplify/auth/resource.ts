import { defineAuth, secret } from '@aws-amplify/backend';

export const auth = defineAuth({
  loginWith: {
    email: true, // Required by Amplify, but we'll only show Google OAuth in UI
    externalProviders: {
      google: {
        clientId: secret('GOOGLE_CLIENT_ID'),
        clientSecret: secret('GOOGLE_CLIENT_SECRET'),
        scopes: ['email', 'profile', 'openid'],
        attributeMapping: {
          email: 'email',
        },
      },
      callbackUrls: [
        'http://localhost:5173/',
        'http://localhost:5173/callback',
      ],
      logoutUrls: ['http://localhost:5173/'],
    },
  },
});
