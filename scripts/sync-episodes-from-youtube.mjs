#!/usr/bin/env node

import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { promises as fs } from 'node:fs';
import path from 'node:path';

const execFileAsync = promisify(execFile);
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const PODCASTS_URL = 'https://www.youtube.com/@LemonadeStandPodcast/podcasts';
const ROOT_DIR = process.cwd();
const EPISODES_DIR = path.join(ROOT_DIR, 'src', 'content', 'episodes');

const args = new Set(process.argv.slice(2));
const verbose = args.has('--verbose');
const isWrite = args.has('--write');

/**
 * Convert any value to a JSON-escaped string suitable for YAML scalar usage.
 */
function toYamlString(value) {
  return JSON.stringify(String(value ?? ''));
}

/**
 * Build a filesystem-friendly slug from arbitrary title text.
 */
function slugify(input) {
  return String(input)
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9\s-]/g, '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
}

/**
 * Remove brand suffixes and normalize a YouTube title for site content.
 */
function cleanTitle(rawTitle) {
  const title = String(rawTitle ?? '').trim();
  if (!title) return 'Episode Title';
  return title.replace(/\s*\|\s*Lemonade Stand.*$/i, '').trim();
}

/**
 * Derive a short description suitable for frontmatter from a long YouTube description.
 */
function inferDescription(rawDescription, fallbackTitle, episodeNumber) {
  const text = String(rawDescription ?? '');
  const lines = text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

  // Strategy 1: Look for a line explicitly mentioning "this week" or "on this week's".
  // Podcast descriptions often start the real content with "On this week's episode..."
  const weekLine = lines.find((line) => /\bweEk\b/i.test(line));

  if (weekLine) {
    // Return the full line/paragraph, typically the best summary.
    const clean = weekLine.replace(/\s+/g, ' ').trim();
    if (clean.length <= 300) return clean;
    return `${clean.slice(0, 297).trimEnd()}...`;
  }

  // Strategy 2: Use the first non-empty line if no "week" keyword found.
  const firstLine = lines[0] || `Lemonade Stand podcast episode ${episodeNumber}: ${fallbackTitle}.`;
  
  // Strategy 3: Just return the first paragraph/line, cleaned up.
  const condensed = firstLine.replace(/\s+/g, ' ').trim();
  if (condensed.length <= 300) return condensed;
  return `${condensed.slice(0, 297).trimEnd()}...`;
}

/**
 * Build a non-empty summary string from episode metadata.
 */
function inferSummary(title, description, episodeNumber) {
  const cleanedTitle = String(title ?? '').trim() || 'Episode';
  
  // If description is just the default fallback, use title.
  // Otherwise use the description we inferred.
  const core = description && description !== `Lemonade Stand podcast episode ${episodeNumber}: ${cleanedTitle}.`
    ? description
    : cleanedTitle;

  const base = Number.isInteger(episodeNumber)
    ? `Episode ${episodeNumber}: ${core}`
    : core;

  const normalized = base.endsWith('.') ? base : `${base}.`;
  if (normalized.length <= 300) return normalized;
  return `${normalized.slice(0, 297).trimEnd()}...`;
}

/**
 * Convert YouTube upload date format (YYYYMMDD) or ISO-like to ISO date format (YYYY-MM-DD).
 */
function formatDate(uploadDate) {
  const text = String(uploadDate ?? '');
  // YYYYMMDD
  if (/^\d{8}$/.test(text)) {
    return `${text.slice(0, 4)}-${text.slice(4, 6)}-${text.slice(6, 8)}`;
  }
  // Already somewhat ISO?
  if (/^\d{4}-\d{2}-\d{2}/.test(text)) {
    return text.slice(0, 10);
  }
  return null;
}

/**
 * Execute yt-dlp with explicit arguments and parse a single JSON object from stdout.
 */
async function runYtDlpArgs(ytArgs) {
  if (verbose) {
    console.log(`Running: yt-dlp ${ytArgs.join(' ')}`);
  }

  try {
    const { stdout } = await execFileAsync('yt-dlp', ytArgs, { maxBuffer: 1024 * 1024 * 10 });
    return JSON.parse(stdout);
  } catch (error) {
    if (verbose) console.error('yt-dlp error:', error);
    throw error;
  }
}

/**
 * Fetch full details for a single video ID using Android client to bypass some restrictions.
 */
async function fetchVideoDetails(videoId) {
  // Use Android client to get around some 403s on server-side requests
  const args = [
    '--skip-download',
    '--dump-single-json',
    '--no-warnings',
    '--extractor-args', 'youtube:player_client=android',
    `https://www.youtube.com/watch?v=${videoId}`
  ];
  return runYtDlpArgs(args);
}

/**
 * Resolve podcast tab metadata to a flat list of playable episode entries.
 * Returns minimal info: id, title, position in playlist.
 */
async function getPodcastEntries() {
  const initial = await runYtDlpArgs([
    '--skip-download',
    '--flat-playlist',
    '--dump-single-json',
    '--ignore-errors',
    '--no-warnings',
    PODCASTS_URL,
  ]);

  let entries = Array.isArray(initial.entries) ? initial.entries : [];

  // Handle channel tab resolving to a playlist URL
  if (entries.length === 1 && entries[0]?._type === 'url' && /playlist\?list=/i.test(entries[0].url || '')) {
    const playlistData = await runYtDlpArgs([
      '--skip-download',
      '--flat-playlist',
      '--dump-single-json',
      '--ignore-errors',
      '--no-warnings',
      entries[0].url,
    ]);
    entries = Array.isArray(playlistData.entries) ? playlistData.entries : [];
  }

  return entries
    .filter((entry) => entry && entry.id)
    .map((entry, index, list) => ({
      id: String(entry.id),
      title: String(entry.title || ''),
      // Playlist is newest-first (usually). infer canonical order from reverse index.
      inferredOrder: list.length - index,
      upload_date: null, // Will be filled later
      description: null, // Will be filled later
    }));
}

/**
 * Read existing markdown episodes and index them.
 */
async function readExistingEpisodes() {
  try {
    await fs.mkdir(EPISODES_DIR, { recursive: true });
    const files = await fs.readdir(EPISODES_DIR);
    const markdownFiles = files.filter((f) => f.endsWith('.md'));

    const byYoutubeId = new Map();
    const usedSlugs = new Set();
    const withMeta = [];

    for (const fileName of markdownFiles) {
      const filePath = path.join(EPISODES_DIR, fileName);
      const content = await fs.readFile(filePath, 'utf8');
      
      const getVal = (k) => {
        const m = content.match(new RegExp(`^${k}:\\s*(.+)$`, 'm'));
        if (!m) return null;
        const raw = m[1].trim();
        const q = raw.match(/^"([\s\S]*)"$/) || raw.match(/^'([\s\S]*)'$/);
        return q ? q[1] : raw;
      };

      const id = getVal('youtubeId');
      const epNum = Number(getVal('episodeNumber'));
      const uploadDate = getVal('pubDate');

      // Base slug on filename minus extension
      const slug = fileName.replace(/\.md$/, '');
      usedSlugs.add(slug);

      if (id) {
        byYoutubeId.set(id, { fileName, episodeNumber: isNaN(epNum) ? null : epNum, uploadDate, content });
      }

      withMeta.push({ fileName, id, episodeNumber: isNaN(epNum) ? null : epNum, uploadDate });
    }

    return { byYoutubeId, usedSlugs, withMeta };
  } catch (err) {
    if (err.code === 'ENOENT') {
      return { byYoutubeId: new Map(), usedSlugs: new Set(), withMeta: [] };
    }
    throw err;
  }
}

/**
 * Ensure a slug is unique.
 */
function makeUniqueSlug(baseSlug, youtubeId, usedSlugs) {
  if (!usedSlugs.has(baseSlug)) {
    usedSlugs.add(baseSlug);
    return baseSlug;
  }
  const withId = `${baseSlug}-${youtubeId.toLowerCase()}`;
  if (!usedSlugs.has(withId)) {
    usedSlugs.add(withId);
    return withId;
  }
  let counter = 2;
  while (usedSlugs.has(`${withId}-${counter}`)) counter += 1;
  const final = `${withId}-${counter}`;
  usedSlugs.add(final);
  return final;
}

/**
 * Build markdown content.
 */
function buildMarkdown(entry) {
  const cleanedTitle = cleanTitle(entry.title);
  // Only use current date if we have it, otherwise fallback. But we aim to fetch it.
  const pubDate = formatDate(entry.upload_date) || '1970-01-01'; 
  const description = inferDescription(entry.description, cleanedTitle, entry.episodeNumber);
  const summary = inferSummary(cleanedTitle, description, entry.episodeNumber);

  return [
    '---',
    `title: ${toYamlString(cleanedTitle)}`,
    `description: ${toYamlString(description)}`,
    `pubDate: ${pubDate}`,
    `youtubeId: ${toYamlString(entry.id)}`,
    `episodeNumber: ${entry.episodeNumber}`,
    `summary: ${toYamlString(summary)}`,
    'tags:',
    '  - "Lemonade Stand"',
    '  - "Podcast"',
    '---',
    '',
  ].join('\n');
}

/**
 * Assign episode numbers to playlist entries.
 * Uses existing file numbers if matched, or infers from order.
 */
function assignEpisodeNumbers(entries) {
  // We just use inferredOrder for now, since the playlist is reliable.
  return entries.map(e => ({ ...e, episodeNumber: e.inferredOrder }));
}

async function main() {
  console.log(`Starting sync... (Write mode: ${isWrite})`);
  
  const [entries, existing] = await Promise.all([
    getPodcastEntries(),
    readExistingEpisodes(),
  ]);

  if (!entries.length) {
    throw new Error('No podcast entries were found from YouTube.');
  }

  // Assign numbers based on playlist position
  const assigned = assignEpisodeNumbers(entries);
  
  // Identify episodes that need full details fetched.
  // 1. New episodes (not in existing.byYoutubeId)
  // 2. Existing episodes with missing/invalid pubDate
  const needsDetails = [];
  let fullAssigned = [...assigned];
  
  for (const entry of assigned) {
    const existingFile = existing.byYoutubeId.get(entry.id);
    if (!existingFile) {
      needsDetails.push(entry);
    } else {
      // Check if existing file has bad date
      // Treat "1970-01-01" as bad. Empty string as bad.
      if (!existingFile.uploadDate || existingFile.uploadDate === '1970-01-01') {
        needsDetails.push(entry);
      }
    }
  }

  console.log(`Found ${assigned.length} total episodes.`);
  console.log(`${existing.byYoutubeId.size} exist locally.`);
  console.log(`${needsDetails.length} episodes require metadata fetch (new or missing date).`);

  // Fetch details sequentially to avoid rate limits
  if (needsDetails.length > 0) {
    console.log(`Fetching details for ${needsDetails.length} videos...`);
    for (let i = 0; i < needsDetails.length; i++) {
        // Find the entry within fullAssigned that matches needsDetails[i].id
        const originalEntry = fullAssigned.find(e => e.id === needsDetails[i].id);
        if (!originalEntry) continue;

        try {
            if (i > 0) process.stdout.write('.'); // Progress dot
            else process.stdout.write('Fetching: ');
            
            // Rate limit delay (longer delay to be safe)
            await sleep(2000); 
            
            const details = await fetchVideoDetails(originalEntry.id);
            
            // Update the entry object in place
            if (details) {
                originalEntry.upload_date = details.upload_date;
                originalEntry.description = details.description;
            }
        } catch (err) {
            console.error(`\nFailed to fetch details for ${originalEntry.id}:`, err.message);
        }
    }
    console.log('\nFetch complete.');
  }

  const ops = [];

  for (const entry of fullAssigned) {
    const existingFile = existing.byYoutubeId.get(entry.id);
    
    // Construct new content
    const newContent = buildMarkdown(entry);
    
    if (existingFile) {
      // Compare content (normalized newlines, trimmed).
      const oldC = existingFile.content.replace(/\r\n/g, '\n').trim();
      const newC = newContent.replace(/\r\n/g, '\n').trim();
      
      if (oldC !== newC) {
        ops.push({
          type: 'update',
          entry,
          filePath: path.join(EPISODES_DIR, existingFile.fileName),
          content: newContent,
          reason: 'Metadata update/correction'
        });
      }
    } else {
      // Create new
      const baseSlug = slugify(cleanTitle(entry.title)) || `episode-${entry.episodeNumber}`;
      const slug = makeUniqueSlug(baseSlug, entry.id, existing.usedSlugs);
      const fileName = `${slug}.md`;
      
      ops.push({
        type: 'create',
        entry,
        filePath: path.join(EPISODES_DIR, fileName),
        content: newContent,
        reason: 'New episode'
      });
    }
  }

  if (ops.length === 0) {
    console.log('All episodes are up to date.');
    return;
  }

  console.log(`\nProposed changes (${ops.length} files):`);
  for (const op of ops) {
    const symbol = op.type === 'create' ? '+' : 'M';
    console.log(`${symbol} ${path.basename(op.filePath)} (${op.reason})`);
  }

  if (isWrite) {
    console.log('\nWriting changes to disk...');
    for (const op of ops) {
      await fs.writeFile(op.filePath, op.content, 'utf8');
      console.log(`Wrote ${path.basename(op.filePath)}`);
    }
    console.log(`\nSuccessfully updated ${ops.length} files.`);
  } else {
    console.log('\nDry run complete. Use --write to apply changes.');
  }
}

main().catch((error) => {
  console.error(error?.message || error);
  process.exitCode = 1;
});
