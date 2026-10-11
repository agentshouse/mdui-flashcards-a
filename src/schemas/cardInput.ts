import {z} from 'zod';

export const CardInputSchema = z.object({
    front: z.string().min(1, "Enter card text.").max(50000).regex(/\S/, "Enter card text."),
    back: z.string().min(1, "Enter card text.").max(50000).regex(/\S/, "Enter card text.")
});

export type CardInput = z.infer<typeof CardInputSchema>;
