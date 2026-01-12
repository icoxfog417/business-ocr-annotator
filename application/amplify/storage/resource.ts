import { defineStorage } from '@aws-amplify/backend';

export const storage = defineStorage({
  name: 'businessOcrImages',
  access: (allow) => ({
    'images/original/*': [allow.authenticated.to(['read', 'write', 'delete'])],
    'images/compressed/*': [allow.authenticated.to(['read', 'write', 'delete'])],
    'images/thumbnail/*': [allow.authenticated.to(['read', 'write', 'delete'])],
  }),
});
