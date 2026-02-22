#!/usr/bin/env python3
"""
Create placeholder MP3 files for the music club.
These are minimal valid MP3 files with silence that can be replaced with actual music later.
"""

import struct
import os

def create_mp3_header(bitrate=128, sample_rate=44100):
    """
    Create a minimal valid MP3 frame header.
    Uses MPEG-1 Layer III, 128kbps, 44.1kHz, mono
    """
    # MP3 frame sync word (11 bits of 1)
    sync = 0xFFE

    # MPEG version: 11 = MPEG-1
    version = 0x3

    # Layer: 01 = Layer III
    layer = 0x1

    # Protection bit: 1 = no CRC
    protection = 0x1

    # Bitrate index: 1001 = 128 kbps for MPEG-1 Layer III
    bitrate_idx = 0x9

    # Sampling rate: 00 = 44100 Hz
    sample_rate_idx = 0x0

    # Padding bit: 0
    padding = 0x0

    # Private bit: 0
    private = 0x0

    # Channel mode: 11 = mono
    channel = 0x3

    # Mode extension: 00
    mode_ext = 0x0

    # Copyright: 0
    copyright = 0x0

    # Original: 0
    original = 0x0

    # Emphasis: 00
    emphasis = 0x0

    # Build the 4-byte header
    header = (sync << 20) | (version << 18) | (layer << 16) | (protection << 15)
    header |= (bitrate_idx << 11) | (sample_rate_idx << 9) | (padding << 8) | (private << 7)
    header |= (channel << 5) | (mode_ext << 3) | (copyright << 2) | (original << 1) | emphasis

    return struct.pack('>I', header)

def create_placeholder_mp3(filename, duration_seconds):
    """
    Create a minimal MP3 file with the specified duration.
    The file will be silent but valid for playback.
    """
    # Frame size for 128kbps at 44.1kHz: (144 * bitrate / sample_rate) = 417 bytes
    frame_size = 417

    # MP3 frame duration is 26ms (1152 samples / 44100 Hz)
    frame_duration = 0.026

    # Calculate number of frames needed
    num_frames = int(duration_seconds / frame_duration)

    # Create the file
    with open(filename, 'wb') as f:
        # Write ID3v2 header (minimal, optional but common)
        # ID3v2.3.0 with no flags and zero size
        f.write(b'ID3\x03\x00\x00\x00\x00\x00\x00')

        # Write MP3 frames
        for i in range(num_frames):
            # Write frame header
            header = create_mp3_header()
            f.write(header)

            # Write frame data (silence = all zeros)
            # Frame size minus header (4 bytes)
            f.write(b'\x00' * (frame_size - 4))

def main():
    """Create all placeholder music files."""

    # Track info from playlist.json
    tracks = [
        ("electric-dreams.mp3", 203),
        ("midnight-groove.mp3", 185),
        ("cosmic-voyage.mp3", 247),
        ("urban-pulse.mp3", 192),
        ("sunset-boulevard.mp3", 218),
        ("digital-horizons.mp3", 234)
    ]

    # Ensure output directory exists
    output_dir = "public/audio"
    os.makedirs(output_dir, exist_ok=True)

    # Create each file
    for filename, duration in tracks:
        filepath = os.path.join(output_dir, filename)
        print(f"Creating {filename} ({duration}s)...")
        create_placeholder_mp3(filepath, duration)

        # Verify file was created
        if os.path.exists(filepath):
            size_kb = os.path.getsize(filepath) / 1024
            print(f"  ✓ Created {filename} ({size_kb:.1f} KB)")
        else:
            print(f"  ✗ Failed to create {filename}")

    print("\nAll placeholder MP3 files created successfully!")
    print("\nNOTE: These are silent placeholder files. Replace them with actual")
    print("music tracks for the full experience. See public/audio/README.md")
    print("for instructions on adding real music files.")

if __name__ == "__main__":
    main()
