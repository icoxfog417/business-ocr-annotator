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
        'https://main.d1qijheh7kkv51.amplifyapp.com/',
        'https://main.d1qijheh7kkv51.amplifyapp.com/callback',
      ],
      logoutUrls: [
        'http://localhost:5173/',
        'https://main.d1qijheh7kkv51.amplifyapp.com/',
      ],
    },
  },
  // Custom attributes for contributor consent tracking (Sprint 3)
  userAttributes: {
    // "true" when user has consented to contribute data
    'custom:contributor': {
      dataType: 'String',
      mutable: true,
    },
    // ISO timestamp of when consent was given
    'custom:consent_date': {
      dataType: 'String',
      mutable: true,
    },
    // Version of consent terms accepted (e.g., "1.0")
    'custom:consent_version': {
      dataType: 'String',
      mutable: true,
    },
  },
});
