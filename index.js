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
const MONGODB_URI = process.env.MONGODB_URI;
console.log('MongoDB URI:', MONGODB_URI ? 'Set' : 'Not set');

if (!MONGODB_URI) {
  console.error('MONGODB_URI environment variable is not set');
  process.exit(1);
}

mongoose.connect(MONGODB_URI)
  .then(() => console.log('Connected to MongoDB'))
  .catch(err => {
    console.error('MongoDB connection error:', err);
    process.exit(1);
  });

// Student Schema
const studentSchema = new mongoose.Schema({
  student_id: { type: String, required: true, unique: true },
  student_name: { type: String, required: true },
  total_marks: { type: Number, required: true },
  marks_obtained: { type: Number, required: true },
  percentage: { type: Number, required: true },
  created_at: { type: Date, default: Date.now }
});

const Student = mongoose.model('Student', studentSchema);

// Upload History Schema
const uploadHistorySchema = new mongoose.Schema({
  filename: { type: String, required: true },
  students_count: { type: Number, required: true },
  uploaded_at: { type: Date, default: Date.now }
});

const UploadHistory = mongoose.model('UploadHistory', uploadHistorySchema);

// Configure multer for memory storage (better for cloud)
const upload = multer({
  storage: multer.memoryStorage(),
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
        file.mimetype === 'text/csv' ||
        file.mimetype === 'application/vnd.ms-excel') {
      cb(null, true);
    } else {
      cb(new Error('Only .xlsx, .xls and .csv files are allowed!'), false);
    }
  },
  limits: { fileSize: 10 * 1024 * 1024 }
});

// API Routes

app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'Server is running', 
    timestamp: new Date().toISOString(),
    mongodb: mongoose.connection.readyState === 1 ? 'Connected' : 'Disconnected'
  });
});

app.post('/api/upload', upload.single('file'), async (req, res) => {
  try {
    console.log('Upload attempt started');
    
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    console.log('File received:', req.file.originalname, 'Size:', req.file.size);

    let workbook;
    try {
      workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
    } catch (parseError) {
      console.error('File parsing error:', parseError);
      return res.status(400).json({ error: 'Invalid file format. Please upload a valid Excel or CSV file.' });
    }

    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const jsonData = XLSX.utils.sheet_to_json(worksheet);

    if (jsonData.length === 0) {
      return res.status(400).json({ error: 'File is empty or contains no valid data' });
    }

    const students = jsonData.map((row, index) => {
      const studentId = row.Student_ID || row.student_id || row.StudentID || row.ID;
      const studentName = row.Student_Name || row.student_name || row.StudentName || row.Name;
      const totalMarks = row.Total_Marks || row.total_marks || row.TotalMarks || row.MaxMarks;
      const marksObtained = row.Marks_Obtained || row.marks_obtained || row.MarksObtained || row.ObtainedMarks;

      if (!studentId || !studentName || totalMarks === undefined || marksObtained === undefined) {
        throw new Error(`Missing required data in row ${index + 1}. Required columns: Student_ID, Student_Name, Total_Marks, Marks_Obtained`);
      }

      const total = parseFloat(totalMarks);
      const obtained = parseFloat(marksObtained);

      if (isNaN(total) || isNaN(obtained) || total <= 0) {
        throw new Error(`Invalid marks data in row ${index + 1}`);
      }

      const percentage = (obtained / total) * 100;

      return {
        student_id: String(studentId),
        student_name: String(studentName),
        total_marks: total,
        marks_obtained: obtained,
        percentage: parseFloat(percentage.toFixed(2))
      };
    });

    // Save students to database
    await Student.deleteMany({});
    await Student.insertMany(students);

    // Save upload history
    const uploadRecord = new UploadHistory({
      filename: req.file.originalname,
      students_count: students.length
    });
    await uploadRecord.save();

    console.log('Data saved successfully');

    res.json({ 
      message: 'File uploaded and processed successfully',
      studentsCount: students.length,
      filename: req.file.originalname
    });

  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ 
      error: 'Failed to process file: ' + error.message
    });
  }
});

app.get('/api/students', async (req, res) => {
  try {
    const students = await Student.find().sort({ created_at: -1 });
    res.json(students);
  } catch (error) {
    console.error('Get students error:', error);
    res.status(500).json({ error: 'Failed to fetch students' });
  }
});

// Update student - using POST to avoid route parameter issues
app.post('/api/students/update', async (req, res) => {
  try {
    const { id, student_name, total_marks, marks_obtained } = req.body;

    if (!id || !student_name || !total_marks || marks_obtained === undefined) {
      return res.status(400).json({ error: 'All fields are required' });
    }

    const total = parseFloat(total_marks);
    const obtained = parseFloat(marks_obtained);
    const percentage = (obtained / total) * 100;

    const updatedStudent = await Student.findByIdAndUpdate(
      id,
      {
        student_name,
        total_marks: total,
        marks_obtained: obtained,
        percentage: parseFloat(percentage.toFixed(2))
      },
      { new: true }
    );

    if (!updatedStudent) {
      return res.status(404).json({ error: 'Student not found' });
    }

    res.json(updatedStudent);
  } catch (error) {
    console.error('Update student error:', error);
    res.status(500).json({ error: 'Failed to update student' });
  }
});

// Delete student - using POST to avoid route parameter issues  
app.post('/api/students/delete', async (req, res) => {
  try {
    const { id } = req.body;

    if (!id) {
      return res.status(400).json({ error: 'Student ID is required' });
    }

    const deletedStudent = await Student.findByIdAndDelete(id);
    
    if (!deletedStudent) {
      return res.status(404).json({ error: 'Student not found' });
    }
    
    res.json({ message: 'Student deleted successfully' });
  } catch (error) {
    console.error('Delete student error:', error);
    res.status(500).json({ error: 'Failed to delete student' });
  }
});

app.get('/api/upload-history', async (req, res) => {
  try {
    const history = await UploadHistory.find()
      .sort({ uploaded_at: -1 })
      .limit(10)
      .select('filename students_count uploaded_at');
    
    res.json(history);
  } catch (error) {
    console.error('Get upload history error:', error);
    res.status(500).json({ error: 'Failed to fetch upload history' });
  }
});

// Serve your existing frontend static files
const frontendPath = path.join(__dirname, 'frontend', 'dist');

if (fs.existsSync(frontendPath)) {
  console.log('Frontend found, serving static files from:', frontendPath);
  
  // Serve static files
  app.use(express.static(frontendPath, {
    maxAge: '1d',
    etag: false
  }));
  
  // Handle all non-API routes by serving index.html (for React Router)
  app.get('*', (req, res, next) => {
    // Skip API routes
    if (req.path.startsWith('/api/')) {
      return next();
    }
    
    const indexPath = path.join(frontendPath, 'index.html');
    if (fs.existsSync(indexPath)) {
      res.sendFile(indexPath);
    } else {
      res.status(404).send('Frontend not found');
    }
  });
  
} else {
  console.log('No frontend found at:', frontendPath);
  
  // Fallback route for API-only mode
  app.get('/', (req, res) => {
    res.json({ 
      message: 'Student Grades API is running',
      endpoints: [
        'GET /api/health',
        'GET /api/students', 
        'POST /api/upload',
        'POST /api/students/update',
        'POST /api/students/delete',
        'GET /api/upload-history'
      ]
    });
  });
}

// 404 handler for API routes
app.use('/api/*', (req, res) => {
  res.status(404).json({ error: 'API endpoint not found' });
});

// Global error handler
app.use((error, req, res, next) => {
  console.error('Unhandled error:', error);
  
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ error: 'File too large. Maximum size is 10MB.' });
    }
    return res.status(400).json({ error: 'File upload error: ' + error.message });
  }
  
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📱 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🔗 Health check: http://localhost:${PORT}/api/health`);
});