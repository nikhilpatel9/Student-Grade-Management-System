const express = require('express');
const mongoose = require('mongoose');
const multer = require('multer');
const XLSX = require('xlsx');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// MongoDB connection
const MONGODB_URI = process.env.MONGODB_URI || 
                    process.env.MONGODB_URL || 
                    process.env.MONGO_URL ||
                    'mongodb://localhost:27017/student-grades';

mongoose.connect(MONGODB_URI)
  .then(() => console.log('Connected to MongoDB'))
  .catch(err => console.error('MongoDB connection error:', err));

// Schemas and Models (same as before)
const studentSchema = new mongoose.Schema({
  student_id: { type: String, required: true, unique: true },
  student_name: { type: String, required: true },
  total_marks: { type: Number, required: true },
  marks_obtained: { type: Number, required: true },
  percentage: { type: Number, required: true },
  created_at: { type: Date, default: Date.now }
});

const Student = mongoose.model('Student', studentSchema);

const uploadHistorySchema = new mongoose.Schema({
  filename: { type: String, required: true },
  students_count: { type: Number, required: true },
  uploaded_at: { type: Date, default: Date.now }
});

const UploadHistory = mongoose.model('UploadHistory', uploadHistorySchema);

const storage = multer.memoryStorage();
const upload = multer({ 
  storage: storage,
  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'text/csv',
      'application/vnd.ms-excel'
    ];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type'), false);
    }
  }
});

// **FIX: Find and serve static files from possible locations**
const possibleStaticDirs = [
  path.join(__dirname, 'dist'),
  path.join(__dirname, 'frontend', 'dist'),
  path.join(__dirname, 'build'),
  path.join(__dirname, 'frontend', 'build'),
  path.join(__dirname, 'client', 'dist'),
  path.join(__dirname, 'client', 'build')
];

let staticDir = null;

for (const dir of possibleStaticDirs) {
  if (fs.existsSync(dir) && fs.existsSync(path.join(dir, 'index.html'))) {
    staticDir = dir;
    console.log('Serving static files from:', staticDir);
    app.use(express.static(staticDir));
    break;
  }
}

if (!staticDir) {
  console.log('No static files found. Running in API-only mode.');
}

// **FIX: API Routes first**
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'Server is running',
    mongodb: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected'
  });
});

app.post('/api/upload', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

    const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const jsonData = XLSX.utils.sheet_to_json(worksheet);

    const students = jsonData.map(row => {
      const percentage = (row.Marks_Obtained / row.Total_Marks) * 100;
      return {
        student_id: row.Student_ID.toString(),
        student_name: row.Student_Name.toString(),
        total_marks: row.Total_Marks,
        marks_obtained: row.Marks_Obtained,
        percentage: parseFloat(percentage.toFixed(2))
      };
    });

    await Student.deleteMany({});
    await Student.insertMany(students);
    await UploadHistory.create({
      filename: req.file.originalname,
      students_count: students.length
    });

    res.json({ message: 'File processed successfully', studentsCount: students.length });
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/students', async (req, res) => {
  try {
    const students = await Student.find().sort({ created_at: -1 });
    res.json(students);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch students' });
  }
});

app.get('/api/upload-history', async (req, res) => {
  try {
    const history = await UploadHistory.find().sort({ uploaded_at: -1 }).limit(10);
    res.json(history);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch upload history' });
  }
});

// **FIX: Serve React app only if static files exist**
app.get('*', (req, res) => {
  if (staticDir) {
    res.sendFile(path.join(staticDir, 'index.html'));
  } else {
    res.json({ 
      message: 'Student Grades API Server (Frontend not built)',
      endpoints: {
        health: '/api/health',
        upload: '/api/upload (POST)',
        students: '/api/students',
        history: '/api/upload-history'
      },
      note: 'Build the frontend to see the UI'
    });
  }
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
});