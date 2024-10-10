const express = require('express')
const path = require('path')
const { get } = require('request')
const multer = require('multer');
const fs = require('fs-extra');
const vosk = require('vosk');
const { spawn } = require('child_process');
// firebase



const app = express()

app.use(express.json())
app.use(express.urlencoded({ extended: true }))

const viewsDir = path.join(__dirname, 'views')
app.use(express.static(viewsDir))
app.use(express.static(path.join(__dirname, './public')))
app.use(express.static(path.join(__dirname, '../images')))
app.use(express.static(path.join(__dirname, '../media')))
app.use(express.static(path.join(__dirname, '../../weights')))
app.use(express.static(path.join(__dirname, '../../dist')))
const MODEL_PATH = 'model';
const SAMPLE_RATE = 16000;
const BUFFER_SIZE = 4000;

if (!fs.existsSync(MODEL_PATH)) {
    console.error(`Please download the model from https://alphacephei.com/vosk/models and unpack as ${MODEL_PATH} in the current folder.`);
    process.exit();
}

vosk.setLogLevel(0);
const model = new vosk.Model(MODEL_PATH);

const storage = multer.diskStorage({
    
    destination: (req, file, cb) => {
        const uploadDir = path.join(__dirname, 'uploads');
        fs.ensureDir(uploadDir, err => {
            if (err) {
                console.error('Error creating upload directory:', err);
            }
            cb(null, uploadDir);
        });
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + '-' + file.originalname);
      }
});

const upload = multer({ storage: storage });
app.post('/upload', upload.single('video'), async (req, res) => {
  const videoPath = req.file.path;
  const audioPath = path.join(__dirname, 'uploads', 'audio.wav');

  try {
      await extractAudio(videoPath, audioPath);
      const transcription = await transcribeAudio(audioPath);
      res.json({ transcription });

      // Clean up
      await fs.remove(videoPath);
      await fs.remove(audioPath);
  } catch (error) {
      console.error('Error:', error);
      res.status(500).send('Internal Server Error');
  }
});

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

app.get('/', (req, res) => res.sendFile(path.join(viewsDir, 'auth.html')))
app.get('/bot', (req, res) => res.sendFile(path.join(viewsDir, 'chatbot.html')))


app.listen(4000, () => console.log('Listening on port 3000!'))

