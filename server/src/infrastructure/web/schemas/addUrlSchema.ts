import { z } from 'zod';

export const AddUrlSchema = z.object({
  url: z.string().url(),
  tags: z.array(z.string()).optional()
});

export type AddUrlPayload = z.infer<typeof AddUrlSchema>;
