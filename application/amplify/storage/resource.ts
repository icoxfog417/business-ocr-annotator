import { defineStorage } from '@aws-amplify/backend';

export const storage = defineStorage({
  name: 'businessOcrImages',
  access: (allow) => ({
    'public/images/*': [
      allow.authenticated.to(['read', 'write', 'delete'])
    ]
  })
});
