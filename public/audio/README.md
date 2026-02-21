# Music Files Directory

This directory contains the music files for synchronized playback in Music Club.

## Adding Music Files

### Step 1: Add MP3 Files

Place your MP3 music files in this directory (`public/audio/`). The files should match the filenames specified in `playlist.json`.

**Supported Format:** MP3 (.mp3)

### Step 2: Update playlist.json

Edit `playlist.json` to configure your tracks. Each track requires the following fields:

```json
{
  "title": "Song Title",
  "artist": "Artist Name",
  "filename": "your-file.mp3",
  "duration": 180
}
```

**Field Descriptions:**
- `title`: The song title displayed to users
- `artist`: The artist name displayed to users
- `filename`: The MP3 filename (must match the file in this directory)
- `duration`: Song duration in seconds (used for progress tracking)

### Step 3: Get Track Duration

To find the duration of your MP3 files, you can:
- Use a media player (VLC, Windows Media Player, etc.)
- Use an online MP3 duration tool
- Use ffprobe: `ffprobe -i your-file.mp3 -show_entries format=duration -v quiet -of csv="p=0"`

### Example playlist.json

```json
{
  "tracks": [
    {
      "title": "Electric Dreams",
      "artist": "Neon Skyline",
      "filename": "electric-dreams.mp3",
      "duration": 203
    },
    {
      "title": "Midnight Groove",
      "artist": "The Funkateers",
      "filename": "midnight-groove.mp3",
      "duration": 185
    }
  ]
}
```

## Music Licensing

**IMPORTANT:** Only use music that you have the rights to use. Options include:

- **Royalty-free music** from sites like:
  - Free Music Archive
  - Incompetech
  - YouTube Audio Library
  - Bensound

- **Creative Commons** licensed music (check attribution requirements)

- **Music you own** the rights to distribute

- **Public domain** music

Do not use copyrighted music without proper licensing!

## Current Playlist

The current `playlist.json` contains placeholder track entries. You need to add the actual MP3 files to make them playable. The playlist will loop automatically once all tracks have played.

## Troubleshooting

**Music not playing?**
- Verify MP3 files are in `public/audio/` directory
- Check that filenames in `playlist.json` match the actual files exactly (case-sensitive)
- Ensure files are valid MP3 format
- Check browser console for audio loading errors

**Sync issues?**
- Verify the `duration` field matches the actual track length
- Inaccurate durations can cause sync problems during track transitions
