import { inspect } from "node:util";
import type { Faker } from "@faker-js/faker";
import { PNG } from "pngjs";
import type { EmailContent, GenerationContext, ImageMode } from "../types.js";

/**
 * A generated image ready to be attached to an email.
 */
export interface GeneratedImage {
	buffer: Buffer;
	contentType: string;
	filename: string;
}

/**
 * Options for {@link getImage}.
 */
export interface GetImageOptions {
	faker: Faker;
	/** Image source mode. Defaults to "local". */
	mode?: ImageMode;
	width?: number;
	height?: number;
}

const DEFAULT_WIDTH = 600;
const DEFAULT_HEIGHT = 400;
const KITTENS_TIMEOUT_MS = 3000;
const KITTENS_URL = "https://cataas.com/cat";

/**
 * Produce a real, valid image for an email attachment.
 *
 * `local` mode (default) renders a deterministic abstract PNG seeded from the
 * provided faker instance. `kittens` mode fetches a real photo from cataas.com
 * and falls back to `local` on any failure.
 */
export const getImage = async (
	options: GetImageOptions,
): Promise<GeneratedImage> => {
	const {
		faker,
		mode = "local",
		width = DEFAULT_WIDTH,
		height = DEFAULT_HEIGHT,
	} = options;

	if (mode === "kittens") {
		const fetched = await fetchKitten(width, height);
		if (fetched) {
			return fetched;
		}
		return generateLocalImage(faker, width, height);
	}

	return generateLocalImage(faker, width, height);
};

interface Rgb {
	r: number;
	g: number;
	b: number;
}

const randomColor = (faker: Faker): Rgb => ({
	r: faker.number.int({ min: 0, max: 255 }),
	g: faker.number.int({ min: 0, max: 255 }),
	b: faker.number.int({ min: 0, max: 255 }),
});

const clamp = (value: number): number => Math.max(0, Math.min(255, value));

const lerp = (from: number, to: number, t: number): number =>
	from + (to - from) * t;

/**
 * Render a deterministic abstract PNG: a diagonal gradient overlaid with a few
 * translucent shapes and light noise. Given the same seeded faker, the output
 * bytes are identical.
 */
const generateLocalImage = (
	faker: Faker,
	width: number,
	height: number,
): GeneratedImage => {
	const png = new PNG({ width, height });
	const top = randomColor(faker);
	const bottom = randomColor(faker);

	for (let y = 0; y < height; y++) {
		for (let x = 0; x < width; x++) {
			const t = (x / width + y / height) / 2;
			const idx = (width * y + x) << 2;
			const jitter = faker.number.int({ min: -8, max: 8 });
			png.data[idx] = clamp(lerp(top.r, bottom.r, t) + jitter);
			png.data[idx + 1] = clamp(lerp(top.g, bottom.g, t) + jitter);
			png.data[idx + 2] = clamp(lerp(top.b, bottom.b, t) + jitter);
			png.data[idx + 3] = 255;
		}
	}

	const shapeCount = faker.number.int({ min: 3, max: 8 });
	for (let s = 0; s < shapeCount; s++) {
		drawCircle(png, faker, width, height);
	}

	const buffer = PNG.sync.write(png);
	return {
		buffer,
		contentType: "image/png",
		filename: `image-${faker.string.alphanumeric(8)}.png`,
	};
};

const drawCircle = (
	png: PNG,
	faker: Faker,
	width: number,
	height: number,
): void => {
	const cx = faker.number.int({ min: 0, max: width - 1 });
	const cy = faker.number.int({ min: 0, max: height - 1 });
	const radius = faker.number.int({
		min: Math.floor(Math.min(width, height) / 12),
		max: Math.floor(Math.min(width, height) / 3),
	});
	const color = randomColor(faker);
	const alpha = faker.number.float({ min: 0.2, max: 0.6 });

	const minY = Math.max(0, cy - radius);
	const maxY = Math.min(height - 1, cy + radius);
	const minX = Math.max(0, cx - radius);
	const maxX = Math.min(width - 1, cx + radius);
	const radiusSq = radius * radius;

	for (let y = minY; y <= maxY; y++) {
		for (let x = minX; x <= maxX; x++) {
			const dx = x - cx;
			const dy = y - cy;
			if (dx * dx + dy * dy > radiusSq) {
				continue;
			}
			const idx = (width * y + x) << 2;
			png.data[idx] = clamp(lerp(png.data[idx] ?? 0, color.r, alpha));
			png.data[idx + 1] = clamp(lerp(png.data[idx + 1] ?? 0, color.g, alpha));
			png.data[idx + 2] = clamp(lerp(png.data[idx + 2] ?? 0, color.b, alpha));
		}
	}
};

const warnFallback = (reason: string): void => {
	process.stderr.write(
		`mailfuzz: kittens image fetch failed (${reason}); falling back to local image\n`,
	);
};

const fetchKitten = async (
	width: number,
	height: number,
): Promise<GeneratedImage | undefined> => {
	const url = `${KITTENS_URL}?width=${width}&height=${height}`;

	return fetch(url, { signal: AbortSignal.timeout(KITTENS_TIMEOUT_MS) })
		.then(async (response) => {
			if (!response.ok) {
				warnFallback(`HTTP ${response.status}`);
				return undefined;
			}
			const contentType = response.headers.get("content-type") ?? "image/jpeg";
			const buffer = Buffer.from(await response.arrayBuffer());
			const extension = contentType.includes("png") ? "png" : "jpg";
			return {
				buffer,
				contentType,
				filename: `cat-${Date.now()}.${extension}`,
			};
		})
		.catch((error: unknown) => {
			warnFallback(inspect(error));
			return undefined;
		});
};

const HERO_CID = "hero.image@mailfuzz";

const injectHeroImageTag = (
	html: string,
	cid: string,
	width: number,
): string => {
	const tag = `<img src="cid:${cid}" width="${width}" alt="" style="display:block;width:100%;max-width:${width}px;height:auto;">`;
	if (/<body[^>]*>/i.test(html)) {
		return html.replace(/(<body[^>]*>)/i, `$1\n${tag}`);
	}
	return `${tag}\n${html}`;
};

/**
 * Attach an inline hero image to the HTML of an email, referenced via a
 * `cid:` URL. Mutates the provided content in place. No-op when there is no
 * HTML body.
 */
export const attachHeroImage = async (
	content: EmailContent,
	context: GenerationContext,
	dimensions: { width: number; height: number },
): Promise<void> => {
	if (!content.html) {
		return;
	}

	const image = await getImage({
		faker: context.faker,
		mode: context.imageMode,
		width: dimensions.width,
		height: dimensions.height,
	});

	content.html = injectHeroImageTag(content.html, HERO_CID, dimensions.width);
	content.attachments = [
		...(content.attachments ?? []),
		{
			filename: image.filename,
			contentType: image.contentType,
			content: image.buffer,
			cid: HERO_CID,
		},
	];
};
