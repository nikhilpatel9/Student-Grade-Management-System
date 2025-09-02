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

// Configure multer for file uploads with memory storage
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
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  }
});

// API Routes ONLY - NO CATCH-ALL ROUTES

// Root route
app.get('/', (req, res) => {
  res.json({ 
    message: 'Student Grades API is running',
    version: '1.0.0',
    endpoints: {
      health: '/api/health',
      students: '/api/students',
      upload: '/api/upload',
      uploadHistory: '/api/upload-history',
      updateStudent: '/api/students/update',
      deleteStudent: '/api/students/delete',
      stats: '/api/stats'
    }
  });
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'Server is running', 
    timestamp: new Date().toISOString(),
    mongodb: mongoose.connection.readyState === 1 ? 'Connected' : 'Disconnected'
  });
});

// Upload Excel/CSV file
app.post('/api/upload', upload.single('file'), async (req, res) => {
  try {
    console.log('Upload attempt started');
    
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    console.log('File received:', req.file.originalname, 'Size:', req.file.size);

    let students = [];
    let workbook;

    try {
      // Read the file from memory buffer
      workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
    } catch (parseError) {
      console.error('File parsing error:', parseError);
      return res.status(400).json({ error: 'Invalid file format. Please upload a valid Excel or CSV file.' });
    }

    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const jsonData = XLSX.utils.sheet_to_json(worksheet);

    console.log('Parsed data rows:', jsonData.length);

    if (jsonData.length === 0) {
      return res.status(400).json({ error: 'File is empty or contains no valid data' });
    }

    // Process the data
    students = jsonData.map((row, index) => {
      try {
        // Handle different possible column names
        const studentId = row.Student_ID || row.student_id || row.StudentID || row.ID;
        const studentName = row.Student_Name || row.student_name || row.StudentName || row.Name;
        const totalMarks = row.Total_Marks || row.total_marks || row.TotalMarks || row.MaxMarks;
        const marksObtained = row.Marks_Obtained || row.marks_obtained || row.MarksObtained || row.ObtainedMarks;

        if (!studentId || !studentName || totalMarks === undefined || marksObtained === undefined) {
          throw new Error(`Missing required data in row ${index + 1}`);
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
      } catch (rowError) {
        console.error(`Error processing row ${index + 1}:`, rowError);
        throw rowError;
      }
    });

    console.log('Processed students:', students.length);

    // Save students to database (replace existing data)
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
      error: 'Failed to process file: ' + error.message,
      details: 'Please ensure your file has columns: Student_ID, Student_Name, Total_Marks, Marks_Obtained'
    });
  }
});

// Get all students
app.get('/api/students', async (req, res) => {
  try {
    const students = await Student.find().sort({ created_at: -1 });
    res.json(students || []);
  } catch (error) {
    console.error('Get students error:', error);
    res.status(500).json({ error: 'Failed to fetch students' });
  }
});

// Update student
app.post('/api/students/update', async (req, res) => {
  try {
    const { id, student_name, total_marks, marks_obtained } = req.body;

    if (!id) {
      return res.status(400).json({ error: 'Student ID is required' });
    }

    if (!student_name || !total_marks || marks_obtained === undefined) {
      return res.status(400).json({ error: 'All fields are required' });
    }

    const total = parseFloat(total_marks);
    const obtained = parseFloat(marks_obtained);

    if (isNaN(total) || isNaN(obtained) || total <= 0) {
      return res.status(400).json({ error: 'Invalid marks data' });
    }

    const percentage = (obtained / total) * 100;

    const updatedStudent = await Student.findByIdAndUpdate(
      id,
      {
        student_name,
        total_marks: total,
        marks_obtained: obtained,
        percentage: parseFloat(percentage.toFixed(2))
      },
      { new: true, runValidators: true }
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

// Delete student
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
    
    res.json({ 
      message: 'Student deleted successfully',
      deletedStudent: {
        id: deletedStudent._id,
        name: deletedStudent.student_name
      }
    });
  } catch (error) {
    console.error('Delete student error:', error);
    res.status(500).json({ error: 'Failed to delete student' });
  }
});

// Get upload history
app.get('/api/upload-history', async (req, res) => {
  try {
    const history = await UploadHistory.find()
      .sort({ uploaded_at: -1 })
      .limit(10)
      .select('filename students_count uploaded_at');
    
    res.json(history || []);
  } catch (error) {
    console.error('Get upload history error:', error);
    res.status(500).json({ error: 'Failed to fetch upload history' });
  }
});

// Get student statistics
app.get('/api/stats', async (req, res) => {
  try {
    const totalStudents = await Student.countDocuments();
    const avgPercentage = await Student.aggregate([
      { $group: { _id: null, avgPercentage: { $avg: '$percentage' } } }
    ]);
    
    const passCount = await Student.countDocuments({ percentage: { $gte: 40 } });
    const failCount = totalStudents - passCount;

    const topPerformer = await Student.findOne().sort({ percentage: -1 }).limit(1);

    res.json({
      totalStudents,
      averagePercentage: avgPercentage.length > 0 ? parseFloat(avgPercentage[0].avgPercentage.toFixed(2)) : 0,
      passCount,
      failCount,
      passPercentage: totalStudents > 0 ? parseFloat(((passCount / totalStudents) * 100).toFixed(2)) : 0,
      topPerformer: topPerformer || null
    });
  } catch (error) {
    console.error('Get stats error:', error);
    res.status(500).json({ error: 'Failed to fetch statistics' });
  }
});

// REMOVED ALL CATCH-ALL AND WILDCARD ROUTES
// Only serve specific routes to avoid path-to-regexp issues

// Serve specific frontend routes manually if needed
const frontendPath = path.join(__dirname, 'frontend', 'dist');
if (fs.existsSync(frontendPath)) {
  console.log('Frontend found, serving static files');
  app.use(express.static(frontendPath));
  
  // Serve index.html for specific frontend routes only
  app.get('/dashboard', (req, res) => {
    const indexPath = path.join(frontendPath, 'index.html');
    if (fs.existsSync(indexPath)) {
      res.sendFile(indexPath);
    } else {
      res.status(404).json({ error: 'Frontend index.html not found' });
    }
  });
  
  app.get('/upload', (req, res) => {
    const indexPath = path.join(frontendPath, 'index.html');
    if (fs.existsSync(indexPath)) {
      res.sendFile(indexPath);
    } else {
      res.status(404).json({ error: 'Frontend index.html not found' });
    }
  });
  
  app.get('/students', (req, res) => {
    const indexPath = path.join(frontendPath, 'index.html');
    if (fs.existsSync(indexPath)) {
      res.sendFile(indexPath);
    } else {
      res.status(404).json({ error: 'Frontend index.html not found' });
    }
  });
} else {
  console.log('No frontend found, API only mode');
}

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

// Handle 404 for API routes only
app.use('/api', (req, res) => {
  res.status(404).json({ error: 'API endpoint not found' });
});

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('Received SIGINT. Graceful shutdown...');
  await mongoose.connection.close();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('Received SIGTERM. Graceful shutdown...');
  await mongoose.connection.close();
  process.exit(0);
});

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📱 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🔗 API Base URL: http://localhost:${PORT}/api`);
  console.log(`📊 Available endpoints:`);
  console.log(`   GET  / - API info`);
  console.log(`   GET  /api/health - Health check`);
  console.log(`   GET  /api/students - Get all students`);
  console.log(`   POST /api/upload - Upload Excel/CSV file`);
  console.log(`   POST /api/students/update - Update student`);
  console.log(`   POST /api/students/delete - Delete student`);
  console.log(`   GET  /api/upload-history - Get upload history`);
  console.log(`   GET  /api/stats - Get statistics`);
});