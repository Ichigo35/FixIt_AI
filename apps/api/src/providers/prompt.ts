import type { DiagnoseInput, RepairGuideInput, VerifyStepInput } from './types';

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
  if ((input.videos?.length ?? 0) > 0) {
    lines.push(
      'A short video is attached — watch it for movement, sound cues, vibration, sparks, smoke, leaks or intermittent faults that a still photo would miss. Note the timestamp of anything relevant.',
    );
  }
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

EVERY step must also carry a "visual" object. The app draws the step from it, so the user
never has to read a wall of text:
- "scene": pick the ONE value from the schema enum that matches the physical gesture of
  the step (e.g. "unscrew" to remove screws, "pry" to unclip a cover, "disconnect" to
  unplug a connector, "measure" for a multimeter reading, "reassemble" to close up).
- "subject": 2 to 5 words naming exactly what the user acts on ("the four rear panel
  screws", "the pump filter cap").
- "caption": ONE short imperative line printed under the drawing, max 12 words.
- "anchors": ONLY when photos of the item are attached. Point at the exact area of the
  user's own photo this step is about, so the app can highlight it:
  {"imageIndex": <0-based index of the attached photo>, "box": [ymin, xmin, ymax, xmax]
  normalised to 0-1000, "label": 2 to 4 words}. Use 0 to 2 anchors per step, and only for
  an area you can genuinely see in that photo. NO anchor is much better than a guessed
  one — a wrong highlight sends the user to the wrong part.

Each step also gets "checks": 1 to 3 short statements the user can verify to know the step
is done ("The panel lifts off with no resistance"), and "estimatedMinutes".

Write the guide in the same language as the user's own words.

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
  const photoCount = input.images?.length ?? 0;
  lines.push(
    photoCount > 0
      ? `${photoCount} photo(s) of the actual item are attached, in order (imageIndex 0 to ${photoCount - 1}). Use them to name real, visible parts, and to place "anchors" on the exact areas each step is about.`
      : 'No photo of the item is attached — leave every "anchors" array empty.',
  );
  if (input.adminOverride) {
    lines.push(
      'IMPORTANT: this item was flagged as professional-only because of a safety hazard, ' +
        'and an authorised operator has explicitly overridden that block. Still write the full ' +
        'guide, but be especially thorough: put every relevant hazard in "generalWarnings", add ' +
        'an explicit "safetyWarning" to every step that carries any risk, and make step 1 a ' +
        'complete make-it-safe procedure (isolate mains/gas/water, discharge stored energy, ' +
        'wait for cooling, use PPE).',
    );
  }
  return lines.join('\n');
}

export const STEP_CHECK_SYSTEM_PROMPT = `You are FixIt AI, checking a user's photo against ONE step of a repair guide.

You are shown: the step's title and instruction, and a photo the user just took of their work.
Decide whether that step looks correctly done.

Return one "verdict":
- "pass": the step is clearly completed correctly.
- "retry": the step is not done, is done wrong, or needs adjustment. Explain briefly in "advice".
- "unsafe": you can see a real hazard in the photo (exposed live wire, damaged mains cable,
  swollen/leaking battery, gas smell reported, scorching, structural damage, standing water near
  mains). Set "escalate": true and tell the user to stop and get a professional.
- "unclear": the photo is too blurry, too dark, or shows the wrong thing to judge. Ask for a better photo.

Be conservative: if you are not confident the step is done, use "retry" or "unclear", never "pass".
"summary" = one short sentence the user will read first. "advice" = 0-4 short, concrete next actions.
Return ONLY JSON matching the schema.`;

export function buildStepCheckPrompt(input: VerifyStepInput): string {
  const lines: string[] = [];
  lines.push(`Repair context: ${input.diagnosis.problem}`);
  if (input.category) lines.push(`Category: ${input.category}`);
  lines.push(`Guide summary: ${input.guideSummary}`);
  lines.push(`Checking step ${input.stepNumber} of ${input.stepCount}.`);
  lines.push(`Step title: ${input.step.title}`);
  lines.push(`Step instruction: ${input.step.instruction}`);
  if (input.step.safetyWarning) lines.push(`Step safety warning: ${input.step.safetyWarning}`);
  if (input.note?.trim()) lines.push(`User note: "${input.note.trim()}"`);
  lines.push('The attached photo shows the user’s work for this step. Judge only this step.');
  return lines.join('\n');
}
