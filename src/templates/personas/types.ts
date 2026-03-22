export type PersonaTemplate = {
  identity: {
    hook: string;
    philosophy: string;
    experience: string;
  };
  style: {
    voice: string;
    examplePhrases: string[];
    tone: string;
  };
  deliverableGuidance: string;
  successMetrics: string[];
  workflowDetail: string;
  learningInstructions: string;
};
