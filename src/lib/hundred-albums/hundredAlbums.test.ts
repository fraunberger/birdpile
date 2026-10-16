import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
    albumAnchor,
    albumKey,
    albumNumber,
    jumpRanges,
    ownFile,
    youtubeVideo,
    type Layout,
} from './list';
import { cleanLyric, parseWriteup } from './writeup';
import {
    albumName,
    findAlbumMedia,
    pickAlbum,
    pickSong,
    sameArtist,
    songName,
    type ItunesItem,
} from './itunes';

const LAYOUT: Layout = { total: 27, countDown: true, jumpSize: 20 };

// ---- the list ---------------------------------------------------------------

test('counts down from the length of the list to No. 1', () => {
    assert.equal(albumNumber(0, LAYOUT), 27);
    assert.equal(albumNumber(26, LAYOUT), 1);
    assert.equal(albumNumber(0, { ...LAYOUT, countDown: false }), 1);
    assert.equal(albumAnchor(0, LAYOUT), 'no-27');
});

test('jump links go 1–20, 21–40, …, each to the first of its range down the page', () => {
    const hundred: Layout = { total: 100, countDown: true, jumpSize: 20 };
    assert.deepEqual(
        jumpRanges(hundred).map((r) => [r.label, albumNumber(r.index, hundred)]),
        [['1–20', 20], ['21–40', 40], ['41–60', 60], ['61–80', 80], ['81–100', 100]],
    );
    // Counting up, each range starts at its smallest number instead.
    const up: Layout = { ...hundred, countDown: false };
    assert.deepEqual(jumpRanges(up).map((r) => albumNumber(r.index, up)), [1, 21, 41, 61, 81]);
    // A short last range, and a range of one.
    assert.deepEqual(jumpRanges(LAYOUT).map((r) => r.label), ['1–20', '21–27']);
    assert.deepEqual(jumpRanges({ total: 21, countDown: true, jumpSize: 20 }).map((r) => r.label), ['1–20', '21']);
});

test('YouTube links are understood however they were copied', () => {
    const id = 'dQw4w9WgXcQ';
    for (const link of [
        id,
        `https://www.youtube.com/watch?v=${id}`,
        `https://youtube.com/watch?v=${id}&list=PL123&index=2`,
        `https://youtu.be/${id}?si=abc123`,
        `youtu.be/${id}`,
        `https://music.youtube.com/watch?v=${id}&feature=share`,
        `https://m.youtube.com/watch?v=${id}`,
        `https://www.youtube.com/embed/${id}`,
        `https://www.youtube.com/shorts/${id}`,
    ]) {
        assert.deepEqual(youtubeVideo(link), { id, start: 0 }, link);
    }
    assert.deepEqual(youtubeVideo(`https://youtu.be/${id}?t=90`), { id, start: 90 });
    assert.deepEqual(youtubeVideo(`https://www.youtube.com/watch?v=${id}&t=1m30s`), { id, start: 90 });
    for (const link of [undefined, '', 'https://vimeo.com/123', 'https://www.youtube.com/watch?v=short', 'not a link']) {
        assert.equal(youtubeVideo(link), null, String(link));
    }
});

test('album keys ignore case, accents and punctuation', () => {
    assert.equal(
        albumKey({ artist: 'Bon Iver', title: '22, A Million', song: '8 (circle)' }),
        'bon-iver~22-a-million~8-circle',
    );
    assert.equal(
        albumKey({ artist: 'Beyoncé', title: "Lemonade", song: "Don't Hurt Yourself" }),
        'beyonce~lemonade~dont-hurt-yourself',
    );
});

test('own files are looked for in public/albums unless given a path or URL', () => {
    assert.equal(ownFile('blackbird.mp3'), '/albums/blackbird.mp3');
    assert.equal(ownFile('Here Comes The Sun.mp3'), '/albums/Here%20Comes%20The%20Sun.mp3');
    assert.equal(ownFile('/music/a.mp3'), '/music/a.mp3');
    assert.equal(ownFile('https://example.com/a.jpg'), 'https://example.com/a.jpg');
    assert.equal(ownFile(undefined), null);
    assert.equal(ownFile(''), null);
});

// ---- write-ups --------------------------------------------------------------

test('write-ups split on blank lines and join wrapped lines', () => {
    const paragraphs = parseWriteup(`
        First line
        still the first paragraph.

        Second *with italics*, **bold** and a [link](https://example.com).
    `);
    assert.equal(paragraphs.length, 2);
    assert.deepEqual(paragraphs[0], [{ kind: 'text', text: 'First line still the first paragraph.' }]);
    assert.deepEqual(paragraphs[1], [
        { kind: 'text', text: 'Second ' },
        { kind: 'em', text: 'with italics' },
        { kind: 'text', text: ', ' },
        { kind: 'strong', text: 'bold' },
        { kind: 'text', text: ' and a ' },
        { kind: 'link', text: 'link', href: 'https://example.com' },
        { kind: 'text', text: '.' },
    ]);
});

test('links that are not web or mail addresses stay plain text', () => {
    assert.deepEqual(parseWriteup('[click](javascript:alert(1))')[0][0], { kind: 'text', text: 'click' });
});

test('link addresses can hold parentheses, like Wikipedia album pages', () => {
    assert.deepEqual(parseWriteup('Read [this](https://en.wikipedia.org/wiki/Help!_(album)) first.')[0], [
        { kind: 'text', text: 'Read ' },
        { kind: 'link', text: 'this', href: 'https://en.wikipedia.org/wiki/Help!_(album)' },
        { kind: 'text', text: ' first.' },
    ]);
    assert.deepEqual(parseWriteup('[x](https://a.com/b) (aside)')[0][1], { kind: 'text', text: ' (aside)' });
});

test('lyrics lose indentation and typed quote marks but keep their line breaks', () => {
    assert.equal(cleanLyric(`
        Here comes the sun
        and I say
    `), 'Here comes the sun\nand I say');
    assert.equal(cleanLyric('"Blackbird singing in the dead of night"'), 'Blackbird singing in the dead of night');
    assert.equal(cleanLyric('\u201cIn my life\u201d'), 'In my life');
    assert.equal(cleanLyric('She said "hello" to me'), 'She said "hello" to me');
});

test('an empty write-up has no paragraphs', () => {
    assert.deepEqual(parseWriteup('   \n\n  '), []);
});

// ---- matching Apple Music results -------------------------------------------

function track(trackName: string, collectionName: string, extra: Partial<ItunesItem> = {}): ItunesItem {
    return {
        wrapperType: 'track',
        kind: 'song',
        artistName: 'The Beatles',
        trackName,
        collectionName,
        collectionId: collectionName.length,
        previewUrl: `https://audio.example/${encodeURIComponent(trackName)}-${encodeURIComponent(collectionName)}.m4a`,
        artworkUrl100: `https://art.example/${encodeURIComponent(collectionName)}/100x100bb.jpg`,
        collectionViewUrl: `https://music.apple.com/album/${encodeURIComponent(collectionName)}`,
        ...extra,
    };
}

function album(collectionName: string, extra: Partial<ItunesItem> = {}): ItunesItem {
    return {
        wrapperType: 'collection',
        collectionType: 'Album',
        artistName: 'The Beatles',
        collectionName,
        collectionId: collectionName.length,
        artworkUrl100: `https://art.example/${encodeURIComponent(collectionName)}/100x100bb.jpg`,
        collectionViewUrl: `https://music.apple.com/album/${encodeURIComponent(collectionName)}`,
        ...extra,
    };
}

test('song names drop release notes but keep real brackets', () => {
    assert.equal(songName('Come Together (Remastered 2009)'), 'come together');
    assert.equal(songName('Here Comes the Sun - 2019 Mix'), 'here comes the sun');
    assert.equal(songName('Never Be Like You (feat. Kai)'), 'never be like you');
    assert.equal(songName('8 (circle)'), '8 circle');
    assert.equal(songName("Holdin' On"), 'holdin on');
    assert.equal(albumName('The Beatles (White Album) [Remastered]'), 'the beatles');
    assert.equal(albumName('Jewel - Single'), 'jewel');
    assert.equal(albumName('Flume: Deluxe Edition'), 'flume');
    assert.equal(albumName('Sgt. Pepper: The Movie'), 'sgt pepper the movie');
});

test('artist credits match with or without "The" and with guests', () => {
    assert.ok(sameArtist('Beatles', 'The Beatles'));
    assert.ok(sameArtist('Flume & Chet Faker', 'Flume'));
    assert.ok(!sameArtist('Bonnie Raitt', 'Bon Iver'));
    assert.ok(!sameArtist(undefined, 'Flume'));
});

test('the studio track on the right album beats live takes and compilations', () => {
    const query = { artist: 'The Beatles', album: 'The Beatles', song: 'Blackbird' };
    const picked = pickSong(
        [
            track('Blackbird (Live)', 'Live at the BBC'),
            track('Blackbird', '1967-1970'),
            track('Blackbird (Take 28)', 'The Beatles (Super Deluxe)'),
            track('Blackbird (Remastered 2009)', 'The Beatles (White Album) [Remastered]'),
            track('Blackbird', 'Blackbird', { artistName: 'Some Tribute Band' }),
        ],
        query,
    );
    assert.equal(picked?.collectionName, 'The Beatles (White Album) [Remastered]');
});

test('the plainest edition of an album wins', () => {
    const query = { artist: 'The Beatles', album: 'Abbey Road', song: '' };
    const picked = pickAlbum(
        [
            album('Abbey Road (Super Deluxe Edition)'),
            album('Abbey Road (Remastered)'),
            album('Abbey Road (Live Tribute)', { artistName: 'The Beatles Revival' }),
            album('Beatles for Sale'),
        ],
        query,
    );
    assert.equal(picked?.collectionName, 'Abbey Road (Remastered)');
});

test('a song found on its album needs one request for both cover and preview', async () => {
    const urls: string[] = [];
    const media = await findAlbumMedia({ artist: 'The Beatles', album: 'Abbey Road', song: 'Here Comes the Sun' }, async (url) => {
        urls.push(url);
        return [track('Here Comes the Sun (2019 Mix)', 'Abbey Road (Super Deluxe Edition)'), track('Here Comes the Sun', 'Abbey Road (Remastered)')];
    });
    assert.equal(urls.length, 1);
    assert.match(urls[0], /entity=song/);
    assert.equal(media.cover, 'https://art.example/Abbey%20Road%20(Remastered)/1200x1200bb.jpg');
    assert.equal(media.thumb, 'https://art.example/Abbey%20Road%20(Remastered)/300x300bb.jpg');
    assert.equal(media.previewTitle, 'Here Comes the Sun');
    assert.ok(media.preview);
});

test('a song found only on a compilation still plays, with the album searched for its cover', async () => {
    const media = await findAlbumMedia({ artist: 'The Beatles', album: 'Let It Be', song: 'Let It Be' }, async (url) =>
        url.includes('entity=song') ? [track('Let It Be', '1'), track('Let It Be', 'Love')] : [album('Let It Be (Remastered)')],
    );
    assert.equal(media.previewTitle, 'Let It Be');
    assert.match(media.preview ?? '', /-1\.m4a$/);
    assert.equal(media.cover, 'https://art.example/Let%20It%20Be%20(Remastered)/1200x1200bb.jpg');
    assert.equal(media.appleUrl, 'https://music.apple.com/album/Let%20It%20Be%20(Remastered)');
});

test('a song that cannot be found falls back to a preview from the album', async () => {
    const media = await findAlbumMedia({ artist: 'The Beatles', album: 'Revolver', song: 'Not A Real Song' }, async (url) => {
        if (url.includes('/lookup')) return [album('Revolver (Remastered)'), track('Taxman', 'Revolver (Remastered)')];
        if (url.includes('entity=album')) return [album('Revolver (Remastered)')];
        return [track('Eleanor Rigby', 'Revolver (Remastered)')];
    });
    assert.equal(media.previewTitle, 'Taxman');
    assert.ok(media.cover);
});

test('nothing found means nulls, not a wrong album', async () => {
    const media = await findAlbumMedia({ artist: 'Nobody', album: 'Nothing', song: 'Silence' }, async () => [
        track('Silence', 'Something Else'),
        album('Nothing Like It'),
    ]);
    assert.deepEqual(media, { cover: null, thumb: null, preview: null, previewTitle: null, appleUrl: null });
});
