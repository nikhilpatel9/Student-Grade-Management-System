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

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = 'uploads/';
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + '-' + file.originalname);
  }
});

const upload = multer({ 
  storage: storage,
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
        file.mimetype === 'text/csv') {
      cb(null, true);
    } else {
      cb(new Error('Only .xlsx and .csv files are allowed!'), false);
    }
  }
});

// Routes

// Health check - should be first
app.get('/api/health', (req, res) => {
  res.json({ status: 'Server is running', timestamp: new Date().toISOString() });
});

// Upload Excel file
app.post('/api/upload', upload.single('file'), async (req, res) => {
  try {
    console.log('Upload attempt started');
    
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const filePath = req.file.path;
    let students = [];

    if (req.file.mimetype === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet') {
      // Process Excel file
      const workbook = XLSX.readFile(filePath);
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const jsonData = XLSX.utils.sheet_to_json(worksheet);

      students = jsonData.map(row => {
        const percentage = (row.Marks_Obtained / row.Total_Marks) * 100;
        return {
          student_id: row.Student_ID,
          student_name: row.Student_Name,
          total_marks: row.Total_Marks,
          marks_obtained: row.Marks_Obtained,
          percentage: parseFloat(percentage.toFixed(2))
        };
      });
    } else if (req.file.mimetype === 'text/csv') {
      // Process CSV file
      const workbook = XLSX.readFile(filePath);
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const jsonData = XLSX.utils.sheet_to_json(worksheet);

      students = jsonData.map(row => {
        const percentage = (row.Marks_Obtained / row.Total_Marks) * 100;
        return {
          student_id: row.Student_ID,
          student_name: row.Student_Name,
          total_marks: row.Total_Marks,
          marks_obtained: row.Marks_Obtained,
          percentage: parseFloat(percentage.toFixed(2))
        };
      });
    }

    // Save students to database (replace existing data)
    await Student.deleteMany({});
    await Student.insertMany(students);

    // Save upload history
    const uploadRecord = new UploadHistory({
      filename: req.file.originalname,
      students_count: students.length
    });
    await uploadRecord.save();

    // Clean up uploaded file
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    res.json({ 
      message: 'File uploaded and processed successfully',
      studentsCount: students.length 
    });

  } catch (error) {
    console.error('Upload error:', error);
    
    // Clean up file if it exists
    if (req.file && req.file.path && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    
    res.status(500).json({ error: 'Failed to process file: ' + error.message });
  }
});

// Get all students
app.get('/api/students', async (req, res) => {
  try {
    const students = await Student.find().sort({ created_at: -1 });
    res.json(students);
  } catch (error) {
    console.error('Get students error:', error);
    res.status(500).json({ error: 'Failed to fetch students' });
  }
});

// Update student
app.put('/api/students/:id', async (req, res) => {
  try {
    const { student_name, total_marks, marks_obtained } = req.body;
    const percentage = (marks_obtained / total_marks) * 100;

    const updatedStudent = await Student.findByIdAndUpdate(
      req.params.id,
      {
        student_name,
        total_marks,
        marks_obtained,
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

// Get upload history
app.get('/api/upload-history', async (req, res) => {
  try {
    const history = await UploadHistory.find().sort({ uploaded_at: -1 }).limit(10);
    res.json(history);
  } catch (error) {
    console.error('Get upload history error:', error);
    res.status(500).json({ error: 'Failed to fetch upload history' });
  }
});

// Serve static React build (only if frontend exists)
const frontendPath = path.join(__dirname, 'frontend', 'dist');
if (fs.existsSync(frontendPath)) {
  app.use(express.static(frontendPath));
  
  // React Router fallback (for SPA) - FIXED ROUTE
  app.get('*', (req, res) => {
    const indexPath = path.join(frontendPath, 'index.html');
    if (fs.existsSync(indexPath)) {
      res.sendFile(indexPath);
    } else {
      res.status(404).json({ error: 'Frontend not found' });
    }
  });
} else {
  // If no frontend, just serve API info
  app.get('/', (req, res) => {
    res.json({ 
      message: 'Student Grades API is running',
      endpoints: {
        health: '/api/health',
        students: '/api/students',
        upload: '/api/upload',
        uploadHistory: '/api/upload-history'
      }
    });
  });
}

// Error handling middleware
app.use((error, req, res, next) => {
  console.error('Unhandled error:', error);
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
});