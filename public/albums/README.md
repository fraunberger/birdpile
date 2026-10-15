# Your own album files

Drop song files and cover images here, then name them on the album in
`src/lib/hundred-albums/albums.ts`:

```ts
{ artist: "The Beatles", title: "Abbey Road", year: 1969, song: "Here Comes the Sun",
  audio: "here-comes-the-sun.mp3", cover: "abbey-road.jpg" },
```

`audio` plays instead of Apple's 30-second preview, and `cover` shows instead
of Apple's artwork. MP3, M4A, JPG, PNG and WebP all work. Keep names simple:
lowercase, dashes, no spaces.
