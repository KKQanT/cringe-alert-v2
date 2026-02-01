import subprocess
import os

async def convert_webm_to_mp4(input_path: str, output_path: str) -> str:
    """
    Convert WebM video to MP4 using FFmpeg.
    Returns the path to the output file.
    """
    if not os.path.exists(input_path):
        raise FileNotFoundError(f"Input file not found: {input_path}")

    # FFmpeg command: -i input -c:v libx264 -c:a aac -strict experimental output
    # -y overwrites output file
    cmd = [
        "ffmpeg",
        "-i", input_path,
        "-c:v", "libx264",
        "-c:a", "aac", 
        "-y",
        output_path
    ]

    print(f"Running conversion: {' '.join(cmd)}")
    
    try:
        subprocess.run(cmd, check=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    except subprocess.CalledProcessError as e:
        print(f"FFmpeg error: {e.stderr.decode()}")
        raise RuntimeError("Failed to convert video") from e

    return output_path
