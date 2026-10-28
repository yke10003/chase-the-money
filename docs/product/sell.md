# Sell items

**Status.** The creation journey is implemented. Marketplace publishing is not. The Sell UX cleanup below is device-accepted on an iPhone 16 Pro (2026-10-15): unfinished cards resume creation, a finished unlisted product opens Product Detail, similar listings are managed on Product Detail, a link without a protocol is accepted, and the product name is edited on its own.

Sell is an item, then later one or more listings. The physical item sells once. An offer will belong to a listing. This version stores the item, its photos, and the evidence used to estimate value. It does not create listing rows yet.

## Money

Item value is **potential** money. It is copied onto the opportunity as `potential_min_minor` / `potential_max_minor` when setup finishes.

An asking price, once the item is listed, stays on the opportunity context. It is not potential and it is not realized.

Realized sale proceeds stay `FinancialImpact` ledger entries. Nothing in `sell_items` is realized money.

## Models

`sell_items` belongs to one `opportunities` row (`playbook = sell_item`). The opportunity still owns the stage, the next action, XP actions, and the ledger.

`sell_item_photos` stores a disk and path, a shot key, sort order, and which photo is the cover. Files are not base64 columns.

`sell_comparables` stores a URL, a guessed platform, a price, and `sold`, `asking`, or `unknown`. Nothing is scraped. A pasted link without a protocol is stored as `https`. `http` and `https` are kept. Other schemes are rejected. After setup, Product Detail is the list: add and edit open the form directly, and delete asks first. The creation Research step still has its own prompt and entry. It uses the same link normalization.

Category-specific answers that are not shared columns live in `details` JSON. The allowed keys come from the catalog.

## Setup

`setup_step` is `identity`, `photos`, `details`, `research`, `estimate`, `description`, or `done`.

A draft opportunity has `context.sell_setup = draft`, no open playbook action, and is left out of Home. Sell shows a draft once it has a name or a photo. Tapping that card resumes creation at `setup_step`. `setup_done` is true only when `setup_step` is `done`. Photos, a price, a description, or a listing do not decide it. A finished product that is not listed yet opens Product Detail. All activity and an old mission link use the same rule when they know `setup_done`. Product Detail still offers Continue setup if an unfinished product was opened directly. Closing a category-only draft deletes it. A named draft stays and can be resumed. Save and exit returns to the tab that started the resume.

Finishing the description marks setup done, keeps the product name separate from `listing_title`, and moves a new sale to ready to list with “Create the listing”. It does not queue “Prepare the listing”. Unknown value is allowed and does not invent a number. A blank description is allowed.

Items that already have an open Prepare the listing action keep it. Completing that action still moves them to ready to list. Already listed products skip setup.

XP is the existing action ledger, awarded once:

- naming the item: 10
- leaving photos with at least one photo: 15
- saving an estimate: 10

Editing photos, the listing title, or comparables again does not award more. Skipping the estimate awards no valuation XP. Finishing twice does not add another list action or more XP.

## Already listed

`POST /v1/sell/items/listed` creates the item and a listed opportunity in one step. It asks for the name, category, marketplace, asking price, and optional link and date. It does not run the photo or valuation wizard.

## Listing text

The product `name` is the identity used on Sell cards and the mission. `listing_title` is the marketplace title. It can be empty; the product name is the display fallback. Neither field overwrites the other. On Product Detail the name has its own edit sheet. The Details sheet does not include it.

A development build can draft the description from the description step with four on-device styles. That draft stays in the field until Save & exit or Finish. It does not change the product name or `listing_title`. Release builds do not show the styles.

## Photos

Shot types are a fixed set of primitives (front, back, label, hallmark, and so on). Each category and subcategory maps to a short plan of recommended and optional shots. The client renders `photo_plan` from the API, including whether a shot was taken or skipped. A shot is taken only when a photo's `shot_key` matches it. A photo added from Product Detail without a shot key stays on the item. Resuming guided photos does not delete it and does not treat it as the front, or as any other shot. The saved `setup_step` still decides which step opens. Skipped shots are not asked for again when setup resumes. Photo review is not a creation step. Adding, reordering, cover, crop, and background removal happen on Product Detail.

Uploads accept JPEG, PNG, and WebP up to 12 MB. The server corrects JPEG orientation when EXIF is available, and stores a JPEG whose long edge is at most 2400 pixels at quality 86. That is the file a later listing can reuse. There is no separate thumbnail pipeline.

Local development uses the `public` disk (`SELL_PHOTO_DISK`, default `public`). Production storage is not chosen. Set `SELL_PHOTO_DISK=s3` when a bucket exists; the API then returns a one-hour temporary URL instead of `/storage/...`.

## Catalog

`GET /v1/sell/catalog` is the taxonomy. Screens do not hard-code which questions follow a jacket versus a coin.

Money Hunt room labels map onto the same category keys, then open the setup flow with the name filled in.

## What is next

Create the listing on a marketplace: asking price, marketplace, and listing URL. The listing title and description are already on the item. Offers belong on a listing. On-device listing generation, marketplace connections, scraping, and automatic valuation are not part of this flow.
