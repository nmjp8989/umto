# Little Panth video export

In GitHub Actions, open **Render Little Panth episode**, choose **Run workflow**, and select the episode. Mission 1 exports at 1920 × 1080, 30 fps, with H.264 video, AAC Punjabi audio and music, a PNG thumbnail, and English SRT captions. Download the `little-panth-mission-001-youtube` artifact from the completed run. Upload the files through YouTube Studio after reviewing playback.

Five jobs capture sections of the same Watch mode in parallel. `tools/little-panth-export.cjs` uses Chrome, Xvfb, PulseAudio, and FFmpeg. The episode provides a chapter entry point and stop boundary in `?export=1` mode. The normal Play and Watch buttons continue to use the interactive flow.

To add an episode, expose the same export API (ready, start, and status), configure its chapter boundaries and thumbnail cue, and add its folder ID to the workflow choices.
