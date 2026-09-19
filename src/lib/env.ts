import { z } from 'zod';

const envSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().min(1),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  CIRCLE_API_KEY: z.string().min(1),
  CIRCLE_WALLET_ID: z.string().min(1),
  AGENT_TREASURY_ADDRESS: z.string().min(1),
  RAW_ENTITY_SECRET: z.string().min(1),
  CIRCLE_API_KEY_MAINNET: z.string().optional(),
  NEXT_PUBLIC_CIRCLE_APP_ID_MAINNET: z.string().optional(),
  CIRCLE_WALLET_ID_MAINNET: z.string().optional(),
  AGENT_TREASURY_ADDRESS_MAINNET: z.string().optional(),
  RAW_ENTITY_SECRET_MAINNET: z.string().optional(),
});

export const validateEnv = () => {
  const result = envSchema.safeParse(process.env);
  if (!result.success) {
    return {
      isValid: false,
      errors: result.error.issues.map((e: z.ZodIssue) => e.path.join('.')),
    };
  }
  return { isValid: true, errors: [] };
};
