import type { DiagnoseInput } from './types';

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
