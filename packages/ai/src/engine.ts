import OpenAI from 'openai';
import { getEnv } from '@tradepilot/config';
import { SignalProposalSchema, type MarketContext, type SignalProposal } from './types';
import { SYSTEM_PROMPT, buildUserPrompt } from './prompt';

/** AI Signal Engine — wraps OpenAI with strict schema validation. */
export class SignalEngine {
  private client: OpenAI;
  private model: string;

  constructor(apiKey?: string, model?: string) {
    const env = getEnv();
    this.client = new OpenAI({ apiKey: apiKey ?? env.OPENAI_API_KEY });
    this.model = model ?? env.OPENAI_MODEL;
  }

  async generate(ctx: MarketContext): Promise<SignalProposal> {
    const completion = await this.client.chat.completions.create({
      model: this.model,
      temperature: 0.2,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: buildUserPrompt(ctx) },
      ],
    });
    const raw = completion.choices[0]?.message?.content ?? '{}';
    return SignalProposalSchema.parse(JSON.parse(raw));
  }
}
