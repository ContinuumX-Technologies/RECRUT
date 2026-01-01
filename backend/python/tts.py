import sys
import asyncio
import edge_tts

# --- CONFIGURATION ---
# Select one of the following Indian English voices:

# Option 1: Female (Indian Accent) - Recommended
VOICE = "en-IN-NeerjaNeural"

# Option 2: Male (Indian Accent)
# VOICE = "en-IN-PrabhatNeural"

async def generate_audio(text):
    """
    Generates audio stream from text using Edge TTS (Free).
    """
    communicate = edge_tts.Communicate(text, VOICE)
    
    # Stream audio chunk by chunk to stdout
    async for chunk in communicate.stream():
        if chunk["type"] == "audio":
            sys.stdout.buffer.write(chunk["data"])

if __name__ == "__main__":
    # 1. Get text from command line arguments
    if len(sys.argv) < 2:
        print("Error: No text provided", file=sys.stderr)
        sys.exit(1)
        
    text_to_speak = sys.argv[1]
    
    # 2. Run the async generation
    try:
        asyncio.run(generate_audio(text_to_speak))
    except Exception as e:
        print(f"Error: {e}", file=sys.stderr)
        sys.exit(1)