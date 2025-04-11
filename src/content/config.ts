import { defineCollection, z } from 'astro:content';

const episodes = defineCollection({
	type: 'content',
	schema: z.object({
		title: z.string(),
		description: z.string(),
		pubDate: z.coerce.date(),
		updatedDate: z.coerce.date().optional(),
		youtubeId: z.string(),
		episodeNumber: z.number(),
		tags: z.array(z.string()),
		citations: z.array(z.object({
			title: z.string(),
			url: z.string().url()
		 })).optional(), // Made citations optional
		summary: z.string().optional(),
		heroImage: z.string().optional(),
	}),
});

export const collections = { episodes };
