const vosk = require('vosk');
const fs = require('fs-extra');
const { spawn } = require('child_process');
const path = require('path');

const MODEL_PATH = 'model'; // Replace with the actual path to your Vosk model
const SAMPLE_RATE = 16000;
const BUFFER_SIZE = 4000;

if (!fs.existsSync(MODEL_PATH)) {
    console.error(`Please download the model from https://alphacephei.com/vosk/models and unpack as ${MODEL_PATH} in the current folder.`);
    process.exit();
}

vosk.setLogLevel(0);
const model = new vosk.Model(MODEL_PATH);

function transcribeAudio(filePath) {
    return new Promise((resolve, reject) => {
        const recognizer = new vosk.Recognizer({ model: model, sampleRate: SAMPLE_RATE });

        const ffmpeg = spawn('ffmpeg', [
            '-loglevel', 'quiet',
            '-i', filePath,
            '-ar', String(SAMPLE_RATE),
            '-ac', '1',
            '-f', 's16le',
            '-bufsize', String(BUFFER_SIZE),
            '-'
        ]);

        let result = '';

        ffmpeg.stdout.on('data', (stdout) => {
            if (recognizer.acceptWaveform(stdout)) {
                result += recognizer.result().text + ' ';
            } else {
                result += recognizer.partialResult().partial + ' ';
            }
        });

        ffmpeg.stdout.on('end', () => {
            result += recognizer.finalResult().text;
            resolve(result.trim());
            recognizer.free();
        });

        ffmpeg.stdout.on('error', (err) => {
            reject(err);
            recognizer.free();
        });

        ffmpeg.stderr.on('data', (data) => {
            console.error(`FFmpeg stderr: ${data}`);
        });
    });
}

async function main() {
    const videoPath = 'video.mp4'; // Replace with the actual path to your video file
    const audioPath = path.join(__dirname, 'audio.wav');

    try {
        console.log('Extracting audio from video...');
        await extractAudio(videoPath, audioPath);

        console.log('Transcribing audio...');
        const transcription = await transcribeAudio(audioPath);
        console.log('Transcription:', transcription);

        // Clean up
        await fs.remove(audioPath);
    } catch (error) {
        console.error('Error:', error);
    }
}

function extractAudio(videoPath, audioPath) {
    return new Promise((resolve, reject) => {
        const ffmpeg = spawn('ffmpeg', [
            '-i', videoPath,
            '-t', '20',
            '-vn', // No video
            '-acodec', 'pcm_s16le',
            '-ac', '1', // Mono channel
            '-ar', '16000', // 16 kHz
            audioPath
        ]);

        ffmpeg.stderr.on('data', (data) => {
            console.error(`FFmpeg stderr: ${data}`);
        });

        ffmpeg.on('close', (code) => {
            if (code === 0) {
                resolve();
            } else {
                reject(new Error(`FFmpeg process exited with code ${code}`));
            }
        });
    });
}

main();
