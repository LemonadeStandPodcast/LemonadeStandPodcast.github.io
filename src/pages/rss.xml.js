import rss from '@astrojs/rss';
import { getCollection } from 'astro:content';
import { SITE_TITLE, SITE_DESCRIPTION } from '../consts';

export async function GET(context) {
	const episodes = await getCollection('episodes');
	const sortedEpisodes = episodes.sort((a, b) => b.data.episodeNumber - a.data.episodeNumber);

	return rss({
		title: SITE_TITLE,
		description: SITE_DESCRIPTION,
		site: context.site,
		items: sortedEpisodes.map((episode) => ({
			title: episode.data.title,
			pubDate: episode.data.pubDate,
			description: episode.data.description,
			link: `/episodes/${episode.slug}/`,
			customData: `
				<enclosure url="https://img.youtube.com/vi/${episode.data.youtubeId}/maxresdefault.jpg" length="0" type="image/jpeg" />
				<itunes:subtitle>${episode.data.description}</itunes:subtitle>
				<itunes:summary><![CDATA[${episode.data.summary}]]></itunes:summary>
				<itunes:author>The Lemonade Stand Podcast</itunes:author>
				<itunes:explicit>false</itunes:explicit>
				<itunes:duration>00:00:00</itunes:duration>
				<itunes:keywords>${episode.data.tags.join(', ')}</itunes:keywords>
			`,
		})),
		xmlns: {
			itunes: 'http://www.itunes.com/dtds/podcast-1.0.dtd',
			content: 'http://purl.org/rss/1.0/modules/content/'
		},
		customData: `
			<itunes:author>The Lemonade Stand Podcast</itunes:author>
			<itunes:explicit>false</itunes:explicit>
			<itunes:image href="https://example.com/podcast-cover.jpg"/>
			<itunes:owner>
				<itunes:name>The Lemonade Stand Podcast</itunes:name>
				<itunes:email>contact@example.com</itunes:email>
			</itunes:owner>
			<itunes:category text="Business">
				<itunes:category text="Entrepreneurship"/>
			</itunes:category>
		`,
	});
}
