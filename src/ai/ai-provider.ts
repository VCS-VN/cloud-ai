import type {
  BusinessProfile,
  BrandProfile,
  GenerationScope,
  Product,
  StorefrontProject,
} from "@/storefront/types";

export type ContentSafetyPolicy = {
  blockUnsupportedClaims: boolean;
  blockFakeReviews: boolean;
};
export type GenerationRequest = {
  projectId?: string;
  businessProfile: BusinessProfile;
  brandProfile: BrandProfile;
  products: Product[];
  currentProject?: StorefrontProject;
  scope: GenerationScope;
  overwrite: boolean;
  safetyPolicy: ContentSafetyPolicy;
};
export type GenerationCandidate = {
  structuredOutput: unknown;
  warnings: string[];
  assumptions: string[];
  providerMetadata: Record<string, unknown>;
};

export interface AIProvider {
  generateStorefront(request: GenerationRequest): Promise<GenerationCandidate>;
}

export class FakeAIProvider implements AIProvider {
  constructor(private readonly output: unknown) {}
  async generateStorefront(): Promise<GenerationCandidate> {
    return {
      structuredOutput: this.output,
      warnings: [],
      assumptions: [],
      providerMetadata: { fake: true },
    };
  }
}

export {
  ChatGptProvider,
  initializeChatGptProvider,
  type ChatGptProviderInit,
  type ChatGptProviderStatus,
} from "./chatgpt-provider";
