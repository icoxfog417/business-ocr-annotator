import { defineStorage } from '@aws-amplify/backend';

export const storage = defineStorage({
  name: 'businessOcrImages',
  access: (allow) => ({
    // Changed from 'public/' to 'images/' - data is private to authenticated users
    'images/*': [
      allow.authenticated.to(['read', 'write', 'delete'])
    ]
  })
});
