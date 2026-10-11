import {z} from 'zod';

export const CreateDeckInputSchema = z.object({
    name: z.string().trim().min(1, "Enter a collection name.").max(200)
});

export type CreateDeckInput = z.infer<typeof CreateDeckInputSchema>;
