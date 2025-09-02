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

// MongoDB connection - Handle various environment variable names
const MONGODB_URI = process.env.MONGODB_URI || 
                    process.env.MONGODB_URL || 
                    process.env.MONGO_URL ||
                    'mongodb://localhost:27017/student-grades';

console.log('MongoDB URI:', MONGODB_URI ? 'Found' : 'Not found');

mongoose.connect(MONGODB_URI)
  .then(() => console.log('Connected to MongoDB'))
  .catch(err => {
    console.error('MongoDB connection error:', err);
    // Don't exit, just log the error for Railway
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

// Use memory storage for Railway (no file system access needed)
const storage = multer.memoryStorage();
const upload = multer({ 
  storage: storage,
  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'text/csv',
      'application/vnd.ms-excel',
      'application/csv',
      'text/x-csv'
    ];
    
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Please upload Excel or CSV files.'), false);
    }
  },
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  }
});

// Serve static files from React build
const staticDir = path.join(__dirname, 'dist');
if (fs.existsSync(staticDir)) {
  app.use(express.static(staticDir));
  console.log('Serving static files from:', staticDir);
} else {
  console.log('Static directory not found, API-only mode');
}

// Routes

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'Server is running',
    mongodb: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
    timestamp: new Date().toISOString()
  });
});

// Upload Excel file
app.post('/api/upload', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    console.log('File received:', req.file.originalname, req.file.size, 'bytes');

    let students = [];
    let workbook;
    
    try {
      // Process file from memory buffer
      workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const jsonData = XLSX.utils.sheet_to_json(worksheet);

      console.log('Rows processed:', jsonData.length);

      // Validate and process data
      students = jsonData.map((row, index) => {
        // Check for required fields
        const requiredFields = ['Student_ID', 'Student_Name', 'Total_Marks', 'Marks_Obtained'];
        const missingFields = requiredFields.filter(field => !(field in row));
        
        if (missingFields.length > 0) {
          throw new Error(`Missing fields in row ${index + 1}: ${missingFields.join(', ')}`);
        }

        const totalMarks = Number(row.Total_Marks);
        const marksObtained = Number(row.Marks_Obtained);
        
        if (isNaN(totalMarks) || isNaN(marksObtained)) {
          throw new Error(`Invalid numbers in row ${index + 1}`);
        }

        if (marksObtained > totalMarks) {
          throw new Error(`Marks obtained > total marks in row ${index + 1}`);
        }

        const percentage = (marksObtained / totalMarks) * 100;
        
        return {
          student_id: String(row.Student_ID),
          student_name: String(row.Student_Name),
          total_marks: totalMarks,
          marks_obtained: marksObtained,
          percentage: parseFloat(percentage.toFixed(2))
        };
      });

    } catch (parseError) {
      console.error('File parsing error:', parseError);
      return res.status(400).json({ error: parseError.message });
    }

    // Save to database
    try {
      await Student.deleteMany({});
      const result = await Student.insertMany(students);

      // Save upload history
      await UploadHistory.create({
        filename: req.file.originalname,
        students_count: students.length
      });

      res.json({ 
        message: 'File processed successfully',
        studentsCount: students.length,
        insertedCount: result.length
      });

    } catch (dbError) {
      console.error('Database error:', dbError);
      res.status(500).json({ error: 'Database error: ' + dbError.message });
    }

  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get all students
app.get('/api/students', async (req, res) => {
  try {
    const students = await Student.find().sort({ created_at: -1 });
    res.json(students);
  } catch (error) {
    console.error('Fetch students error:', error);
    res.status(500).json({ error: 'Failed to fetch students' });
  }
});

// Get upload history
app.get('/api/upload-history', async (req, res) => {
  try {
    const history = await UploadHistory.find().sort({ uploaded_at: -1 }).limit(10);
    res.json(history);
  } catch (error) {
    console.error('Fetch history error:', error);
    res.status(500).json({ error: 'Failed to fetch upload history' });
  }
});

// Update student
app.put('/api/students/:id', async (req, res) => {
  try {
    const { student_name, total_marks, marks_obtained } = req.body;
    
    if (marks_obtained > total_marks) {
      return res.status(400).json({ error: 'Marks obtained cannot exceed total marks' });
    }

    const percentage = (marks_obtained / total_marks) * 100;

    const updatedStudent = await Student.findByIdAndUpdate(
      req.params.id,
      {
        student_name,
        total_marks,
        marks_obtained,
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
app.delete('/api/students/:id', async (req, res) => {
  try {
    const deletedStudent = await Student.findByIdAndDelete(req.params.id);
    if (!deletedStudent) {
      return res.status(404).json({ error: 'Student not found' });
    }
    res.json({ message: 'Student deleted successfully' });
  } catch (error) {
    console.error('Delete student error:', error);
    res.status(500).json({ error: 'Failed to delete student' });
  }
});

// Serve React app (if built files exist)
app.get('*', (req, res) => {
  const indexPath = path.join(__dirname, 'dist', 'index.html');
  if (fs.existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    res.json({ 
      message: 'Student Grades API Server',
      endpoints: {
        health: '/api/health',
        upload: '/api/upload (POST)',
        students: '/api/students',
        history: '/api/upload-history'
      }
    });
  }
});

// Error handling middleware
app.use((error, req, res, next) => {
  console.error('Unhandled error:', error);
  res.status(500).json({ error: 'Internal server error' });
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/api/health`);
});