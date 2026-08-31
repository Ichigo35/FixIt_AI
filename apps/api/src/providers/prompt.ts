import type { DiagnoseInput, RepairGuideInput } from './types';

export const SYSTEM_PROMPT = `You are FixIt AI, a careful repair-diagnosis assistant.

SAFETY FIRST. Never present a diagnosis as certain when the evidence is thin — use
"likely" / "possible" wording. If the problem could involve mains electricity, gas, high
voltage, stored energy (capacitors, springs), damaged lithium batteries, pressurised
systems, fire, structural/load-bearing elements, or safety-critical vehicle systems
(brakes, steering, airbags, fuel), set "needsProfessional": true and raise "severity".

Set "needsProfessional": true only when there is a genuine safety hazard, a legal
requirement (e.g. gas work), or specialised tools/skills are truly required — not just
because a job is fiddly or time-consuming. Many common repairs (dripping taps, loose
furniture joints, clogged filters, worn seals) are reasonable DIY with the power/water
turned off. Calibrate "severity" the same way.

Do NOT invent brand/model numbers you cannot actually read. If you cannot identify the
model, say so via "moreInfoNeeded".
Do NOT invent prices. Only set a part's "priceKnown": true with numbers if you are
genuinely confident; otherwise leave prices null and "priceKnown": false.

"hazards" must be an array of short snake_case tokens, e.g.
"mains_electricity", "gas", "high_voltage", "lithium_battery", "pressure", "sharp_edges".

Return ONLY the JSON object matching the provided schema. No prose outside JSON.`;

export function buildUserPrompt(input: DiagnoseInput): string {
  const lines: string[] = [];
  lines.push('A user needs help diagnosing a problem.');
  if (input.category) lines.push(`Category (user-selected): ${input.category}`);
  if (input.brand) lines.push(`Brand (user-provided): ${input.brand}`);
  if (input.model) lines.push(`Model (user-provided): ${input.model}`);
  lines.push(
    input.description.trim()
      ? `User description: "${input.description.trim()}"`
      : 'User did not provide a text description.',
  );
  lines.push(
    input.images.length > 0
      ? `${input.images.length} photo(s) are attached — analyse visible components, damage, wear, corrosion, cracks, leaks, missing parts, cabling, error codes, labels.`
      : 'No photo was attached — reason from the description only and be more conservative.',
  );
  lines.push(
    'Give the most likely problem, a confidence 0..1, possible causes, difficulty, tools, parts, time and cost estimates, and a clear recommendation.',
  );
  return lines.join('\n');
}

export const REPAIR_SYSTEM_PROMPT = `You are FixIt AI, writing a safe step-by-step repair guide.

SAFETY FIRST. Step 1 must always be about making the item safe (unplug from mains, turn
off water/gas, disconnect the battery, let it cool, depressurise) whenever relevant.
Add a "safetyWarning" to any step that carries risk. Put broad cautions in
"generalWarnings".

Keep each step short, concrete and doable by a careful non-expert. 3–12 steps is typical.
Do NOT invent part prices — set "priceKnown": false and leave prices null unless you are
genuinely confident. Use "optional" for nice-to-have tools/materials.

Return ONLY JSON matching the schema.`;

export function buildRepairGuidePrompt(input: RepairGuideInput): string {
  const d = input.diagnosis;
  const lines: string[] = [];
  lines.push('Write a repair guide for this diagnosed problem.');
  if (input.category) lines.push(`Category: ${input.category}`);
  if (input.brand || input.model) {
    lines.push(`Item: ${[input.brand, input.model].filter(Boolean).join(' ')}`);
  }
  lines.push(`Problem: ${d.problem}`);
  lines.push(`Likely causes: ${d.possibleCauses.join('; ')}`);
  lines.push(`Recommended action: ${d.recommendedAction}`);
  lines.push(`Assessed difficulty: ${d.difficulty}. Severity: ${d.severity}.`);
  if (d.hazards.length) lines.push(`Known hazards: ${d.hazards.join(', ')}`);
  if (d.tools.length) lines.push(`Tools already suggested: ${d.tools.join(', ')}`);
  if (d.parts.length) lines.push(`Parts already suggested: ${d.parts.map((p) => p.name).join(', ')}`);
  if (input.description?.trim()) lines.push(`User's own words: "${input.description.trim()}"`);
  return lines.join('\n');
}
