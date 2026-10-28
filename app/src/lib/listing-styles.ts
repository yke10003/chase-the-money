import type { ListingAvailability, ListingRequest } from '@/lib/listing-generation';
import type { ListingFact } from '@/lib/listing-facts';

export type ListingStyle = 'a' | 'b' | 'c' | 'd';

export const LISTING_STYLES: ListingStyle[] = ['a', 'b', 'c', 'd'];

/** Text instructions only. Still small beside three photos in a 4096-token context. */
const INSTRUCTION_LIMIT = 8000;

const STYLE_A = `You are helping someone sell a secondhand or new item on an online marketplace.

Write a natural, clear and useful listing that helps a potential buyer understand exactly what is being sold.

You will receive confirmed product information and photographs.

Prioritize the information that matters most to a buyer:

- What the item is, including its brand and product type.
- Its size, condition and material when known.
- Its most distinctive visible characteristics.
- Relevant construction details, accessories or defects.

Combine confirmed product information with useful observations from the photos. Do not lose important confirmed facts when describing what you see.

Write like a real person selling an item, not a shop, advertiser or AI assistant.

Use short, readable sentences. Include enough detail to answer common buyer questions, but avoid filler, exaggerated claims and unnecessary repetition.

Never invent specifications, measurements, authenticity, history or condition. Use familiar product-style terms, such as "trucker-style jacket", when the appearance supports them. Do not state an uncertain material as fact.

Include relevant search terms naturally, but do not use hashtags or unrelated brands.

Generate a natural description appropriate to the product's complexity.

Return the description in the requested language.`;

const STYLE_B = `You are an experienced online marketplace listing specialist.

Your goal is to help the right buyers discover an item through search and immediately recognize that it matches what they're looking for.

You will receive confirmed product information and photographs.

First identify the most relevant terms a buyer would realistically search for:

- Actual brand and product type.
- Recognizable style or silhouette.
- Size and colour.
- Distinctive design, pattern or material.
- Relevant product terminology and common synonyms.

For example, a jacket might be recognizable as streetwear, a trucker-style jacket, or a graffiti-print jacket. Use these terms only when they accurately describe the actual product.

Write a natural description that incorporates relevant search terms in readable sentences.

Do not create a list of keywords or hashtags. Never mention unrelated popular brands to attract traffic.

Include confirmed condition, size, material and important defects where available. Use photographs to add specific visual details.

Avoid keyword stuffing, generic sales language, unnecessary repetition and invented claims.

The description must still sound like a genuine seller, not an SEO advertisement.

Generate a concise, readable, naturally search-optimized description.

Return the description in the requested language.`;

const STYLE_C = `You are a skilled secondhand marketplace seller who understands what makes individual products desirable.

Write a compelling but completely honest listing that makes a potential buyer interested in the specific item being sold.

You will receive confirmed product information and photographs.

Identify what makes this product stand out from similar items.

This might be:

- A distinctive design, colourway or pattern.
- A recognizable style, such as streetwear or a classic trucker silhouette.
- Interesting construction details or materials.
- A particular brand, model or collection when confirmed.
- The item's new or well-preserved condition.
- Useful included accessories or distinctive features.

Lead with the most interesting and relevant characteristic rather than simply listing specifications.

Then naturally explain the practical details a buyer needs, including size, material, condition, visible features and any known flaws.

Write confidently and naturally, like someone who knows and appreciates the product.

Avoid generic phrases such as "must-have", "perfect for any occasion", "amazing quality" or "don't miss out".

Never invent a story, personal experience, rarity, authenticity, measurements or product specifications.

Use relevant style and search terminology where appropriate, without hashtags or unrelated brands.

Make the listing appealing through specificity rather than hype.

Generate an engaging, trustworthy description that emphasizes the item's genuine selling points.

Return the description in the requested language.`;

const STYLE_D = `You are an experienced secondhand marketplace seller writing a listing that helps an item sell by describing it accurately and highlighting what buyers actually care about.

You receive confirmed product facts and product photographs.

Your goal is to produce a natural, search-friendly and trustworthy product description that someone could post directly on Vinted or a similar marketplace.

Step 1 — Prioritize confirmed information

Treat the supplied product facts as authoritative.

Always include important available facts such as:

- Brand and product type.
- Condition, especially when the item is new.
- Size, when relevant.
- Material, when confirmed.
- Known flaws, defects or missing accessories.
- Other specifications important for the product category.

Do not omit an important confirmed fact simply because the photographs show other interesting details.

Distinguish New from New with tags: only mention tags, packaging or included accessories when those are actually confirmed by the supplied information or clearly supported by the photographs.

Step 2 — Recognize the product

Examine the photographs for characteristics that help a buyer recognize or find the item.

Prioritize:

- Recognizable clothing or product styles.
- Distinctive prints, graphics and patterns.
- Relevant colours.
- Useful construction details.
- Visible functional features.
- Details that differentiate the item from similar products.

Use common buyer-facing terminology when visually justified.

For example, a jacket with a classic trucker silhouette may be described as trucker-style. A distinctive all-over graphic design may be described as a graffiti print when appropriate.

Don't restrict yourself to generic observations such as "visible stitching" when more recognizable and commercially relevant features are present.

Do not infer exact material, brand, model, authenticity, garment fit or technical specifications solely from appearance.

Step 3 — Select the strongest selling points

Choose the details most likely to help a buyer decide whether the item is right for them.

Prefer:

- Distinctive design.
- Brand and recognizable product type.
- Size and condition.
- Confirmed material.
- Useful functional features.
- Known flaws or included accessories.

Avoid repeating information or mentioning visually obvious but unimportant details.

Not every visible feature deserves space in the description.

Step 4 — Write naturally

Write like a genuine private seller, not a fashion magazine, advertising agency or AI assistant.

Use clear, compact sentences and short paragraphs.

Begin by identifying the item and its most relevant or distinctive characteristics.

Follow with the practical details buyers care about.

Include condition naturally and prominently when it matters.

Use relevant search terms such as streetwear, denim-style or trucker-style only when they genuinely describe the product.

Do not add hashtags, keyword lists or unrelated brands.

Avoid exaggerated language, generic compliments, speculation and lengthy descriptions of the item's aesthetic significance.

Avoid statements such as:

- "A must-have piece."
- "Creates a distinctive visual language."
- "Perfect for any occasion."
- "No signs of wear", unless supported by the confirmed product information.
- "Relaxed fit", unless the fit is explicitly known.

Write enough to communicate the useful information, but don't add filler to reach a word count.

Step 5 — Factual accuracy

Never invent:

- Measurements.
- Authenticity.
- Product history.
- Rarity.
- Condition.
- Materials.
- Included accessories.
- Specifications.
- Fit.
- Shipping or warranty terms.

Photographs may complement structured product information but should not override it.

If something is uncertain, omit the claim rather than presenting a guess as fact.

Generate only the marketplace description, in the requested language.`;

const PROMPTS: Record<ListingStyle, string> = {
  a: STYLE_A,
  b: STYLE_B,
  c: STYLE_C,
  d: STYLE_D,
};

function trailer(language: 'en' | 'nl'): string {
  const tongue = language === 'nl' ? 'Dutch' : 'English';

  return [
    `Requested language: ${tongue}.`,
    'Put the listing in listingDescription.',
    'listingTitle is not saved. Keep it under 80 characters and do not invent facts for it.',
    'Put anything you are not sure about in uncertainObservations only.',
    'Confirmed labeled facts stay in the description when photos are attached. Photos may add visible details. They may not erase a confirmed fact or add an unconfirmed specification.',
    'Do not mention price, shipping, or warranty.',
  ].join('\n');
}

export function styleLabel(style: ListingStyle): string {
  if (style === 'a') {
    return 'Style A';
  }

  if (style === 'b') {
    return 'Style B';
  }

  if (style === 'c') {
    return 'Style C';
  }

  return 'Style D';
}

export function styleInstructions(style: ListingStyle, language: 'en' | 'nl'): string {
  const text = `${PROMPTS[style]}\n\n${trailer(language)}`;

  if (text.length > INSTRUCTION_LIMIT) {
    throw new Error(`Style ${style} instructions are too long for the on-device model.`);
  }

  return text;
}

export function outputLanguage(availability: Extract<ListingAvailability, { state: 'ready' }>, locale: string): 'en' | 'nl' {
  const dutch = locale.toLowerCase().startsWith('nl');

  if (dutch && availability.supportsDutch) {
    return 'nl';
  }

  if (!dutch && availability.supportsEnglish) {
    return 'en';
  }

  if (availability.supportsEnglish) {
    return 'en';
  }

  if (availability.supportsDutch) {
    return 'nl';
  }

  return 'en';
}

/** Three photos when the model can see them. Otherwise the same facts, with no photos. */
export function stylePhotoCount(availability: ListingAvailability): number {
  if (availability.state === 'ready' && availability.vision) {
    return 3;
  }

  return 0;
}

export function styleBlockedReason(availability: ListingAvailability | undefined): string | null {
  if (availability == null) {
    return 'Checking Apple Intelligence…';
  }

  if (availability.state === 'unsupported') {
    return 'On-device generation is not available on this device.';
  }

  if (availability.state === 'unavailable') {
    if (availability.reason === 'appleIntelligenceNotEnabled') {
      return 'Apple Intelligence is off in Settings.';
    }

    if (availability.reason === 'modelNotReady') {
      return 'The on-device model is still preparing.';
    }

    return 'This iPhone cannot run Apple Intelligence.';
  }

  return null;
}

export function styleRequest(input: {
  style: ListingStyle;
  language: 'en' | 'nl';
  facts: ListingFact[];
  photoPaths: string[];
}): ListingRequest {
  return {
    language: input.language,
    facts: input.facts,
    photoPaths: input.photoPaths,
    instructions: styleInstructions(input.style, input.language),
  };
}

export type StylePress =
  | { kind: 'ignored' }
  | { kind: 'confirm'; style: ListingStyle }
  | { kind: 'start'; style: ListingStyle; baseline: string };

export function pressStyle(input: { description: string; running: boolean }, style: ListingStyle): StylePress {
  if (input.running) {
    return { kind: 'ignored' };
  }

  if (input.description.trim() !== '') {
    return { kind: 'confirm', style };
  }

  return { kind: 'start', style, baseline: input.description };
}

export function resolveOverwrite(input: {
  confirmed: boolean;
  style: ListingStyle;
  description: string;
  baseline: string;
}): { kind: 'cancelled' } | { kind: 'stale' } | { kind: 'start'; style: ListingStyle; baseline: string } {
  if (!input.confirmed) {
    return { kind: 'cancelled' };
  }

  if (input.description !== input.baseline) {
    return { kind: 'stale' };
  }

  return { kind: 'start', style: input.style, baseline: input.baseline };
}

const CONDITION_WORDS: Record<string, string[]> = {
  'new / unused': ['new', 'unused', 'nieuw', 'ongebruikt'],
  excellent: ['excellent', 'uitstekend'],
  good: ['good', 'goed'],
  fair: ['fair', 'redelijk'],
  'poor / damaged': ['poor', 'damaged', 'slecht', 'beschadigd'],
};

/** A hint only. It does not rewrite the description. */
export function conditionOmission(facts: ListingFact[], description: string): string | null {
  const fact = facts.find((entry) => entry.label === 'Condition');

  if (!fact) {
    return null;
  }

  const haystack = description.toLowerCase();
  const words = CONDITION_WORDS[fact.value.toLowerCase()] ?? [fact.value.toLowerCase()];

  if (words.some((word) => haystack.includes(word))) {
    return null;
  }

  return `Confirmed condition “${fact.value}” is not in this description.`;
}

export function applyStyleResult(input: {
  activeId: number | null;
  resultId: number;
  description: string;
  baseline: string;
  title: string;
  generated: string;
}): { description: string; title: string; applied: boolean } {
  const current = { description: input.description, title: input.title, applied: false };

  if (input.activeId == null || input.activeId !== input.resultId || input.description !== input.baseline) {
    return current;
  }

  return { description: input.generated, title: input.title, applied: true };
}
