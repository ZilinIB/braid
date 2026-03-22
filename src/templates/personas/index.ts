import type { PersonaTemplate } from "./types.js";
import { chiefOfStaff } from "./chief-of-staff.js";
import { productLead } from "./product-lead.js";
import { techLead } from "./tech-lead.js";
import { growthHacker } from "./growth-hacker.js";
import { researchAnalyst } from "./research-analyst.js";
import { designLead } from "./design-lead.js";
import { frontendEngineer } from "./frontend-engineer.js";
import { backendEngineer } from "./backend-engineer.js";
import { platformEngineer } from "./platform-engineer.js";
import { qaGuard } from "./qa-guard.js";

export type { PersonaTemplate } from "./types.js";

export const PERSONA_TEMPLATES: Record<string, PersonaTemplate> = {
  chief_of_staff: chiefOfStaff,
  product_lead: productLead,
  tech_lead: techLead,
  growth_hacker: growthHacker,
  research_analyst: researchAnalyst,
  design_lead: designLead,
  frontend_engineer: frontendEngineer,
  backend_engineer: backendEngineer,
  platform_engineer: platformEngineer,
  qa_guard: qaGuard,
};
